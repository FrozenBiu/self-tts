import time
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from app.core.database import get_database, is_cloud_mode
from app.core.storage_r2 import (
    is_r2_configured,
    delete_audio_from_r2,
    delete_session_from_r2,
    delete_multiple_from_r2,
)

from app.schemas.sync import (
    SyncStatusResponse,
    ProjectSyncItem,
    HistorySyncItem,
    PronunciationSyncItem,
)
from app.core.config import logger

router = APIRouter(prefix="/api/sync", tags=["Cloud Synchronization"])


@router.get("/status", response_model=SyncStatusResponse, summary="Kiểm tra trạng thái đồng bộ đa thiết bị")
async def get_sync_status():
    cloud_active = is_cloud_mode()
    r2_active = is_r2_configured()

    if cloud_active and r2_active:
        msg = "Đồng bộ Đám Mây Toàn Diện (MongoDB Atlas + Cloudflare R2 Audio 10GB)."
        mode = "cloud"
    elif cloud_active:
        msg = "Đồng bộ Kịch Bản (MongoDB Atlas). File âm thanh lưu trữ cục bộ."
        mode = "cloud"
    else:
        msg = "Chế độ Cục Bộ (Local Mode) - Dữ liệu lưu trong LocalStorage trình duyệt."
        mode = "local"

    return SyncStatusResponse(
        mode=mode,
        mongo_connected=cloud_active,
        r2_connected=r2_active,
        message=msg,
    )


# ── Projects Sync ────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectSyncItem], summary="Lấy danh sách dự án từ MongoDB Atlas")
async def get_cloud_projects():
    db = get_database()
    if db is None:
        return []

    try:
        cursor = db["projects"].find({}, {"_id": 0}).sort("createdAt", -1)
        projects = await cursor.to_list(length=500)
        return projects
    except Exception as e:
        logger.error(f"Lỗi tải danh sách dự án từ MongoDB: {e}")
        raise HTTPException(status_code=500, detail="Không thể đọc dữ liệu dự án từ đám mây.")


@router.post("/projects", summary="Lưu hoặc cập nhật dự án lên MongoDB Atlas")
async def save_cloud_project(project: ProjectSyncItem):
    db = get_database()
    if db is None:
        return {"status": "skipped", "message": "Hệ thống đang ở chế độ Local Mode."}

    try:
        doc = project.model_dump()
        doc["updatedAt"] = int(time.time() * 1000)
        await db["projects"].replace_one({"id": project.id}, doc, upsert=True)
        return {"status": "success", "id": project.id}
    except Exception as e:
        logger.error(f"Lỗi lưu dự án lên MongoDB: {e}")
        raise HTTPException(status_code=500, detail="Không thể lưu dự án lên đám mây.")


@router.delete("/projects/{project_id}", summary="Xóa dự án trên MongoDB Atlas và Cloudflare R2")
async def delete_cloud_project(project_id: str, background_tasks: BackgroundTasks):
    db = get_database()
    if db is None:
        return {"status": "skipped"}

    try:
        # Tìm thông tin project để dọn dẹp file audio trên R2
        proj = await db["projects"].find_one({"id": project_id})
        if proj:
            r2_keys = []
            # Gom audio các blocks
            for b in proj.get("blocks", []):
                fn = b.get("filename") or (b.get("audioUrl", "").split("/")[-1] if b.get("audioUrl") else None)
                if fn:
                    r2_keys.append(fn)
            # Gom master audio và srt
            m_fn = proj.get("masterFilename") or (proj.get("masterAudioUrl", "").split("/")[-1] if proj.get("masterAudioUrl") else None)
            if m_fn:
                r2_keys.append(m_fn)
            if proj.get("masterSrtUrl"):
                r2_keys.append(proj["masterSrtUrl"].split("/")[-1])

            # Thực hiện xóa hàng loạt trên R2 ở BackgroundTask (không block HTTP request)
            if r2_keys:
                background_tasks.add_task(delete_multiple_from_r2, r2_keys)

        res = await db["projects"].delete_one({"id": project_id})
        return {"status": "success", "deleted_count": res.deleted_count}
    except Exception as e:
        logger.error(f"Lỗi xóa dự án trên MongoDB/R2: {e}")
        raise HTTPException(status_code=500, detail="Không thể xóa dự án trên đám mây.")


