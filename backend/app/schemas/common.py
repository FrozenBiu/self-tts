from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool

class EngineItem(BaseModel):
    id: str
    name: str
    description: str
    is_default: bool

class EngineResponse(BaseModel):
    engines: list[EngineItem]
