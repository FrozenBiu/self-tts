import React, { useState, useEffect } from "react";
import { Minus, Square, Copy, X, Sparkles } from "lucide-react";





export const CustomTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
    window.electronAPI.onMaximizeChange((max) => setIsMaximized(max));
  }, []);

  // Chỉ hiển thị thanh điều khiển khi đang chạy trong ứng dụng Desktop (Electron)
  if (!isElectron) return null;

  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  return (
    <header
      onDoubleClick={handleMaximize}
      className="app-drag-region fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-between pl-3 pr-0 bg-[#09090b]/95 backdrop-blur-md border-b border-white/5 select-none"
    >
      {/* Bên trái: Logo & Tên ứng dụng */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-[10px] shadow-sm">
          🎙️
        </div>
        <span className="text-[11px] font-semibold tracking-wide text-slate-200">
          OmniVoice Studio
        </span>
        <span className="px-1.5 py-[1px] rounded bg-amber-500/10 text-amber-400 text-[9px] font-medium border border-amber-500/20">
          24kHz Pro
        </span>
      </div>

      {/* Vùng giữa: Drag Area rộng thênh thang kèm badge trạng thái */}
      <div className="flex items-center justify-center flex-1 h-full">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] text-slate-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span>Studio Active</span>
        </div>
      </div>

      {/* Bên phải: Nút điều khiển cửa sổ chuẩn Windows (No-Drag) */}
      <div className="app-no-drag flex items-center h-full">
        {/* Nút Thu nhỏ */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Thu nhỏ"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Nút Phóng to / Thu về kích thước cũ */}
        <button
          type="button"
          onClick={handleMaximize}
          className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={isMaximized ? "Khôi phục kích thước" : "Phóng to toàn màn hình"}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        {/* Nút Đóng (Đổi nền đỏ khi hover chuẩn Windows 11) */}
        <button
          type="button"
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
          title="Đóng về khay hệ thống"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

