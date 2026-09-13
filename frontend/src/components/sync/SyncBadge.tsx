import React, { useState } from "react";
import { Cloud, HardDrive, RefreshCw } from "lucide-react";
import { useTTSStore } from "@/store/useTTSStore";
import { SyncStatusModal } from "./SyncStatusModal";

interface SyncBadgeProps {
  isCollapsed?: boolean;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({ isCollapsed = false }) => {
  const { syncStatus, isSyncing } = useTTSStore();
  const [isOpen, setIsOpen] = useState(false);

  const isCloud = syncStatus.mode === "cloud";

  if (isCollapsed) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center relative group cursor-pointer transition-all duration-200 border ${
            isCloud
              ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
              : "bg-surface-variant/60 hover:bg-surface-variant border-white/10 text-on-surface-variant hover:text-on-surface"
          }`}
          aria-label="Trạng thái lưu trữ"
        >
          {isSyncing ? (
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          ) : isCloud ? (
            <Cloud className="w-5 h-5" />
          ) : (
            <HardDrive className="w-5 h-5" />
          )}

          {/* Glowing Status Dot */}
          <span
            className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-surface ${
              isCloud ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
            }`}
          />

          {/* Gemini-style Tooltip */}
          <div className="absolute left-full ml-3 px-3 py-1.5 bg-black/95 text-white text-xs font-medium rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap z-50">
            {isCloud ? "Đồng bộ Đám mây (Active)" : "Bộ nhớ máy (Cục bộ)"}
          </div>
        </button>

        <SyncStatusModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-left transition-all duration-200 group cursor-pointer ${
          isCloud
            ? "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-on-surface"
            : "bg-surface-variant/40 hover:bg-surface-variant/70 border-white/5 text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              isCloud
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-surface-container-lowest border-white/10 text-slate-400"
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : isCloud ? (
              <Cloud className="w-3.5 h-3.5" />
            ) : (
              <HardDrive className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium truncate text-on-surface">
                {isCloud ? "Cloud Sync" : "Bộ nhớ máy"}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCloud ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                }`}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant truncate">
              {isCloud ? "MongoDB Atlas" : "LocalStorage"}
            </p>
          </div>
        </div>

        <span className="text-[10px] text-on-surface-variant group-hover:text-primary transition-colors">
          Cấu hình
        </span>
      </button>

      <SyncStatusModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
