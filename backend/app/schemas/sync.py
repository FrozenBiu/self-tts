from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SyncStatusResponse(BaseModel):
    mode: str = Field(..., description="'cloud' hoặc 'local'")
    mongo_connected: bool = Field(..., description="Trạng thái kết nối MongoDB Atlas")
    r2_connected: bool = Field(..., description="Trạng thái kết nối Cloudflare R2")
    message: str = Field(..., description="Thông báo chi tiết")


class ProjectSyncItem(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    createdAt: int
    blocks: Optional[List[Dict[str, Any]]] = []
    masterAudioUrl: Optional[str] = None
    masterFilename: Optional[str] = None
    masterSrtUrl: Optional[str] = None
    masterDuration: Optional[float] = None
    updatedAt: Optional[int] = None


class HistorySyncItem(BaseModel):
    id: str
    text: str
    url: str
    timestamp: int
    projectId: Optional[str] = None
    voiceId: Optional[str] = None
    voiceName: Optional[str] = None
    mode: Optional[str] = None
    instruct: Optional[str] = None
    num_step: Optional[int] = None
    cfg_value: Optional[float] = None
    inference_timesteps: Optional[int] = None
    seed: Optional[int] = None
    speed: Optional[float] = None
    pitch: Optional[float] = None
    engine: Optional[str] = None
    blockFilenames: Optional[List[str]] = []
    sessionId: Optional[str] = None


class PronunciationSyncItem(BaseModel):
    id: str
    original: str
    pronunciation: str
    enabled: bool = True
