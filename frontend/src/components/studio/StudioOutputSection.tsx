import React from "react";
import {
  Layers,
  Plus,
  Loader2,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { ScriptBlockItem } from "../project/ScriptBlockItem";
import type { ScriptBlock, Voice } from "../../store/useTTSStore";

interface StudioOutputSectionProps {
  audioUrl: string | null;
  elapsedTime: number;
  onNavigateToVideo: () => void;
  onDownload: () => void;
  studioBlocks: ScriptBlock[];
  voices: Voice[];
  hasModifiedSegments: boolean;
  isUpdatingMaster: boolean;
  onUpdateMasterAudio: () => void;
  onOpenSaveProjectModal: () => void;
  isSegmentsCollapsed: boolean;
  onToggleCollapseSegments: () => void;
  playingStudioBlockId: string | null;
  onPlayBlock: (block: ScriptBlock) => void;
  onStopPlayback: () => void;
  onUpdateBlock: (id: string, updated: Partial<ScriptBlock>) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlock: (index: number, direction: -1 | 1) => void;
  onInsertBlockBelow: (index: number) => void;
  onAddBlock: () => void;
  onRenderBlock: (id: string) => void;
}

export const StudioOutputSection: React.FC<StudioOutputSectionProps> = ({
  audioUrl,
  elapsedTime,
  onNavigateToVideo,
  onDownload,
  studioBlocks,
  voices,
  hasModifiedSegments,
  isUpdatingMaster,
  onUpdateMasterAudio,
  onOpenSaveProjectModal,
  isSegmentsCollapsed,
  onToggleCollapseSegments,
  playingStudioBlockId,
  onPlayBlock,
  onStopPlayback,
  onUpdateBlock,
  onDeleteBlock,
  onMoveBlock,
  onInsertBlockBelow,
  onAddBlock,
  onRenderBlock,
}) => {
  if (!audioUrl && studioBlocks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 mt-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
      {/* Trình phát Audio Tổng thể */}
      {audioUrl && (
        <div className="flex flex-col gap-4 bg-primary/5 p-5 2k:p-6 rounded-2xl border border-primary/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                headphones
              </span>
              Âm thanh đầu ra (Bản hoàn chỉnh)
            </span>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-surface-dim px-2.5 py-1 rounded-lg border border-white/10 text-on-surface-variant font-mono-data text-[10px]">
                <span className="material-symbols-outlined text-[14px]">
                  timer
                </span>
                {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:
                {String(elapsedTime % 60).padStart(2, "0")}
              </div>
              <button
                type="button"
                onClick={onNavigateToVideo}
                className="px-3.5 py-1.5 bg-primary/20 hover:bg-primary hover:text-black text-primary border border-primary/40 rounded-lg font-label-caps text-xs transition-all shadow-sm flex items-center gap-1.5 font-semibold group"
                title="Chuyển sang làm video với giọng đọc này trong Auto Caption Studio"
              >
                <span className="material-symbols-outlined text-[16px] group-hover:rotate-6 transition-transform">
                  movie_edit
                </span>
                LÀM VIDEO NGAY
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface border border-white/10 rounded-lg font-label-caps text-xs transition-colors shadow-sm flex items-center gap-2 font-medium"
              >
                <span className="material-symbols-outlined text-[16px]">
                  download
                </span>
                TẢI VỀ
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <audio
              src={audioUrl}
              controls
              className="w-full h-10 outline-none"
              autoPlay
              style={{ colorScheme: "dark" }}
            ></audio>
          </div>
        </div>
      )}

      {/* Danh sách phân đoạn câu */}
      {studioBlocks.length > 0 && (
        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-surface-dim/60 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-label-caps text-xs text-on-surface font-semibold">
                    Chi tiết phân đoạn câu
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-data font-bold bg-primary/15 text-primary border border-primary/20">
                    {studioBlocks.length} câu
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant/70">
                  Nghe thấy câu nào chưa vừa ý? Bạn có thể chỉnh sửa và render lại riêng câu đó bên dưới.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút cập nhật lại Audio chính khi có câu vừa được render lại */}
              {hasModifiedSegments && (
                <button
                  type="button"
                  onClick={onUpdateMasterAudio}
                  disabled={isUpdatingMaster}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-black font-semibold text-xs font-label-caps flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse hover:brightness-110 transition-all"
                  title="Ghép lại các câu và cập nhật vào file âm thanh chính ở trên"
                >
                  {isUpdatingMaster ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  ⚡ CẬP NHẬT AUDIO CHÍNH
                </button>
              )}

              <button
                type="button"
                onClick={onOpenSaveProjectModal}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface border border-white/10 text-xs font-label-caps flex items-center gap-1.5 transition-all"
                title="Lưu các phân đoạn này vào một Dự án trong Thư viện"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Lưu vào Dự án
              </button>

              <button
                type="button"
                onClick={onToggleCollapseSegments}
                className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors"
                title={isSegmentsCollapsed ? "Mở rộng danh sách" : "Thu gọn danh sách"}
              >
                {isSegmentsCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Danh sách các câu gọn gàng */}
          {!isSegmentsCollapsed && (
            <div className="flex flex-col gap-2">
              {studioBlocks.map((block, idx) => (
                <ScriptBlockItem
                  key={block.id}
                  block={block}
                  index={idx}
                  total={studioBlocks.length}
                  voices={voices}
                  isPlaying={playingStudioBlockId === block.id}
                  onPlay={() => onPlayBlock(block)}
                  onStop={onStopPlayback}
                  onUpdate={(updated) => onUpdateBlock(block.id, updated)}
                  onDelete={() => onDeleteBlock(block.id)}
                  onMoveUp={() => onMoveBlock(idx, -1)}
                  onMoveDown={() => onMoveBlock(idx, 1)}
                  onInsertBelow={() => onInsertBlockBelow(idx)}
                  onRender={() => onRenderBlock(block.id)}
                />
              ))}

              <button
                type="button"
                onClick={onAddBlock}
                className="py-2 px-3 rounded-lg border border-dashed border-white/10 hover:border-primary/40 bg-white/5 hover:bg-primary/5 text-on-surface-variant hover:text-primary transition-all flex items-center justify-center gap-1.5 text-xs font-label-caps group shadow-inner mt-1"
              >
                <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                Thêm câu mới (+1)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
