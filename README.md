# 🎙️ OmniVoice Studio - Ứng dụng Text-to-Speech & Video Kinetic Chuyên Nghiệp (24kHz)

Một giải pháp toàn diện cho việc tổng hợp giọng nói AI (Text-to-Speech), nhân bản giọng đọc (Voice Cloning), thiết kế giọng nói (Voice Design) và tự động tạo phụ đề video (Kinetic Karaoke Subtitles) chuẩn Studio 24kHz.

Hệ thống được thiết kế linh hoạt với kiến trúc hiện đại:

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Sonner + Lucide Icons.
- **Backend:** Python + FastAPI + Uvicorn + Mô hình OmniVoice Diffusion (k2-fsa) + Whisper ASR + Motor Async MongoDB.
- **Desktop Runtime:** Electron Native Desktop App + Windows Task Manager Branding + System Tray + Cầu nối IPC File Explorer.

---

## 🌟 3 Tùy Chọn Sử Dụng Linh Hoạt

OmniVoice Studio hỗ trợ 3 hình thức sử dụng phù hợp với mọi nhu cầu:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                   OMNIVOICE STUDIO                     │
                  └───────────────────────────┬────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────┐               ┌───────────────────────┐            ┌──────────────────────┐
│  TÙY CHỌN 1: WEB │               │  TÙY CHỌN 2: DESKTOP  │            │ TÙY CHỌN 3: BỘ CÀI   │
│  Browser Mode    │               │  App Window Mode      │            │ Windows Setup (.exe) │
├──────────────────┤               ├───────────────────────┤            ├──────────────────────┤
│ - Chạy trên Chrome│              │ - Cửa sổ App độc lập  │            │ - File NSIS Setup    │
│ - http://localhost│              │ - Custom TitleBar     │            │ - Cài đặt máy khác   │
│ - Phù hợp dev FE │               │ - Ẩn scrollbar thừa   │            │ - Shortcut Desktop   │
│                  │               │ - Mở thư mục & Play   │            │ - Tự tạo Start Menu  │
├──────────────────┤               ├───────────────────────┤            ├──────────────────────┤
│ ▶️ start_web.bat  │               │ ▶️ start_desktop.bat   │            │ ▶️ build_installer   │
└──────────────────┘               └───────────────────────┘            └──────────────────────┘
```

---

## ✨ Tính Năng Nổi Bật

### 1. 🎛️ Phòng Thu Đa Chế Độ (Studio)

- **Voice Cloning:** Sao chép giọng từ mẫu có sẵn hoặc file ghi âm cá nhân, tự động trích xuất embedding `.pt` (suy luận 0ms với bộ đệm cache).
- **Voice Design:** Tự thiết kế giọng đọc qua câu lệnh mô tả tự nhiên (`instruct`: giới tính, tuổi tác, phong cách, thì thầm, kịch tính, v.v.).
- **Thanh công cụ biểu cảm phi ngôn ngữ (Non-verbal expressions):** Chèn nhanh các cảm xúc tự nhiên vào câu thoại như `[laughter]`, `[sigh]`, `[surprise-ah]`, `[dissatisfaction-hnn]`, `[question-ah]`.
- **Chất lượng âm thanh 24,000 Hz:** Âm thanh trong trẻo, chi tiết cao, hỗ trợ xuất `.mp3` và `.wav`.
- **Lồng nhạc nền DSP Sidechain (Auto-Ducking):** Tự động giảm âm lượng nhạc nền khi có tiếng nói và đẩy nhạc lên ở các đoạn nghỉ.

### 2. 🎬 Tạo Video Phụ Đề Động (Auto Caption - Kinetic Karaoke)

- Tải lên video bài giảng, podcast, tiktok hoặc reels.
- Tự động tách âm thanh, nhận diện lời thoại từng từ (Word-level Timestamps) với Whisper AI.
- Tạo phụ đề chuyển động Kinetic Karaoke mượt mà, hỗ trợ font chữ tùy biến (.ttf, .otf), căn chỉnh vị trí trực tiếp trên màn hình preview.
- Cắt bỏ khoảng lặng thừa (Trim Silences) tự động bằng FFmpeg.
- **Xuất video HD 1080p:** Render phụ đề cứng vào video với tốc độ cao.

### 3. 🎲 Tạo Giọng Mới & Nhân Bản (Cloning Voice)

- **Tạo giọng ngẫu nhiên (Random Voice):** Tự sinh giọng nói độc đáo qua thuật toán Diffusion, nghe thử và lưu vào danh sách giọng sử dụng lâu dài.
- **Clone giọng 1-Click:** Tải lên tệp âm thanh 3 - 15 giây, Whisper tự động bóc băng phụ đề đối chiếu để sinh embedding chuẩn xác.

### 4. 📁 Quản Lý Dự Án & Thư Viện (Projects & Library)

- Gom nhóm các đoạn hội thoại, phân cảnh theo từng dự án riêng biệt.
- Ghép nối hàng loạt phân đoạn âm thanh thành 1 file Master duy nhất kèm phụ đề `.srt` đồng bộ.
- Lưu trữ lịch sử toàn bộ các lần tạo âm thanh, hỗ trợ tìm kiếm, nghe lại và tải về tức thì.

### 5. ⚙️ Bảng Điều Khiển Cài Đặt Tập Trung (Settings)

- Quản lý và kiểm tra kết nối **Cloud GPU (Hugging Face / Google Colab)** chỉ bằng 1 nút bấm.
- Tùy chỉnh số bước khử nhiễu Diffusion Steps (mặc định 32, tối đa 100).
- Cấu hình thư mục lưu trữ tùy biến cho **Âm thanh** và **Video** trên máy tính.
- Quản lý đồng bộ dữ liệu đám mây: **MongoDB Atlas** và **Cloudflare R2 Storage**.

---

## 🛠️ Yêu Cầu Hệ Thống & Cài Đặt Ban Đầu

### 1. Phần mềm cần có trên máy:

- **Hệ điều hành:** Windows 10/11 (khuyên dùng 64-bit).
- **Python:** Phiên bản 3.10 hoặc 3.11 ([Tải Python](https://www.python.org/downloads/)).
- **Node.js:** Phiên bản 18+ ([Tải Node.js](https://nodejs.org/)).
- **pnpm:** Trình quản lý gói hiện đại (`npm install -g pnpm`).
- **FFmpeg:** Bắt buộc để xử lý âm thanh & render video.
  - _Cài đặt nhanh trên Windows:_ Mở Terminal/PowerShell và gõ:
    ```powershell
    winget install Gyan.FFmpeg
    ```
  - Khởi động lại terminal sau khi cài để nhận lệnh `ffmpeg`.

---

### 2. Cài đặt mã nguồn dự án:

Mở PowerShell tại thư mục gốc của dự án và chạy:

#### Bước A: Cài đặt Backend (Python)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
# Git bash
source venv/Scripts/activate

# Nếu máy có card đồ họa NVIDIA (khuyên dùng):
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Cài đặt các thư viện cần thiết:
pip install -r requirements.txt
# python -m pip install -r requirements.txt

# Chạy test
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Bước B: Cài đặt Frontend (React)

```powershell
# Cài đặt dependencies cho frontend và electron
pnpm install
cd frontend
pnpm install
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### 🌐 Tùy Chọn 1: Chế Độ Web (Web Browser Mode)

