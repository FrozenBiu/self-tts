"""
main.py  —  VoxCPM2 TTS API Server
────────────────────────────────────
Khởi chạy:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Swagger UI:
    http://localhost:8000/docs
"""

import logging
import uuid
import hashlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import shutil

from model_handler import load_model, generate_audio

# ─── Logging ────────────────────────────────────────────────────────────────
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
    with open(CUSTOM_VOICES_JSON, 'w', encoding='utf-8') as f:
        f.write("[]")


# ─── Lifespan (thay thế on_event("startup") đã deprecated) ─────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model vào VRAM trước khi nhận request đầu tiên."""
    logger.info("🚀 Server đang khởi động — load VoxCPM2 …")
    load_model()      # Blocking nhưng chỉ chạy 1 lần duy nhất
    yield
    # (cleanup nếu cần đặt ở đây sau yield)
    logger.info("🛑 Server đang tắt.")


# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="VoxCPM2 TTS API",
    description=(
        "Text-to-Speech cục bộ dùng VoxCPM2. "
        "Hỗ trợ tiếng Việt, tiếng Anh và code-switching."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
# Cho phép Frontend Vite (cổng 5173) gọi API không bị CORS block.
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

# ─── Static Files (phục vụ file .wav đã tạo) ─────────────────────────────────
# Frontend gọi URL: http://localhost:8000/outputs/<filename>.wav
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
app.mount("/presets", StaticFiles(directory=str(PRESETS_DIR)), name="presets")


import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()
DEFAULT_TIMESTEPS = int(os.getenv("DEFAULT_INFERENCE_TIMESTEPS", 10))

# ─── Request / Response Schemas ──────────────────────────────────────────────
class TTSRequest(BaseModel):
    """Payload cho endpoint POST /api/tts"""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Văn bản cần tổng hợp giọng nói (tối đa 5000 ký tự).",
        examples=["Xin chào! Đây là hệ thống TTS VoxCPM2."],
    )
    cfg_value: float = Field(
        default=2.0,
        ge=1.0,
        le=3.0,
        description="Guidance scale (1.0-3.0). 2.5 la gia tri khuyen dung cho code-switching.",
    )
    inference_timesteps: int = Field(
        default=DEFAULT_TIMESTEPS,
        ge=4,
        le=30,
        description="So buoc diffusion (4-30). Mac dinh tu .env (4-30).",
    )
    normalize: bool = Field(
        default=True,
        description="Bật text normalization (tự động mở rộng số, ngày tháng…).",
    )
    prompt_wav_path: str | None = Field(
        default=None,
        description="(Tuy chon) Duong dan file WAV tham chieu de clone giong noi.",
    )
    prompt_text: str | None = Field(
        default=None,
        description="Transcript chinh xac cua prompt_wav_path. Bat buoc neu truyen prompt_wav_path.",
    )
    voice_id: str | None = Field(
        default=None,
        description="(Tùy chọn) ID của giọng mẫu đã được định nghĩa trong hệ thống (sẽ tự động resolve thành prompt_wav_path và prompt_text).",
    )
    seed: int | None = Field(
        default=42,
        description="Seed để cố định tính ngẫu nhiên của mô hình (Consistency).",
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Tốc độ đọc (1.0 là bình thường, 1.2 là nhanh 20%).",
    )
    pitch: float = Field(
        default=0.0,
        ge=-12.0,
        le=12.0,
        description="Điều chỉnh cao độ (bước âm - nửa cung). 0 là bình thường.",
    )
    format: str = Field(
        default="mp3",
        description="Định dạng âm thanh đầu ra: 'wav' hoặc 'mp3'",
    )


class TTSResponse(BaseModel):
    """Kết quả trả về sau khi tổng hợp thành công"""

    message: str
    filename: str
    audio_url: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Kiểm tra trạng thái server",
    tags=["System"],
)
async def health_check():
    """Ping endpoint — kiểm tra server còn sống và model đã load chưa."""
    from model_handler import _model
    return HealthResponse(
        status="ok",
        model_loaded=(_model is not None),
    )


