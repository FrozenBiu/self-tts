from typing import Any
from pydantic import BaseModel, Field


class VoiceItem(BaseModel):
    id: str
    name: str
    gender: str
    description: str
    icon: str
    url: str
    prompt_text: str
    type: str = "preset"
    samples_count: int | None = None
    duration: float | None = None


class RandomVoiceRequest(BaseModel):
    gender: str | None = Field(default=None, description="Giới tính: 'male', 'female' hoặc None")
    age: str | None = Field(default=None, description="Độ tuổi: 'child', 'teenager', 'young adult', 'middle-aged', 'elderly'")
    pitch: str | None = Field(default=None, description="Cao độ: 'very low pitch', 'low pitch', 'moderate pitch', 'high pitch', 'very high pitch'")
    style: str | None = Field(default=None, description="Phong cách: 'cheerful', 'calm', 'serious', 'enthusiastic', 'mysterious', 'warm', 'whisper'...")
    preview_text: str | None = Field(default=None, description="Câu văn đọc thử nghiệm cá nhân")
    seed: int | None = Field(default=None, description="Hạt giống sinh âm thanh ngẫu nhiên")


class RandomVoiceResponse(BaseModel):
    message: str
    filename: str
    audio_url: str
    instruct: str
    seed: int
    gender: str
    age: str
    pitch: str
    style: str | None = None
    preview_text: str
