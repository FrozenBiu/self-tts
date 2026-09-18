import React, { useEffect } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ConfirmModal({
  isOpen,
  title = "Xác nhận xóa",
  message,
  confirmText = "Xác nhận xóa",
  cancelText = "Hủy bỏ",
  variant = "danger",
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div className="bg-[#18181b] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow ambient */}
        <div
          className={`absolute top-0 right-0 w-44 h-44 rounded-full blur-[70px] pointer-events-none ${
            isDanger ? "bg-red-500/10" : "bg-amber-500/10"
          }`}
        />

        {/* Nút đóng */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          title="Đóng (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header với Icon Badge */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner ${
              isDanger
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400"
            }`}
          >
            {isDanger ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Thao tác này không thể hoàn tác.</p>
          </div>
        </div>

        {/* Message Content */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-zinc-300 leading-relaxed break-words whitespace-pre-line">
          {message}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
              isDanger
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                : "bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20"
            }`}
          >
            {isDanger && <Trash2 className="w-3.5 h-3.5" />}
            <span>{isSubmitting ? "Đang xử lý..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