Dành cho người dùng muốn làm việc trực tiếp trên trình duyệt web (Google Chrome, Microsoft Edge, Brave...):

- **Cách 1 (1-Click - Khuyên dùng):**
  Click đúp vào file **`start_web.bat`** (hoặc `start.bat`) tại thư mục gốc.
  Hệ thống sẽ khởi động cả Backend và Frontend, tự động mở trình duyệt tại:
  👉 **`http://localhost:5173`**
- **Cách 2 (Khởi chạy bằng lệnh):**

  ```powershell
  # Terminal 1: Backend
  cd backend
  .\venv\Scripts\activate
  python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

  # Terminal 2: Frontend
  cd frontend
  pnpm dev
  ```

---

### 💻 Tùy Chọn 2: Chế Độ Desktop App (Native Desktop Mode)

Dành cho trải nghiệm ứng dụng máy tính độc lập cao cấp:

- **Cách 1 (1-Click - Khuyên dùng):**
  Click đúp vào file **`start_desktop.bat`** hoặc biểu tượng **`OmniVoice TTS`** ngoài màn hình Desktop.
- **Cách 2 (Khởi chạy bằng lệnh):**
  ```powershell
  pnpm run desktop:start
  ```
- **Ưu điểm vượt trội của bản Desktop:**
  - Cửa sổ ứng dụng độc lập, không viền trình duyệt thừa, có thanh tiêu đề tùy biến sang trọng.
  - Tự động ẩn thanh scrollbar toàn hệ thống, tự động co giãn layout responsive.
  - **Cơ chế tải file thông minh:** Khi bấm **Xuất Video** hoặc **Tải về Audio**, hệ thống lưu trực tiếp vào máy tính và hiển thị popup:
    - **"📁 Mở thư mục"**: Bật File Explorer và tự động bôi sáng đúng tệp vừa xuất.
    - **"🎬 Xem / Nghe ngay"**: Mở file trực tiếp bằng trình phát mặc định của Windows.
  - Hiển thị nhận diện chính xác **`OmniVoice Studio`** và logo app trong **Windows Task Manager**.

---

### 📦 Tùy Chọn 3: Đóng Gói Thành File Cài Đặt Windows (.exe Installer)

