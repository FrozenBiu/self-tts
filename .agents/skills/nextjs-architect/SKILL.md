---
name: nextjs-architect
description: >-
  Khởi tạo và thiết lập kiến trúc dự án Next.js Fullstack với pnpm, App Router, TypeScript,
  và cấu trúc thư mục module hóa. Sử dụng khi bắt đầu dự án mới hoặc tái cấu trúc hệ thống.
---

# Next.js Architect Skill

Subagent này chịu trách nhiệm thiết kế nền móng, cấu hình công cụ và khởi tạo dự án Next.js Fullstack chuẩn mực.

---

## 1. Lệnh Khởi Tạo Dự Án Chuẩn (Bắt buộc dùng `pnpm`)

Khi khởi tạo một dự án Next.js mới, luôn chạy lệnh sau:

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

*(Lưu ý: Nếu khởi tạo vào thư mục con, thay thế dấu `.` bằng tên thư mục dự án).*

---

## 2. Cài Đặt Bộ Dependency Nền Tảng

Chạy các lệnh cài đặt thư viện cốt lõi bằng `pnpm`:

```bash
# Icons & UI Utilities
pnpm add lucide-react clsx tailwind-merge class-variance-authority sonner

# Schema Validation
pnpm add zod

# Database (MongoDB Atlas) & Tools
pnpm add mongoose
pnpm add -D @types/mongoose
```

---

## 3. Kiến Trúc Thư Mục Chuẩn (`src/`)

```text
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group cho authentication
│   ├── (dashboard)/              # Route group cho main dashboard
│   ├── api/                      # Route Handlers (REST endpoints)
│   ├── layout.tsx                # Root layout (tích hợp Sonner Toaster, font, providers)
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Design tokens, Tailwind directives, CSS variables
├── components/
│   ├── ui/                       # Nguyên tử UI dùng chung (Button, Input, Dialog, etc.)
│   ├── features/                 # Các component gắn với tính năng cụ thể (users, orders, ...)
│   └── layout/                   # Header, Sidebar, Footer, Navigation
├── hooks/                        # Custom React hooks
├── lib/
│   ├── mongodb.ts                # MongoDB Atlas Singleton Connection Cache
│   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
├── server/
│   ├── actions/                  # Next.js Server Actions (Mutations)
│   └── models/                   # Mongoose / MongoDB schemas & models
└── types/                        # TypeScript global types & interfaces
```

---

## 4. Helper `src/lib/utils.ts`

Tạo file tiện ích kết hợp class Tailwind:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 5. Cấu Hình `layout.tsx` Tích Hợp Sonner Toaster

Luôn đảm bảo Root Layout import và khai báo `<Toaster />` từ `sonner`:

```tsx
import { Toaster } from "sonner";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```
