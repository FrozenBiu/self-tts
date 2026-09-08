---
name: react-vite-frontend
description: >-
  Khởi tạo và xây dựng giao diện Single Page Application (SPA) bằng React + Vite + TypeScript.
  Tích hợp Tailwind CSS, Shadcn UI (chế độ Vite), TanStack Query, và Sonner toast (cấm alert).
  Quản lý package 100% bằng pnpm. Sử dụng khi dự án chọn Frontend là React thuần / Vite thay vì Next.js.
---

# React + Vite Frontend Skill

Subagent này chịu trách nhiệm khởi tạo và phát triển giao diện người dùng Single Page Application (SPA) bằng **React**, **Vite** và **TypeScript**, quản lý gói 100% bằng **`pnpm`**, đồng thời tuân thủ toàn bộ tiêu chuẩn UI/UX hiện đại.

---

## 1. Khởi Tạo Dự Án Chuẩn (Bắt buộc dùng `pnpm`)

Khi bắt đầu một dự án React Vite mới:

```bash
# 1. Khởi tạo dự án React + TypeScript với Vite
pnpm create vite@latest . --template react-ts

# 2. Cài đặt các gói cơ bản
pnpm install

# 3. Cài đặt Tailwind CSS và các tiện ích UI cốt lõi
pnpm add -D tailwindcss postcss autoprefixer @types/node
pnpm add clsx tailwind-merge class-variance-authority lucide-react sonner
pnpm add @tanstack/react-query react-router-dom
```

---

## 2. Cấu Hình Path Alias `@/*`

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `vite.config.ts`
```typescript
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy sang backend FastAPI lúc dev
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## 3. Khởi Tạo Shadcn UI Cho Vite

Khởi tạo cấu hình Shadcn UI chế độ Vite:

```bash
pnpm dlx shadcn@latest init
```
*(Chọn cấu hình: Style `Default`/`New York`, Base color `Zinc`, CSS variables `yes`).*

Cài đặt các component cơ bản:
```bash
pnpm dlx shadcn@latest add button card dialog input form sonner
```

---

## 4. Cấu Hình Gốc Ứng Dụng `src/App.tsx` (Tích hợp Sonner)

Luôn đảm bảo component `<Toaster />` từ **Sonner** có mặt ở cấp cao nhất của ứng dụng:

```tsx
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// import HomePage from "@/pages/HomePage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground font-sans antialiased">
          <Routes>
            {/* <Route path="/" element={<HomePage />} /> */}
          </Routes>
          {/* Kỷ luật: Bắt buộc dùng Sonner thay cho alert() */}
          <Toaster position="top-right" richColors />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

## 5. Kết Nối API Backend (FastAPI) Bằng TanStack Query

Mẫu hook gọi API từ Backend Python FastAPI:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Item {
  _id: string;
  title: string;
  description: string;
}

// Fetch danh sách items
export function useItems() {
  return useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await fetch("/api/v1/items/");
      if (!res.ok) throw new Error("Không thể tải danh sách dữ liệu");
      return res.json();
    },
  });
}

// Thêm mới item với thông báo Sonner
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: { title: string; description?: string }) => {
      const res = await fetch("/api/v1/items/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!res.ok) throw new Error("Lỗi khi tạo mục mới");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast.success("Thêm mới thành công!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Đã xảy ra lỗi");
    },
  });
}
```

---

## 6. Lệnh Chạy Dự Án & Kiểm Thử

```bash
# Chạy dev server Vite
pnpm run dev

# Kiểm tra TypeScript typecheck
pnpm tsc --noEmit

# Build production
pnpm run build
```
