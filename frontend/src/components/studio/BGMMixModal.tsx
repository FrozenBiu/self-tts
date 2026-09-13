import React, { useState, useEffect, useRef } from "react";
import {
  Music,
  X,
  Play,
  Pause,
  Upload,
  Volume2,
  Sliders,
  Sparkles,
  Loader2,
  Edit2,
  Check,
  Trash2,
  FileMusic,
} from "lucide-react";
import { toast } from "sonner";
import { globalAudio } from "../../utils/audioCoordinator";

interface BGMTrack {
  id: string;
  name: string;
  filename: string;
  url: string;
  duration?: number | null;
  is_preset: boolean;
  category: string;
}

interface BGMMixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAudioUrl: string | null;
  onSuccess: (newAudioUrl: string) => void;
}

export const BGMMixModal: React.FC<BGMMixModalProps> = ({
  isOpen,
  onClose,
  currentAudioUrl,
  onSuccess,
}) => {
  const [tracks, setTracks] = useState<BGMTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [bgmVolume, setBgmVolume] = useState<number>(0.25);
  const [duckingDepth, setDuckingDepth] = useState<"light" | "medium" | "deep">("medium");

  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMixing, setIsMixing] = useState(false);

  // Edit track name inline
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  // Audio preview playback state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Focus input khi mở edit
  useEffect(() => {
    if (editingTrackId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTrackId]);

  // Load danh sách BGM khi mở modal
  useEffect(() => {
    if (!isOpen) {
      stopPreview();
      setEditingTrackId(null);
      return;
    }

    const fetchTracks = async () => {
      setIsLoadingTracks(true);
      try {
        const res = await fetch("http://localhost:8000/api/bgm/list");
        if (!res.ok) throw new Error("Không thể nạp danh sách nhạc nền");
        const data = await res.json();
        const loadedTracks: BGMTrack[] = data.tracks || [];
        setTracks(loadedTracks);
        if (loadedTracks.length > 0 && !selectedTrackId) {
          setSelectedTrackId(loadedTracks[0].id);
        }
      } catch (err: any) {
        console.error("Lỗi fetch BGM list:", err);
        toast.error("Không thể tải danh sách nhạc nền.");
      } finally {
        setIsLoadingTracks(false);
      }
    };

    fetchTracks();
  }, [isOpen]);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setPlayingTrackId(null);
  };

  const handleTogglePlayPreview = (track: BGMTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingTrackId === track.id) {
      stopPreview();
      return;
    }

    stopPreview();
    const audio = new Audio(track.url);
    previewAudioRef.current = audio;
    globalAudio.play(audio);

    audio.onended = () => {
      setPlayingTrackId(null);
    };
    audio.onerror = () => {
      toast.error(`Không thể phát thử bản nhạc: ${track.name}`);
      setPlayingTrackId(null);
    };

    audio.play().then(() => {
      setPlayingTrackId(track.id);
    }).catch((err) => {
      console.warn("Không thể autoplay:", err);
      setPlayingTrackId(null);
    });
  };

  const handleUploadBgm = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "mp3" && ext !== "wav") {
      toast.error("Chỉ chấp nhận file nhạc định dạng .mp3 hoặc .wav");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/bgm/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Tải lên file nhạc thất bại");
      }

      const newTrack: BGMTrack = await res.json();
      setTracks((prev) => [newTrack, ...prev]);
      setSelectedTrackId(newTrack.id);
      toast.success(`Đã lưu bản nhạc: ${newTrack.name}`);
    } catch (err: any) {
      console.error("Lỗi upload BGM:", err);
      toast.error(err.message || "Lỗi khi tải file nhạc lên.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStartEdit = (track: BGMTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrackId(track.id);
    setEditingName(track.name);
  };

  const handleSaveEdit = async (trackId: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("Tên bản nhạc không được để trống!");
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/bgm/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Không thể đổi tên bản nhạc");
      }

      const updatedTrack: BGMTrack = await res.json();
      setTracks((prev) => prev.map((t) => (t.id === trackId ? updatedTrack : t)));
      setEditingTrackId(null);
      toast.success("Đã đổi tên bản nhạc thành công!");
    } catch (err: any) {
      console.error("Lỗi update BGM:", err);
      toast.error(err.message || "Lỗi khi đổi tên.");
    }
  };

  const handleDeleteTrack = async (trackId: string, trackName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc chắn muốn xóa bản nhạc "${trackName}" khỏi thư viện?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/bgm/${trackId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Không thể xóa bản nhạc này.");
      }

      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      if (selectedTrackId === trackId) {
        const remaining = tracks.filter((t) => t.id !== trackId);
        setSelectedTrackId(remaining[0]?.id || "");
      }
      if (playingTrackId === trackId) {
        stopPreview();
      }
      toast.success(`Đã xóa bản nhạc "${trackName}"`);
    } catch (err: any) {
      console.error("Lỗi xóa BGM:", err);
      toast.error(err.message || "Không thể xóa bản nhạc.");
    }
  };

  const handleMix = async () => {
    if (!currentAudioUrl) {
      toast.error("Không có bản thu âm giọng đọc nào để lồng nhạc nền!");
      return;
    }

    if (!selectedTrackId) {
      toast.error("Vui lòng chọn một bản nhạc nền từ danh sách!");
      return;
    }

    stopPreview();

    // Lấy filename giọng nói từ URL
    const voiceFilename = currentAudioUrl.split("/").pop() || "";
    if (!voiceFilename) {
      toast.error("URL giọng nói không hợp lệ!");
      return;
    }

    setIsMixing(true);
    try {
      const res = await fetch("http://localhost:8000/api/bgm/mix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice_filename: voiceFilename,
          bgm_id: selectedTrackId,
          bgm_volume: bgmVolume,
          ducking_depth: duckingDepth,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Quá trình hòa trộn âm thanh thất bại");
      }

      const data = await res.json();
      onSuccess(data.audio_url);
      toast.success("Đã hòa trộn nhạc nền Auto-Ducking vào bản Master thành công!");
      onClose();
    } catch (err: any) {
      console.error("Lỗi mix BGM:", err);
      toast.error(err.message || "Lỗi khi xử lý lồng nhạc nền.");
    } finally {
      setIsMixing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl max-w-xl w-full p-6 border border-white/10 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-label-caps text-sm text-on-surface font-semibold flex items-center gap-1.5">
                Lồng Nhạc Nền & Auto-Ducking
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal border border-indigo-500/30">
                  Stereo DSP
                </span>
              </h3>
              <p className="text-[11px] text-on-surface-variant/70">
                Tự động giảm âm lượng nhạc nền khi có giọng đọc và nổi lên êm ái khi ngắt nghỉ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách nhạc nền tải lên */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-on-surface flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-primary" />
              Thư viện nhạc nền của bạn ({tracks.length} bài)
            </label>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav"
                className="hidden"
                onChange={handleUploadBgm}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors font-semibold"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Tải lên nhạc nền từ máy
              </button>
            </div>
          </div>

          {isLoadingTracks ? (
            <div className="py-8 flex flex-col items-center justify-center text-on-surface-variant gap-2 bg-surface-dim/40 rounded-xl border border-white/5">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs">Đang nạp danh sách nhạc nền...</span>
            </div>
          ) : tracks.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-8 px-4 flex flex-col items-center justify-center gap-3 bg-surface-dim/30 hover:bg-surface-dim/50 rounded-xl border border-dashed border-white/15 cursor-pointer transition-all group text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <FileMusic className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-on-surface">Chưa có bài nhạc nền nào trong thư viện</p>
                <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                  Bấm vào đây để tải lên file MP3 hoặc WAV từ máy tính của bạn
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {tracks.map((track) => {
                const isSelected = selectedTrackId === track.id;
                const isPlaying = playingTrackId === track.id;
                const isEditing = editingTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      if (!isEditing) setSelectedTrackId(track.id);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? "bg-indigo-500/15 border-indigo-500/40 text-on-surface shadow-sm"
                        : "bg-surface-dim/40 border-white/5 text-on-surface-variant hover:bg-surface-dim/70 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                      {/* Play preview button */}
                      <button
                        type="button"
                        onClick={(e) => handleTogglePlayPreview(track, e)}
                        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-all ${
                          isPlaying
                            ? "bg-primary text-black"
                            : "bg-white/5 hover:bg-white/10 text-on-surface border border-white/10"
                        }`}
                        title={isPlaying ? "Dừng nghe thử" : "Nghe thử bản nhạc"}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Track info or inline edit */}
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit(track.id, e);
                                if (e.key === "Escape") setEditingTrackId(null);
                              }}
                              className="w-full bg-black/40 border border-indigo-500/50 rounded-lg px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Nhập tên bài nhạc..."
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveEdit(track.id, e)}
                              className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white transition-colors"
                              title="Lưu tên mới"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTrackId(null);
                              }}
                              className="p-1 rounded hover:bg-white/10 text-on-surface-variant transition-colors"
                              title="Hủy"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs font-semibold truncate flex items-center gap-2">
                              <span
                                className={isSelected ? "text-indigo-200 font-bold" : "text-on-surface"}
                                title={track.name}
                              >
                                {track.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-on-surface-variant/70 flex items-center gap-2 mt-0.5">
                              {track.duration && (
                                <span>
                                  {Math.floor(track.duration / 60)}:
                                  {String(Math.floor(track.duration % 60)).padStart(2, "0")}
                                </span>
                              )}
                              <span>•</span>
                              <span className="truncate">{track.filename}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons: Edit Name, Delete, Radio */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleStartEdit(track, e)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
                            title="Đổi tên bài nhạc này"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTrack(track.id, track.name, e)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 transition-colors"
                            title="Xóa khỏi thư viện"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <input
                        type="radio"
                        name="bgm_selection"
                        checked={isSelected}
                        onChange={() => setSelectedTrackId(track.id)}
                        className="w-4 h-4 text-indigo-500 bg-surface-dim border-white/20 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thiết lập âm lượng BGM & Ducking */}
        <div className="flex flex-col gap-4 bg-surface-dim/60 p-4 rounded-xl border border-white/5">
          {/* Thanh trượt âm lượng BGM */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-on-surface flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-primary" />
                Âm lượng Nhạc nền (BGM Volume)
              </span>
              <span className="font-mono-data text-primary font-bold">
                {Math.round(bgmVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={bgmVolume}
              onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant/60">
              <span>5% (Nhẹ nhàng)</span>
              <span>25% (Chuẩn Podcast)</span>
              <span>100% (Tối đa)</span>
            </div>
          </div>

          {/* Chọn mức độ Auto-Ducking */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-on-surface flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              Độ sâu nén âm tự động (Sidechain Auto-Ducking)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDuckingDepth("light")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  duckingDepth === "light"
                    ? "bg-primary/15 border-primary text-on-surface"
                    : "bg-surface-dim/40 border-white/5 text-on-surface-variant hover:border-white/10"
                }`}
              >
                <span className="text-xs font-semibold">Nhẹ (-8dB)</span>
                <span className="text-[10px] text-on-surface-variant/70 mt-0.5">Nhạc nền rõ</span>
              </button>

              <button
                type="button"
                onClick={() => setDuckingDepth("medium")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all relative ${
                  duckingDepth === "medium"
                    ? "bg-primary/20 border-primary text-on-surface shadow-sm"
                    : "bg-surface-dim/40 border-white/5 text-on-surface-variant hover:border-white/10"
                }`}
              >
                <div className="absolute -top-1.5 right-1 px-1 bg-primary text-black text-[8px] font-bold rounded">
                  Khuyên dùng
                </div>
                <span className="text-xs font-semibold">Chuẩn (-14dB)</span>
                <span className="text-[10px] text-on-surface-variant/70 mt-0.5">Cân bằng tối ưu</span>
              </button>

              <button
                type="button"
                onClick={() => setDuckingDepth("deep")}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  duckingDepth === "deep"
                    ? "bg-primary/15 border-primary text-on-surface"
                    : "bg-surface-dim/40 border-white/5 text-on-surface-variant hover:border-white/10"
                }`}
              >
                <span className="text-xs font-semibold">Sâu (-20dB)</span>
                <span className="text-[10px] text-on-surface-variant/70 mt-0.5">Kịch tính / Trailer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => {
              stopPreview();
              onClose();
            }}
            disabled={isMixing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleMix}
            disabled={isMixing || !selectedTrackId || tracks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-primary text-black font-semibold text-xs shadow-lg shadow-indigo-500/20 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isMixing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý DSP Sidechain...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Hòa trộn & Xuất bản Master</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
