import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Film,
  Copy,
  Download,
  Trash2,
  Mic,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTTSStore, type AudioRecord } from "../../store/useTTSStore";
import { toast } from "sonner";
import { downloadAudioFile } from "../../utils/download";
import { AudioPlayerBar } from "./AudioPlayerBar";
import { CustomDropdown } from "../common/CustomDropdown";
import { ConfirmModal } from "../common/ConfirmModal";

export interface AudioRecordItemProps {
  record: AudioRecord;
  removeHistory: (id: string) => void;
  activePlayingId?: string | null;
  onPlayStateChange?: (id: string, isPlaying: boolean) => void;
}

export function AudioRecordItem({
  record,
  removeHistory,
  activePlayingId,
  onPlayStateChange,
}: AudioRecordItemProps) {
  const navigate = useNavigate();
  const { projects, updateRecordProject, setPendingVoiceForVideo } = useTTSStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEditVideo = () => {
    setPendingVoiceForVideo(record);
    toast.success("Đã chọn giọng đọc! Đang chuyển sang Auto Caption Studio...");
    navigate("/autocaption");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(record.text);
    toast.success("Đã sao chép nội dung văn bản!");
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!record.url) return;
    downloadAudioFile(record.url);
    toast.success("Đang tải file âm thanh về máy...");
  };

  const handleLocateFile = async () => {
    try {
      toast.info("Đang định vị file trên máy tính...");
      const res = await fetch("http://127.0.0.1:8000/api/tts/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: record.url }),
      }).catch(() =>
        fetch("http://localhost:8000/api/tts/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: record.url }),
        })
      );

      if (!res.ok) throw new Error("Không thể tìm thấy file âm thanh.");
      const data = await res.json();
      if (window.electronAPI?.showItemInFolder && data.file_path) {
        await window.electronAPI.showItemInFolder(data.file_path);
        toast.success("Đã mở thư mục và chọn đúng file âm thanh!");
      } else if (data.file_path) {
        toast.info(`Đường dẫn file: ${data.file_path}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi định vị file: ${err.message}`);
    }
  };

  const isLongText = record.text.length > 120;

  return (
    <div className="p-5 hover:bg-surface-variant/30 transition-colors flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Nội dung text */}
          <p
            className={`text-sm text-on-surface leading-relaxed ${
              !isExpanded ? "line-clamp-2" : ""
            }`}
          >
            "{record.text}"
          </p>

          <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
            {isLongText && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5 cursor-pointer"
              >
                {isExpanded ? (
                  <>
                    <span>Thu gọn</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>Xem thêm</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-on-surface transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>

          {/* Tham số cấu hình */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {record.voiceName && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                <Mic className="w-3 h-3" />
                {record.voiceName}
              </span>
            )}
            {record.speed !== undefined && (
              <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                Speed: {record.speed.toFixed(2)}x
              </span>
            )}
            {record.pitch !== undefined && (
              <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                Pitch: {record.pitch > 0 ? "+" : ""}
                {record.pitch.toFixed(1)}
              </span>
            )}
            {record.cfg_value !== undefined && (
              <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                CFG: {record.cfg_value}
              </span>
            )}
            <span className="text-[11px] font-mono-data text-on-surface-variant/50 ml-auto">
              {new Date(record.timestamp).toLocaleString("vi-VN")}
            </span>
          </div>
        </div>

        {/* Các nút hành động */}
        <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
          <CustomDropdown
            value={record.projectId || ""}
            onChange={(val) => {
              updateRecordProject(record.id, val || undefined);
              toast.success(
                val ? "Đã gán vào dự án thành công!" : "Đã chuyển về Thư viện chung",
              );
            }}
            placeholder="-- Thư viện chung --"
            className="h-8.5 bg-surface-dim hover:bg-white/10 text-on-surface-variant hover:text-white border-white/10 max-w-[155px]"
            options={[
              { value: "", label: "-- Thư viện chung --" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          <button
            type="button"
            onClick={handleEditVideo}
            className="h-8.5 px-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/50 font-semibold text-xs border border-amber-500/30 transition-all shadow-sm cursor-pointer group"
            title="Làm video với giọng đọc này trong Auto Caption Studio"
          >
            <Film className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span>Làm Video</span>
          </button>

          <button
            type="button"
            onClick={handleLocateFile}
            className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
            title="Mở thư mục trong Windows Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors cursor-pointer"
            title="Tải xuống"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/25 transition-colors cursor-pointer"
            title="Xóa khỏi lịch sử"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio Player Bar */}
      <AudioPlayerBar
        url={record.url}
        recordId={record.id}
        activePlayingId={activePlayingId}
        onPlayStateChange={onPlayStateChange}
      />

      {/* Modal xác nhận xóa */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Xác nhận xóa audio"
        message="Bạn có chắc chắn muốn xóa bản ghi âm thanh này khỏi thư viện và bộ nhớ máy tính?"
        onConfirm={() => {
          removeHistory(record.id);
          toast.success("Đã xóa khỏi lịch sử!");
          setIsDeleteModalOpen(false);
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
