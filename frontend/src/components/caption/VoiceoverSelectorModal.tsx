import React, { useState, useRef } from "react";
import {
  Mic,
  Play,
  Pause,
  Upload,
  X,
  Search,
  Folder,
  Calendar,
  Check,
  FileAudio,
  Sparkles,
} from "lucide-react";
import { useTTSStore, type AudioRecord } from "@/store/useTTSStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceoverSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoiceover: (item: {
    url: string;
    text?: string;
    title?: string;
    file?: File;
    recordId?: string;
  }) => void;
}

export const VoiceoverSelectorModal: React.FC<VoiceoverSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectVoiceover,
}) => {
  const { history, projects } = useTTSStore();
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewAudioId, setPreviewAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  // Lọc danh sách bản ghi audio từ Thư viện
  const filteredRecords = history.filter((rec) => {
    const matchesProject =
      selectedProjectId === "all" ||
      (selectedProjectId === "unassigned" && !rec.projectId) ||
      rec.projectId === selectedProjectId;

    const matchesSearch =
      !searchQuery.trim() ||
      rec.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rec.voiceName && rec.voiceName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesProject && matchesSearch;
  });

  const handleTogglePreview = (id: string, url: string) => {
    if (previewAudioId === id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPreviewAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audio.onended = () => setPreviewAudioId(null);
      audio.play().catch(() => toast.error("Không thể phát âm thanh nghe thử"));
      audioRef.current = audio;
      setPreviewAudioId(id);
    }
  };

  const handleSelectRecord = (rec: AudioRecord) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPreviewAudioId(null);
    onSelectVoiceover({
      url: rec.url,
      text: rec.text,
      title: `${rec.voiceName || "Giọng đọc"} - ${rec.text.slice(0, 30)}...`,
      recordId: rec.id,
    });
    toast.success(`Đã nạp giọng đọc: ${rec.voiceName || "Giọng mẫu"}!`);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)) {
      toast.error("Vui lòng chọn file âm thanh hợp lệ (.mp3, .wav, .m4a, .aac)");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    onSelectVoiceover({
      url: localUrl,
      title: file.name,
      file,
    });
    toast.success(`Đã nạp file âm thanh: ${file.name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121418] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-surface-variant/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                Lồng Giọng Đọc / Âm Thanh Cho Video
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  Voiceover
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Chọn file giọng đọc đã tạo từ Phòng thu, Dự án hoặc tải file âm thanh riêng
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 bg-surface-variant/10 px-5 pt-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={cn(
              "pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition",
              activeTab === "library"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Folder className="w-4 h-4" />
            <span>Thư viện & Dự án ({history.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition",
              activeTab === "upload"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            )}
          >
            <Upload className="w-4 h-4" />
            <span>Tải lên từ thiết bị</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "library" ? (
            <>
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm nội dung câu thoại, tên giọng đọc..."
                    className="w-full pl-9 pr-3 py-2 bg-surface-variant/30 border border-white/10 rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition"
                  />
                </div>

                {projects.length > 0 && (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="px-3 py-2 bg-surface-variant/30 border border-white/10 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary transition cursor-pointer"
                  >
                    <option value="all">Tất cả dự án</option>
                    <option value="unassigned">Thư viện chung</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Records List */}
              {filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant border border-dashed border-white/10 rounded-xl bg-surface-variant/10 space-y-3">
                  <FileAudio className="w-10 h-10 mx-auto text-white/30" />
                  <p className="text-sm">Chưa có bản ghi âm nào phù hợp</p>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    Bạn có thể tạo giọng đọc mới trong trang Phòng thu hoặc chuyển sang tab "Tải lên từ thiết bị".
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRecords.map((rec) => {
                    const isPreviewing = previewAudioId === rec.id;
                    const projectName = projects.find((p) => p.id === rec.projectId)?.name;

                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-xl border border-white/5 bg-surface-variant/20 hover:bg-surface-variant/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePreview(rec.id, rec.url)}
                            className={cn(
                              "p-2.5 rounded-xl transition shrink-0 mt-0.5",
                              isPreviewing
                                ? "bg-primary text-black"
                                : "bg-surface-variant/60 text-on-surface hover:bg-primary/20 hover:text-primary border border-white/10"
                            )}
                            title={isPreviewing ? "Dừng nghe thử" : "Nghe thử"}
                          >
                            {isPreviewing ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-on-surface line-clamp-2 leading-relaxed">
                              "{rec.text}"
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-on-surface-variant">
                              {rec.voiceName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                                  <Mic className="w-2.5 h-2.5" />
                                  {rec.voiceName}
                                </span>
                              )}
                              {projectName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant border border-white/5">
                                  <Folder className="w-2.5 h-2.5" />
                                  {projectName}
                                </span>
                              )}
                              <span className="flex items-center gap-1 opacity-70">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(rec.timestamp).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectRecord(rec)}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Chọn giọng này</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Upload Tab */
            <div className="py-8">
              <label className="border-2 border-dashed border-white/20 hover:border-primary/50 hover:bg-primary/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition group">
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="p-4 rounded-2xl bg-surface-variant/40 text-primary border border-white/10 group-hover:scale-110 transition-transform mb-4">
                  <FileAudio className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-on-surface">
                  Chọn file âm thanh từ máy tính
                </h4>
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm">
                  Hỗ trợ định dạng MP3, WAV, M4A, AAC. File âm thanh sẽ được đồng bộ làm voiceover chính cho video.
                </p>
                <div className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-primary group-hover:bg-primary group-hover:text-black transition">
                  Duyệt file trên thiết bị
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-surface-variant/10 flex items-center justify-between text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5 text-[11px] text-white/50">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>AI sẽ tự động căn chỉnh mốc thời gian phụ đề theo giọng đọc đã chọn</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (audioRef.current) audioRef.current.pause();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg hover:bg-white/10 text-on-surface transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
