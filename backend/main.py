"""
main.py  —  OmniVoice TTS API Server
────────────────────────────────────
Khởi chạy:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Swagger UI:
    http://localhost:8000/docs
"""

import os
import json
import logging
import uuid
import hashlib
import shutil
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from model_handler import (
    load_model,
    generate_audio,
    create_voice_prompt,
    VoiceClonePrompt,
    SAMPLE_RATE,
)

# ─── Environment & Logging ──────────────────────────────────────────────────
load_dotenv()
DEFAULT_NUM_STEP = int(os.getenv("DEFAULT_NUM_STEP", "32"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)
PRESETS_DIR = BASE_DIR / "presets"
PRESETS_DIR.mkdir(exist_ok=True)
CUSTOM_VOICES_DIR = PRESETS_DIR / "custom"
CUSTOM_VOICES_DIR.mkdir(exist_ok=True)
CUSTOM_VOICES_JSON = PRESETS_DIR / "custom_voices.json"
if not CUSTOM_VOICES_JSON.exists():
    with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
        f.write("[]")


# ─── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load mô hình OmniVoice trước khi nhận request đầu tiên."""
    logger.info("🚀 Server đang khởi động — nạp mô hình OmniVoice (24kHz) …")
    load_model()
    yield
    logger.info("🛑 Server đang tắt.")


# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="OmniVoice TTS API",
    description=(
        "Text-to-Speech đa ngôn ngữ chất lượng cao 24kHz sử dụng OmniVoice (k2-fsa). "
        "Hỗ trợ Voice Cloning (kèm cache .pt), Voice Design bằng câu lệnh, và các thẻ biểu cảm phi ngôn ngữ."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static Files ─────────────────────────────────────────────────────────────
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
app.mount("/presets", StaticFiles(directory=str(PRESETS_DIR)), name="presets")


# ─── Request / Response Schemas ──────────────────────────────────────────────
class TTSRequest(BaseModel):
    """Payload cho endpoint POST /api/tts"""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Văn bản cần tổng hợp giọng nói (tối đa 5000 ký tự, hỗ trợ thẻ phi ngôn ngữ như [laughter]).",
        examples=["Xin chào! [laughter] Rất vui được gặp bạn."],
    )
    mode: str = Field(
        default="clone",
        description="Chế độ tổng hợp: 'clone' (sao chép giọng), 'design' (thiết kế giọng qua instruct).",
    )
    instruct: str | None = Field(
        default=None,
        description="Câu lệnh mô tả thuộc tính giọng nói cho chế độ Voice Design (vd: 'female, whisper, gentle').",
    )
    cfg_value: float = Field(
        default=2.0,
        ge=1.0,
        le=3.0,
        description="Guidance scale (1.0 - 3.0). Mặc định 2.0.",
    )
    num_step: int | None = Field(
        default=None,
        ge=4,
        le=100,
        description="Số bước khử nhiễu Diffusion (4-100). Nếu để trống, tự động lấy theo DEFAULT_NUM_STEP trong .env.",
    )
    inference_timesteps: int | None = Field(
        default=None,
        description="Tương thích ngược với tham số cũ (sẽ ghi đè num_step nếu được truyền).",
    )
    normalize: bool = Field(
        default=False,
        description="Bật chuẩn hóa văn bản số, ngày tháng.",
    )
    voice_id: str | None = Field(
        default=None,
        description="ID giọng mẫu (preset hoặc custom).",
    )
    prompt_wav_path: str | None = Field(
        default=None,
        description="(Tùy chọn) Đường dẫn file WAV tham chiếu để clone giọng.",
    )
    prompt_text: str | None = Field(
        default=None,
        description="(Tùy chọn) Transcript của prompt_wav_path (nếu để trống, Whisper sẽ tự bóc băng).",
    )
    seed: int | None = Field(
        default=42,
        description="Seed để cố định tính ngẫu nhiên.",
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Tốc độ đọc (0.5x - 2.0x).",
    )
    pitch: float = Field(
        default=0.0,
        ge=-12.0,
        le=12.0,
        description="Cao độ giọng (bán cung).",
    )
    format: str = Field(
        default="mp3",
        description="Định dạng âm thanh đầu ra: 'mp3' hoặc 'wav'.",
    )


class TTSResponse(BaseModel):
    message: str
    filename: str
    audio_url: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    sample_rate: int


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Kiểm tra trạng thái server",
    tags=["System"],
)
async def health_check():
    from model_handler import _model
    return HealthResponse(
        status="ok",
        model_loaded=(_model is not None),
        model_name="k2-fsa/OmniVoice",
        sample_rate=SAMPLE_RATE,
    )


