import os
import shutil
from pathlib import Path
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.core.config import AUDIOS_DIR, OUTPUTS_DIR, logger
from app.schemas.tts import (
    TTSRequest,
    TTSResponse,
    CleanupOrphansRequest,
    CleanupOrphansResponse,
    DeleteBatchAudioRequest,
    StitchRequest,
    StitchResponse,
    LocateAudioRequest,
    LocateAudioResponse,
)
from app.services.tts_service import (
    synthesize_speech,
    delete_single_audio,
    delete_audio_session,
    delete_multiple_audios,
    cleanup_orphan_files,
    stitch_audio_blocks,
    _find_audio_file,
)

router = APIRouter(tags=["TTS"])


@router.post(
    "/api/tts",
    response_model=TTSResponse,
    summary="Tổng hợp giọng nói từ văn bản",
)
async def text_to_speech(
    request: TTSRequest,
    background_tasks: BackgroundTasks,
):
    return await synthesize_speech(request, background_tasks)


@router.post(
    "/api/tts/locate",
    response_model=LocateAudioResponse,
    summary="Xác định vị trí tệp âm thanh trên đĩa cứng và đồng bộ sang thư mục lưu trữ Audio",
)
async def locate_audio(request: LocateAudioRequest):
    raw_filename = (
        request.custom_filename
        or request.filename
        or request.url.split("?")[0].split("/").pop()
        or "audio.mp3"
    )
    safe_filename = os.path.basename(raw_filename)
    if not safe_filename:
        safe_filename = "audio.mp3"

    AUDIOS_DIR.mkdir(parents=True, exist_ok=True)
    target_dest = AUDIOS_DIR / safe_filename

    # 1. Nếu file đã có sẵn trong AUDIOS_DIR
    if target_dest.exists():
        size_mb = round(os.path.getsize(target_dest) / (1024 * 1024), 2)
        return LocateAudioResponse(
            status="success",
            filename=safe_filename,
            file_path=str(target_dest.resolve()),
            dir_path=str(target_dest.parent.resolve()),
            file_size_mb=size_mb,
        )

    # 2. Tìm kiếm trong OUTPUTS_DIR và các thư mục session con
    found_path = _find_audio_file(safe_filename)
    if not found_path:
        for p in OUTPUTS_DIR.glob(f"**/{safe_filename}"):
            if p.is_file():
                found_path = p
                break

    if found_path and found_path.exists():
        try:
            shutil.copy2(found_path, target_dest)
            final_path = target_dest
        except Exception as e:
            logger.warning(f"Không thể copy sang AUDIOS_DIR: {e}")
            final_path = found_path

        size_mb = round(os.path.getsize(final_path) / (1024 * 1024), 2)
        return LocateAudioResponse(
            status="success",
            filename=safe_filename,
            file_path=str(final_path.resolve()),
            dir_path=str(final_path.parent.resolve()),
            file_size_mb=size_mb,
        )

    # 3. Nếu là URL từ xa (R2 Cloudflare hoặc server ngoài)
    if request.url.startswith("http://") or request.url.startswith("https://"):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(request.url)
                if res.status_code == 200:
                    with open(target_dest, "wb") as f:
                        f.write(res.content)
                    size_mb = round(os.path.getsize(target_dest) / (1024 * 1024), 2)
                    return LocateAudioResponse(
                        status="success",
                        filename=safe_filename,
                        file_path=str(target_dest.resolve()),
                        dir_path=str(target_dest.parent.resolve()),
                        file_size_mb=size_mb,
                    )
        except Exception as exc:
            logger.warning(f"Lỗi khi tải audio từ URL {request.url}: {exc}")

    raise HTTPException(status_code=404, detail=f"Không tìm thấy file audio '{safe_filename}' trên hệ thống")



@router.delete(
    "/api/tts/session/{session_id}",
    summary="Xóa trọn gói thư mục session âm thanh (outputs/audios/{session_id}) và trên Cloudflare R2",
)
async def delete_session(session_id: str, background_tasks: BackgroundTasks):
    return await delete_audio_session(session_id, background_tasks=background_tasks)


@router.delete(
    "/api/tts/{filename}",
    summary="Xóa một file âm thanh đã tổng hợp (hoặc session_id nếu là thư mục)",
)
async def delete_audio(filename: str, background_tasks: BackgroundTasks):
    return await delete_single_audio(filename, background_tasks=background_tasks)


@router.post(
    "/api/tts/delete-batch",
    summary="Xóa nhiều file âm thanh kèm phụ đề và R2",
)
async def delete_batch_audios(request: DeleteBatchAudioRequest, background_tasks: BackgroundTasks):
    return await delete_multiple_audios(request.filenames, background_tasks=background_tasks)


@router.post(
    "/api/tts/cleanup-orphans",
    response_model=CleanupOrphansResponse,
    summary="Dọn dẹp các file âm thanh và phụ đề rác không còn được sử dụng",
)
async def cleanup_orphans(request: CleanupOrphansRequest):
    return await cleanup_orphan_files(request)


@router.post(
    "/api/tts/stitch",
    response_model=StitchResponse,
    summary="Ghép nối các đoạn âm thanh phân đoạn kèm khoảng lặng và sinh phụ đề SRT",
)
@router.post(
    "/api/stitch-audio",
    response_model=StitchResponse,
    summary="Ghép nối các đoạn âm thanh (alias)",
)
async def stitch_audio(
    request: StitchRequest,
    background_tasks: BackgroundTasks,
):
    return await stitch_audio_blocks(request, background_tasks)
