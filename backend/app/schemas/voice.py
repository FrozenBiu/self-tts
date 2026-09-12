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

class RandomVoiceResponse(BaseModel):
    message: str
    filename: str
    audio_url: str
    instruct: str
    seed: int