@app.get(
    "/api/voices",
    summary="Lấy danh sách các giọng đọc mẫu",
    tags=["TTS"],
)
async def get_voices():
    voices_json = PRESETS_DIR / "voices.json"
    preset_voices = []
    if voices_json.exists():
        with open(voices_json, "r", encoding="utf-8") as f:
            preset_voices = json.load(f)
            for v in preset_voices:
                v["type"] = "preset"

    custom_voices = []
    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
            custom_voices = json.load(f)
            for v in custom_voices:
                v["type"] = "custom"

    return preset_voices + custom_voices


@app.post(
    "/api/voices/clone",
    summary="Clone giọng đọc từ file tải lên và tạo cache .pt",
    tags=["TTS"],
)
async def clone_voice(
    file: UploadFile = File(...),
    name: str = Form(...),
    transcript: str | None = Form(None),
    description: str = Form("Giọng tự tạo"),
    gender: str = Form("all"),
    icon: str = Form("record_voice_over"),
):
    import librosa
    import soundfile as sf

    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".webm", ".ogg")):
        raise HTTPException(
            status_code=400, detail="Chỉ hỗ trợ file wav, mp3, m4a, webm, ogg"
        )

    custom_id = f"custom_{uuid.uuid4().hex[:8]}"
    temp_path = BASE_DIR / f"temp_{custom_id}_{file.filename}"

    try:
        # 1. Lưu file tạm
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # 2. Resample về chuẩn 24,000 Hz của OmniVoice (tối đa 15 giây)
        y, sr = librosa.load(temp_path, sr=SAMPLE_RATE, duration=15.0)

        wav_path = CUSTOM_VOICES_DIR / f"{custom_id}.wav"
        sf.write(str(wav_path), y, sr)

        # 3. Tạo sẵn VoiceClonePrompt (.pt) để tăng tốc độ suy luận ở các lần gọi sau
        pt_path = CUSTOM_VOICES_DIR / f"{custom_id}.pt"
        has_pt = False
        try:
            prompt = create_voice_prompt(
                ref_audio=str(wav_path),
                ref_text=transcript if (transcript and transcript.strip()) else None,
            )
            prompt.save(str(pt_path))
            has_pt = True
            logger.info(f"✅ Đã tạo và lưu cache VoiceClonePrompt: {pt_path.name}")
        except Exception as pe:
            logger.warning(f"⚠️ Không thể tạo trước prompt .pt (sẽ tạo lại khi gọi tts): {pe}")

        # 4. Ghi metadata vào custom_voices.json
        custom_voices = []
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                custom_voices = json.load(f)

        new_voice = {
            "id": custom_id,
            "name": name,
            "gender": gender,
            "description": description,
            "icon": icon,
            "prompt_text": transcript or "",
            "url": f"http://localhost:8000/presets/custom/{custom_id}.wav",
            "has_prompt_pt": has_pt,
        }

        custom_voices.append(new_voice)
        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
            json.dump(custom_voices, f, ensure_ascii=False, indent=2)

        return {"message": "Tạo giọng đọc thành công!", "voice": new_voice}

    except Exception as e:
        logger.exception("Lỗi khi clone voice")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


