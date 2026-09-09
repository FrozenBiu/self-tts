# Kiến Trúc Tính Năng: Auto Kinetic Caption & Video Editor Pipeline (Local)

Tài liệu đặc tả kiến trúc và các bước triển khai tính năng tự động tạo phụ đề chạy từng từ (Kinetic Caption) cho web app chạy local. Hệ thống nhận video đã ghép sẵn voice từ CapCut, bóc tách phụ đề bằng AI, cho phép tùy biến trực tiếp trên web và xuất ra file MP4 hoàn chỉnh.

---

## 1. Sơ Đồ Quy Trình (Pipeline Workflow)

1. **Upload:** Người dùng tải file `video_raw.mp4` lên Web App.
2. **Audio Extraction:** Backend dùng `FFmpeg` tách riêng luồng âm thanh `audio.wav`.
3. **STT & Alignment:** `Faster-Whisper` (kèm `Silero VAD`) phân tích `audio.wav` để lấy mốc thời gian chi tiết từng từ (Word-level timestamps).
4. **Client Preview & Edit:**
   - Frontend hiển thị trình phát video với lớp phủ (Overlay) giả lập chữ chạy theo thời gian thực.
   - Người dùng chỉnh sửa text sai chính tả, đổi font, cỡ chữ, màu highlight, kéo thả vị trí và upload thêm file nhạc nền (BGM).
5. **Export:**
   - Backend nhận cấu hình tùy chỉnh từ Frontend, sinh file phụ đề Karaoke (`.ass`) và dùng `FFmpeg` vừa ép cứng phụ đề vừa hòa âm (mix) nhạc nền ra file `output.mp4`.

---

## 2. Kiến Trúc Backend (Python / FastAPI)

### A. Công nghệ lõi

- **Faster-Whisper:** Chạy mô hình Whisper qua CTranslate2 trên GPU CUDA (nhanh gấp 4 lần Whisper gốc).
- **Silero VAD:** Lọc bỏ khoảng lặng và các đoạn chỉ có nhạc nền, ngăn model tự sinh chữ ảo giác (hallucination).
- **FFmpeg:** Tách âm thanh đầu vào và render video đầu ra.

### B. Payload JSON chuẩn trả về cho Frontend

Mỗi block câu chứa danh sách các từ kèm mốc thời gian chính xác:

```json
[
  {
    "id": 1,
    "start": 0.52,
    "end": 2.15,
    "text": "Xin chào các bạn đã quay trở lại",
    "words": [
      { "word": "Xin", "start": 0.52, "end": 0.8 },
      { "word": "chào", "start": 0.81, "end": 1.1 },
      { "word": "các", "start": 1.11, "end": 1.35 },
      { "word": "bạn", "start": 1.36, "end": 1.6 },
      { "word": "đã", "start": 1.61, "end": 1.8 },
      { "word": "quay", "start": 1.81, "end": 1.95 },
      { "word": "trở", "start": 1.96, "end": 2.05 },
      { "word": "lại", "start": 2.06, "end": 2.15 }
    ]
  }
]
```

---

## 3. Kiến Trúc Frontend (React / Web UI)

### A. Cơ chế Preview theo thời gian thực (Overlay Engine)

- **HTML5 Video Player:** Phát video thô gốc.
- **Div Overlay (`position: absolute`):** Nằm đè lên khung video, bắt sự kiện `onTimeUpdate` từ video để lấy `currentTime`.
- **Logic Highlight từ:**
  - Tìm block phụ đề có: `segment.start <= currentTime <= segment.end`.
  - Duyệt qua mảng `words`, từ nào có `word.start <= currentTime <= word.end` thì thêm class CSS highlight (màu vàng neon, scale 1.15x).

### B. Bảng điều khiển tùy biến (Control Panel)

- **Transcript Editor:** Bảng danh sách các câu cho phép click vào sửa text trực tiếp.
- **Style Controls:**
  - **Font Family:** Montserrat, Inter, Be Vietnam Pro, The Bold Font...
  - **Font Size:** Slider từ 18px đến 72px.
  - **Color:** Primary Color (màu chữ gốc) & Highlight Color (màu chữ khi đọc tới).
  - **Stroke / Border:** Độ dày viền đen chống chìm chữ.
  - **Position:** Kéo thả hoặc chọn căn Top, Middle, Bottom.
- **Background Music (BGM):** Tải file nhạc `.mp3`, điều chỉnh âm lượng (0% đến 100%) và phát thử đồng bộ với video.

---

## 4. Xử Lý Render File Thành Phẩm (FFmpeg Export Engine)

Khi người dùng bấm **Export**, Frontend gửi toàn bộ cấu hình về Backend:

### Bước 1: Sinh file phụ đề Karaoke (`.ass`) từ cấu hình người dùng

File `.ass` quy định màu sắc, viền, font và hiệu ứng Karaoke `{\k<thời gian>}`:

```ini
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Alignment, MarginV
Style: HighlightStyle,Montserrat,48,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,2,80

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.52,0:00:02.15,HighlightStyle,,0,0,0,,{\k28}Xin {\k29}chào {\k24}các {\k25}bạn {\k19}đã {\k14}quay {\k10}trở {\k9}lại
```

*(Trong đó `&H0000FFFF` là màu vàng highlight theo mã BGR hex của ASS, `\k<cs>` là thời gian giữ highlight tính bằng centisecond).*

### Bước 2: Dùng FFmpeg ghép phụ đề và mix nhạc nền

Chạy một lệnh FFmpeg duy nhất để xuất video 2K/1080p sắc nét mà không bị giảm chất lượng:

```bash
ffmpeg -i input_raw.mp4 -i bgm.mp3 -filter_complex \
"[1:a]volume=0.25[bgm_low]; \
 [0:a][bgm_low]amix=inputs=2:duration=first[a_mixed]; \
 [0:v]ass=subtitles.ass[v_sub]" \
-map "[v_sub]" -map "[a_mixed]" \
-c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k \
output_final.mp4
```

---

## 5. Checklist Triển Khai

- [ ] Cài đặt thư viện backend: `pip install faster-whisper`
- [ ] Viết hàm tách audio và gọi Faster-Whisper với tham số `word_timestamps=True` và `vad_filter=True`.
- [ ] Dựng component React: Video player + CSS Overlay tính highlight từ theo `currentTime`.
- [ ] Xây dựng thanh công cụ đổi màu, font và vị trí cho text overlay.
- [ ] Viết hàm Python convert JSON timestamps + style UI thành file template `.ass`.
- [ ] Viết API endpoint nhận cấu hình và gọi lệnh FFmpeg render ra file MP4 cuối cùng.
