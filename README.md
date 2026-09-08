# 🎙️ OmniVoice Studio - Ứng dụng Text-to-Speech Chuyên Nghiệp (24kHz)

Một ứng dụng Text-to-Speech đa ngôn ngữ cao cấp, được xây dựng dựa trên mô hình **OmniVoice** (k2-fsa), mang lại trải nghiệm tạo và quản lý âm thanh như một phòng thu (Studio) chuyên nghiệp. Hệ thống bao gồm Frontend giao diện hiện đại (React + Vite + Tailwind CSS + Sonner) và Backend AI mạnh mẽ (Python + FastAPI + OmniVoice Diffusion).

---

## ✨ Tính Năng Nổi Bật

- 🎛️ **Phòng Thu Đa Chế Độ (Studio):**
  - **Voice Cloning:** Sao chép giọng từ mẫu hệ thống hoặc giọng cá nhân, tự động lưu và tái sử dụng bộ đệm embedding `.pt` (khởi tạo 0ms).
  - **Voice Design:** Tự thiết kế giọng nói qua mô tả đặc tính (`instruct`: giới tính, độ tuổi, tông giọng, thì thầm, v.v.).
  - **Auto Voice:** Tự động điều phối giọng ngẫu nhiên phù hợp với nội dung văn bản.
  - **Thanh công cụ cảm xúc phi ngôn ngữ (Non-verbal symbols):** Chèn nhanh thẻ biểu cảm như `[laughter]`, `[sigh]`, `[surprise-ah]`, `[surprise-oh]`, `[dissatisfaction-hnn]`, `[question-ah]` vào văn bản.
  - **Chất lượng Studio 24,000 Hz:** Âm thanh đầu ra trong trẻo, chi tiết cao, hỗ trợ xuất `.mp3` và `.wav`.
- 📁 **Quản Lý Dự Án (Projects):** Gom nhóm các file âm thanh theo từng dự án riêng biệt (Podcast, Audiobook, Video quảng cáo, v.v.).
- 🎧 **Thư Viện (Library):** Lưu trữ toàn bộ lịch sử tạo âm thanh, nghe lại, tải xuống nhanh chóng, sao chép văn bản và quản lý danh mục.
- 🗣️ **Sao Chép Giọng Nói Tiện Lợi (Cloning Voice):**
  - Tải file hoặc thu âm trực tiếp (3 - 15 giây).
  - **Bóc băng tự động:** Tùy chọn nhập transcript hoặc để trống, hệ thống sẽ tự động dùng Whisper ASR để trích xuất văn bản và lưu prompt `.pt`.
- ⚡ **Tối Ưu Hiệu Suất:**
  - Tốc độ suy luận Diffusion siêu tốc (RTF ~0.025, nhanh gấp ~40 lần real-time).
  - Tích hợp bộ đệm (Cache Hit) ở backend giúp trả về âm thanh ngay lập tức (0ms) cho các yêu cầu trùng lặp.

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