@app.delete(
    "/api/voices/custom/{voice_id}",
    summary="Xoá giọng đọc tự tạo",
    tags=["TTS"],
)
async def delete_custom_voice(voice_id: str):
    if not voice_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Chỉ được phép xoá giọng tự tạo")

    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
            custom_voices = json.load(f)

        filtered_voices = [v for v in custom_voices if v["id"] != voice_id]

        if len(filtered_voices) < len(custom_voices):
            with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                json.dump(filtered_voices, f, ensure_ascii=False, indent=2)

            # Xoá cả file audio và file embedding .pt
            wav_path = CUSTOM_VOICES_DIR / f"{voice_id}.wav"
            wav_path.unlink(missing_ok=True)

            pt_path = CUSTOM_VOICES_DIR / f"{voice_id}.pt"
            pt_path.unlink(missing_ok=True)

            return {"message": "Đã xoá giọng đọc và bộ đệm thành công"}

    raise HTTPException(status_code=404, detail="Không tìm thấy giọng đọc")


# ─────────────────────────────────────────────────────────────────────────────
# Các tổ hợp ngẫu nhiên (tất cả đều hợp lệ với OmniVoice)
import random as _random

_RANDOM_GENDER = ["male", "female"]
_RANDOM_AGE = ["child", "teenager", "young adult", "middle-aged", "elderly"]
_RANDOM_PITCH = [
    "very low pitch", "low pitch", "moderate pitch", "high pitch", "very high pitch",
]
_RANDOM_STYLE = [None, None, None, "whisper"]  # whisper ít phổ biến hơn


@app.post(
    "/api/voices/random",
    summary="Tạo giọng ngẫu nhiên để xem trước (preview)",
    tags=["TTS"],
)
async def generate_random_voice(background_tasks: BackgroundTasks):
    """
    Sinh một đoạn audio ngắn (10 giây) với bộ thuộc tính giọng ngẫu nhiên.
    Trả về URL audio tạm và chuỗi instruct đã dùng.
    """
    import hashlib

    gender = _random.choice(_RANDOM_GENDER)
    age = _random.choice(_RANDOM_AGE)
    pitch = _random.choice(_RANDOM_PITCH)
    style = _random.choice(_RANDOM_STYLE)

    parts = [gender, age, pitch]
    if style:
        parts.append(style)
    instruct_str = ", ".join(parts)

    # Văn bản tiếng Việt trung tính để preview chất giọng
    preview_text = (
        "Xin chào, đây là giọng đọc thử nghiệm. "
        "Chất lượng giọng này được tổng hợp bởi OmniVoice hai mươi bốn kilohertz. "
        "Hy vọng bạn thích nó."
    )

    seed = _random.randint(0, 99999)
    cache_str = f"random_{instruct_str}_{seed}"
    file_hash = hashlib.md5(cache_str.encode()).hexdigest()
    filename = f"random_preview_{file_hash}.mp3"
    output_path = OUTPUTS_DIR / filename

    try:
        generate_audio(
            text=preview_text,
            output_path=output_path,
            mode="design",
            instruct=instruct_str,
            cfg_value=2.0,
            num_step=int(os.getenv("DEFAULT_NUM_STEP", "32")),
            seed=seed,
            speed=1.0,
            pitch=0.0,
            audio_format="mp3",
        )
    except Exception as e:
        logger.exception("Lỗi khi sinh giọng ngẫu nhiên")
        raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(_cleanup_old_files)

    return {
        "message": "Tạo giọng ngẫu nhiên thành công!",
        "audio_url": f"http://localhost:8000/outputs/{filename}",
        "filename": filename,
        "instruct": instruct_str,
        "gender": gender,
        "age": age,
        "pitch": pitch,
        "style": style or "normal",
        "seed": seed,
    }