@app.get(
    "/api/voices",
    summary="Lấy danh sách các giọng đọc mẫu",
    tags=["TTS"],
)
async def get_voices():
    import json
    voices_json = PRESETS_DIR / "voices.json"
    
    preset_voices = []
    if voices_json.exists():
        with open(voices_json, 'r', encoding='utf-8') as f:
            preset_voices = json.load(f)
            for v in preset_voices:
                v['type'] = 'preset'

    custom_voices = []
    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, 'r', encoding='utf-8') as f:
            custom_voices = json.load(f)
            for v in custom_voices:
                v['type'] = 'custom'
                
    return preset_voices + custom_voices

whisper_model = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        logger.info("Đang tải mô hình Whisper...")
        from faster_whisper import WhisperModel
        whisper_model = WhisperModel("base", device="auto", compute_type="default")
    return whisper_model

@app.post(
    "/api/voices/clone",
    summary="Clone giọng đọc từ file tải lên",
    tags=["TTS"],
)
async def clone_voice(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form("Giọng tự tạo"),
    gender: str = Form("all"),
    icon: str = Form("record_voice_over"),
):
    import librosa
    import soundfile as sf
    import json
    import uuid

    if not file.filename.endswith((".wav", ".mp3", ".m4a", ".webm")):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file wav, mp3, m4a, webm")

    custom_id = f"custom_{uuid.uuid4().hex[:8]}"
    temp_path = BASE_DIR / f"temp_{custom_id}_{file.filename}"
    
    try:
        # Save temp file
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Đọc và tự động cắt lấy 10 giây đầu tiên, resample về 16000Hz (chuẩn VoxCPM2)
        y, sr = librosa.load(temp_path, sr=16000, duration=10.0)
        
        # Save to custom directory
        wav_path = CUSTOM_VOICES_DIR / f"{custom_id}.wav"
        sf.write(wav_path, y, sr)

        # Chạy nhận dạng giọng nói tự động (ASR)
        logger.info(f"Đang nhận dạng giọng nói cho {custom_id}...")
        model = get_whisper_model()
        segments, info = model.transcribe(str(wav_path), beam_size=5)
        transcript = " ".join([segment.text for segment in segments]).strip()
        logger.info(f"Transcript nhận diện: {transcript}")
        
        # Append to custom_voices.json
        custom_voices = []
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, 'r', encoding='utf-8') as f:
                custom_voices = json.load(f)
                
        new_voice = {
            "id": custom_id,
            "name": name,
            "gender": gender,
            "description": description,
            "icon": icon,
            "prompt_text": transcript,
            "url": f"http://localhost:8000/presets/custom/{custom_id}.wav"
        }
        
        custom_voices.append(new_voice)
        with open(CUSTOM_VOICES_JSON, 'w', encoding='utf-8') as f:
            json.dump(custom_voices, f, ensure_ascii=False, indent=2)
            
        return {"message": "Tạo giọng đọc thành công", "voice": new_voice}
        
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
    import json
    if not voice_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Chỉ được phép xoá giọng tự tạo")
        
    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, 'r', encoding='utf-8') as f:
            custom_voices = json.load(f)
            
        filtered_voices = [v for v in custom_voices if v["id"] != voice_id]
        
        if len(filtered_voices) < len(custom_voices):
            with open(CUSTOM_VOICES_JSON, 'w', encoding='utf-8') as f:
                json.dump(filtered_voices, f, ensure_ascii=False, indent=2)
                
            # Xoá file wav
            wav_path = CUSTOM_VOICES_DIR / f"{voice_id}.wav"
            wav_path.unlink(missing_ok=True)
            return {"message": "Đã xoá giọng đọc"}
            
    raise HTTPException(status_code=404, detail="Không tìm thấy giọng đọc")


def _cleanup_old_files(keep_latest: int = 200) -> None:
    """
    Dọn dẹp outputs/ nếu vượt quá `keep_latest` file,
    xóa các file cũ nhất để tiết kiệm dung lượng ổ đĩa.
    """
    files = list(OUTPUTS_DIR.glob("*.wav")) + list(OUTPUTS_DIR.glob("*.mp3"))
    files = sorted(files, key=lambda f: f.stat().st_mtime)
    for old_file in files[:-keep_latest]:
        old_file.unlink(missing_ok=True)
        logger.info(f"🗑️  Đã xóa file cũ: {old_file.name}")


