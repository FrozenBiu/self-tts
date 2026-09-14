from fastapi import APIRouter, BackgroundTasks

from app.schemas.tts import (
    TTSRequest,
    TTSResponse,
    CleanupOrphansRequest,
    CleanupOrphansResponse,
    DeleteBatchAudioRequest,
    StitchRequest,
    StitchResponse,
)
from app.services.tts_service import (
    synthesize_speech,
    delete_single_audio,
    delete_audio_session,
    delete_multiple_audios,
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
