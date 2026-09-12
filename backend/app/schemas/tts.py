from typing import Any
from pydantic import BaseModel, Field

class TTSRequest(BaseModel):
    """Payload cho endpoint POST /api/tts"""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Văn bản cần tổng hợp giọng nói (tối đa 5000 ký tự, hỗ trợ thẻ phi ngôn ngữ như [laughter]).",
        examples=["Xin chào! [laughter] Rất vui được gặp bạn."],
    )
    mode: str = Field(
        default="clone",
        description="Chế độ tổng hợp: 'clone' (sao chép giọng), 'design' (thiết kế giọng qua instruct).",
    )
    instruct: str | None = Field(
        default=None,
        description="Câu lệnh mô tả thuộc tính giọng nói cho chế độ Voice Design (vd: 'female, whisper, gentle').",
    )
    cfg_value: float = Field(
        default=2.0,
        ge=1.0,
        le=3.0,
        description="Guidance scale (1.0 - 3.0). Mặc định 2.0.",
    )
    num_step: int | None = Field(
        default=None,
        ge=4,
        le=100,
        description="Số bước khử nhiễu Diffusion (4-100). Nếu để trống, tự động lấy theo DEFAULT_NUM_STEP trong .env.",
    )
    inference_timesteps: int | None = Field(
        default=None,
        description="Tương thích ngược với tham số cũ (sẽ ghi đè num_step nếu được truyền).",
    )
    normalize: bool = Field(
        default=False,
        description="Bật chuẩn hóa văn bản số, ngày tháng.",
    )
    voice_id: str | None = Field(
        default=None,
        description="ID giọng mẫu (preset hoặc custom).",
    )
    prompt_wav_path: str | None = Field(
        default=None,
        description="(Tùy chọn) Đường dẫn file WAV tham chiếu để clone giọng.",
    )
    prompt_text: str | None = Field(
        default=None,
        description="(Tùy chọn) Transcript của prompt_wav_path (nếu để trống, Whisper sẽ tự bóc băng).",
    )
    seed: int | None = Field(
        default=42,
        description="Seed để cố định tính ngẫu nhiên.",
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Tốc độ đọc (0.5x - 2.0x).",
    )
    pitch: float = Field(
        default=0.0,
        ge=-12.0,
        le=12.0,
        description="Cao độ giọng (bán cung).",
    )
    format: str = Field(
        default="mp3",
        description="Định dạng âm thanh đầu ra: 'mp3' hoặc 'wav'.",
    )
    enhance_audio: bool = Field(
        default=True,
        description="Bật bộ lọc Studio Hi-Fi (Low-cut, EQ, Soft Compressor, 44.1kHz).",
    )
    engine: str = Field(
        default="omnivoice",
        description="Engine tổng hợp: 'omnivoice'.",
    )


class TTSResponse(BaseModel):
    message: str
    filename: str
    audio_url: str


class CleanupOrphansRequest(BaseModel):
    active_filenames: list[str] = Field(
        default_factory=list,
        description="Danh sách các filename đang được sử dụng trong projects và history",
    )
    max_age_minutes: int = Field(
        default=15,
        description="Chỉ xoá file rác có tuổi thọ lớn hơn số phút này",
    )
    force: bool = Field(
        default=False,
        description="Xoá tất cả file rác không dùng ngay lập tức (không cần đợi hết hạn)",
    )


class CleanupOrphansResponse(BaseModel):
    message: str
    deleted_count: int
    freed_bytes: int
    freed_mb: float


class StitchBlockItem(BaseModel):
    filename: str = Field(..., description="Tên file âm thanh trong outputs/ (vd: tts_abc.mp3)")
    pause_after: float = Field(default=0.5, ge=0.0, le=10.0, description="Khoảng lặng sau đoạn tính bằng giây")
    text: str = Field(default="", description="Văn bản của đoạn để sinh phụ đề SRT")


class StitchRequest(BaseModel):
    blocks: list[StitchBlockItem] = Field(..., min_length=1, description="Danh sách các phân đoạn cần ghép nối")
    format: str = Field(default="mp3", description="Định dạng âm thanh đầu ra: 'mp3' hoặc 'wav'")
    project_name: str | None = Field(default=None, description="Tên dự án (tùy chọn)")


class StitchResponse(BaseModel):
    message: str
    filename: str
    audio_url: str
    srt_filename: str | None = None
    srt_url: str | None = None
    total_duration: float
