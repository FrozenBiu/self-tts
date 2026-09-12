from typing import Any
from pydantic import BaseModel, Field

class ExportCaptionRequest(BaseModel):
    session_id: str
    segments: list[dict[str, Any]]
    style_config: dict[str, Any] = Field(default_factory=dict)
    has_voiceover: bool = False
    voiceover_start_time: float = 0.0
    audio_clips: list[dict[str, Any]] = Field(default_factory=list)
    has_bgm: bool = False
    bgm_volume: float = 0.25

class AlignScriptRequest(BaseModel):
    segments: list[dict[str, Any]]
    reference_script: str

class OptimizeChunksRequest(BaseModel):
    segments: list[dict[str, Any]]
    max_words: int = 7

class TrimSilencesRequest(BaseModel):
    session_id: str
    keep_ranges: list[dict[str, float]]
