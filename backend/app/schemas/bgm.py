from pydantic import BaseModel, Field


class BGMTrack(BaseModel):
    id: str
    name: str
    filename: str
    url: str
    duration: float | None = None
    is_preset: bool = True
    category: str = "general"


class BGMListResponse(BaseModel):
    tracks: list[BGMTrack]


class BGMMixRequest(BaseModel):
    voice_filename: str = Field(..., description="Tên file giọng nói trong outputs/ (vd: master_xyz.mp3)")
    bgm_id: str = Field(..., description="ID của bản nhạc nền (preset hoặc custom)")
    bgm_volume: float = Field(default=0.25, ge=0.01, le=1.0, description="Âm lượng nhạc nền cơ sở (0.05 -> 1.0)")
    ducking_depth: str = Field(
        default="medium",
        description="Mức độ giảm âm lượng khi có giọng nói: 'light' (-8dB), 'medium' (-14dB), 'deep' (-20dB)",
    )


class BGMMixResponse(BaseModel):
    message: str
    filename: str
    audio_url: str
    duration: float | None = None


class BGMUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150, description="Tên hiển thị mới của bản nhạc")
