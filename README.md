# 🎙️ VoxCPM2 Studio - Ứng dụng Text-to-Speech Chuyên Nghiệp

Một ứng dụng Text-to-Speech cao cấp, được xây dựng dựa trên mô hình **VoxCPM2**, mang lại trải nghiệm tạo và quản lý âm thanh như một phòng thu (Studio) chuyên nghiệp. Hệ thống bao gồm Frontend giao diện hiện đại (React + Vite + Tailwind CSS) và Backend mạnh mẽ xử lý AI (Python + FastAPI).

---

## ✨ Tính Năng Nổi Bật

- 🎛️ **Phòng Thu (Studio):** Tạo giọng nói từ văn bản với nhiều tham số tùy chỉnh chuyên sâu:
  - Chọn giọng mẫu (Preset) hoặc giọng cá nhân (Custom).
  - Tùy chỉnh cường độ (CFG Scale), số bước suy luận (Timesteps), Speed (Tốc độ), Pitch (Độ cao).
  - Hỗ trợ lưu dưới định dạng `.mp3` và `.wav`.
- 📁 **Quản Lý Dự Án (Projects):** Gom nhóm các file âm thanh theo từng dự án riêng biệt để dễ dàng quản lý khối lượng công việc lớn (ví dụ: làm Vlog, Audiobook, Video quảng cáo).
- 🎧 **Thư Viện (Library):** Lưu trữ toàn bộ lịch sử tạo âm thanh, cho phép nghe lại, tải xuống nhanh chóng, sao chép văn bản, và di chuyển qua lại giữa các dự án.
- 🗣️ **Sao Chép Giọng Nói (Cloning Voice):** (Đang phát triển) Hỗ trợ tải tệp âm thanh gốc lên để hệ thống tự động trích xuất đặc trưng và tạo ra giọng đọc y hệt.
- ⚡ **Tối Ưu Hiệu Suất:**
  - Giao diện (UI) mượt mà, hỗ trợ Dark Mode và các hiệu ứng hiện đại.
  - Tích hợp bộ đệm (Cache Hit) ở backend giúp trả về âm thanh ngay lập tức (0ms) nếu tạo lại trùng văn bản và các tham số cũ.

---

## 🛠️ Yêu Cầu Hệ Thống

Trước khi bắt đầu, đảm bảo máy tính của bạn đã cài đặt:

- **Python 3.10+** (khuyên dùng Python 3.11).
- **Node.js v18+**.
- **pnpm** (Trình quản lý gói cho Node.js).
- **FFmpeg** (Bắt buộc để xử lý âm thanh ở Backend).
  - **Cài đặt nhanh trên Windows:** Mở terminal (với quyền Admin nếu cần) và chạy lệnh: `winget install Gyan.FFmpeg` (hoặc `winget install ffmpeg`).
  - Sau khi cài đặt xong, hãy **khởi động lại máy tính** hoặc **khởi động lại Terminal/VSCode** để hệ thống nhận diện biến môi trường PATH của FFmpeg.

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Cài đặt Backend (Python)

Mở terminal và thực hiện các bước sau:

```bash
# Di chuyển vào thư mục backend
cd backend

# Tạo môi trường ảo (Virtual Environment)
python -m venv venv

# Kích hoạt môi trường ảo (Windows)
# Powershell
.\venv\Scripts\activate
# Git bash
source venv/Scripts/activate

# Cài đặt PyTorch hỗ trợ CUDA 12.4 (Quan trọng cho máy có card NVIDIA)
# Lưu ý: Chạy lệnh này TRƯỚC để ép tải bản GPU, tránh tải nhầm bản CPU
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124 --upgrade --force-reinstall

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# Khởi chạy server Backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

_Backend sẽ chạy tại địa chỉ: `http://localhost:8000`_

### 2. Cài đặt Frontend (React + Vite)

Mở một tab terminal mới và thực hiện:

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt các gói phụ thuộc bằng pnpm
pnpm install

# Khởi chạy giao diện ứng dụng
pnpm dev
```

_Frontend sẽ chạy tại địa chỉ: `http://localhost:5173`_

---

## 📖 Hướng Dẫn Sử Dụng

1. **Truy cập Ứng dụng:** Mở trình duyệt và truy cập vào `http://localhost:5173`.
2. **Tạo Dự Án Mới (Tùy chọn):**
   - Chuyển sang tab **Dự án** trên menu bên trái.
   - Bấm `Tạo dự án mới`, nhập tên và mô tả.
3. **Sử Dụng Phòng Thu:**
   - Quay lại tab **Phòng thu**.
   - Nhập đoạn văn bản bạn muốn chuyển đổi thành giọng nói.
   - Ở cột **Cài đặt mô hình** bên phải, chọn _Lưu vào dự án_ vừa tạo, chọn định dạng âm thanh (.MP3 hoặc .WAV) và các tham số kỹ thuật.
   - Bấm **Bắt đầu tổng hợp**.
4. **Quản lý Thư viện:**
   - Tại tab **Thư viện**, bạn có thể xem lại toàn bộ lịch sử các âm thanh đã tạo.
   - Tại đây có thể nghe thử, đổi dự án cho file audio, sao chép văn bản, hoặc nhấn nút **Tải xuống**.

---

## 🏗️ Cấu Trúc Mã Nguồn

- `/backend/`: Chứa mã nguồn Python, API FastAPI, module AI (ModelScope/PyTorch).
  - `main.py`: Entry point API.
  - `model_handler.py`: Logic gọi mô hình TTS.
  - `/presets/`, `/outputs/`: Nơi lưu trữ file âm thanh và config json.
- `/frontend/`: Chứa ứng dụng React (Vite).
  - `/src/pages/`: Các trang (Studio, Library, Projects, CloningVoice).
  - `/src/store/`: Quản lý trạng thái bằng thư viện `zustand` (`useTTSStore.ts`).
  - `/src/components/`: Chứa các Component dùng chung (UI Components).

---

_Phát triển bởi đội ngũ đam mê AI._
