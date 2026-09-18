"""
settings.py — Router Quản lý & Cấu hình Hệ thống (System Settings)
Cung cấp API đọc/ghi cấu hình .env, kiểm tra kết nối Cloud GPU và MongoDB.
"""

import os
import time
import httpx
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import dotenv_values, set_key

from app.core.config import (
    BASE_DIR,
    OUTPUTS_DIR,
    AUDIOS_DIR,
    CAPTIONS_DIR,
    DEFAULT_NUM_STEP,
    logger,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

_env_path_str = os.getenv("ENV_FILE_PATH", "").strip()
ENV_FILE_PATH = Path(_env_path_str) if _env_path_str else (BASE_DIR / ".env")


class SettingsPayload(BaseModel):
    # Cloud GPU
    use_remote_gpu: bool = False
    remote_gpu_url: Optional[str] = ""
    remote_concurrency: int = 2

    # Model Parameters
    default_num_step: int = 32

    # Directories
    audios_dir: Optional[str] = ""
    videos_dir: Optional[str] = ""

    # MongoDB Atlas
    mongodb_uri: Optional[str] = ""
    mongodb_db_name: Optional[str] = "omnivoice_tts"

    # Cloudflare R2
    r2_account_id: Optional[str] = ""
    r2_access_key_id: Optional[str] = ""
    r2_secret_access_key: Optional[str] = ""
    r2_bucket_name: Optional[str] = ""
    r2_public_url: Optional[str] = ""


class TestGpuPayload(BaseModel):
    url: str


class TestDbPayload(BaseModel):
    mongodb_uri: str
    mongodb_db_name: str = "omnivoice_tts"


def read_env_dict() -> dict:
    """Đọc file .env nếu có, fallback về os.environ."""
    env_dict = {}
    if ENV_FILE_PATH.exists():
        try:
            env_dict = dotenv_values(ENV_FILE_PATH)
        except Exception as e:
            logger.warning(f"[Settings] Lỗi khi đọc .env: {e}")
    return env_dict


@router.get("")
async def get_settings():
    """Lấy toàn bộ cấu hình hệ thống hiện tại."""
    env = read_env_dict()

    use_remote = env.get("USE_REMOTE_GPU", os.getenv("USE_REMOTE_GPU", "false")).lower() in ("true", "1", "yes")
    remote_url = env.get("REMOTE_GPU_URL", os.getenv("REMOTE_GPU_URL", "")).strip()
    concurrency = int(env.get("REMOTE_CONCURRENCY", os.getenv("REMOTE_CONCURRENCY", "2")))
    num_step = int(env.get("DEFAULT_NUM_STEP", os.getenv("DEFAULT_NUM_STEP", str(DEFAULT_NUM_STEP))))

    audios_dir = env.get("CUSTOM_AUDIOS_DIR", os.getenv("CUSTOM_AUDIOS_DIR", str(AUDIOS_DIR))).strip()
    videos_dir = env.get("CUSTOM_VIDEOS_DIR", os.getenv("CUSTOM_VIDEOS_DIR", str(CAPTIONS_DIR))).strip()

    mongo_uri = env.get("MONGODB_URI", os.getenv("MONGODB_URI", "")).strip()
    mongo_db = env.get("MONGODB_DB_NAME", os.getenv("MONGODB_DB_NAME", "omnivoice_tts")).strip()

    r2_acc = env.get("R2_ACCOUNT_ID", os.getenv("R2_ACCOUNT_ID", "")).strip()
    r2_key = env.get("R2_ACCESS_KEY_ID", os.getenv("R2_ACCESS_KEY_ID", "")).strip()
    r2_sec = env.get("R2_SECRET_ACCESS_KEY", os.getenv("R2_SECRET_ACCESS_KEY", "")).strip()
    r2_bucket = env.get("R2_BUCKET_NAME", os.getenv("R2_BUCKET_NAME", "")).strip()
    r2_pub = env.get("R2_PUBLIC_URL", os.getenv("R2_PUBLIC_URL", "")).strip()

    return {
        "success": True,
        "data": {
            "use_remote_gpu": use_remote,
            "remote_gpu_url": remote_url,
            "remote_concurrency": concurrency,
            "default_num_step": num_step,
            "audios_dir": audios_dir,
            "videos_dir": videos_dir,
            "mongodb_uri": mongo_uri,
            "mongodb_db_name": mongo_db,
            "r2_account_id": r2_acc,
            "r2_access_key_id": r2_key,
            "r2_secret_access_key": r2_sec,
            "r2_bucket_name": r2_bucket,
            "r2_public_url": r2_pub,
            "default_audios_dir": str(OUTPUTS_DIR / "audios"),
            "default_videos_dir": str(OUTPUTS_DIR / "captions"),
        },
    }


@router.post("")
async def save_settings(payload: SettingsPayload):
    """Lưu cấu hình hệ thống vào file .env và cập nhật biến môi trường runtime."""
    try:
        if not ENV_FILE_PATH.exists():
            # Tạo file .env mới nếu chưa tồn tại
            ENV_FILE_PATH.touch()

        str_env = str(ENV_FILE_PATH)

        # 1. Cloud GPU
        set_key(str_env, "USE_REMOTE_GPU", "true" if payload.use_remote_gpu else "false")
        set_key(str_env, "REMOTE_GPU_URL", payload.remote_gpu_url or "")
        set_key(str_env, "REMOTE_CONCURRENCY", str(payload.remote_concurrency))
        os.environ["USE_REMOTE_GPU"] = "true" if payload.use_remote_gpu else "false"
        os.environ["REMOTE_GPU_URL"] = payload.remote_gpu_url or ""
        os.environ["REMOTE_CONCURRENCY"] = str(payload.remote_concurrency)

        # 2. Diffusion Steps
        set_key(str_env, "DEFAULT_NUM_STEP", str(payload.default_num_step))
        os.environ["DEFAULT_NUM_STEP"] = str(payload.default_num_step)

        # 3. Directories (Âm thanh & Video)
        if payload.audios_dir:
            set_key(str_env, "CUSTOM_AUDIOS_DIR", payload.audios_dir)
            os.environ["CUSTOM_AUDIOS_DIR"] = payload.audios_dir
            Path(payload.audios_dir).mkdir(parents=True, exist_ok=True)
        else:
            set_key(str_env, "CUSTOM_AUDIOS_DIR", "")
            os.environ.pop("CUSTOM_AUDIOS_DIR", None)

        if payload.videos_dir:
            set_key(str_env, "CUSTOM_VIDEOS_DIR", payload.videos_dir)
            os.environ["CUSTOM_VIDEOS_DIR"] = payload.videos_dir
            Path(payload.videos_dir).mkdir(parents=True, exist_ok=True)
        else:
            set_key(str_env, "CUSTOM_VIDEOS_DIR", "")
            os.environ.pop("CUSTOM_VIDEOS_DIR", None)

        # 4. MongoDB Atlas
        set_key(str_env, "MONGODB_URI", payload.mongodb_uri or "")
        set_key(str_env, "MONGODB_DB_NAME", payload.mongodb_db_name or "omnivoice_tts")
        os.environ["MONGODB_URI"] = payload.mongodb_uri or ""
        os.environ["MONGODB_DB_NAME"] = payload.mongodb_db_name or "omnivoice_tts"

        # 5. Cloudflare R2
        set_key(str_env, "R2_ACCOUNT_ID", payload.r2_account_id or "")
        set_key(str_env, "R2_ACCESS_KEY_ID", payload.r2_access_key_id or "")
        set_key(str_env, "R2_SECRET_ACCESS_KEY", payload.r2_secret_access_key or "")
        set_key(str_env, "R2_BUCKET_NAME", payload.r2_bucket_name or "")
        set_key(str_env, "R2_PUBLIC_URL", payload.r2_public_url or "")
        os.environ["R2_ACCOUNT_ID"] = payload.r2_account_id or ""
        os.environ["R2_ACCESS_KEY_ID"] = payload.r2_access_key_id or ""
        os.environ["R2_SECRET_ACCESS_KEY"] = payload.r2_secret_access_key or ""
        os.environ["R2_BUCKET_NAME"] = payload.r2_bucket_name or ""
        os.environ["R2_PUBLIC_URL"] = payload.r2_public_url or ""

        logger.info("[Settings] Đã cập nhật thành công cấu hình hệ thống vào .env!")
        return {"success": True, "message": "Đã lưu thành công toàn bộ cấu hình hệ thống!"}

    except Exception as e:
        logger.error(f"[Settings] Lỗi khi lưu cấu hình: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu cấu hình: {str(e)}")


@router.post("/test-gpu")
async def test_cloud_gpu(payload: TestGpuPayload):
    """Kiểm tra kết nối tới Cloud GPU (Hugging Face Spaces hoặc Colab)."""
    target_url = payload.url.strip().rstrip("/")
    if not target_url:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đường dẫn URL của Cloud GPU")

    test_endpoints = [
        f"{target_url}/gradio_api/remote/health",
        f"{target_url}/api/remote/health",
        f"{target_url}/health",
    ]

    start_time = time.time()
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        last_error = None
        for ep in test_endpoints:
            try:
                resp = await client.get(ep)
                if resp.status_code == 200:
                    latency = round((time.time() - start_time) * 1000, 1)
                    data = {}
                    try:
                        data = resp.json()
                    except Exception:
                        data = {"status": "ok"}

                    gpu_name = data.get("gpu", data.get("device", "NVIDIA GPU Accelerator"))
                    vram = data.get("vram", data.get("memory", "Cloud VRAM"))
                    
                    return {
                        "success": True,
                        "message": "Kết nối Cloud GPU thành công!",
                        "latency_ms": latency,
                        "gpu_name": gpu_name,
                        "vram": vram,
                        "details": data,
                    }
            except Exception as ex:
                last_error = ex
                continue

    raise HTTPException(
        status_code=502,
        detail=f"Không thể kết nối tới Cloud GPU tại '{target_url}'. Lỗi: {last_error}",
    )


@router.post("/test-db")
async def test_mongodb(payload: TestDbPayload):
    """Kiểm tra chuỗi kết nối MongoDB Atlas."""
    uri = payload.mongodb_uri.strip()
    if not uri:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp chuỗi kết nối MongoDB URI")

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        start_time = time.time()
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        # Ping lệnh kiểm tra
        await client.admin.command("ping")
        latency = round((time.time() - start_time) * 1000, 1)
        client.close()

        return {
            "success": True,
            "message": "Kết nối MongoDB Atlas Cloud thành công!",
            "latency_ms": latency,
            "database": payload.mongodb_db_name,
        }
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Không thể kết nối MongoDB Atlas: {str(e)}",
        )
