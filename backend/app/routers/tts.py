from fastapi import APIRouter, BackgroundTasks

from app.schemas.tts import (
    TTSRequest,
    TTSResponse,
    CleanupOrphansRequest,
    CleanupOrphansResponse,
    StitchRequest,
    StitchResponse,
)
from app.services.tts_service import (
    synthesize_speech,
    delete_single_audio,
    cleanup_orphan_files,
    stitch_audio_blocks,
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


@router.delete(
    "/api/tts/{filename}",
    summary="Xóa một file âm thanh đã tổng hợp",
)
async def delete_audio(filename: str):
    return await delete_single_audio(filename)


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