@app.post(
    "/api/tts",
    response_model=TTSResponse,
    summary="Tổng hợp giọng nói từ văn bản",
    tags=["TTS"],
    responses={
        200: {"description": "Tổng hợp thành công, trả về URL file WAV."},
        422: {"description": "Dữ liệu đầu vào không hợp lệ."},
        500: {"description": "Lỗi server hoặc mô hình."},
    },
)
async def text_to_speech(
    request: TTSRequest,
    background_tasks: BackgroundTasks,
):
    """
    ## Tổng hợp giọng nói (Text-to-Speech)

    **Lưu ý:** Lần gọi đầu tiên sau khi server khởi động có thể chậm hơn
    do GPU warm-up. Các lần gọi tiếp theo sẽ nhanh hơn đáng kể.
    """
    # Tạo Hash để làm Cache Key
    cache_str = f"{request.text}_{request.voice_id}_{request.cfg_value}_{request.inference_timesteps}_{request.normalize}_{request.seed}_{request.speed}_{request.pitch}_{request.format}"
    file_hash = hashlib.md5(cache_str.encode('utf-8')).hexdigest()
    
    ext = ".mp3" if request.format == "mp3" else ".wav"
    filename = f"tts_{file_hash}{ext}"
    output_path = OUTPUTS_DIR / filename
    
    # Clean file type check for glob cleanup
    if output_path.exists():
        logger.info(f"⚡ CACHE HIT: Tái sử dụng {filename}")
        output_path.touch() # Cập nhật thời gian mtime để không bị xóa bởi _cleanup_old_files
        audio_url = f"http://localhost:8000/outputs/{filename}"
        return TTSResponse(
            message="Tổng hợp thành công (Cache Hit)!",
            filename=filename,
            audio_url=audio_url,
        )

    logger.info(f"⏳ CACHE MISS: Bắt đầu sinh mới {filename}")
    
    prompt_wav_path = request.prompt_wav_path
    prompt_text = request.prompt_text

    if request.voice_id:
        import json
        voices_json = PRESETS_DIR / "voices.json"
        
        # Load preset voices
        all_voices = []
        if voices_json.exists():
            with open(voices_json, 'r', encoding='utf-8') as f:
                all_voices.extend(json.load(f))
                
        # Load custom voices
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, 'r', encoding='utf-8') as f:
                all_voices.extend(json.load(f))
                
        for v in all_voices:
            if v["id"] == request.voice_id:
                if request.voice_id.startswith("custom_"):
                    prompt_wav_path = str(CUSTOM_VOICES_DIR / f"{v['id']}.wav")
                else:
                    prompt_wav_path = str(PRESETS_DIR / f"{v['id']}.wav")
                prompt_text = v["prompt_text"]
                break

    try:
        # Chạy inference (CPU-blocking) — vẫn OK vì đây là local server
        # Nếu cần non-blocking thật sự, dùng run_in_executor ở giai đoạn sau.
        generate_audio(
            text=request.text,
            output_path=output_path,
            cfg_value=request.cfg_value,
            inference_timesteps=request.inference_timesteps,
            prompt_wav_path=prompt_wav_path,
            prompt_text=prompt_text,
            normalize=request.normalize,
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

    # Dọn dẹp file cũ ở background, không block response
    background_tasks.add_task(_cleanup_old_files)

    audio_url = f"http://localhost:8000/outputs/{filename}"
    return TTSResponse(
        message="Tổng hợp thành công!",
        filename=filename,
        audio_url=audio_url,
    )


@app.delete("/api/tts/{filename}")
async def delete_audio(filename: str):
    """
    Xóa một file âm thanh đã được tổng hợp khỏi máy chủ.
    """
    # Bảo mật: Lấy basename để tránh path traversal (vd: ../main.py)
    safe_filename = os.path.basename(filename)
    file_path = OUTPUTS_DIR / safe_filename
    
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            logger.info(f"🗑️ Đã xóa file theo yêu cầu API: {safe_filename}")
            return {"message": "Đã xóa file thành công"}
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {safe_filename}: {e}")
            raise HTTPException(status_code=500, detail="Không thể xóa file")
    
    # Kể cả không tìm thấy cũng trả về 200 để Frontend dọn dẹp bộ nhớ an toàn
    return {"message": "File không tồn tại hoặc đã bị xóa trước đó"}

