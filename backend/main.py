"""
main.py  —  OmniVoice TTS API Server
────────────────────────────────────
Khởi chạy:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Swagger UI:
    http://localhost:8000/docs
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import OUTPUTS_DIR, PRESETS_DIR, SYSTEM_PRESETS_DIR, sync_system_presets, logger
from app.core.database import connect_db, close_db
from app.routers import api_router
from model_handler import load_model


def _safe_lookup(directory: Path | str, subpath: str) -> tuple[str, os.stat_result | None]:
    if not subpath or subpath.startswith(("/", "\\")):
        return "", None
    dir_path = os.path.realpath(str(directory))
    full_path = os.path.realpath(os.path.join(dir_path, subpath))
    try:
        if os.path.commonpath([full_path, dir_path]) != dir_path:
            return "", None
        if os.path.isfile(full_path):
            return full_path, os.stat(full_path)
    except (ValueError, OSError):
        pass
    return "", None


class OutputsStaticFiles(StaticFiles):
    """
    StaticFiles thông minh phục vụ thư mục /outputs:
    - Nếu request bắt đầu bằng "audios/": ưu tiên tìm trong AUDIOS_DIR (hỗ trợ CUSTOM_AUDIOS_DIR tùy biến),
      fallback sang OUTPUTS_DIR / "audios".
    - Nếu request bắt đầu bằng "captions/": ưu tiên tìm trong CAPTIONS_DIR (hỗ trợ CUSTOM_VIDEOS_DIR tùy biến),
      fallback sang OUTPUTS_DIR / "captions".
    - Các file khác: tìm trong OUTPUTS_DIR.
    """
    def lookup_path(self, path: str) -> tuple[str, os.stat_result | None]:
        clean_path = path.replace("\\", "/").lstrip("/")
        if clean_path.startswith("audios/"):
            sub_path = clean_path[len("audios/"):]
            from app.core.config import AUDIOS_DIR, OUTPUTS_DIR
            full, stat_res = _safe_lookup(AUDIOS_DIR, sub_path)
            if stat_res is not None:
                return full, stat_res
            full, stat_res = _safe_lookup(OUTPUTS_DIR / "audios", sub_path)
            if stat_res is not None:
                return full, stat_res

        elif clean_path.startswith("captions/"):
            sub_path = clean_path[len("captions/"):]
            from app.core.config import CAPTIONS_DIR, OUTPUTS_DIR
            full, stat_res = _safe_lookup(CAPTIONS_DIR, sub_path)
            if stat_res is not None:
                return full, stat_res
            full, stat_res = _safe_lookup(OUTPUTS_DIR / "captions", sub_path)
            if stat_res is not None:
                return full, stat_res

        return super().lookup_path(path)


class DualStaticFiles(StaticFiles):
    """StaticFiles với cơ chế tự động tìm kiếm fallback ở SYSTEM_PRESETS_DIR nếu file chưa có ở PRESETS_DIR."""
    def __init__(self, *args, fallback_dir: Path | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fallback_dir = Path(fallback_dir) if fallback_dir else None

    def lookup_path(self, path: str):
        full_path, stat_result = super().lookup_path(path)
        if stat_result is not None:
            return full_path, stat_result
        if self.fallback_dir and self.fallback_dir.exists():
            candidate = (self.fallback_dir / path).resolve()
            try:
                candidate.relative_to(self.fallback_dir.resolve())
                if candidate.exists() and candidate.is_file():
                    return str(candidate), os.stat(str(candidate))
            except (ValueError, OSError):
                pass
        return full_path, stat_result


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load mô hình OmniVoice và kết nối cơ sở dữ liệu nếu có cấu hình."""
    logger.info("🚀 Server đang khởi động — nạp mô hình OmniVoice (24kHz) …")
    sync_system_presets()
    load_model()
    await connect_db()
    yield
    await close_db()
    logger.info("🛑 Server đang tắt.")



app = FastAPI(
    title="OmniVoice TTS API",
    description=(
        "Text-to-Speech đa ngôn ngữ chất lượng cao 24kHz sử dụng OmniVoice (k2-fsa). "
        "Hỗ trợ Cloud Sync MongoDB & Cloudflare R2 với Fallback LocalStorage."
    ),
    version="2.2.0",

    lifespan=lifespan,
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static Files ─────────────────────────────────────────────────────────────
app.mount("/outputs", OutputsStaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
app.mount(
    "/presets",
    DualStaticFiles(directory=str(PRESETS_DIR), fallback_dir=SYSTEM_PRESETS_DIR),
    name="presets",
)

# ─── Include API Routers ──────────────────────────────────────────────────────
app.include_router(api_router)
