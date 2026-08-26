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

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

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
        default=10,
        ge=4,
        le=30,
        description="So buoc diffusion (4-30). 25 buoc cho chat luong on dinh voi text Viet-Anh.",
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
    if not voices_json.exists():
        return []
    with open(voices_json, 'r', encoding='utf-8') as f:
        return json.load(f)


def _cleanup_old_files(keep_latest: int = 50) -> None:
    """
    Dọn dẹp outputs/ nếu vượt quá `keep_latest` file,
    xóa các file cũ nhất để tiết kiệm dung lượng ổ đĩa.
    """
    wav_files = sorted(OUTPUTS_DIR.glob("*.wav"), key=lambda f: f.stat().st_mtime)
    for old_file in wav_files[:-keep_latest]:
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
    cache_str = f"{request.text}_{request.voice_id}_{request.cfg_value}_{request.inference_timesteps}_{request.normalize}_{request.seed}_{request.speed}_{request.pitch}"
    file_hash = hashlib.md5(cache_str.encode('utf-8')).hexdigest()
    filename = f"tts_{file_hash}.wav"
    output_path = OUTPUTS_DIR / filename

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
        if voices_json.exists():
            with open(voices_json, 'r', encoding='utf-8') as f:
                voices = json.load(f)
            for v in voices:
                if v["id"] == request.voice_id:
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
