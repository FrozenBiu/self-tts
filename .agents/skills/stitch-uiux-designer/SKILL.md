---
name: stitch-uiux-designer
description: >-
  Thiết kế giao diện UI/UX trực quan bằng Stitch MCP trước khi lập trình.
  Tạo màn hình mẫu (screens), xây dựng Design System và trích xuất bộ màu,
  typography, CSS tokens đồng bộ cho dự án Next.js.
---

# Stitch UI/UX Designer Skill

Subagent này chịu trách nhiệm nghiên cứu trải nghiệm người dùng, tạo bản vẽ giao diện trực quan thông qua **Stitch MCP**, và trích xuất các quy chuẩn thiết kế thành CSS tokens trước khi chuyển sang giai đoạn code frontend.

---

## 1. Quy Trình Làm Việc (Design-First Workflow)

1. **Thu thập yêu cầu & Tra cứu mẫu thiết kế (kết hợp `ui-ux-pro-max`)**:
   - Sử dụng kiến thức từ skill `ui-ux-pro-max` để chọn phong cách phù hợp (Bento Grid, Modern SaaS, Dark Minimalist, Glassmorphism).
   - Chọn bộ Font Pairing (Inter / Outfit / Plus Jakarta Sans) và bảng màu chuẩn WCAG contrast (>= 4.5:1).
2. **Khởi tạo Project trên Stitch**: Gọi công cụ `create_project` từ Stitch MCP.
3. **Sinh màn hình thiết kế trực quan**: Gọi `generate_screen_from_text` với prompt chi tiết dựa trên thông tin đã tổng hợp từ `ui-ux-pro-max` để tạo các màn hình chính (Landing page, Dashboard, Settings, Detail view).
4. **Phân tích và trích xuất Design Tokens**: Lấy mã màu (Primary, Accent, Muted, Background), Typography scale, Border-radius và Spacing từ bản thiết kế của Stitch.
5. **Cấu hình `globals.css` / Tailwind**: Xuất các biến CSS tokens sang `src/app/globals.css` để sẵn sàng cho `nextjs-frontend-ui`.

---

## 2. Các Lệnh Thao Tác Với Stitch MCP

### Bước 1: Tạo dự án thiết kế
```json
{
  "title": "Tên Dự Án (VD: AI Task Manager)",
  "description": "Mô tả mục tiêu sản phẩm, đối tượng người dùng, phong cách thiết kế hiện đại, tinh tế"
}
```

### Bước 2: Tạo màn hình thiết kế
Gọi `generate_screen_from_text` với prompt chi tiết:
- Nêu rõ phong cách hình ảnh (Dark mode / Light mode, Glassmorphism, Clean borders).
- Bố cục: Header bar, Sidebar điều hướng, vùng thống kê Metrics, Data Table / Cards trực quan.
- Trạng thái tương tác: Empty state, Hover state, Modal popups.

### Bước 3: Lấy thông tin màn hình & mã nguồn thiết kế
Gọi `get_screen` để kiểm tra cấu trúc DOM và CSS styling của màn hình vừa sinh ra.

---

## 3. Chuyển Đổi Thiết Kế Thành `src/app/globals.css`

Ánh xạ các thông số từ Stitch MCP vào file CSS biến hệ thống của Next.js:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.75rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

---

## 4. Bàn Giao Thiết Kế (Handoff to Frontend)
Sau khi thiết kế xong, Designer cung cấp cho Frontend:
1. Danh sách component cần triển khai (Cards, Dialog, Table, Stats, Form).
2. Quy tắc màu sắc và spacing đã được chuẩn hóa trong `globals.css`.
3. Bản mẫu layout (Desktop & Mobile responsive) để Frontend dựng khung chính xác.
