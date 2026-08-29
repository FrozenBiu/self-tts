import { useState } from "react";
import { useTTSStore, type AudioRecord } from "../store/useTTSStore";
import { toast } from "sonner";

function AudioRecordItem({ record, removeHistory }: { record: AudioRecord, removeHistory: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(record.text);
    toast.success("Đã copy văn bản!");
  };

  const isLongText = record.text.length > 120;

  return (
    <div className="p-6 hover:bg-surface-variant/40 transition-colors flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 flex flex-col gap-3">
          <div className="relative">
            <p
              className={`font-body-md text-on-surface leading-relaxed ${!isExpanded ? "line-clamp-2" : ""}`}
            >
              "{record.text}"
            </p>
            <div className="flex items-center gap-4 mt-2">
              {isLongText && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[11px] font-label-caps text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  {isExpanded ? "Thu gọn" : "Xem thêm"}
                  <span className="material-symbols-outlined text-[14px]">
                    {isExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              )}
              <button
                onClick={handleCopy}
                className="text-[11px] font-label-caps text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                Copy nội dung
              </button>
            </div>
          </div>
          
          {/* Tham số cấu hình */}
          <div className="flex flex-wrap gap-2 items-center">
            {record.voiceName && (
              <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[11px] font-label-caps text-primary border border-primary/20">
                <span className="material-symbols-outlined text-[14px]">record_voice_over</span>
                {record.voiceName}
              </span>
            )}
            {record.speed !== undefined && (
              <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                Speed: {record.speed.toFixed(2)}x
              </span>
            )}
            {record.pitch !== undefined && (
              <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                Pitch: {record.pitch > 0 ? '+' : ''}{record.pitch.toFixed(1)}
              </span>
            )}
            {record.seed !== undefined && (
              <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                Seed: {record.seed}
              </span>
            )}
            {record.cfg_value !== undefined && (
              <span className="inline-flex items-center rounded bg-surface-variant px-2 py-1 text-[11px] font-mono-data text-on-surface-variant border border-white/5">
                CFG: {record.cfg_value}
              </span>
            )}
          </div>

          <p className="font-mono-data text-mono-data text-on-surface-variant/50 text-xs mt-1">
            ID: {record.id.toUpperCase()} • {new Date(record.timestamp).toLocaleString("vi-VN")}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={record.url}
            download
            className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-white/10 hover:text-primary transition-colors"
            title="Tải xuống"
          >
            <span className="material-symbols-outlined text-[20px]">
              download
            </span>
          </a>
          <button
            className="w-10 h-10 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/20 hover:text-error transition-colors"
            onClick={() => removeHistory(record.id)}
            title="Xóa khỏi lịch sử"
          >
            <span className="material-symbols-outlined text-[20px]">
              delete
            </span>
          </button>
        </div>
      </div>

      <audio
        controls
        src={record.url}
        className="w-full h-10 rounded focus:outline-none"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  );
}

export default function Library() {
  const { history, removeHistory } = useTTSStore();
  
  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = history.slice(startIndex, startIndex + itemsPerPage);

  // Điều chỉnh trang nếu xoá item cuối cùng của trang hiện tại
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(totalPages);
  }

  return (
    <div className="glass-card rounded-xl w-full max-w-4xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">
            folder_open
          </span>
          <h1 className="font-display text-display md:text-display text-headline-lg-mobile text-on-surface">
            Thư viện Audio
          </h1>
        </div>
        <div className="bg-surface-variant px-3 py-1 rounded-full text-xs font-mono-data text-on-surface-variant border border-white/5">
          {history.length} mục
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {history.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant font-mono-data text-mono-data border border-dashed border-white/10 rounded-lg bg-surface-dim">
            Thư viện trống. Hãy tạo một đoạn âm thanh mới ở Phòng thu.
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5 border border-white/5 rounded-lg bg-surface-dim overflow-hidden">
              {currentItems.map((record) => (
                <AudioRecordItem key={record.id} record={record} removeHistory={removeHistory} />
              ))}
            </div>
            
            {/* Thanh điều hướng phân trang */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center bg-surface-dim p-4 rounded-lg border border-white/5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-caps text-xs transition-colors ${currentPage === 1 ? 'text-on-surface-variant/30 cursor-not-allowed' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'}`}
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Trang trước
                </button>
                <div className="font-mono-data text-xs text-on-surface-variant">
                  Trang <span className="text-primary">{currentPage}</span> / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-caps text-xs transition-colors ${currentPage === totalPages ? 'text-on-surface-variant/30 cursor-not-allowed' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'}`}
                >
                  Trang sau
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