# ── History Sync ─────────────────────────────────────────────────────────────

@router.get("/history", response_model=List[HistorySyncItem], summary="Lấy lịch sử tạo âm thanh từ MongoDB Atlas")
async def get_cloud_history():
    db = get_database()
    if db is None:
        return []

    try:
        cursor = db["history"].find({}, {"_id": 0}).sort("timestamp", -1).limit(100)
        history = await cursor.to_list(length=100)
        return history
    except Exception as e:
        logger.error(f"Lỗi tải lịch sử từ MongoDB: {e}")
        return []


@router.post("/history", summary="Lưu bản ghi lịch sử lên MongoDB Atlas")
async def save_cloud_history(item: HistorySyncItem):
    db = get_database()
    if db is None:
        return {"status": "skipped"}

    try:
        doc = item.model_dump()
        await db["history"].replace_one({"id": item.id}, doc, upsert=True)
        return {"status": "success", "id": item.id}
    except Exception as e:
        logger.error(f"Lỗi lưu lịch sử lên MongoDB: {e}")
        return {"status": "error"}


@router.delete("/history/{history_id}", summary="Xóa bản ghi lịch sử trên MongoDB Atlas và Cloudflare R2")
async def delete_cloud_history(history_id: str, background_tasks: BackgroundTasks):
    db = get_database()
    if db is None:
        return {"status": "skipped"}

    try:
        doc = await db["history"].find_one({"id": history_id})
        if doc:
            sess_id = doc.get("sessionId")
            r2_keys = []
            if doc.get("url"):
                fn = doc["url"].split("/")[-1]
                if fn:
                    r2_keys.append(fn)
            for b_fn in doc.get("blockFilenames", []) or []:
                if b_fn:
                    r2_keys.append(b_fn)

            def _cleanup_history_r2(session_id: str | None, keys: list[str]):
                if session_id:
                    delete_session_from_r2(session_id)
                if keys:
                    delete_multiple_from_r2(keys)

            if sess_id or r2_keys:
                background_tasks.add_task(_cleanup_history_r2, sess_id, r2_keys)

        await db["history"].delete_one({"id": history_id})
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Lỗi xóa lịch sử trên MongoDB/R2: {e}")
        return {"status": "error"}



# ── Pronunciation Dictionary Sync ────────────────────────────────────────────

@router.get("/pronunciation", response_model=List[PronunciationSyncItem], summary="Lấy từ điển phát âm từ MongoDB Atlas")
async def get_cloud_pronunciation():
    db = get_database()
    if db is None:
        return []

    try:
        cursor = db["pronunciation_words"].find({}, {"_id": 0})
        words = await cursor.to_list(length=1000)
        return words
    except Exception as e:
        logger.error(f"Lỗi đọc từ điển từ MongoDB: {e}")
        return []


@router.post("/pronunciation", summary="Đồng bộ toàn bộ từ điển phát âm lên MongoDB Atlas")
async def save_cloud_pronunciation(words: List[PronunciationSyncItem]):
    db = get_database()
    if db is None:
        return {"status": "skipped"}

    try:
        # Xóa toàn bộ và cập nhật lại bộ mới
        await db["pronunciation_words"].delete_many({})
        if words:
            docs = [w.model_dump() for w in words]
            await db["pronunciation_words"].insert_many(docs)
        return {"status": "success", "count": len(words)}
    except Exception as e:
        logger.error(f"Lỗi lưu từ điển lên MongoDB: {e}")
        return {"status": "error"}
