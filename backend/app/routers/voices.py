from fastapi import APIRouter, File, UploadFile, Form, BackgroundTasks

from app.services.voice_service import (
    fetch_all_voices,
    clone_custom_voice,
    remove_custom_voice,
    generate_random_preview,
    discard_preview_voice,
    save_preview_as_custom_voice,
)

router = APIRouter(prefix="/api/voices", tags=["Voices"])


@router.get("", summary="Lấy danh sách tất cả giọng đọc mẫu và giọng tự tạo")
async def get_voices():
    """Trả về danh sách giọng đọc mặc định và giọng tùy chỉnh do người dùng tạo."""
    return await fetch_all_voices()


@router.post("/clone", summary="Clone giọng đọc từ file tải lên và tạo cache .pt")
async def clone_voice(
    file: UploadFile = File(...),
    name: str = Form(...),
    transcript: str | None = Form(None),
    description: str = Form("Giọng tự tạo"),
    gender: str = Form("all"),
    icon: str = Form("record_voice_over"),
):
    return await clone_custom_voice(
        file=file,
        name=name,
        transcript=transcript,
        description=description,
        gender=gender,
        icon=icon,
    )


@router.delete("/custom/{voice_id}", summary="Xoá giọng đọc tự tạo")
async def delete_custom_voice(voice_id: str):
    return await remove_custom_voice(voice_id)


@router.post("/random", summary="Tạo giọng ngẫu nhiên để xem trước (preview)")
async def generate_random_voice(background_tasks: BackgroundTasks):
    return await generate_random_preview(background_tasks)


@router.delete("/discard-random/{filename}", summary="Huỷ bỏ file preview ngẫu nhiên không sử dụng")
@router.delete("/random/{filename}", summary="Huỷ bỏ file preview ngẫu nhiên (alias)")
async def discard_random_voice(filename: str):
    return await discard_preview_voice(filename)


@router.post("/save-random", summary="Lưu giọng ngẫu nhiên vừa preview thành custom voice")
async def save_random_voice(
    name: str = Form(...),
    description: str = Form("Giọng ngẫu nhiên"),
    gender: str = Form("all"),
    icon: str = Form("casino"),
    filename: str = Form(...),
    instruct: str = Form(""),
):
    return await save_preview_as_custom_voice(
        name=name,
        description=description,
        gender=gender,
        icon=icon,
        filename=filename,
        instruct=instruct,
    )
