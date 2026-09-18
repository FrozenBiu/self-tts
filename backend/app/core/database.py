import logging
from typing import Optional, Any
try:
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
    _HAS_MOTOR = True
except ImportError:
    AsyncIOMotorClient = Any
    AsyncIOMotorDatabase = Any
    _HAS_MOTOR = False

import app.core.config as config
from app.core.config import logger

_client: Optional[Any] = None
_db: Optional[Any] = None
_is_connected: bool = False


async def connect_db(uri: Optional[str] = None, db_name: Optional[str] = None) -> bool:
    """
    Khởi tạo kết nối tới MongoDB Atlas.
    Tự động fallback về Local Mode nếu không có URI hoặc mất kết nối.
    Hỗ trợ kết nối lại trực tiếp khi người dùng lưu cài đặt mới mà không cần khởi động lại app.
    """
    global _client, _db, _is_connected

    target_uri = (uri or config.MONGODB_URI or "").strip()
    target_db_name = (db_name or config.MONGODB_DB_NAME or "omnivoice_tts").strip()

    if not _HAS_MOTOR:
        logger.info("ℹ️ Thư viện 'motor' chưa được cài đặt. Hệ thống chạy ở chế độ CỤC BỘ (Local Mode).")
        _is_connected = False
        _db = None
        return False

    if not target_uri:
        logger.info("ℹ️ Không tìm thấy MONGODB_URI. Hệ thống chạy ở chế độ CỤC BỘ (Local Mode - LocalStorage).")
        _is_connected = False
        _db = None
        return False

    try:
        logger.info(f"🔄 Đang kết nối tới MongoDB Atlas Cloud (Database: '{target_db_name}')...")
        if _client:
            try:
                _client.close()
            except Exception:
                pass
            _client = None

        _client = AsyncIOMotorClient(
            target_uri,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000,
        )
        # Ping để kiểm tra thực tế
        await _client.admin.command("ping")
        _db = _client[target_db_name]
        _is_connected = True
        logger.info(f"✅ Kết nối MongoDB Atlas Cloud thành công! Database: '{target_db_name}'.")
        return True
    except Exception as e:
        logger.warning(
            f"⚠️ Không thể kết nối tới MongoDB Atlas ({e}). Tự động fallback về chế độ CỤC BỘ (Local Mode)."
        )
        _is_connected = False
        _db = None
        if _client:
            try:
                _client.close()
            except Exception:
                pass
            _client = None
        return False


async def close_db() -> None:
    """Đóng kết nối MongoDB khi ứng dụng dừng hoặc khi cập nhật cấu hình."""
    global _client, _db, _is_connected
    if _client:
        logger.info("🧹 Đang đóng kết nối MongoDB Atlas...")
        try:
            _client.close()
        except Exception:
            pass
        _client = None
        _db = None
        _is_connected = False


def get_database() -> Optional[AsyncIOMotorDatabase]:
    """Trả về instance database Motor (hoặc None nếu ở Local Mode)."""
    return _db


def is_cloud_mode() -> bool:
    """Kiểm tra hệ thống có đang ở chế độ Cloud Sync không."""
    return _is_connected and _db is not None
