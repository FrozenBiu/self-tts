# 🖥️ HƯỚNG DẪN CẤU HÌNH SỬ DỤNG GPU LOCAL (MÁY TÍNH CÁ NHÂN)

Tài liệu này hướng dẫn bạn cách thiết lập để toàn bộ mô hình AI OmniVoice TTS chạy trực tiếp trên **card đồ họa rời (NVIDIA GPU)** của máy tính bạn. Không phụ thuộc vào kết nối Internet, không độ trễ mạng, xử lý âm thanh siêu tốc offline 100%.

---

## 1. Yêu Cầu Phần Cứng & Môi Trường

- **Hệ điều hành:** Windows 10/11 (64-bit) hoặc Ubuntu Linux.
- **Card đồ họa (VGA):** Card rời **NVIDIA** (dòng GTX 1660 Super, RTX 2060, RTX 3050 trở lên).
- **VRAM (Bộ nhớ video):** Tối thiểu **6GB VRAM** (khuyến nghị **8GB VRAM trở lên** để chạy song song mượt mà).
- **Driver NVIDIA:** Đã cài driver mới nhất từ trang chủ NVIDIA.
- **Python:** Phiên bản `3.10` hoặc `3.11` (Khuyên dùng `3.10.x` ổn định nhất cho AI).

---

## 2. Các Bước Cài Đặt Môi Trường GPU Local

### Bước 2.1: Mở Terminal tại thư mục `backend` và kích hoạt Virtualenv
```bash
cd backend
# Nếu chưa có virtualenv thì tạo mới:
python -m venv venv

# Kích hoạt môi trường ảo:
venv\Scripts\activate
```

### Bước 2.2: Cài đặt PyTorch hỗ trợ CUDA
Mô hình yêu cầu bản PyTorch biên dịch cho GPU NVIDIA (CUDA). Chạy lệnh sau để cài đặt:
```bash
# Cài đặt PyTorch với CUDA 12.1 (Phổ biến và tương thích cao nhất)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

> **Kiểm tra nhanh xem Python đã nhận GPU chưa:**
> ```bash
> python -c "import torch; print('CUDA Available:', torch.cuda.is_available(), '| GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU')"
> ```
> 👉 Nếu màn hình hiện: `CUDA Available: True | GPU: NVIDIA GeForce RTX ...` là môi trường đã chuẩn 100%!

### Bước 2.3: Cài đặt các thư viện cần thiết của dự án
```bash
pip install -r requirements.txt
```

---

## 3. Cấu Hình File `backend/.env` Cho GPU Local

Mở file `backend/.env` (nếu chưa có, bạn copy từ `backend/.env.example` và đổi tên thành `.env`). Thiết lập các biến sau:

```env
# ==============================================================================
# CHẾ ĐỘ MÁY CHỦ GPU TỪ XA (REMOTE WORKER)
# ==============================================================================
# Đặt false để ép buộc hệ thống chạy trực tiếp trên card NVIDIA máy bạn
USE_REMOTE_GPU=false
REMOTE_GPU_URL=

# ==============================================================================
# CẤU HÌNH PHẦN CỨNG NỘI BỘ (LOCAL HARDWARE INFERENCE)
# ==============================================================================
# Thiết bị tính toán: 'cuda' (Khuyên dùng), 'cuda:0', hoặc 'cpu'
DEVICE=cuda

# Kiểu dữ liệu số học:
# - 'float16' : (Khuyên dùng cho GPU) Giảm 50% dung lượng VRAM, tốc độ sinh gấp đôi.
# - 'bfloat16': Rất tốt cho dòng RTX 30xx, RTX 40xx.
# - 'float32' : Dành cho CPU (không dùng cho GPU vì tốn VRAM).
TORCH_DTYPE=float16

# Tăng tốc độ tính toán ma trận tích chập cho NVIDIA
CUDNN_BENCHMARK=true

# Hệ số dự đoán token âm thanh (giữ nguyên 1.0)
TOKEN_PADDING_FACTOR=1.0

# Xuất âm thanh tự động
AUDIO_MP3_BACKEND=auto
```

---

## 4. Khởi Chạy Ứng Dụng

Sau khi cấu hình xong, bạn mở 2 cửa sổ Command Prompt/PowerShell:

### Terminal 1: Chạy Backend
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Khi khởi động, log sẽ thông báo:
```text
[INFO] model_handler — 🚀 Đang tải mô hình k2-fsa/OmniVoice (Device=cuda, Dtype=torch.float16)...
[INFO] model_handler — ✅ OmniVoice đã sẵn sàng phục vụ trên GPU NVIDIA!
```

### Terminal 2: Chạy Frontend
```bash
cd frontend
pnpm dev
```
Mở trình duyệt tại `http://localhost:5173`. Bây giờ khi bạn bấm **Tạo mẫu giọng** hoặc **Sinh âm thanh**, toàn bộ quá trình xử lý diễn ra trực tiếp trên GPU máy tính của bạn với tốc độ cực nhanh (chỉ từ 0.5s đến 1.5s mỗi câu).

---

## 5. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Lỗi | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| `CUDA out of memory` | VRAM của card bị đầy do mở nhiều game/phần mềm đồ họa khác | Tắt các ứng dụng đồ họa nặng hoặc game đang chạy nền; đảm bảo `TORCH_DTYPE=float16`. |
| `Torch not compiled with CUDA enabled` | Cài nhầm bản PyTorch CPU | Chạy lại lệnh cài đặt PyTorch CUDA ở **Bước 2.2**. |
| Quạt tản nhiệt quay mạnh khi tạo audio | Card GPU đang hoạt động hết công suất để tính toán | Đây là hiện tượng bình thường khi GPU tính toán song song, thời gian chỉ kéo dài 1-2 giây cho mỗi câu. |
