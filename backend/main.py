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
import subprocess
from typing import Any
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.responses import FileResponse
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
from caption_handler import (
    extract_audio,
    transcribe_video_audio,
    align_words_with_reference,
    resegment_words,
    generate_ass_subtitles,
    render_video_with_captions,
    trim_video_by_ranges,
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
CAPTIONS_DIR = OUTPUTS_DIR / "captions"
CAPTIONS_DIR.mkdir(exist_ok=True)
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
    "/api/download/{filename}",
    summary="Tải trực tiếp file âm thanh từ hệ thống",
    tags=["TTS"],
)
async def download_file(filename: str):
    file_path = OUTPUTS_DIR / filename
    if not file_path.exists():
        custom_path = CUSTOM_VOICES_DIR / filename
        if custom_path.exists():
            file_path = custom_path
        else:
            raise HTTPException(status_code=404, detail="File âm thanh không tồn tại hoặc đã bị xóa.")

    media_type = "audio/mpeg" if filename.lower().endswith(".mp3") else "audio/wav"
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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


@app.delete(
    "/api/voices/discard-random/{filename}",
    summary="Xoá file preview giọng ngẫu nhiên khi người dùng huỷ hoặc không lưu",
    tags=["TTS"],
)
async def discard_random_voice(filename: str):
    """
    Xoá ngay file audio preview ngẫu nhiên trong outputs/ khi người dùng bỏ qua hoặc không lưu.
    Chỉ cho phép xoá các file có tiền tố 'random_preview_'.
    """
    safe_filename = Path(filename).name
    if not safe_filename.startswith("random_preview_"):
        raise HTTPException(
            status_code=400,
            detail="Chỉ được phép xoá file preview ngẫu nhiên (random_preview_*)",
        )

    file_path = OUTPUTS_DIR / safe_filename
    if file_path.exists():
        file_path.unlink(missing_ok=True)
        logger.info(f"🗑️ Đã xoá file preview ngẫu nhiên bị huỷ: {safe_filename}")
        return {"message": f"Đã xoá file preview {safe_filename}"}

    return {"message": "File không tồn tại hoặc đã được xoá trước đó"}


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
    Sau khi lưu thành công, file preview tạm trong outputs/ sẽ được xoá để tránh rác đệm.
    """
    import soundfile as sf

    src_path = OUTPUTS_DIR / Path(filename).name
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

        # Xoá file preview tạm trong outputs/ sau khi đã lưu thành công vào presets/custom/
        src_path.unlink(missing_ok=True)
        logger.info(f"💾 Đã lưu giọng random: {custom_id} — {name} và dọn dẹp file tạm {src_path.name}")
        return {"message": "Lưu giọng thành công!", "voice": new_voice}

    except Exception as e:
        logger.exception("Lỗi khi lưu giọng random")
        raise HTTPException(status_code=500, detail=str(e))


def _cleanup_old_files(keep_latest: int = 200) -> None:
    """
    Dọn dẹp outputs/:
    - Xoá các file preview ngẫu nhiên 'random_preview_*' không được lưu.
    - Xoá các file TTS cũ nếu vượt quá keep_latest.
    """
    import time
    now = time.time()

    # Dọn sạch các file preview ngẫu nhiên chưa lưu có tuổi thọ > 10 phút
    for p in list(OUTPUTS_DIR.glob("random_preview_*")):
        try:
            if now - p.stat().st_mtime > 600:  # 10 phút
                p.unlink(missing_ok=True)
                logger.info(f"🗑️ Tự động dọn dẹp file preview ngẫu nhiên hết hạn: {p.name}")
        except Exception:
            pass

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
    """Xóa một file âm thanh đã tổng hợp và file phụ đề đi kèm nếu có."""
    safe_filename = os.path.basename(filename)
    file_path = OUTPUTS_DIR / safe_filename

    deleted = False
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            deleted = True
            logger.info(f"🗑️ Đã xóa file theo yêu cầu: {safe_filename}")
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {safe_filename}: {e}")
            raise HTTPException(status_code=500, detail="Không thể xóa file")

    # Xóa kèm file phụ đề tương ứng nếu có
    srt_candidate = file_path.with_suffix(".srt")
    if srt_candidate.exists() and srt_candidate.is_file():
        srt_candidate.unlink(missing_ok=True)
        deleted = True

    if deleted:
        return {"message": "Đã xóa file thành công"}

    return {"message": "File không tồn tại hoặc đã bị xóa trước đó"}


# ─── Garbage Collection & Orphan Files Cleanup ───────────────────────────────

class CleanupOrphansRequest(BaseModel):
    active_filenames: list[str] = Field(
        default_factory=list,
        description="Danh sách các filename đang được sử dụng trong projects và history",
    )
    max_age_minutes: int = Field(
        default=15,
        description="Chỉ xoá file rác có tuổi thọ lớn hơn số phút này",
    )
    force: bool = Field(
        default=False,
        description="Xoá tất cả file rác không dùng ngay lập tức (không cần đợi hết hạn)",
    )


class CleanupOrphansResponse(BaseModel):
    message: str
    deleted_count: int
    freed_bytes: int
    freed_mb: float


@app.post(
    "/api/tts/cleanup-orphans",
    response_model=CleanupOrphansResponse,
    summary="Dọn dẹp các file âm thanh và phụ đề rác không còn được sử dụng",
    tags=["TTS"],
)
async def cleanup_orphans(request: CleanupOrphansRequest):
    """
    Quét thư mục outputs/ và xoá các file âm thanh/phụ đề mồ côi (không thuộc bất kỳ dự án hay lịch sử nào).
    """
    import time
    now = time.time()

    # Chuẩn hóa tập hợp các file active để tìm kiếm O(1)
    active_set = {os.path.basename(f) for f in request.active_filenames if f}

    # Luôn bảo vệ các file hệ thống cố định
    protected_files = {"demo_voice.wav", ".gitkeep"}

    deleted_count = 0
    freed_bytes = 0

    for p in OUTPUTS_DIR.iterdir():
        if not p.is_file() or p.name in protected_files:
            continue

        # Chỉ xử lý các file âm thanh và subtitle do hệ thống sinh ra
        if not p.name.lower().endswith((".mp3", ".wav", ".srt", ".ass", ".vtt")):
            continue

        # Nếu file không nằm trong danh sách đang được sử dụng
        if p.name not in active_set:
            file_age_sec = now - p.stat().st_mtime
            min_age_sec = request.max_age_minutes * 60

            # Xoá nếu force=True hoặc file đã cũ hơn max_age_minutes
            if request.force or file_age_sec >= min_age_sec:
                try:
                    f_size = p.stat().st_size
                    p.unlink(missing_ok=True)
                    deleted_count += 1
                    freed_bytes += f_size
                    logger.info(f"🗑️ Đã dọn dẹp file rác: {p.name} ({f_size / 1024:.1f} KB)")
                except Exception as e:
                    logger.warning(f"Không thể xoá file {p.name}: {e}")

    freed_mb = round(freed_bytes / (1024 * 1024), 2)
    return CleanupOrphansResponse(
        message=f"Đã dọn dẹp {deleted_count} file rác, giải phóng {freed_mb} MB.",
        deleted_count=deleted_count,
        freed_bytes=freed_bytes,
        freed_mb=freed_mb,
    )


# ─── Segment / Block-based TTS Stitching ──────────────────────────────────────

class StitchBlockItem(BaseModel):
    filename: str = Field(..., description="Tên file âm thanh trong outputs/ (vd: tts_abc.mp3)")
    pause_after: float = Field(default=0.5, ge=0.0, le=10.0, description="Khoảng lặng sau đoạn tính bằng giây")
    text: str = Field(default="", description="Văn bản của đoạn để sinh phụ đề SRT")


class StitchRequest(BaseModel):
    blocks: list[StitchBlockItem] = Field(..., min_length=1, description="Danh sách các phân đoạn cần ghép nối")
    format: str = Field(default="mp3", description="Định dạng âm thanh đầu ra: 'mp3' hoặc 'wav'")
    project_name: str | None = Field(default=None, description="Tên dự án (tùy chọn)")


class StitchResponse(BaseModel):
    message: str
    filename: str
    audio_url: str
    srt_filename: str | None = None
    srt_url: str | None = None
    total_duration: float


def _format_srt_time(seconds: float) -> str:
    """Chuyển đổi số giây thành định dạng thời gian SRT: 00:00:00,000"""
    millis = int(round(seconds * 1000))
    hours = millis // 3600000
    millis %= 3600000
    minutes = millis // 60000
    millis %= 60000
    secs = millis // 1000
    millis %= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


@app.post(
    "/api/tts/stitch",
    response_model=StitchResponse,
    summary="Ghép nối các đoạn âm thanh phân đoạn kèm khoảng lặng và sinh phụ đề SRT",
    tags=["TTS"],
)
async def stitch_audio(
    request: StitchRequest,
    background_tasks: BackgroundTasks,
):
    """
    Nối danh sách các file audio phân đoạn tuần tự, chèn khoảng im lặng chuẩn xác giữa các đoạn,
    xuất file master (.mp3 hoặc .wav) và file phụ đề (.srt) đồng bộ.
    """
    from pydub import AudioSegment

    if not request.blocks:
        raise HTTPException(status_code=400, detail="Danh sách phân đoạn rỗng")

    # Kiểm tra sự tồn tại của các file thành phần
    for idx, block in enumerate(request.blocks):
        safe_name = os.path.basename(block.filename)
        file_p = OUTPUTS_DIR / safe_name
        if not file_p.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Không tìm thấy file audio ở phân đoạn {idx + 1}: {safe_name}",
            )

    combined = AudioSegment.empty()
    srt_entries: list[str] = []
    current_time_sec = 0.0

    for idx, block in enumerate(request.blocks):
        safe_name = os.path.basename(block.filename)
        file_p = OUTPUTS_DIR / safe_name

        try:
            segment_audio = AudioSegment.from_file(str(file_p))
        except Exception as e:
            logger.error(f"Lỗi đọc file audio phân đoạn {safe_name}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Không thể giải mã file {safe_name}: {str(e)}",
            )

        duration_sec = len(segment_audio) / 1000.0
        start_sec = current_time_sec
        end_sec = current_time_sec + duration_sec

        # Ghi mục phụ đề SRT nếu có text
        clean_text = block.text.strip()
        if clean_text:
            start_str = _format_srt_time(start_sec)
            end_str = _format_srt_time(end_sec)
            srt_entries.append(f"{len(srt_entries) + 1}\n{start_str} --> {end_str}\n{clean_text}\n")

        # Nối audio của đoạn
        combined += segment_audio
        current_time_sec += duration_sec

        # Chèn khoảng lặng nếu được chỉ định và chưa phải block cuối (hoặc pause_after > 0)
        if block.pause_after > 0:
            pause_ms = int(block.pause_after * 1000)
            combined += AudioSegment.silent(duration=pause_ms)
            current_time_sec += block.pause_after

    # Xuất file master
    file_id = uuid.uuid4().hex[:10]
    out_ext = ".mp3" if request.format.lower() == "mp3" else ".wav"
    export_format = "mp3" if request.format.lower() == "mp3" else "wav"
    out_filename = f"master_{file_id}{out_ext}"
    out_path = OUTPUTS_DIR / out_filename

    try:
        combined.export(
            str(out_path),
            format=export_format,
            bitrate="192k" if export_format == "mp3" else None,
        )
        logger.info(f"🎉 Ghép nối master audio thành công: {out_filename} (Thời lượng: {combined.duration_seconds:.2f}s)")
    except Exception as e:
        logger.error(f"Lỗi xuất file master audio: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xuất audio: {str(e)}")

    # Xuất file SRT nếu có ít nhất 1 câu text
    srt_filename = None
    srt_url = None
    if srt_entries:
        srt_filename = f"master_{file_id}.srt"
        srt_path = OUTPUTS_DIR / srt_filename
        with open(srt_path, "w", encoding="utf-8") as sf:
            sf.write("\n".join(srt_entries))
        srt_url = f"http://localhost:8000/outputs/{srt_filename}"
        logger.info(f"📝 Đã tạo file phụ đề SRT đồng bộ: {srt_filename}")

    background_tasks.add_task(_cleanup_old_files)

    return StitchResponse(
        message="Ghép nối phân đoạn thành công!",
        filename=out_filename,
        audio_url=f"http://localhost:8000/outputs/{out_filename}",
        srt_filename=srt_filename,
        srt_url=srt_url,
        total_duration=round(combined.duration_seconds, 2),
    )


# ─── Auto Caption & Video Editing Endpoints ─────────────────────────────────

class ExportCaptionRequest(BaseModel):
    session_id: str
    segments: list[dict[str, Any]]
    style_config: dict[str, Any] = Field(default_factory=dict)
    has_voiceover: bool = False
    voiceover_start_time: float = 0.0
    audio_clips: list[dict[str, Any]] = Field(default_factory=list)
    has_bgm: bool = False
    bgm_volume: float = 0.25


class AlignScriptRequest(BaseModel):
    segments: list[dict[str, Any]]
    reference_script: str


@app.post("/api/caption/align-script")
async def align_script_endpoint(request: AlignScriptRequest):
    """
    So khớp danh sách segment hiện tại với kịch bản đối chiếu người dùng cung cấp.
    Giúp sửa toàn bộ lỗi nghe nhầm / chính tả tức thì trong <0.1s mà không cần chạy lại Whisper.
    """
    try:
        aligned_segments = align_words_with_reference(request.segments, request.reference_script)
        return {"segments": aligned_segments}
    except Exception as exc:
        logger.error(f"Lỗi khi so khớp kịch bản: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Không thể so khớp kịch bản: {str(exc)}") from exc


class OptimizeChunksRequest(BaseModel):
    segments: list[dict[str, Any]]
    max_words: int = 7


@app.post("/api/caption/optimize-chunks")
async def optimize_chunks_endpoint(request: OptimizeChunksRequest):
    """
    Tự động chia nhỏ lại các câu phụ đề quá dài thành các câu 4-7 từ chuẩn ngắn gọn (Shorts/Reels) hiển thị 1 hàng.
    """
    try:
        all_words = []
        for s in request.segments:
            all_words.extend(s.get("words", []))
        new_segments = resegment_words(all_words, max_words=request.max_words)
        return {"segments": new_segments}
    except Exception as exc:
        logger.error(f"Lỗi khi chia nhỏ câu phụ đề: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Không thể chia nhỏ câu: {str(exc)}") from exc


@app.post("/api/caption/transcribe")
async def transcribe_video(
    video: UploadFile = File(...),
    language: str = Form("vi"),
    model_size: str = Form("base"),
    reference_script: str | None = Form(None),
):
    """
    Tải lên file video MP4/MOV/WebM, tách âm thanh và chạy Faster-Whisper
    để lấy word-level timestamps. Hỗ trợ reference_script để chuẩn hóa chính tả đối chiếu.
    """
    session_id = uuid.uuid4().hex[:12]
    session_dir = CAPTIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    video_suffix = Path(video.filename).suffix if video.filename else ".mp4"
    if not video_suffix:
        video_suffix = ".mp4"
    video_path = session_dir / f"video_raw{video_suffix}"
    audio_path = session_dir / "audio.wav"

    try:
        # Lưu file video
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        # 1. Trích xuất âm thanh từ video
        extract_audio(video_path, audio_path)

        # 2. Bóc tách phụ đề chi tiết từng từ (có đối chiếu kịch bản nếu có)
        segments = transcribe_video_audio(
            audio_path,
            language=language,
            model_size=model_size,
            reference_script=reference_script,
        )

        # 3. Lưu lại bản sao phụ đề mốc gốc để khôi phục bất cứ lúc nào
        raw_json_path = session_dir / "subtitles_raw.json"
        with open(raw_json_path, "w", encoding="utf-8") as f:
            json.dump(segments, f, ensure_ascii=False, indent=2)

        return {
            "session_id": session_id,
            "video_url": f"http://localhost:8000/outputs/captions/{session_id}/video_raw{video_suffix}",
            "filename": video.filename,
            "segments": segments,
        }
    except Exception as exc:
        logger.error(f"Lỗi khi xử lý video transcribe: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Không thể xử lý video: {str(exc)}"
        ) from exc


@app.post("/api/caption/upload-bgm")
async def upload_bgm(
    bgm: UploadFile = File(...),
    session_id: str = Form(...),
):
    """Tải lên file nhạc nền (BGM) cho session video hiện tại."""
    session_dir = CAPTIONS_DIR / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    bgm_suffix = Path(bgm.filename).suffix if bgm.filename else ".mp3"
    bgm_path = session_dir / f"bgm{bgm_suffix}"

    try:
        with open(bgm_path, "wb") as buffer:
            shutil.copyfileobj(bgm.file, buffer)

        return {
            "session_id": session_id,
            "bgm_url": f"http://localhost:8000/outputs/captions/{session_id}/bgm{bgm_suffix}",
            "bgm_filename": bgm.filename,
        }
    except Exception as exc:
        logger.error(f"Lỗi khi lưu file BGM: {exc}")
        raise HTTPException(status_code=500, detail=f"Không thể tải lên BGM: {str(exc)}") from exc


@app.post("/api/caption/attach-voiceover")
async def attach_voiceover(
    session_id: str = Form(...),
    voice_audio: UploadFile | None = File(None),
    voice_url: str | None = Form(None),
    reference_script: str | None = Form(None),
    auto_transcribe: bool = Form(True),
):
    """
    Gắn file giọng đọc (Voiceover) từ Thư viện / Phòng thu hoặc tải từ máy vào session video.
    Tự động bóc tách phụ đề lời thoại từ file giọng đọc này nếu auto_transcribe=True.
    """
    session_dir = CAPTIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    voice_path = session_dir / "voiceover.wav"

    try:
        if voice_audio:
            suffix = Path(voice_audio.filename).suffix if voice_audio.filename else ".wav"
            temp_path = session_dir / f"voice_raw{suffix}"
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(voice_audio.file, buffer)

            convert_cmd = [
                "ffmpeg", "-y", "-i", str(temp_path),
                "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                str(voice_path),
            ]
            subprocess.run(convert_cmd, capture_output=True, check=True)
            if temp_path != voice_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
        elif voice_url:
            parsed_filename = voice_url.split("/")[-1].split("?")[0]
            local_src = OUTPUTS_DIR / parsed_filename
            if not local_src.exists():
                found_files = list(OUTPUTS_DIR.glob(f"**/{parsed_filename}"))
                if found_files:
                    local_src = found_files[0]

            if local_src.exists():
                convert_cmd = [
                    "ffmpeg", "-y", "-i", str(local_src),
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    str(voice_path),
                ]
                subprocess.run(convert_cmd, capture_output=True, check=True)
            elif "localhost" in voice_url or "127.0.0.1" in voice_url:
                raise HTTPException(
                    status_code=404,
                    detail=f"File âm thanh '{parsed_filename}' không tìm thấy trên server. Hãy tạo giọng đọc mới trong Studio hoặc tải lên file âm thanh từ máy tính.",
                )
            else:
                import httpx
                temp_dl = session_dir / "temp_dl_voice"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(voice_url, timeout=30.0)
                    resp.raise_for_status()
                    with open(temp_dl, "wb") as f:
                        f.write(resp.content)
                convert_cmd = [
                    "ffmpeg", "-y", "-i", str(temp_dl),
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                    str(voice_path),
                ]
                subprocess.run(convert_cmd, capture_output=True, check=True)
                if temp_dl.exists():
                    try:
                        temp_dl.unlink()
                    except Exception:
                        pass
        else:
            raise HTTPException(status_code=400, detail="Cần cung cấp voice_audio hoặc voice_url")

        segments = []
        if auto_transcribe and voice_path.exists():
            segments = transcribe_video_audio(
                voice_path,
                language="vi",
                model_size="base",
                reference_script=reference_script,
            )
            raw_json_path = session_dir / "subtitles_raw.json"
            with open(raw_json_path, "w", encoding="utf-8") as f:
                json.dump(segments, f, ensure_ascii=False, indent=2)

        return {
            "session_id": session_id,
            "status": "success",
            "voiceover_url": f"http://localhost:8000/outputs/captions/{session_id}/voiceover.wav",
            "segments": segments,
        }
    except Exception as exc:
        logger.error(f"Lỗi khi gắn voiceover vào session: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Không thể gắn giọng đọc: {str(exc)}") from exc


@app.post("/api/caption/upload-font")
async def upload_custom_font(
    font: UploadFile = File(...),
    session_id: str = Form(...),
):
    """Tải lên file font tùy chỉnh (.ttf, .otf) cho session hiện tại."""
    session_dir = CAPTIONS_DIR / session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    fonts_dir = session_dir / "fonts"
    fonts_dir.mkdir(exist_ok=True)

    font_filename = font.filename or "custom_font.ttf"
    font_path = fonts_dir / font_filename

    try:
        with open(font_path, "wb") as buffer:
            shutil.copyfileobj(font.file, buffer)

        font_family_name = Path(font_filename).stem
        logger.info(f"✅ Đã tải font tùy chỉnh: {font_family_name} ({font_filename})")

        return {
            "status": "success",
            "font_name": font_family_name,
            "filename": font_filename,
            "font_url": f"http://localhost:8000/outputs/captions/{session_id}/fonts/{font_filename}",
        }
    except Exception as exc:
        logger.error(f"Lỗi khi lưu font tùy chỉnh: {exc}")
        raise HTTPException(status_code=500, detail=f"Không thể tải font: {str(exc)}") from exc


@app.post("/api/caption/export")
async def export_captioned_video(request: ExportCaptionRequest):
    """
    Nhận cấu hình style, text đã chỉnh sửa và render video hoàn chỉnh kèm phụ đề Kinetic & BGM.
    """
    session_dir = CAPTIONS_DIR / request.session_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Phiên làm việc (Session) không tồn tại")

    # Tìm file video raw trong session_dir
    video_files = list(session_dir.glob("video_raw.*"))
    if not video_files:
        raise HTTPException(status_code=400, detail="Không tìm thấy video gốc trong session")
    video_path = video_files[0]

    # Kiểm tra Voiceover
    voiceover_path = None
    if request.has_voiceover:
        voiceover_files = list(session_dir.glob("voiceover.*"))
        if voiceover_files:
            voiceover_path = voiceover_files[0]

    # Kiểm tra BGM
    bgm_path = None
    if request.has_bgm:
        bgm_files = list(session_dir.glob("bgm.*"))
        if bgm_files:
            bgm_path = bgm_files[0]

    # Kiểm tra font tùy chỉnh
    fonts_dir = session_dir / "fonts"
    fonts_dir_param = fonts_dir if (fonts_dir.exists() and any(fonts_dir.iterdir())) else None

    ass_path = session_dir / "subtitles.ass"
    output_path = session_dir / "output_final.mp4"

    # Xóa file output cũ nếu đã xuất trước đó để giải phóng dung lượng đĩa
    if output_path.exists():
        try:
            output_path.unlink()
            logger.info(f"🗑️ Đã xóa video thành phẩm cũ của session {request.session_id} để tạo bản mới.")
        except Exception as e:
            logger.warning(f"Không thể xóa file cũ: {e}")

    try:
        # 1. Sinh file phụ đề ASS với kích thước video thực tế
        generate_ass_subtitles(request.segments, request.style_config, ass_path, video_path=video_path)

        # 2. Render bằng FFmpeg
        render_video_with_captions(
            video_path=video_path,
            ass_path=ass_path,
            output_path=output_path,
            voiceover_path=voiceover_path,
            voiceover_start_time=request.voiceover_start_time,
            audio_clips=request.audio_clips,
            bgm_path=bgm_path,
            bgm_volume=request.bgm_volume,
            fonts_dir=fonts_dir_param,
        )

        return {
            "status": "success",
            "download_url": f"http://localhost:8000/api/caption/download/{request.session_id}",
            "filename": f"kinetic_{request.session_id[:8]}.mp4",
        }
    except Exception as exc:
        logger.error(f"Lỗi khi render video thành phẩm: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Render video thất bại: {str(exc)}"
        ) from exc


@app.get("/api/caption/download/{session_id}")
async def download_caption_video(session_id: str):
    """
    Tải file video đã ép phụ đề về máy.
    FileResponse tự động đính kèm header 'Content-Disposition: attachment; filename=...'
    để trình duyệt bắt buộc mở hộp thoại lưu file về máy thay vì mở phát trực tiếp.
    """
    safe_id = os.path.basename(session_id)
    video_path = CAPTIONS_DIR / safe_id / "output_final.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="File video thành phẩm không tồn tại")

    filename = f"kinetic_{safe_id[:8]}.mp4"
    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=filename,
    )


@app.delete("/api/caption/session/{session_id}")
@app.post("/api/caption/session/{session_id}/delete")
async def delete_caption_session(session_id: str):
    """
    Xóa toàn bộ thư mục và các file tạm của session (video raw, audio, ass, output...).
    Hỗ trợ cả DELETE và POST (phục vụ navigator.sendBeacon khi người dùng rời trang).
    """
    safe_id = os.path.basename(session_id)
    session_dir = CAPTIONS_DIR / safe_id
    if session_dir.exists() and session_dir.is_dir():
        try:
            shutil.rmtree(session_dir)
            logger.info(f"🗑️ Đã dọn dẹp sạch thư mục session: {safe_id}")
            return {"message": "Đã dọn dẹp session thành công"}
        except Exception as e:
            logger.error(f"Lỗi khi xóa session {safe_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Không thể xóa session: {e}")
    return {"message": "Session không tồn tại hoặc đã bị xóa trước đó"}


@app.get("/api/caption/session/{session_id}/restore-raw")
async def restore_raw_caption_segments(session_id: str):
    """
    Khôi phục mốc thời gian phụ đề gốc từ file subtitles_raw.json được lưu trữ trên server.
    Đảm bảo phụ đề khớp 100% với giọng nói trong video khi người dùng cần khôi phục.
    """
    safe_id = os.path.basename(session_id)
    session_dir = CAPTIONS_DIR / safe_id
    raw_json_path = session_dir / "subtitles_raw.json"
    if not raw_json_path.exists():
        raise HTTPException(
            status_code=404, detail="Không tìm thấy bản sao lưu mốc phụ đề gốc trên server"
        )

    try:
        with open(raw_json_path, "r", encoding="utf-8") as f:
            segments = json.load(f)
        return {"session_id": safe_id, "segments": segments}
    except Exception as exc:
        logger.error(f"Lỗi khi đọc file mốc gốc: {exc}")
        raise HTTPException(status_code=500, detail="Lỗi khi đọc bản sao lưu mốc gốc")


class TrimSilencesRequest(BaseModel):
    session_id: str
    keep_ranges: list[dict[str, float]]


@app.post("/api/caption/trim-silences")
async def trim_silences_endpoint(body: TrimSilencesRequest):
    """
    Cắt gọt video vật lý bằng FFmpeg theo danh sách keep_ranges (loại bỏ hoàn toàn khoảng lặng).
    Tạo ra file video mới và trả về URL để nạp vào player.
    """
    safe_id = os.path.basename(body.session_id)
    session_dir = CAPTIONS_DIR / safe_id
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    video_files = list(session_dir.glob("video_raw.*"))
    if not video_files:
        raise HTTPException(status_code=404, detail="Không tìm thấy video gốc trong session")

    input_video = video_files[0]
    trimmed_name = f"video_trimmed_{uuid.uuid4().hex[:8]}.mp4"
    output_video = session_dir / trimmed_name

    try:
        trim_video_by_ranges(input_video, body.keep_ranges, output_video)
        return {
            "session_id": safe_id,
            "trimmed_video_url": f"http://localhost:8000/outputs/captions/{safe_id}/{trimmed_name}",
            "filename": trimmed_name,
        }
    except Exception as exc:
        logger.error(f"Lỗi khi cắt gọt video bằng FFmpeg: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Cắt video thất bại: {str(exc)}"
        ) from exc



