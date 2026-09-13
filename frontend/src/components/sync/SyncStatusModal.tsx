import React, { useState } from "react";
import { createPortal } from "react-dom";

import {
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Radio,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTTSStore } from "@/store/useTTSStore";

interface SyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    syncStatus,
    isSyncing,
    checkStorageStatus,
    syncAllToCloud,
    fetchFromCloud,
    projects,
    history,
    pronunciationWords,
  } = useTTSStore();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (!isOpen) return null;

  const isCloud = syncStatus.mode === "cloud";

  const handleRefreshStatus = async () => {
    setIsActionLoading(true);
    try {
      await checkStorageStatus();
      toast.success("Đã làm mới trạng thái kết nối!");
    } catch {
      toast.error("Không thể kết nối đến máy chủ.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePushAll = async () => {
    setIsActionLoading(true);
    try {
      await syncAllToCloud();
      toast.success("Đã đồng bộ toàn bộ dự án và lịch sử lên Cloud thành công!");
    } catch {
      toast.error("Gặp sự cố trong quá trình đồng bộ lên Cloud.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePullAll = async () => {
    setIsActionLoading(true);
    try {
      await fetchFromCloud();
      toast.success("Đã tải dữ liệu mới nhất từ Cloud về máy!");
    } catch {
      toast.error("Không thể tải dữ liệu từ Cloud.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">

      <div className="relative w-full max-w-xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-container-lowest/50">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${
                isCloud
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-primary/10 border-primary/30 text-primary"
              }`}
            >
              {isCloud ? (
                <Cloud className="w-5 h-5" />
              ) : (
                <HardDrive className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
                Trạng thái lưu trữ & Đồng bộ
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                    isCloud
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-slate-500/10 border-slate-500/30 text-slate-400"
                  }`}
                >
                  {isCloud ? "Cloud Active" : "Local Mode"}
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Quản lý kịch bản, dự án & file âm thanh trên mọi thiết bị
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isCloud
                ? "bg-emerald-500/5 border-emerald-500/20 text-on-surface"
                : "bg-surface-variant/40 border-white/10 text-on-surface"
            }`}
          >
            {isCloud ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs leading-relaxed">
              <p className="font-semibold text-sm mb-0.5">
                {isCloud
                  ? "Đang kích hoạt đồng bộ đám mây"
                  : "Chế độ lưu trữ Cục Bộ (LocalStorage)"}
              </p>
              <p className="text-on-surface-variant">
                {isCloud
                  ? "Kịch bản và dự án được đồng bộ tự động qua MongoDB Atlas. Bạn có thể mở đồng thời trên nhiều máy tính mà không bị mất dữ liệu."
                  : "Dữ liệu đang được lưu trữ an toàn ngay trên trình duyệt này. Nếu bạn chỉ làm việc trên 1 máy tính duy nhất thì không cần thiết lập thêm bất kỳ thứ gì!"}
              </p>
            </div>
          </div>

          {/* Cloud Connectors Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Kết nối dịch vụ
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* MongoDB Atlas Item */}
              <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-medium text-on-surface">
                      MongoDB Atlas
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      Kịch bản, Dự án, Từ điển
                    </p>
                  </div>
                </div>
                {syncStatus.mongo_connected ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Đã nối
                  </span>
                ) : (
                  <span className="text-[11px] text-on-surface-variant">
                    Chưa nối
                  </span>
                )}
              </div>

              {/* Cloudflare R2 Item */}
              <div className="p-3 rounded-xl bg-surface-container-lowest/80 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-xs font-medium text-on-surface">
                      Cloudflare R2
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      10GB Audio & Egress 0đ
                    </p>
                  </div>
                </div>
                {syncStatus.r2_connected ? (
                  <span className="flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Đã nối
                  </span>
                ) : (
                  <span className="text-[11px] text-on-surface-variant">
                    Lưu cục bộ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Current Local Stats */}
          <div className="p-3.5 rounded-xl bg-surface-variant/30 border border-white/5 space-y-1.5 text-xs text-on-surface-variant">
            <div className="flex justify-between">
              <span>Số dự án hiện có:</span>
              <span className="font-semibold text-on-surface">
                {projects.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Số bản ghi lịch sử âm thanh:</span>
              <span className="font-semibold text-on-surface">
                {history.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Từ khóa trong từ điển phát âm:</span>
              <span className="font-semibold text-on-surface">
                {pronunciationWords.length}
              </span>
            </div>
          </div>

          {/* Cloud Actions (if cloud is active) */}
          {isCloud && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Thao tác đồng bộ
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={isActionLoading || isSyncing}
                  onClick={handlePushAll}
                  className="py-2.5 px-3 rounded-xl bg-surface-variant hover:bg-surface-variant/80 border border-white/10 text-xs font-medium text-on-surface flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  Đẩy dữ liệu lên Cloud
                </button>
                <button
                  disabled={isActionLoading || isSyncing}
                  onClick={handlePullAll}
                  className="py-2.5 px-3 rounded-xl bg-surface-variant hover:bg-surface-variant/80 border border-white/10 text-xs font-medium text-on-surface flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-cyan-400 ${
                      isSyncing ? "animate-spin" : ""
                    }`}
                  />
                  Tải dữ liệu từ Cloud
                </button>
              </div>
            </div>
          )}

          {/* Setup Guide Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-surface-container-lowest/60 hover:bg-surface-container-lowest border border-white/10 flex items-center justify-between text-xs text-on-surface font-medium transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Hướng dẫn bật Cloud Sync khi cần dùng 2 máy tính
              </span>
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${
                  showSetupGuide ? "rotate-90" : ""
                }`}
              />
            </button>

            {showSetupGuide && (
              <div className="mt-3 p-4 rounded-xl bg-surface-container-lowest/90 border border-white/10 text-xs text-on-surface-variant space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-on-surface font-medium">
                  Chỉ cần 2 bước cấu hình trong file{" "}
                  <code className="px-1.5 py-0.5 rounded bg-black/40 text-primary font-mono text-[11px]">
                    backend/.env
                  </code>
                  :
                </p>

                <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                  <li>
                    <strong className="text-on-surface">MongoDB Atlas (Miễn phí 512MB):</strong>{" "}
                    Tạo tài khoản tại{" "}
                    <a
                      href="https://www.mongodb.com/cloud/atlas"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      mongodb.com
                      <ExternalLink className="w-2.5 h-2.5 inline" />
                    </a>
                    , copy connection string dán vào biến{" "}
                    <code className="px-1 py-0.2 rounded bg-black/40 text-primary font-mono text-[10px]">
                      MONGODB_URI
                    </code>
                    .
                  </li>
                  <li>
                    <strong className="text-on-surface">Cloudflare R2 (Tùy chọn - 10GB Audio Free):</strong>{" "}
                    Tạo bucket tại{" "}
                    <a
                      href="https://dash.cloudflare.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      cloudflare.com
                      <ExternalLink className="w-2.5 h-2.5 inline" />
                    </a>
                    , dán R2 Key và Bucket Name vào biến{" "}
                    <code className="px-1 py-0.2 rounded bg-black/40 text-primary font-mono text-[10px]">
                      R2_*
                    </code>
                    .
                  </li>
                </ol>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-on-surface-variant">
                  💡 <em>Nếu ai đó clone repository này về mà không điền thông tin vào .env, hệ thống sẽ tự động chuyển sang chế độ Cục Bộ (LocalStorage) và hoạt động bình thường 100% mà không gặp bất kỳ lỗi nào.</em>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-surface-container-lowest/50">
          <button
            onClick={handleRefreshStatus}
            disabled={isActionLoading}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isActionLoading ? "animate-spin text-primary" : ""
              }`}
            />
            Kiểm tra lại kết nối
          </button>

          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