@app.post(
    "/api/voices/save-random",
    summary="Lưu giọng ngẫu nhiên vừa preview thành custom voice",
    tags=["TTS"],
)
async def save_random_voice(
    name: str = Form(...),
    description: str = Form("Giọng ngẫu nhiên"),
    gender: str = Form("all"),
    icon: str = Form("casino"),
    filename: str = Form(...),
    instruct: str = Form(""),
):
    """
    Chuyển file audio preview ngẫu nhiên thành custom voice chính thức.
    Trích xuất VoiceClonePrompt (.pt) từ audio vừa sinh để dùng lại sau.
    """
    import soundfile as sf

    src_path = OUTPUTS_DIR / filename
    if not src_path.exists():
        raise HTTPException(
            status_code=404,
            detail="File preview không còn tồn tại. Hãy tạo lại giọng ngẫu nhiên.",
        )

    custom_id = f"custom_{uuid.uuid4().hex[:8]}"
    wav_path = CUSTOM_VOICES_DIR / f"{custom_id}.wav"
    pt_path = CUSTOM_VOICES_DIR / f"{custom_id}.pt"

    try:
        import librosa
        y, sr_loaded = librosa.load(str(src_path), sr=SAMPLE_RATE, duration=15.0)
        sf.write(str(wav_path), y, sr_loaded)

        has_pt = False
        try:
            prompt = create_voice_prompt(ref_audio=str(wav_path), ref_text=None)
            prompt.save(str(pt_path))
            has_pt = True
            logger.info(f"✅ Đã tạo VoiceClonePrompt từ giọng random: {pt_path.name}")
        except Exception as pe:
            logger.warning(f"⚠️ Không thể tạo .pt cho giọng random: {pe}")

        # Ghi metadata
        custom_voices_list = []
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                custom_voices_list = json.load(f)

        new_voice = {
            "id": custom_id,
            "name": name,
            "gender": gender,
            "description": description,
            "icon": icon,
            "prompt_text": "",
            "instruct_used": instruct,
            "url": f"http://localhost:8000/presets/custom/{custom_id}.wav",
            "has_prompt_pt": has_pt,
        }

        custom_voices_list.append(new_voice)
        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
            json.dump(custom_voices_list, f, ensure_ascii=False, indent=2)

        logger.info(f"💾 Đã lưu giọng random: {custom_id} — {name}")
        return {"message": "Lưu giọng thành công!", "voice": new_voice}

    except Exception as e:
        logger.exception("Lỗi khi lưu giọng random")
        raise HTTPException(status_code=500, detail=str(e))


def _cleanup_old_files(keep_latest: int = 200) -> None:
    """Dọn dẹp outputs/ nếu vượt quá keep_latest file."""
    files = list(OUTPUTS_DIR.glob("*.wav")) + list(OUTPUTS_DIR.glob("*.mp3"))
    files = sorted(files, key=lambda f: f.stat().st_mtime)
    for old_file in files[:-keep_latest]:
        old_file.unlink(missing_ok=True)
        logger.info(f"🗑️ Đã xóa file cũ: {old_file.name}")


