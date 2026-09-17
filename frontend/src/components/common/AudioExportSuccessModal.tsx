import React, { useEffect } from "react";
import { FolderOpen, Play, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { useAudioExportModalStore } from "../../store/useAudioExportModalStore";

export const AudioExportSuccessModal: React.FC = () => {
  const { isOpen, title, filename, filePath, dirPath, fileSizeMb, closeModal } =
    useAudioExportModalStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  const ext = filename.split(".").pop()?.toUpperCase() || "MP3";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="bg-surface-dim border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Close Button Top-Right */}
        <button
          type="button"
          onClick={closeModal}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-inner">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {title}
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-mono font-medium">
                {ext} HD
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tệp âm thanh đã được xử lý và lưu an toàn vào máy tính của bạn.
            </p>
          </div>
        </div>

        {/* File Info Box */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Tên tệp audio:</span>
            <span className="font-semibold text-white font-mono break-all text-right max-w-[70%]">
              {filename}
            </span>
          </div>
          {fileSizeMb !== undefined && fileSizeMb > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Dung lượng:</span>
              <span className="text-amber-400 font-mono">{fileSizeMb} MB</span>
            </div>
          )}
          <div className="flex flex-col gap-1 text-xs border-t border-white/5 pt-2">
            <span className="text-slate-400">Vị trí lưu trữ:</span>
            <span className="font-mono text-[11px] text-slate-300 break-all bg-white/5 p-2 rounded-lg border border-white/5 select-all">
              {filePath || dirPath}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {/* Nút 1: Mở thư mục chứa audio */}
          <button
            type="button"
            onClick={async () => {
              try {
                if (filePath && window.electronAPI?.showItemInFolder) {
                  await window.electronAPI.showItemInFolder(filePath);
                  toast.success("📁 Đang mở thư mục và chọn tệp audio...");
                } else if (dirPath && window.electronAPI?.openPath) {
                  await window.electronAPI.openPath(dirPath);
                  toast.success("📁 Đang mở thư mục chứa audio...");
                } else {
                  toast.info(`Vị trí lưu: ${filePath || dirPath}`);
                }
              } catch (e: any) {
                console.error("Lỗi mở thư mục:", e);
                toast.error(`Không thể mở thư mục: ${e?.message || e}`);
              }
            }}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-black font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-primary/20 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Mở thư mục chứa Audio</span>
          </button>

          {/* Nút 2: Nghe audio ngay */}
          {filePath && (
            <button
              type="button"
              onClick={async () => {
                try {
                  if (window.electronAPI?.openPath) {
                    toast.info("🎧 Đang mở trình phát âm thanh...");
                    const err = await window.electronAPI.openPath(filePath);
                    if (err) {
                      toast.error(`Không thể mở audio: ${err}`);
                    }
                  } else {
                    toast.info(`Tệp audio: ${filePath}`);
                  }
                } catch (e: any) {
                  console.error("Lỗi khi mở audio:", e);
                  toast.error(`Không thể mở audio: ${e?.message || e}`);
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs transition-colors cursor-pointer border border-white/5"
              title="Mở audio bằng trình phát mặc định của Windows"
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              <span>Nghe audio</span>
            </button>
          )}

          {/* Nút 3: Đóng modal quay lại ứng dụng */}
          <button
            type="button"
            onClick={closeModal}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  );
};
