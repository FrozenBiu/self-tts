"""
main.py  —  OmniVoice TTS API Server
────────────────────────────────────
Khởi chạy:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Swagger UI:
    http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import OUTPUTS_DIR, PRESETS_DIR, logger
from app.routers import api_router
from model_handler import load_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load mô hình OmniVoice trước khi nhận request đầu tiên."""
    logger.info("🚀 Server đang khởi động — nạp mô hình OmniVoice (24kHz) …")
    load_model()
    yield
    logger.info("🛑 Server đang tắt.")


app = FastAPI(
    title="OmniVoice TTS API",
    description=(
        "Text-to-Speech đa ngôn ngữ chất lượng cao 24kHz sử dụng OmniVoice (k2-fsa). "
        "Hỗ trợ Voice Cloning (kèm cache .pt), Voice Design bằng câu lệnh, và các thẻ biểu cảm phi ngôn ngữ."
    ),
    version="2.1.0",
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

# ─── Include API Routers ──────────────────────────────────────────────────────
app.include_router(api_router)
