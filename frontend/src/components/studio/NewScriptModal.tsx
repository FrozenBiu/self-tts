import React from "react";
import { FolderPlus, AlertTriangle, RotateCcw, X, FilePlus } from "lucide-react";

interface NewScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onOpenSaveProject?: () => void;
  hasContent: boolean;
  studioBlocksCount: number;
}

export const NewScriptModal: React.FC<NewScriptModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onOpenSaveProject,
  studioBlocksCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-surface-dim/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface font-body-md">
                Bắt đầu kịch bản mới
              </h3>
              <p className="text-xs text-on-surface-variant">
                Làm mới không gian soạn thảo của Studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 text-sm text-on-surface-variant">
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex gap-3 text-on-surface">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1 text-xs sm:text-sm">
              <p className="font-semibold text-rose-300">
                Thao tác này sẽ dọn sạch phiên làm việc hiện tại:
              </p>
              <ul className="list-disc list-inside space-y-1 text-on-surface-variant text-xs mt-1">
                <li>Văn bản nhập liệu hiện tại</li>
                {studioBlocksCount > 0 && (
                  <li>
                    Toàn bộ <span className="text-on-surface font-semibold">{studioBlocksCount} phân đoạn câu</span> đang làm việc
                  </li>
                )}
                <li>Bản thu âm thanh hoàn chỉnh (Master Audio)</li>
              </ul>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-dim border border-white/5 text-xs text-on-surface-variant/80 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              info
            </span>
            <span>
              Các Dự án bạn đã lưu trong <strong className="text-on-surface">Thư viện</strong> sẽ hoàn toàn không bị ảnh hưởng.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-surface-dim/40">
          {studioBlocksCount > 0 && onOpenSaveProject ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSaveProject();
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-label-caps font-semibold text-primary hover:bg-primary/10 border border-primary/30 transition-all flex items-center justify-center gap-1.5"
              title="Lưu các phân đoạn này vào một Dự án trước khi xoá"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Lưu vào Dự án trước
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-label-caps font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-white/10 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-label-caps font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Xóa & Bắt đầu mới
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