@app.post(
    "/api/tts",
    response_model=TTSResponse,
    summary="Tổng hợp giọng nói từ văn bản",
    tags=["TTS"],
)
async def text_to_speech(
    request: TTSRequest,
    background_tasks: BackgroundTasks,
):
    """
    ## Tổng hợp giọng nói với OmniVoice 24kHz
    Hỗ trợ 2 chế độ:
    - `clone`: Sao chép giọng mẫu hoặc giọng cá nhân (sử dụng cache .pt nếu có).
    - `design`: Thiết kế giọng qua lệnh `instruct` (tự động neo giọng xuyên suốt các câu).
    """
    env_step = int(os.getenv("DEFAULT_NUM_STEP", str(DEFAULT_NUM_STEP)))
    steps = request.inference_timesteps or request.num_step or env_step

    # Tạo Cache Key
    cache_str = (
        f"{request.text}_{request.mode}_{request.instruct}_{request.voice_id}_"
        f"{request.cfg_value}_{steps}_{request.seed}_{request.speed}_{request.pitch}_{request.format}"
    )
    file_hash = hashlib.md5(cache_str.encode("utf-8")).hexdigest()

    ext = ".mp3" if request.format == "mp3" else ".wav"
    filename = f"tts_{file_hash}{ext}"
    output_path = OUTPUTS_DIR / filename

    if output_path.exists():
        logger.info(f"⚡ CACHE HIT: Tái sử dụng {filename}")
        output_path.touch()
        return TTSResponse(
            message="Tổng hợp thành công (Cache Hit)!",
            filename=filename,
            audio_url=f"http://localhost:8000/outputs/{filename}",
        )

    logger.info(f"⏳ CACHE MISS: Bắt đầu sinh mới {filename}")

    voice_clone_prompt = None
    ref_audio = request.prompt_wav_path
    ref_text = request.prompt_text

    # Xử lý chế độ clone
    if request.mode == "clone":
        if request.voice_id:
            # 1. Kiểm tra cache file .pt trước tiên
            custom_pt = CUSTOM_VOICES_DIR / f"{request.voice_id}.pt"
            preset_pt = PRESETS_DIR / f"{request.voice_id}.pt"

            if custom_pt.exists():
                try:
                    voice_clone_prompt = VoiceClonePrompt.load(str(custom_pt))
                    logger.info(f"⚡ Đã nạp cache VoiceClonePrompt từ: {custom_pt.name}")
                except Exception as e:
                    logger.warning(f"Không thể nạp prompt .pt: {e}")

            elif preset_pt.exists():
                try:
                    voice_clone_prompt = VoiceClonePrompt.load(str(preset_pt))
                    logger.info(f"⚡ Đã nạp cache VoiceClonePrompt preset từ: {preset_pt.name}")
                except Exception as e:
                    logger.warning(f"Không thể nạp prompt .pt preset: {e}")

            # 2. Nếu chưa có prompt .pt, tìm file .wav tương ứng
            if voice_clone_prompt is None:
                voices_json = PRESETS_DIR / "voices.json"
                all_voices = []
                if voices_json.exists():
                    with open(voices_json, "r", encoding="utf-8") as f:
                        all_voices.extend(json.load(f))
                if CUSTOM_VOICES_JSON.exists():
                    with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                        all_voices.extend(json.load(f))

                for v in all_voices:
                    if v["id"] == request.voice_id:
                        if request.voice_id.startswith("custom_"):
                            wav_candidate = CUSTOM_VOICES_DIR / f"{v['id']}.wav"
                        else:
                            wav_candidate = PRESETS_DIR / f"{v['id']}.wav"

                        if wav_candidate.exists():
                            ref_audio = str(wav_candidate)
                            ref_text = v.get("prompt_text")

                            # Tự động tạo và lưu cache .pt cho lần gọi tiếp theo
                            try:
                                prompt_save_path = (
                                    CUSTOM_VOICES_DIR / f"{v['id']}.pt"
                                    if request.voice_id.startswith("custom_")
                                    else PRESETS_DIR / f"{v['id']}.pt"
                                )
                                voice_clone_prompt = create_voice_prompt(
                                    ref_audio=ref_audio,
                                    ref_text=ref_text,
                                )
                                voice_clone_prompt.save(str(prompt_save_path))
                                logger.info(f"✨ Đã tự động tạo và lưu cache {prompt_save_path.name}")
                            except Exception as pe:
                                logger.warning(f"Không thể tạo trước cache prompt: {pe}")
                        break

    try:
        generate_audio(
            text=request.text,
            output_path=output_path,
            mode=request.mode,
            voice_clone_prompt=voice_clone_prompt,
            ref_audio=ref_audio,
            ref_text=ref_text,
            instruct=request.instruct,
            cfg_value=request.cfg_value,
            num_step=steps,
            seed=request.seed,
            speed=request.speed,
            pitch=request.pitch,
            audio_format=request.format,
        )
    except Exception as exc:
        logger.exception("❌ Lỗi khi tổng hợp giọng nói")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi tổng hợp: {str(exc)}",
        ) from exc

    background_tasks.add_task(_cleanup_old_files)

    return TTSResponse(
        message="Tổng hợp thành công!",
        filename=filename,
        audio_url=f"http://localhost:8000/outputs/{filename}",
    )


@app.delete("/api/tts/{filename}")
async def delete_audio(filename: str):
    """Xóa một file âm thanh đã tổng hợp."""
    safe_filename = os.path.basename(filename)
    file_path = OUTPUTS_DIR / safe_filename

    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            logger.info(f"🗑️ Đã xóa file theo yêu cầu: {safe_filename}")
            return {"message": "Đã xóa file thành công"}
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {safe_filename}: {e}")
            raise HTTPException(status_code=500, detail="Không thể xóa file")

    return {"message": "File không tồn tại hoặc đã bị xóa trước đó"}