Dành cho người muốn đóng gói ứng dụng thành file cài đặt độc lập để lưu trữ hoặc chia sẻ cho máy khác:

- **Cách 1 (1-Click):**
  Click đúp vào file **`build_installer.bat`** tại thư mục gốc.
- **Cách 2 (Chạy bằng lệnh pnpm):**
  ```powershell
  pnpm run desktop:build
  ```
- **Kết quả đầu ra:**
  Tệp cài đặt chuẩn NSIS sẽ được tạo tại thư mục **`release/`**:
  📁 **`release/OmniVoice Studio Setup 1.0.0.exe`** (~250 MB)
  - 🌟 **Tích hợp sẵn Python Portable:** Người nhận **không cần cài Python hay Node.js**, cài là chạy ngay 100%!
  - 🌐 **Hỗ trợ Cloud GPU 1-Click:** Chỉ cần mở app, vào mục **Cài đặt** dán link Hugging Face hoặc Google Colab vào là tạo giọng AI siêu tốc (ZeroGPU A100).
  - Hỗ trợ chọn thư mục cài đặt (`allowToChangeInstallationDirectory: true`).
  - Tự động tạo Shortcut ngoài màn hình Desktop và trong Start Menu với logo thương hiệu chuẩn.
  - Tích hợp trình gỡ cài đặt (Uninstaller) an toàn.

---

## ⚡ Cấu Hình Cloud GPU Miễn Phí (Khuyên Dùng)

Nếu máy tính của bạn không có card đồ họa rời (VGA NVIDIA) hoặc cấu hình yếu, bạn có thể chuyển toàn bộ tác vụ tính toán AI sang Cloud GPU miễn phí để tạo giọng đọc trong 1-2 giây:

### 🌟 Hugging Face Spaces (ZeroGPU A100) — Hoạt động 24/7

1. Tạo một Space mới trên [Hugging Face Spaces](https://huggingface.co/spaces) (chọn SDK **Gradio**, phần cứng **ZeroGPU**).
2. Tải toàn bộ các file trong thư mục `hf_space/` lên Space của bạn.
3. Khi Space hiển thị trạng thái **Running**, sao chép Direct URL (dạng `https://<ten-ban>-<ten-space>.hf.space`).
4. Vào ứng dụng OmniVoice Studio ➔ Bấm vào **Cài đặt (Settings)** ở góc dưới bên trái ➔ Dán URL vào ô **Cloud GPU URL** ➔ Bấm **Kiểm tra kết nối** và **Lưu cấu hình**.

---

## 📁 Cấu Trúc Mã Nguồn

```text
├── assets/                     # Biểu tượng ứng dụng (app.ico, app.png)
├── backend/                    # Server Python FastAPI & Thuật toán OmniVoice AI
│   ├── app/                    # Mã nguồn backend module hóa
│   │   ├── core/config.py      # Cấu hình biến môi trường & thư mục lưu trữ
│   │   ├── routers/            # Các API endpoints (TTS, Caption, Settings, Sync...)
│   │   └── services/           # Xử lý sinh âm thanh, cắt gọt video FFmpeg
│   ├── main.py                 # Điểm khởi chạy FastAPI
│   ├── requirements.txt        # Danh sách thư viện Python
│   └── .env                    # File cấu hình biến môi trường
├── electron/                   # Mã nguồn ứng dụng Desktop Electron
│   ├── main.cjs                # Quản lý vòng đời Desktop, cửa sổ & tiến trình nền
│   ├── preload.cjs             # Cầu nối IPC bảo mật Context Isolation
│   ├── start.cjs               # Trình khởi chạy OmniVoice Studio.exe
│   └── customize-exe.cjs       # Trình nhúng icon và metadata PE vào file .exe
├── frontend/                   # Ứng dụng giao diện React + Vite + TypeScript
│   ├── src/pages/              # Studio, AutoCaption, Library, Projects, Settings
│   ├── src/components/         # Components UI hiện đại (Shadcn UI, CustomTitleBar...)
│   └── src/store/              # Zustand State Stores
├── scripts/                    # Các kịch bản tự động hóa
│   ├── create_desktop_shortcut.ps1 # Tạo shortcut Desktop native
│   └── tray_manager.ps1        # Tiện ích quản lý khay hệ thống Windows
├── start_web.bat               # Khởi chạy 1-click bản Web Browser
├── start_desktop.bat           # Khởi chạy 1-click bản Desktop App
├── build_installer.bat         # Đóng gói 1-click thành file Setup .exe
└── package.json                # Cấu hình dự án, scripts & electron-builder
```

---

## 📄 Bản Quyền & Giấy Phép

Dự án được phát triển dựa trên mô hình OmniVoice mã nguồn mở theo giấy phép **AGPL-3.0**.
Mọi thắc mắc hoặc đóng góp vui lòng mở Issue hoặc Pull Request trên repository.
