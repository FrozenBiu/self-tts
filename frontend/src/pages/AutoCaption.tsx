import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Music,
  Download,
  CheckCircle2,
  Sparkles,
  Type,
  Palette,
  MoveVertical,
  Edit3,
  Video,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileUp,
  FileText,
  Wand2,
  Scissors,
  SlidersHorizontal,
  SidebarClose,
  SidebarOpen,
  User,
  Film,
  Focus,
  Highlighter,
  Smile,
  MousePointer,
  Crosshair,
  ArrowRight,
  AlertTriangle,
  Star,
  Layers,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Move,
  Gauge,
  CheckCheck,
  Mic,
  VolumeX,
  FileAudio,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TimelineEditor } from "@/components/caption/TimelineEditor";
import { TranscriptDocEditor } from "@/components/caption/TranscriptDocEditor";
import { VoiceoverSelectorModal } from "@/components/caption/VoiceoverSelectorModal";
import { useTTSStore } from "@/store/useTTSStore";
import type {
  ZoomEffect,
  HighlightEffect,
  StickerOverlay,
  SelectedElement,
  AudioClip,
  VideoClip,
} from "@/types/videoEffects";

interface WordTiming {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  customPositionY?: number; // Vị trí dọc riêng cho đoạn này (10% - 90%)
}

interface StyleConfig {
  font_name: string;
  font_size: number;
  primary_color: string;
  highlight_color: string;
  outline_color: string;
  outline_size: number;
  position_y: number; // Phần trăm từ đỉnh xuống đáy (10% - 90%)
}

const DEFAULT_STYLE: StyleConfig = {
  font_name: "Be Vietnam Pro",
  font_size: 24,
  primary_color: "#FFFFFF",
  highlight_color: "#ec6f09",
  outline_color: "#000000",
  outline_size: 3,
  position_y: 90,
};

const SYSTEM_FONTS = [
  { name: "Montserrat", label: "Montserrat (Hiện đại, sang trọng)" },
  { name: "Anton", label: "Anton (Chữ to, Shorts/Reels hot)" },
  { name: "Be Vietnam Pro", label: "Be Vietnam Pro (Chuẩn tiếng Việt)" },
  { name: "Inter", label: "Inter (Sạch sẽ, tinh tế)" },
  { name: "Roboto", label: "Roboto (Rõ nét, chuẩn mực)" },
  { name: "Lexend", label: "Lexend (Dễ đọc lướt)" },
  { name: "Playfair Display", label: "Playfair Display (Nghệ thuật)" },
  { name: "Arial", label: "Arial Bold (Cơ bản)" },
];

export default function AutoCaption() {
  // Video & Transcription State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Inspector Sidebar State (Collapsible)
  const [showInspector, setShowInspector] = useState<boolean>(true);

  // Dynamic Video Aspect Ratio & Synchronized 3-Column Height
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  // BGM State
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.25);

  // Voiceover Audio State (Lồng tiếng giọng đọc từ Thư viện / Phòng thu / Upload)
  const { pendingVoiceForVideo, setPendingVoiceForVideo } = useTTSStore();
  const [isVoiceoverModalOpen, setIsVoiceoverModalOpen] = useState(false);
  const [voiceoverRecord, setVoiceoverRecord] = useState<{
    url: string;
    text?: string;
    title?: string;
    file?: File;
    recordId?: string;
  } | null>(null);
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverStartTime, setVoiceoverStartTime] = useState<number>(0);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number>(5);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(true);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);

  // Undo History Stack (Lưu vết lịch sử thao tác để hoàn tác Ctrl + Z)
  const [undoStack, setUndoStack] = useState<{
    audioClips: AudioClip[];
    videoClips: VideoClip[];
    segments: CaptionSegment[];
    zoomEffects: ZoomEffect[];
    highlightEffects: HighlightEffect[];
    stickers: StickerOverlay[];
  }[]>([]);

  // Style State
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE);
  const [customFonts, setCustomFonts] = useState<string[]>([]);

  // Drag & Drop Y Position State
  const [isDragging, setIsDragging] = useState(false);

  // Expanded segment details
  const [expandedSegId, setExpandedSegId] = useState<number | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportResultUrl, setExportResultUrl] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string | null>(null);

  // Reference Script State (Đối chiếu kịch bản gốc để chuẩn hóa chính tả 100%)
  const [referenceScript, setReferenceScript] = useState("");
  const [isAligningScript, setIsAligningScript] = useState(false);
  const [isOptimizingChunks, setIsOptimizingChunks] = useState(false);
  const [showScriptBox, setShowScriptBox] = useState(false);

  // Raw Segments Backup (Lưu bản sao mốc gốc để khôi phục đồng bộ 100% bất cứ lúc nào)
  const [rawSegments, setRawSegments] = useState<CaptionSegment[]>([]);

  // Active Tab: Kiểu dáng chữ | Nhạc nền | Hiệu ứng Video Tutorial
  const [activeTab, setActiveTab] = useState<"transcript" | "style" | "bgm" | "effects">(
    "effects",
  );

  // ─── Video Tutorial Creator Effects State ────────────────────────────────
  const [zoomEffects, setZoomEffects] = useState<ZoomEffect[]>([]);
  const [highlightEffects, setHighlightEffects] = useState<HighlightEffect[]>([]);
  const [stickers, setStickers] = useState<StickerOverlay[]>([]);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  // Dragging & Resizing interaction state trên Canvas Preview
  const [isDraggingFocus, setIsDraggingFocus] = useState(false);

  // Mượt mà: Quản lý biến đổi tương đối theo chuột (delta-based transform)
  const [highlightTransform, setHighlightTransform] = useState<{
    mode: "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";
    startMouseX: number;
    startMouseY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    elementId: string;
  } | null>(null);

  const [stickerTransform, setStickerTransform] = useState<{
    startMouseX: number;
    startMouseY: number;
    initialX: number;
    initialY: number;
    elementId: string;
  } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const bgmInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);

  // ─── 60 FPS RequestAnimationFrame Loop & Playback Watchdog ─────────────────
  // Cập nhật mốc thời gian 60 FPS mượt mà; Video là Master Clock đồng bộ tuyệt đối
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isPlayAttemptingRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      const video = videoRef.current;
      if (video) {
        if (!video.paused) {
          setCurrentTime(video.currentTime);
        } else {
          // Bảo vệ đồng bộ: Nếu Video Master bị paused (đang tua lùi decode frame hoặc bấm pause),
          // âm thanh lồng tiếng và nhạc nền phải lập tức tạm dừng theo, không chạy vượt trước!
          if (voiceoverAudioRef.current && !voiceoverAudioRef.current.paused) {
            voiceoverAudioRef.current.pause();
          }
          if (bgmAudioRef.current && !bgmAudioRef.current.paused) {
            bgmAudioRef.current.pause();
          }
        }
      } else if (voiceoverAudioRef.current && !voiceoverAudioRef.current.paused) {
        const aTime = voiceoverAudioRef.current.currentTime;
        if (audioClips.length > 0) {
          const activeClip = audioClips.find(
            (c) => aTime >= c.sourceStart && aTime < c.sourceStart + c.duration,
          );
          if (activeClip) {
            setCurrentTime(Number((activeClip.start + (aTime - activeClip.sourceStart)).toFixed(2)));
          }
        } else {
          setCurrentTime(Number((voiceoverStartTime + aTime).toFixed(2)));
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [audioClips, voiceoverStartTime]);

  // Synchronize BGM audio with video player
  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  // Tự động nhận Voiceover chuyển giao từ Studio hoặc Library
  useEffect(() => {
    if (pendingVoiceForVideo) {
      const vTitle = `${pendingVoiceForVideo.voiceName || "Giọng đọc"} - ${pendingVoiceForVideo.text.slice(0, 30)}...`;
      setVoiceoverRecord({
        url: pendingVoiceForVideo.url,
        text: pendingVoiceForVideo.text,
        title: vTitle,
        recordId: pendingVoiceForVideo.id,
      });
      setVoiceoverUrl(pendingVoiceForVideo.url);
      setVoiceoverStartTime(0);
      setAudioClips([
        {
          id: `audio_${Date.now()}`,
          name: vTitle,
          url: pendingVoiceForVideo.url,
          start: 0,
          duration: 10,
          sourceStart: 0,
          text: pendingVoiceForVideo.text,
          originalText: pendingVoiceForVideo.text,
        },
      ]);
      if (pendingVoiceForVideo.text) {
        setReferenceScript(pendingVoiceForVideo.text);
      }
      toast.success(
        `Đã nạp giọng đọc: ${pendingVoiceForVideo.voiceName || "Giọng đọc"} từ Thư viện! Hãy chọn video để bắt đầu biên tập.`,
      );
      setPendingVoiceForVideo(null);
    }
  }, [pendingVoiceForVideo, setPendingVoiceForVideo]);

  // Đồng bộ trạng thái mute của video gốc khi có voiceover
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !!voiceoverUrl && muteOriginalAudio;
    }
  }, [voiceoverUrl, muteOriginalAudio]);

  // ─── Tự động đồng bộ chiều cao 2 cột 2 bên theo chính xác khung Preview ────
  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;

    const updateHeight = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 50) {
        setPreviewHeight(rect.height);
      }
    };

    updateHeight();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        if (rect.height > 50) {
          setPreviewHeight(rect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [videoUrl, videoAspectRatio, showInspector]);

  // ─── Tự động dọn dẹp file session khi người dùng rời trang ────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId) {
        navigator.sendBeacon(
          `http://localhost:8000/api/caption/session/${sessionId}/delete`,
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (sessionId) {
        // Gọi DELETE khi chuyển sang trang khác trong React Router
        fetch(`http://localhost:8000/api/caption/session/${sessionId}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [sessionId]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Vui lòng chọn file video hợp lệ (.mp4, .mov, .webm)");
      return;
    }

    // Dọn dẹp session cũ nếu người dùng chọn video khác
    if (sessionId) {
      fetch(`http://localhost:8000/api/caption/session/${sessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    setVideoFile(file);
    const localUrl = URL.createObjectURL(file);
    setVideoUrl(localUrl);
    setVideoAspectRatio(null);
    setSegments([]);
    setSessionId(null);
    setExportResultUrl(null);
    setVideoDuration(0);
    toast.success(`Đã chọn video: ${file.name}`);
  };

  const handleTranscribe = async () => {
    if (!videoFile) {
      toast.error("Vui lòng tải lên video trước");
      return;
    }

    setIsTranscribing(true);
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("language", "vi");
    formData.append("model_size", "base");
    if (referenceScript.trim()) {
      formData.append("reference_script", referenceScript.trim());
    }

    try {
      toast.info("Đang tách âm thanh và nhận diện phụ đề từng từ bằng AI...", {
        duration: 8000,
      });

      const response = await fetch(
        "http://localhost:8000/api/caption/transcribe",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Nhận diện phụ đề thất bại");
      }

      const data = await response.json();
      setSessionId(data.session_id);

      // Nếu có sẵn giọng đọc voiceover, tự động gắn vào session và bóc tách phụ đề theo voiceover
      if (voiceoverRecord) {
        try {
          toast.info("Đang đồng bộ giọng đọc lồng tiếng vào phụ đề...");
          const vFormData = new FormData();
          vFormData.append("session_id", data.session_id);
          if (voiceoverRecord.file) {
            vFormData.append("voice_audio", voiceoverRecord.file);
          } else {
            vFormData.append("voice_url", voiceoverRecord.url);
          }
          const activeScript = referenceScript.trim() || voiceoverRecord.text || "";
          if (activeScript) {
            vFormData.append("reference_script", activeScript);
          }
          vFormData.append("auto_transcribe", "true");

          const vRes = await fetch("http://localhost:8000/api/caption/attach-voiceover", {
            method: "POST",
            body: vFormData,
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            if (vData.segments && vData.segments.length > 0) {
              setSegments(vData.segments);
              setRawSegments(vData.segments);
              toast.success(
                `✨ Hoàn tất! Đã đồng bộ giọng đọc & tạo ${vData.segments.length} câu phụ đề chuẩn xác.`,
              );
              return;
            }
          } else {
            const vErrData = await vRes.json().catch(() => ({}));
            toast.error(`Lỗi đồng bộ giọng đọc: ${vErrData.detail || "Không thể tạo phụ đề từ voiceover"}`);
          }
        } catch (vErr: any) {
          console.error("Lỗi đồng bộ voiceover khi transcribe:", vErr);
          toast.error(`Lỗi kết nối khi đồng bộ giọng đọc: ${vErr?.message || vErr}`);
        }
      }

      setSegments(data.segments || []);
      setRawSegments(data.segments || []);
      if ((data.segments?.length || 0) === 0) {
        toast.warning(
          "Video không phát hiện thấy âm thanh lời nói nào. Hãy lồng thêm file giọng đọc (Voiceover) để tạo phụ đề.",
          { duration: 6000 }
        );
      } else {
        toast.success(
          `Hoàn tất! Bóc tách được ${data.segments?.length || 0} câu có mốc thời gian chi tiết.`,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi nhận diện video");
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── Khớp kịch bản đối chiếu vào phụ đề hiện có tức thì (<0.1s) ───────────
  const handleAlignScript = async () => {
    if (!referenceScript.trim()) {
      toast.error("Vui lòng dán văn bản / kịch bản đối chiếu vào ô nhập");
      return;
    }
    if (!segments.length) {
      toast.error("Chưa có phụ đề để đối chiếu. Hãy bấm Tạo Phụ Đề AI trước.");
      return;
    }

    setIsAligningScript(true);
    try {
      const response = await fetch(
        "http://localhost:8000/api/caption/align-script",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments,
            reference_script: referenceScript.trim(),
          }),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Không thể so khớp kịch bản");
      }

      const data = await response.json();
      if (data.segments && data.segments.length > 0) {
        setSegments(data.segments);
        setRawSegments(data.segments);
        toast.success(
          `✨ Đã đối chiếu và chuẩn hóa 100% chính tả theo kịch bản mẫu (${data.segments.length} câu)!`,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi so khớp kịch bản");
    } finally {
      setIsAligningScript(false);
    }
  };

  // ─── Tự động chia nhỏ lại các câu quá dài thành câu 4-9 từ ───────────────
  const handleOptimizeChunks = async () => {
    if (!segments.length) {
      toast.error("Chưa có phụ đề để chia câu");
      return;
    }

    setIsOptimizingChunks(true);
    try {
      const response = await fetch(
        "http://localhost:8000/api/caption/optimize-chunks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments,
            max_words: 9,
          }),
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Không thể chia nhỏ câu");
      }

      const data = await response.json();
      setSegments(data.segments || []);
      toast.success(
        `✨ Đã chia ngắn thành ${data.segments?.length || 0} câu chuẩn Shorts/Reels!`,
      );
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi chia nhỏ câu");
    } finally {
      setIsOptimizingChunks(false);
    }
  };

  // ─── Khôi phục mốc thời gian phụ đề gốc (Restore Sync) ─────────────────────
  const handleRestoreSync = async () => {
    // 1. Thử khôi phục từ rawSegments local
    if (rawSegments.length > 0) {
      setSegments(JSON.parse(JSON.stringify(rawSegments)));
      toast.success(
        "Đã khôi phục mốc thời gian phụ đề gốc, khớp 100% với giọng nói!",
      );
      return;
    }

    // 2. Nếu local chưa có nhưng có sessionId, thử khôi phục từ máy chủ
    if (sessionId) {
      try {
        const res = await fetch(
          `http://localhost:8000/api/caption/session/${sessionId}/restore-raw`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.segments && data.segments.length > 0) {
            setSegments(data.segments);
            setRawSegments(data.segments);
            toast.success(
              "Đã khôi phục mốc thời gian gốc từ máy chủ, khớp 100%!",
            );
            return;
          }
        }
      } catch (e) {
        console.warn("Không thể tải mốc gốc từ backend:", e);
      }
    }

    toast.error("Không tìm thấy bản sao lưu mốc thời gian gốc để khôi phục");
  };

  const handleBgmSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!sessionId) {
      toast.error(
        "Vui lòng chờ hoàn tất phân tích video trước khi tải nhạc nền",
      );
      return;
    }

    setBgmFile(file);
    const localAudioUrl = URL.createObjectURL(file);
    setBgmUrl(localAudioUrl);

    const formData = new FormData();
    formData.append("bgm", file);
    formData.append("session_id", sessionId);

    try {
      const res = await fetch("http://localhost:8000/api/caption/upload-bgm", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload BGM thất bại");
      toast.success(`Đã thêm nhạc nền: ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi upload nhạc nền");
    }
  };

  // ─── Voiceover Audio Handlers ──────────────────────────────────────────
  const handleSelectVoiceover = async (item: {
    url: string;
    text?: string;
    title?: string;
    file?: File;
    recordId?: string;
  }) => {
    setVoiceoverRecord(item);
    setVoiceoverUrl(item.url);
    setVoiceoverStartTime(0);
    const clipTitle = item.title || "Voiceover Audio";
    setAudioClips([
      {
        id: `audio_${Date.now()}`,
        name: clipTitle,
        url: item.url,
        start: 0,
        duration: voiceoverDuration || 5,
        sourceStart: 0,
        text: item.text,
        originalText: item.text,
      },
    ]);
    if (item.text) {
      setReferenceScript(item.text);
    }

    // Nếu đã có session trên backend, tự động gắn voiceover vào session
    if (sessionId) {
      try {
        toast.info("Đang đồng bộ giọng đọc vào video...");
        const formData = new FormData();
        formData.append("session_id", sessionId);
        if (item.file) {
          formData.append("voice_audio", item.file);
        } else {
          formData.append("voice_url", item.url);
        }
        const activeScript = referenceScript.trim() || item.text || "";
        if (activeScript) {
          formData.append("reference_script", activeScript);
        }
        formData.append("auto_transcribe", "true");

        const res = await fetch("http://localhost:8000/api/caption/attach-voiceover", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.segments && data.segments.length > 0) {
            setSegments(data.segments);
            setRawSegments(data.segments);
            toast.success(`Đã đồng bộ giọng đọc & tạo ${data.segments.length} câu phụ đề tự động!`);
          }
        }
      } catch (err: any) {
        console.error("Lỗi attach voiceover:", err);
      }
    }
  };

  const handleRemoveVoiceover = () => {
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.pause();
    }
    setVoiceoverRecord(null);
    setVoiceoverUrl(null);
    setVoiceoverStartTime(0);
    setAudioClips([]);
    toast.info("Đã gỡ giọng đọc voiceover.");
  };

  // ─── Custom Font Upload ───────────────────────────────────────────────────
  const handleCustomFontUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input để người dùng có thể chọn lại cùng file nếu muốn
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["ttf", "otf", "woff2", "woff"].includes(ext || "")) {
      toast.error("Chỉ chấp nhận file font .ttf, .otf, .woff, .woff2");
      return;
    }

    // Chuẩn hóa tên font: bỏ phần mở rộng và loại bỏ ký tự đặc biệt (ngoặc, phẩy, chấm) tránh lỗi FontFace
    const cleanFontName =
      file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^\w\s-]/g, "")
        .trim() || "CustomFont";

    try {
      // Cách 1: Nạp trực tiếp qua thẻ <style> @font-face (Tương thích 100% mọi trình duyệt)
      const fontUrl = URL.createObjectURL(file);
      const styleEl = document.createElement("style");
      styleEl.textContent = `
        @font-face {
          font-family: "${cleanFontName}";
          src: url("${fontUrl}");
        }
      `;
      document.head.appendChild(styleEl);

      // Cách 2: Nạp vào document.fonts qua FontFace API (có ép kiểu an toàn tránh lỗi TypeScript / runtime)
      if (typeof FontFace !== "undefined" && "fonts" in document) {
        try {
          const buffer = await file.arrayBuffer();
          const fontFace = new FontFace(cleanFontName, buffer);
          const loadedFace = await fontFace.load();
          (document.fonts as any).add(loadedFace);
        } catch (fontApiErr) {
          console.warn(
            "FontFace API fallback to @font-face style tag:",
            fontApiErr,
          );
        }
      }

      setCustomFonts((prev) =>
        prev.includes(cleanFontName) ? prev : [...prev, cleanFontName],
      );
      setStyle((s) => ({ ...s, font_name: cleanFontName }));
      toast.success(`Đã nạp font tùy chỉnh: ${cleanFontName}`);

      // Đồng bộ lên server nếu đã có session để FFmpeg render video thành phẩm
      if (sessionId) {
        const formData = new FormData();
        formData.append("font", file);
        formData.append("session_id", sessionId);
        await fetch("http://localhost:8000/api/caption/upload-font", {
          method: "POST",
          body: formData,
        });
      }
    } catch (err: any) {
      toast.error(`Không thể nạp font: ${err.message}`);
    }
  };

  // Video time tracking
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      // Sync Voiceover Audio (hỗ trợ nhiều audioClips cắt ghép)
      if (voiceoverAudioRef.current && voiceoverUrl) {
        if (audioClips.length > 0) {
          const activeClip = audioClips.find(
            (c) => time >= c.start && time < c.start + c.duration,
          );
          if (activeClip) {
            const targetAudioTime = activeClip.sourceStart + (time - activeClip.start);
            if (isPlaying && voiceoverAudioRef.current.paused) {
              voiceoverAudioRef.current.currentTime = Math.max(0, targetAudioTime);
              voiceoverAudioRef.current.play().catch(() => {});
            } else if (Math.abs(voiceoverAudioRef.current.currentTime - targetAudioTime) > 0.15) {
              voiceoverAudioRef.current.currentTime = Math.max(0, targetAudioTime);
            }
          } else {
            // Đang rơi vào khoảng trống giữa các clip hoặc ngoài phạm vi
            if (!voiceoverAudioRef.current.paused) {
              voiceoverAudioRef.current.pause();
            }
          }
        } else {
          // Fallback khi chưa có audioClips
          if (time < voiceoverStartTime || time > voiceoverStartTime + voiceoverDuration) {
            if (!voiceoverAudioRef.current.paused) {
              voiceoverAudioRef.current.pause();
            }
          } else {
            const targetAudioTime = time - voiceoverStartTime;
            if (isPlaying && voiceoverAudioRef.current.paused) {
              voiceoverAudioRef.current.currentTime = targetAudioTime;
              voiceoverAudioRef.current.play().catch(() => {});
            } else if (Math.abs(voiceoverAudioRef.current.currentTime - targetAudioTime) > 0.15) {
              voiceoverAudioRef.current.currentTime = targetAudioTime;
            }
          }
        }
      }

      // Sync BGM
      if (bgmAudioRef.current && bgmUrl) {
        if (isPlaying && bgmAudioRef.current.paused) {
          bgmAudioRef.current.currentTime = time;
          bgmAudioRef.current.play().catch(() => {});
        } else if (Math.abs(bgmAudioRef.current.currentTime - time) > 0.25) {
          bgmAudioRef.current.currentTime = time;
        }
      }
    }
  };

  const pausePlayback = useCallback(() => {
    isPlayingRef.current = false;
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.pause();
    }
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const safePlayVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) return;
    if (isPlayAttemptingRef.current) return;

    isPlayAttemptingRef.current = true;
    try {
      // Nếu video đang bận seeking (đặc biệt khi tua lùi ngược về trước), kiên nhẫn chờ sự kiện seeked
      if (video.seeking) {
        await new Promise<void>((resolve) => {
          let timer: any;
          const onSeeked = () => {
            clearTimeout(timer);
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked, { once: true });
          timer = setTimeout(() => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          }, 300);
        });
      }

      // Nếu người dùng đã nhấn pause trong lúc đang chờ seek
      if (!isPlayingRef.current) {
        return;
      }

      if (video.paused) {
        await video.play();
      }

      // CHỈ KHI VIDEO ĐÃ PHÁT THÀNH CÔNG (!video.paused): Mới kích hoạt Voiceover Audio và BGM
      if (!video.paused) {
        const time = video.currentTime;
        if (voiceoverAudioRef.current && voiceoverUrl) {
          if (audioClips.length > 0) {
            const activeClip = audioClips.find(
              (c) => time >= c.start && time < c.start + c.duration,
            );
            if (activeClip) {
              voiceoverAudioRef.current.currentTime = Math.max(
                0,
                activeClip.sourceStart + (time - activeClip.start),
              );
              await voiceoverAudioRef.current.play().catch(() => {});
            } else {
              voiceoverAudioRef.current.pause();
            }
          } else if (time >= voiceoverStartTime && time <= voiceoverStartTime + voiceoverDuration) {
            voiceoverAudioRef.current.currentTime = time - voiceoverStartTime;
            await voiceoverAudioRef.current.play().catch(() => {});
          }
        }

        if (bgmAudioRef.current && bgmUrl) {
          bgmAudioRef.current.currentTime = time;
          await bgmAudioRef.current.play().catch(() => {});
        }

        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.warn("[Video Playback] Safe play interrupted:", err?.name || err);
      }
    } finally {
      isPlayAttemptingRef.current = false;
    }
  }, [voiceoverUrl, audioClips, voiceoverStartTime, voiceoverDuration, bgmUrl]);

  const togglePlay = useCallback(async () => {
    // Nếu có video thì dùng video làm master clock
    if (videoRef.current) {
      if (isPlayingRef.current) {
        pausePlayback();
      } else {
        isPlayingRef.current = true;
        setIsPlaying(true);
        // Nếu video đang ở mốc cuối, tua về 0 để phát từ đầu
        if (videoRef.current.currentTime >= (videoDuration || videoRef.current.duration || 0.1) - 0.05) {
          videoRef.current.currentTime = 0;
          setCurrentTime(0);
        }
        setIsPlaying(true);
        await safePlayVideo();
      }
    } else if (voiceoverAudioRef.current && voiceoverUrl) {
      // Fallback khi chưa có video: Dùng audio làm master clock
      if (isPlayingRef.current) {
        pausePlayback();
      } else {
        if (voiceoverAudioRef.current.currentTime >= (voiceoverDuration || 0.1) - 0.05) {
          voiceoverAudioRef.current.currentTime = 0;
          setCurrentTime(0);
        }
        await voiceoverAudioRef.current.play().catch(() => {});
        if (bgmAudioRef.current && bgmUrl) {
          await bgmAudioRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
      }
    }
  }, [videoDuration, pausePlayback, safePlayVideo, voiceoverUrl, voiceoverDuration, bgmUrl]);

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Number(seconds.toFixed(2)));

    // 1. Cập nhật Video nếu có
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }

    // 2. Cập nhật Voiceover Audio
    if (voiceoverAudioRef.current && voiceoverUrl) {
      if (audioClips.length > 0) {
        const activeClip = audioClips.find(
          (c) => clamped >= c.start && clamped < c.start + c.duration,
        );
        if (activeClip) {
          voiceoverAudioRef.current.currentTime = Math.max(
            0,
            activeClip.sourceStart + (clamped - activeClip.start),
          );
        } else {
          voiceoverAudioRef.current.pause();
        }
      } else if (clamped >= voiceoverStartTime && clamped <= voiceoverStartTime + voiceoverDuration) {
        voiceoverAudioRef.current.currentTime = clamped - voiceoverStartTime;
      } else {
        voiceoverAudioRef.current.pause();
      }
    }

    // 3. Cập nhật BGM
    if (bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = clamped;
    }

    // 4. Cập nhật thời gian hiển thị giao diện ngay lập tức
    setCurrentTime(clamped);

    // 5. Nếu đang ở trạng thái phát (ví dụ bấm nút Quay lại đầu hoặc click thanh timeline):
    // Phục hồi phát video đồng bộ an toàn
    if (isPlayingRef.current) {
      safePlayVideo();
    }
  }, [voiceoverUrl, voiceoverStartTime, voiceoverDuration, audioClips, safePlayVideo]);

  // ─── Hàm Tách Nội Dung Thoại Thông Minh Khi Cắt Audio Clip ───────────────────
  const splitAudioText = (
    fullText: string,
    ratio: number,
    splitTime: number,
    speakerPrefix: string
  ): { name1: string; text1: string; name2: string; text2: string } => {
    const clean = (fullText || "").trim();
    if (!clean) {
      return {
        name1: `${speakerPrefix} - Phần 1`,
        text1: "",
        name2: `${speakerPrefix} - [${splitTime.toFixed(1)}s] Phần 2`,
        text2: `[${splitTime.toFixed(1)}s]`,
      };
    }

    const words = clean.split(/\s+/);
    if (words.length <= 1) {
      return {
        name1: `${speakerPrefix} - ${clean.slice(0, 30)}...`,
        text1: clean,
        name2: `${speakerPrefix} - [${splitTime.toFixed(1)}s] ${clean.slice(0, 30)}...`,
        text2: `[${splitTime.toFixed(1)}s] ${clean}`,
      };
    }

    const splitIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
    const part1 = words.slice(0, splitIdx).join(" ");
    const part2 = words.slice(splitIdx).join(" ");

    return {
      name1: `${speakerPrefix} - ${part1.slice(0, 35)}...`,
      text1: part1,
      name2: `${speakerPrefix} - [${splitTime.toFixed(1)}s] ${part2.slice(0, 35)}...`,
      text2: `[${splitTime.toFixed(1)}s] ${part2}`,
    };
  };

  // ─── Undo History Stack (Lưu vết lịch sử thao tác để hoàn tác Ctrl + Z) ───
  const pushHistorySnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-25),
      {
        audioClips: JSON.parse(JSON.stringify(audioClips)),
        videoClips: JSON.parse(JSON.stringify(videoClips)),
        segments: JSON.parse(JSON.stringify(segments)),
        zoomEffects: JSON.parse(JSON.stringify(zoomEffects)),
        highlightEffects: JSON.parse(JSON.stringify(highlightEffects)),
        stickers: JSON.parse(JSON.stringify(stickers)),
      },
    ]);
  }, [audioClips, videoClips, segments, zoomEffects, highlightEffects, stickers]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      toast.info("Không có thao tác nào để hoàn tác.");
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setAudioClips(previous.audioClips);
    setVideoClips(previous.videoClips);
    setSegments(previous.segments);
    setZoomEffects(previous.zoomEffects);
    setHighlightEffects(previous.highlightEffects);
    setStickers(previous.stickers);
    setSelectedElement(null);
    toast.success("↩️ Đã hoàn tác thao tác trước đó!");
  }, [undoStack]);

  // ─── Cắt (Split) Phụ đề, Âm thanh, Video hoặc Hiệu ứng tại kim Playhead ───
  const handleSplit = useCallback(() => {
    // 1. Cắt phần tử đang được chọn cụ thể (Selected Element)
    if (selectedElement) {
      if (selectedElement.type === "zoom") {
        const z = zoomEffects.find((item) => item.id === selectedElement.id);
        if (z && currentTime > z.start + 0.1 && currentTime < z.start + z.duration - 0.1) {
          pushHistorySnapshot();
          const firstPartDur = Number((currentTime - z.start).toFixed(2));
          const secondPartDur = Number((z.duration - firstPartDur).toFixed(2));
          const updatedFirst: ZoomEffect = { ...z, duration: firstPartDur };
          const newSecond: ZoomEffect = {
            ...z,
            id: `zoom_${Date.now()}`,
            start: Number(currentTime.toFixed(2)),
            duration: secondPartDur,
          };
          setZoomEffects((prev) => [
            ...prev.filter((item) => item.id !== z.id),
            updatedFirst,
            newSecond,
          ]);
          setSelectedElement({ id: newSecond.id, type: "zoom" });
          toast.success(`✂️ Đã cắt Zoom thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
          return;
        }
      } else if (selectedElement.type === "highlight") {
        const h = highlightEffects.find((item) => item.id === selectedElement.id);
        if (h && currentTime > h.start + 0.1 && currentTime < h.start + h.duration - 0.1) {
          pushHistorySnapshot();
          const firstPartDur = Number((currentTime - h.start).toFixed(2));
          const secondPartDur = Number((h.duration - firstPartDur).toFixed(2));
          const updatedFirst: HighlightEffect = { ...h, duration: firstPartDur };
          const newSecond: HighlightEffect = {
            ...h,
            id: `hl_${Date.now()}`,
            start: Number(currentTime.toFixed(2)),
            duration: secondPartDur,
          };
          setHighlightEffects((prev) => [
            ...prev.filter((item) => item.id !== h.id),
            updatedFirst,
            newSecond,
          ]);
          setSelectedElement({ id: newSecond.id, type: "highlight" });
          toast.success(`✂️ Đã cắt Highlight thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
          return;
        }
      } else if (selectedElement.type === "sticker") {
        const s = stickers.find((item) => item.id === selectedElement.id);
        if (s && currentTime > s.start + 0.1 && currentTime < s.start + s.duration - 0.1) {
          pushHistorySnapshot();
          const firstPartDur = Number((currentTime - s.start).toFixed(2));
          const secondPartDur = Number((s.duration - firstPartDur).toFixed(2));
          const updatedFirst: StickerOverlay = { ...s, duration: firstPartDur };
          const newSecond: StickerOverlay = {
            ...s,
            id: `stk_${Date.now()}`,
            start: Number(currentTime.toFixed(2)),
            duration: secondPartDur,
          };
          setStickers((prev) => [
            ...prev.filter((item) => item.id !== s.id),
            updatedFirst,
            newSecond,
          ]);
          setSelectedElement({ id: newSecond.id, type: "sticker" });
          toast.success(`✂️ Đã cắt Nhãn dán thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
          return;
        }
      } else if (selectedElement.type === "audio") {
        let clip = audioClips.find((item) => item.id === selectedElement.id);
        if (!clip && voiceoverUrl) {
          clip = {
            id: `audio_${Date.now()}`,
            name: voiceoverRecord?.title || "Voiceover Audio",
            url: voiceoverUrl,
            start: voiceoverStartTime || 0,
            duration: voiceoverDuration || 5,
            sourceStart: 0,
            text: voiceoverRecord?.text,
            originalText: voiceoverRecord?.text,
          };
        }
        if (clip && currentTime > clip.start + 0.1 && currentTime < clip.start + clip.duration - 0.1) {
          pushHistorySnapshot();
          const firstPartDur = Number((currentTime - clip.start).toFixed(2));
          const secondPartDur = Number((clip.duration - firstPartDur).toFixed(2));

          // Tách text thông minh theo tỷ lệ cắt
          const ratio = Math.max(0.05, Math.min(0.95, firstPartDur / clip.duration));
          const fullText = clip.originalText || clip.text || voiceoverRecord?.text || referenceScript || "";
          const speakerPrefix = clip.name.includes(" - ") ? clip.name.split(" - ")[0] : (voiceoverRecord?.title?.split(" - ")[0] || "Giọng đọc");
          const textInfo = splitAudioText(fullText, ratio, currentTime, speakerPrefix);

          const updatedFirst: AudioClip = {
            ...clip,
            duration: firstPartDur,
            name: textInfo.name1,
            text: textInfo.text1,
            originalText: fullText,
          };
          const newSecond: AudioClip = {
            id: `audio_${Date.now()}`,
            name: textInfo.name2,
            text: textInfo.text2,
            originalText: fullText,
            url: clip.url,
            start: Number(currentTime.toFixed(2)),
            duration: secondPartDur,
            sourceStart: Number((clip.sourceStart + firstPartDur).toFixed(2)),
          };
          const baseList = audioClips.length > 0 ? audioClips : [clip];
          const nextList = [
            ...baseList.filter((item) => item.id !== clip.id),
            updatedFirst,
            newSecond,
          ].sort((a, b) => a.start - b.start);
          setAudioClips(nextList);
          setSelectedElement({ id: newSecond.id, type: "audio" });
          toast.success(`✂️ Đã cắt âm thanh thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
          return;
        } else {
          toast.info("Hãy đặt kim thời gian (Playhead) vào giữa khối âm thanh để cắt.");
          return;
        }
      } else if (selectedElement.type === "video") {
        let clip = videoClips.find((item) => item.id === selectedElement.id);
        if (!clip && videoUrl && videoDuration > 0) {
          clip = {
            id: `video_${Date.now()}`,
            name: videoFile ? videoFile.name : "source_video.mp4",
            start: 0,
            duration: videoDuration,
            sourceStart: 0,
          };
        }
        if (clip && currentTime > clip.start + 0.1 && currentTime < clip.start + clip.duration - 0.1) {
          pushHistorySnapshot();
          const firstPartDur = Number((currentTime - clip.start).toFixed(2));
          const secondPartDur = Number((clip.duration - firstPartDur).toFixed(2));
          const updatedFirst: VideoClip = { ...clip, duration: firstPartDur };
          const newSecond: VideoClip = {
            id: `video_${Date.now()}`,
            name: clip.name,
            start: Number(currentTime.toFixed(2)),
            duration: secondPartDur,
            sourceStart: Number((clip.sourceStart + firstPartDur).toFixed(2)),
          };
          const baseList = videoClips.length > 0 ? videoClips : [clip];
          const nextList = [
            ...baseList.filter((item) => item.id !== clip.id),
            updatedFirst,
            newSecond,
          ].sort((a, b) => a.start - b.start);
          setVideoClips(nextList);
          setSelectedElement({ id: newSecond.id, type: "video" });
          toast.success(`✂️ Đã cắt video thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
          return;
        }
      }
    }

    // 2. Nếu người dùng KHÔNG chọn trước: Tự động bắt theo vị trí Playhead
    // 2.1 Ưu tiên cắt Khối Âm thanh nếu Playhead đang nằm trên track âm thanh
    let audioTarget = audioClips.find(
      (c) => currentTime > c.start + 0.1 && currentTime < c.start + c.duration - 0.1,
    );
    if (!audioTarget && voiceoverUrl) {
      const vStart = voiceoverStartTime || 0;
      const vDur = voiceoverDuration || 5;
      if (currentTime > vStart + 0.1 && currentTime < vStart + vDur - 0.1) {
        audioTarget = {
          id: `audio_${Date.now()}`,
          name: voiceoverRecord?.title || "Voiceover Audio",
          url: voiceoverUrl,
          start: vStart,
          duration: vDur,
          sourceStart: 0,
          text: voiceoverRecord?.text,
          originalText: voiceoverRecord?.text,
        };
      }
    }

    if (audioTarget) {
      pushHistorySnapshot();
      const firstPartDur = Number((currentTime - audioTarget.start).toFixed(2));
      const secondPartDur = Number((audioTarget.duration - firstPartDur).toFixed(2));

      // Tách text thông minh theo tỷ lệ cắt
      const ratio = Math.max(0.05, Math.min(0.95, firstPartDur / audioTarget.duration));
      const fullText = audioTarget.originalText || audioTarget.text || voiceoverRecord?.text || referenceScript || "";
      const speakerPrefix = audioTarget.name.includes(" - ") ? audioTarget.name.split(" - ")[0] : (voiceoverRecord?.title?.split(" - ")[0] || "Giọng đọc");
      const textInfo = splitAudioText(fullText, ratio, currentTime, speakerPrefix);

      const updatedFirst: AudioClip = {
        ...audioTarget,
        duration: firstPartDur,
        name: textInfo.name1,
        text: textInfo.text1,
        originalText: fullText,
      };
      const newSecond: AudioClip = {
        id: `audio_${Date.now()}`,
        name: textInfo.name2,
        text: textInfo.text2,
        originalText: fullText,
        url: audioTarget.url,
        start: Number(currentTime.toFixed(2)),
        duration: secondPartDur,
        sourceStart: Number((audioTarget.sourceStart + firstPartDur).toFixed(2)),
      };
      const baseList = audioClips.length > 0 ? audioClips : [audioTarget];
      const nextList = [
        ...baseList.filter((item) => item.id !== audioTarget.id),
        updatedFirst,
        newSecond,
      ].sort((a, b) => a.start - b.start);
      setAudioClips(nextList);
      setSelectedElement({ id: newSecond.id, type: "audio" });
      toast.success(`✂️ Đã cắt âm thanh thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
      return;
    }

    // 2.2 Cắt câu phụ đề (CaptionSegment) tại currentTime
    const seg = segments.find(
      (s) => currentTime >= s.start - 0.05 && currentTime <= s.end + 0.05,
    );
    if (seg && currentTime > seg.start + 0.15 && currentTime < seg.end - 0.15) {
      pushHistorySnapshot();
      const wordsBefore: WordTiming[] = [];
      const wordsAfter: WordTiming[] = [];

      (seg.words || []).forEach((w) => {
        if (w.end <= currentTime) {
          wordsBefore.push(w);
        } else if (w.start >= currentTime) {
          wordsAfter.push(w);
        } else {
          // Từ nằm ngay tại điểm cắt currentTime
          if (currentTime - w.start >= w.end - currentTime) {
            wordsBefore.push({ ...w, end: Number(currentTime.toFixed(2)) });
          } else {
            wordsAfter.push({ ...w, start: Number(currentTime.toFixed(2)) });
          }
        }
      });

      // Nếu một trong 2 bên bị rỗng từ, tự chia từ theo index
      if (wordsBefore.length === 0 && seg.words && seg.words.length > 1) {
        wordsBefore.push(seg.words[0]);
        wordsAfter.push(...seg.words.slice(1));
      } else if (wordsAfter.length === 0 && seg.words && seg.words.length > 1) {
        wordsBefore.push(...seg.words.slice(0, -1));
        wordsAfter.push(seg.words[seg.words.length - 1]);
      }

      const seg1: CaptionSegment = {
        ...seg,
        end: Number(currentTime.toFixed(2)),
        words: wordsBefore,
        text: wordsBefore.map((w) => w.word).join(" ") || seg.text.slice(0, Math.floor(seg.text.length / 2)),
      };

      const seg2: CaptionSegment = {
        ...seg,
        id: Date.now(),
        start: Number(currentTime.toFixed(2)),
        words: wordsAfter,
        text: wordsAfter.map((w) => w.word).join(" ") || seg.text.slice(Math.floor(seg.text.length / 2)),
      };

      setSegments((prev) => {
        const next = prev.flatMap((s) => (s.id === seg.id ? [seg1, seg2] : [s]));
        return next.sort((a, b) => a.start - b.start);
      });

      toast.success(`✂️ Đã cắt câu phụ đề thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
      return;
    }

    // 2.3 Cắt Video gốc tại currentTime
    let videoTarget = videoClips.find(
      (c) => currentTime > c.start + 0.1 && currentTime < c.start + c.duration - 0.1,
    );
    if (!videoTarget && videoUrl && videoDuration > 0) {
      if (currentTime > 0.1 && currentTime < videoDuration - 0.1) {
        videoTarget = {
          id: `video_${Date.now()}`,
          name: videoFile ? videoFile.name : "source_video.mp4",
          start: 0,
          duration: videoDuration,
          sourceStart: 0,
        };
      }
    }
    if (videoTarget) {
      pushHistorySnapshot();
      const firstPartDur = Number((currentTime - videoTarget.start).toFixed(2));
      const secondPartDur = Number((videoTarget.duration - firstPartDur).toFixed(2));
      const updatedFirst: VideoClip = { ...videoTarget, duration: firstPartDur };
      const newSecond: VideoClip = {
        id: `video_${Date.now()}`,
        name: videoTarget.name,
        start: Number(currentTime.toFixed(2)),
        duration: secondPartDur,
        sourceStart: Number((videoTarget.sourceStart + firstPartDur).toFixed(2)),
      };
      const baseList = videoClips.length > 0 ? videoClips : [videoTarget];
      const nextList = [
        ...baseList.filter((item) => item.id !== videoTarget.id),
        updatedFirst,
        newSecond,
      ].sort((a, b) => a.start - b.start);
      setVideoClips(nextList);
      setSelectedElement({ id: newSecond.id, type: "video" });
      toast.success(`✂️ Đã cắt video thành 2 đoạn tại ${currentTime.toFixed(2)}s!`);
      return;
    }

    toast.info("💡 Hãy đặt kim thời gian (Playhead) vào giữa clip âm thanh, video hoặc phụ đề để cắt.");
  }, [
    selectedElement,
    currentTime,
    audioClips,
    videoClips,
    voiceoverUrl,
    voiceoverRecord,
    voiceoverStartTime,
    voiceoverDuration,
    videoUrl,
    videoDuration,
    videoFile,
    zoomEffects,
    highlightEffects,
    stickers,
    segments,
    referenceScript,
    pushHistorySnapshot,
  ]);

  // Hỗ trợ phím tắt Space (Play/Pause), S hoặc Ctrl+B (Split), Ctrl+Z (Undo) khi không focus vào ô nhập chữ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (
        (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b")
      ) {
        e.preventDefault();
        handleSplit();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, handleSplit, handleUndo]);

  // ─── Sentence Editing (Tự động nội suy từ & mốc thời gian) ───────────────
  const handleSentenceChange = (segIndex: number, newText: string) => {
    setSegments((prev) => {
      const updated = [...prev];
      const seg = { ...updated[segIndex] };
      seg.text = newText;

      const rawWords = newText.trim().split(/\s+/).filter(Boolean);
      if (rawWords.length === 0) {
        seg.words = [];
      } else if (rawWords.length === seg.words.length) {
        // Giữ nguyên timestamp, chỉ update nội dung chữ
        seg.words = seg.words.map((w, idx) => ({
          ...w,
          word: rawWords[idx],
        }));
      } else {
        // Tái phân bổ mốc thời gian theo tỉ lệ số ký tự của từng từ (char-weighted interpolation)
        const totalChars = rawWords.reduce((sum, w) => sum + w.length, 0);
        const totalDuration = Math.max(0.2, seg.end - seg.start);
        let currentStart = seg.start;

        seg.words = rawWords.map((w, idx) => {
          const weight =
            totalChars > 0 ? w.length / totalChars : 1 / rawWords.length;
          const dur =
            idx === rawWords.length - 1
              ? seg.end - currentStart
              : totalDuration * weight;
          const wEnd = Math.min(
            seg.end,
            Number((currentStart + dur).toFixed(2)),
          );
          const wordItem: WordTiming = {
            word: w,
            start: Number(currentStart.toFixed(2)),
            end: Number(wEnd.toFixed(2)),
          };
          currentStart = wEnd;
          return wordItem;
        });
      }

      updated[segIndex] = seg;
      return updated;
    });
  };

  // ─── Active & Target Segment for Positioning ─────────────────────────────
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start - 0.05 && currentTime <= seg.end + 0.1,
  );

  const targetSegment = useMemo(() => {
    if (activeSegment) return activeSegment;
    if (expandedSegId) {
      const found = segments.find((s) => s.id === expandedSegId);
      if (found) return found;
    }
    return segments[0] || null;
  }, [activeSegment, expandedSegId, segments]);

  const currentSegmentY = targetSegment?.customPositionY ?? style.position_y;

  // ─── Drag & Drop Interactive Positioning ──────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();

      if (isDragging) {
        const relativeY = e.clientY - rect.top;
        const pct = Math.max(
          10,
          Math.min(90, Math.round((relativeY / rect.height) * 100)),
        );
        if (targetSegment) {
          setSegments((prev) =>
            prev.map((s) => (s.id === targetSegment.id ? { ...s, customPositionY: pct } : s))
          );
        } else {
          setStyle((s) => ({ ...s, position_y: pct }));
        }
      } else if (isDraggingFocus && selectedElement?.type === "zoom") {
        const pctX = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
        const pctY = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
        setZoomEffects((prev) =>
          prev.map((z) => (z.id === selectedElement.id ? { ...z, originX: pctX, originY: pctY } : z))
        );
      } else if (stickerTransform) {
        // Di chuyển Sticker theo delta tương đối mượt mà
        const deltaX = ((e.clientX - stickerTransform.startMouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - stickerTransform.startMouseY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, stickerTransform.initialX + deltaX));
        const newY = Math.max(0, Math.min(100, stickerTransform.initialY + deltaY));
        setStickers((prev) =>
          prev.map((s) =>
            s.id === stickerTransform.elementId
              ? { ...s, x: Number(newX.toFixed(1)), y: Number(newY.toFixed(1)) }
              : s
          )
        );
      } else if (highlightTransform) {
        // Di chuyển hoặc Co giãn 8 cạnh/góc Highlight theo delta mượt mà chuẩn Figma/CapCut
        const deltaX = ((e.clientX - highlightTransform.startMouseX) / rect.width) * 100;
        const deltaY = ((e.clientY - highlightTransform.startMouseY) / rect.height) * 100;
        const { mode, initialX, initialY, initialW, initialH, elementId } = highlightTransform;

        setHighlightEffects((prev) =>
          prev.map((h) => {
            if (h.id !== elementId) return h;
            let nextX = initialX;
            let nextY = initialY;
            let nextW = initialW;
            let nextH = initialH;

            if (mode === "move") {
              nextX = Math.max(0, Math.min(100 - initialW, initialX + deltaX));
              nextY = Math.max(0, Math.min(100 - initialH, initialY + deltaY));
            } else {
              if (mode.includes("e")) {
                nextW = Math.max(4, Math.min(100 - initialX, initialW + deltaX));
              }
              if (mode.includes("s")) {
                nextH = Math.max(4, Math.min(100 - initialY, initialH + deltaY));
              }
              if (mode.includes("w")) {
                const maxDelta = initialW - 4;
                const clamped = Math.min(maxDelta, Math.max(-initialX, deltaX));
                nextX = initialX + clamped;
                nextW = initialW - clamped;
              }
              if (mode.includes("n")) {
                const maxDelta = initialH - 4;
                const clamped = Math.min(maxDelta, Math.max(-initialY, deltaY));
                nextY = initialY + clamped;
                nextH = initialH - clamped;
              }
            }

            return {
              ...h,
              x: Number(nextX.toFixed(1)),
              y: Number(nextY.toFixed(1)),
              width: Number(nextW.toFixed(1)),
              height: Number(nextH.toFixed(1)),
            };
          })
        );
      }
    },
    [isDragging, isDraggingFocus, stickerTransform, highlightTransform, selectedElement, targetSegment],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingFocus(false);
    setStickerTransform(null);
    setHighlightTransform(null);
  }, []);

  useEffect(() => {
    if (isDragging || isDraggingFocus || stickerTransform || highlightTransform) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isDraggingFocus, stickerTransform, highlightTransform, handleMouseMove, handleMouseUp]);

  // ─── Tự Động Phân Lớp Layer (CapCut Style Layer Ordering) ───────────────────
  const getNextLayerOrder = useCallback(() => {
    const orders = [
      ...highlightEffects.map((h) => h.layerOrder || 0),
      ...stickers.map((s) => s.layerOrder || 0),
    ];
    return orders.length > 0 ? Math.max(...orders) + 1 : 1;
  }, [highlightEffects, stickers]);

  const handleBringToFront = (id: string, type: "highlight" | "sticker") => {
    const nextMax = getNextLayerOrder();
    if (type === "highlight") {
      setHighlightEffects((prev) =>
        prev.map((h) => (h.id === id ? { ...h, layerOrder: nextMax } : h))
      );
    } else {
      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, layerOrder: nextMax } : s))
      );
    }
    toast.success("Đã đưa lên lớp trên cùng!");
  };

  const handleSendToBack = (id: string, type: "highlight" | "sticker") => {
    const allOrders = [
      ...highlightEffects.map((h) => h.layerOrder || 0),
      ...stickers.map((s) => s.layerOrder || 0),
    ];
    const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1;
    const newOrder = Math.max(0, minOrder - 1);
    if (type === "highlight") {
      setHighlightEffects((prev) =>
        prev.map((h) => (h.id === id ? { ...h, layerOrder: newOrder } : h))
      );
    } else {
      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, layerOrder: newOrder } : s))
      );
    }
    toast.success("Đã đưa xuống lớp dưới cùng!");
  };

  const handleMoveLayerUp = (id: string, type: "highlight" | "sticker") => {
    if (type === "highlight") {
      setHighlightEffects((prev) =>
        prev.map((h) => (h.id === id ? { ...h, layerOrder: (h.layerOrder || 0) + 1 } : h))
      );
    } else {
      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, layerOrder: (s.layerOrder || 0) + 1 } : s))
      );
    }
    toast.success("Đã nâng lên 1 lớp");
  };

  const handleMoveLayerDown = (id: string, type: "highlight" | "sticker") => {
    if (type === "highlight") {
      setHighlightEffects((prev) =>
        prev.map((h) => (h.id === id ? { ...h, layerOrder: Math.max(0, (h.layerOrder || 0) - 1) } : h))
      );
    } else {
      setStickers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, layerOrder: Math.max(0, (s.layerOrder || 0) - 1) } : s))
      );
    }
    toast.success("Đã hạ xuống 1 lớp");
  };

  // ─── Quản Lý Vị Trí Phụ Đề Riêng Cho Từng Đoạn (Per-Segment Caption Positioning) ───
  const handleUpdateSegmentPositionY = (segId: number, y: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, customPositionY: y } : s))
    );
  };

  const handleApplyPositionToAll = (y: number) => {
    setStyle((s) => ({ ...s, position_y: y }));
    setSegments((prev) =>
      prev.map((s) => ({ ...s, customPositionY: undefined }))
    );
    toast.success(`Đã áp dụng vị trí Y: ${y}% cho tất cả các câu phụ đề!`);
  };

  const handleResetSegmentPosition = (segId: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, customPositionY: undefined } : s))
    );
    toast.success("Đã khôi phục vị trí mặc định cho đoạn này.");
  };

  // ─── Actions: Thêm & Xóa Hiệu ứng Video Tutorial ──────────────────────────
  const handleAddZoom = () => {
    const newZoom: ZoomEffect = {
      id: `zoom_${Date.now()}`,
      start: Number(currentTime.toFixed(2)),
      duration: 2.5,
      scale: 1.6,
      originX: 50,
      originY: 50,
      transitionDuration: 0.5,
      label: "Zoom In",
    };
    setZoomEffects((prev) => [...prev, newZoom]);
    setSelectedElement({ id: newZoom.id, type: "zoom" });
    setActiveTab("effects");
    toast.success("Đã thêm Zoom In! Kéo tâm ngắm trên video để chọn vị trí zoom.");
  };

  const handleAddHighlight = () => {
    const newHl: HighlightEffect = {
      id: `hl_${Date.now()}`,
      start: Number(currentTime.toFixed(2)),
      duration: 3.0,
      type: "neon_border",
      x: 20,
      y: 20,
      width: 40,
      height: 35,
      color: "#eab308",
      animation: "pulse",
      layerOrder: getNextLayerOrder(),
      label: "Highlight",
    };
    setHighlightEffects((prev) => [...prev, newHl]);
    setSelectedElement({ id: newHl.id, type: "highlight" });
    setActiveTab("effects");
    toast.success("Đã thêm khung viền Highlight!");
  };

  const handleAddSticker = () => {
    const newStk: StickerOverlay = {
      id: `stk_${Date.now()}`,
      start: Number(currentTime.toFixed(2)),
      duration: 2.5,
      type: "arrow",
      text: "Nhấp vào đây",
      x: 50,
      y: 50,
      rotation: 0,
      scale: 1.0,
      animation: "bounce",
      layerOrder: getNextLayerOrder(),
      label: "Mũi tên chỉ dẫn",
    };
    setStickers((prev) => [...prev, newStk]);
    setSelectedElement({ id: newStk.id, type: "sticker" });
    setActiveTab("effects");
    toast.success("Đã thêm Mũi tên chỉ dẫn! Kéo trực tiếp trên video để đặt vị trí.");
  };

  const handleDeleteSelected = () => {
    if (!selectedElement) return;
    pushHistorySnapshot();
    if (selectedElement.type === "zoom") {
      setZoomEffects((prev) => prev.filter((z) => z.id !== selectedElement.id));
      setSelectedElement(null);
      toast.success("Đã xóa Zoom.");
      return;
    } else if (selectedElement.type === "highlight") {
      setHighlightEffects((prev) => prev.filter((h) => h.id !== selectedElement.id));
      setSelectedElement(null);
      toast.success("Đã xóa Highlight.");
      return;
    } else if (selectedElement.type === "sticker") {
      setStickers((prev) => prev.filter((s) => s.id !== selectedElement.id));
      setSelectedElement(null);
      toast.success("Đã xóa Nhãn dán.");
      return;
    } else if (selectedElement.type === "audio") {
      setAudioClips((prev) => prev.filter((c) => c.id !== selectedElement.id));
      setSelectedElement(null);
      toast.success("Đã xóa đoạn âm thanh.");
      return;
    } else if (selectedElement.type === "video") {
      setVideoClips((prev) => prev.filter((c) => c.id !== selectedElement.id));
      setSelectedElement(null);
      toast.success("Đã xóa đoạn video.");
      return;
    }
  };

  // ─── Tính toán Active Effects & Selected Objects ───────────────────────────
  const activeZoom = useMemo(() => {
    return zoomEffects.find(
      (z) => currentTime >= z.start && currentTime <= z.start + z.duration
    );
  }, [zoomEffects, currentTime]);

  const activeHighlights = useMemo(() => {
    return highlightEffects.filter(
      (h) => currentTime >= h.start && currentTime <= h.start + h.duration
    );
  }, [highlightEffects, currentTime]);

  const activeStickers = useMemo(() => {
    return stickers.filter(
      (s) => currentTime >= s.start && currentTime <= s.start + s.duration
    );
  }, [stickers, currentTime]);

  const currentSelectedZoom = useMemo(() => {
    if (selectedElement?.type === "zoom") {
      return zoomEffects.find((z) => z.id === selectedElement.id);
    }
    return null;
  }, [selectedElement, zoomEffects]);

  const currentSelectedHighlight = useMemo(() => {
    if (selectedElement?.type === "highlight") {
      return highlightEffects.find((h) => h.id === selectedElement.id);
    }
    return null;
  }, [selectedElement, highlightEffects]);

  const currentSelectedSticker = useMemo(() => {
    if (selectedElement?.type === "sticker") {
      return stickers.find((s) => s.id === selectedElement.id);
    }
    return null;
  }, [selectedElement, stickers]);

  // Lưu trữ thời gian chuyển cảnh zoom gần nhất để khi kết thúc zoom out không bị gián đoạn transition
  const lastZoomDurationRef = useRef<number>(0.5);

  // ─── Tối Ưu Zoom In / Zoom Out Chuẩn Điện Ảnh (Edge Boundary Clamping & Fixed 50% Origin) ───
  // Cố định transformOrigin: 50% 50% và dùng translate3d kết hợp scale để triệt tiêu hoàn toàn giật nảy
  const zoomTransform = useMemo(() => {
    const targetZoom = activeZoom || (!isPlaying && currentSelectedZoom ? currentSelectedZoom : null);
    if (targetZoom) {
      lastZoomDurationRef.current = targetZoom.transitionDuration || 0.5;
    }
    const duration = targetZoom ? (targetZoom.transitionDuration || 0.5) : lastZoomDurationRef.current;

    if (!targetZoom || targetZoom.scale <= 1) {
      return {
        transform: "translate3d(0%, 0%, 0) scale(1)",
        duration,
      };
    }

    const scale = targetZoom.scale;
    // Giới hạn biên độ dịch chuyển tối đa để 4 cạnh video luôn phủ kín khung hình (không hở viền đen mép)
    const maxShift = 50 * (1 - 1 / scale);
    const rawShiftX = 50 - targetZoom.originX;
    const rawShiftY = 50 - targetZoom.originY;
    const clampedTx = Math.max(-maxShift, Math.min(maxShift, rawShiftX));
    const clampedTy = Math.max(-maxShift, Math.min(maxShift, rawShiftY));

    return {
      transform: `translate3d(${clampedTx}%, ${clampedTy}%, 0) scale(${scale})`,
      duration,
    };
  }, [activeZoom, currentSelectedZoom, isPlaying]);


  const getActiveWordIndex = (seg: CaptionSegment, time: number): number => {
    if (!seg.words || seg.words.length === 0) return -1;
    if (time < seg.words[0].start) return -1;

    for (let i = 0; i < seg.words.length; i++) {
      const w = seg.words[i];
      // Nối tiếp highlight: Giữ active cho đến khi từ kế tiếp bắt đầu để không có khoảng chết
      const nextStart =
        i < seg.words.length - 1 ? seg.words[i + 1].start : seg.end;
      const effectiveEnd = Math.max(w.end, nextStart);

      if (time >= w.start && time < effectiveEnd) {
        return i;
      }
    }

    if (
      time >= seg.words[seg.words.length - 1].start &&
      time <= seg.end + 0.1
    ) {
      return seg.words.length - 1;
    }

    return -1;
  };

  const activeWordIdx = activeSegment
    ? getActiveWordIndex(activeSegment, currentTime)
    : -1;

  // Export video with FFmpeg
  const handleExport = async () => {
    if (!sessionId) {
      toast.error("Vui lòng phân tích video trước khi xuất file");
      return;
    }

    setIsExporting(true);
    toast.info(
      "FFmpeg đang ép phụ đề Kinetic và hòa âm nhạc nền, vui lòng đợi...",
      {
        duration: 12000,
      },
    );

    try {
      // Tính toán chiều cao hiển thị thực tế của khung hình video trên trình duyệt
      let previewHeight = 450;
      if (videoRef.current) {
        const vid = videoRef.current;
        if (
          vid.videoWidth &&
          vid.videoHeight &&
          vid.clientHeight &&
          vid.clientWidth
        ) {
          const videoAspect = vid.videoWidth / vid.videoHeight;
          const containerAspect = vid.clientWidth / vid.clientHeight;
          if (videoAspect > containerAspect) {
            // Video dạng ngang hơn khung (letterbox trên/dưới)
            previewHeight = vid.clientWidth / videoAspect;
          } else {
            // Video khớp chiều cao (pillarbox 2 bên)
            previewHeight = vid.clientHeight;
          }
        } else if (vid.clientHeight) {
          previewHeight = vid.clientHeight;
        }
      }

      const payload = {
        session_id: sessionId,
        segments: segments,
        style_config: {
          ...style,
          preview_height: Math.round(previewHeight),
        },
        has_voiceover: !!voiceoverUrl || audioClips.length > 0,
        voiceover_start_time: voiceoverStartTime || 0,
        audio_clips: audioClips.map((c) => ({
          id: c.id,
          name: c.name,
          start: c.start,
          duration: c.duration,
          sourceStart: c.sourceStart,
          source_start: c.sourceStart,
        })),
        has_bgm: !!bgmFile,
        bgm_volume: bgmVolume,
      };

      const res = await fetch("http://localhost:8000/api/caption/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Xuất video thất bại");
      }

      const data = await res.json();
      setExportResultUrl(data.download_url);
      setExportFilename(data.filename);

      // Tự động tải video về máy tính dưới dạng Blob để tránh bị trình duyệt redirect
      try {
        const fileRes = await fetch(data.download_url);
        const blob = await fileRes.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const dl = document.createElement("a");
        dl.href = blobUrl;
        dl.download = data.filename || `kinetic_${Date.now()}.mp4`;
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
        window.URL.revokeObjectURL(blobUrl);
        toast.success("Xuất video hoàn tất! File đã được tải về máy.");
      } catch (blobErr) {
        // Dự phòng: Mở iframe ẩn tải trực tiếp
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = data.download_url;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 5000);
        toast.success("Xuất video hoàn tất! File đang được tải về.");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi xuất video");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-full px-1 md:px-2 pb-16 space-y-4">
      {/* ─── 1. Header Toolbar (Descript Top Bar) ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface/80 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl 2k:text-2xl font-bold text-on-surface tracking-tight">
                Kinetic Caption Studio
              </h1>
              <span className="text-[10px] bg-primary/20 border border-primary/40 text-primary px-2 py-0.5 rounded-full font-semibold">
                Descript Mode
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Biên tập video bằng văn bản, Timeline đa tầng & bóc tách mốc thời
              gian 60 FPS
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto">
          <input
            type="file"
            ref={videoInputRef}
            onChange={handleVideoSelect}
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
          />

          <button
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 hover:border-primary/50 bg-surface-variant/40 hover:bg-surface-variant text-on-surface transition-all text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            {videoFile ? "Đổi video" : "Chọn Video (.mp4)"}
          </button>

          {/* Nút Chọn / Quản lý Giọng đọc Voiceover */}
          <button
            onClick={() => setIsVoiceoverModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-xs font-medium",
              voiceoverUrl
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm"
                : "border-white/10 hover:border-primary/50 bg-surface-variant/40 hover:bg-surface-variant text-on-surface"
            )}
            title="Lồng tiếng giọng đọc từ Thư viện, Dự án hoặc tải file âm thanh riêng"
          >
            <Mic className={cn("w-3.5 h-3.5", voiceoverUrl ? "text-amber-400" : "text-primary")} />
            <span>{voiceoverRecord ? "Đổi Giọng đọc" : "Lồng Giọng đọc (Voiceover)"}</span>
          </button>

          {videoFile && (
            <button
              onClick={() => setShowScriptBox((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                showScriptBox || referenceScript.trim()
                  ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                  : "bg-surface-variant/40 border-white/10 hover:border-white/20 text-on-surface",
              )}
              title="Nhập văn bản đọc gốc để so khớp chính tả 100%"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>
                {referenceScript.trim() ? "Kịch bản (Đã nạp)" : "Kịch bản mẫu"}
              </span>
              {referenceScript.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          )}

          {videoFile && (
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold transition-all shadow-lg hover:shadow-primary/20 disabled:opacity-50 text-xs"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang bóc tách AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo Phụ Đề AI</span>
                </>
              )}
            </button>
          )}

          {/* Toggle Inspector */}
          <button
            onClick={() => setShowInspector(!showInspector)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition",
              showInspector
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-surface-variant/40 border-white/10 text-on-surface hover:bg-surface-variant",
            )}
            title="Ẩn / Hiện thanh công cụ Kiểu dáng & Nhạc nền"
          >
            {showInspector ? (
              <SidebarClose className="w-3.5 h-3.5" />
            ) : (
              <SidebarOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {showInspector ? "Thu gọn công cụ" : "Mở công cụ"}
            </span>
          </button>

          {/* Export Button Header */}
          {segments.length > 0 && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xuất...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Video</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Voiceover Notification Bar khi đã nạp giọng đọc */}
      {voiceoverRecord && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs shadow-md animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Mic className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white truncate">
                  {voiceoverRecord.title || "Giọng đọc lồng tiếng"}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 text-[10px] font-mono">
                  Voiceover Sẵn sàng
                </span>
              </div>
              {voiceoverRecord.text && (
                <p className="text-[11px] text-amber-200/70 truncate max-w-xl">
                  "{voiceoverRecord.text}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <label className="flex items-center gap-1.5 text-[11px] text-amber-300/90 cursor-pointer select-none px-2.5 py-1 rounded-lg bg-black/30 border border-amber-500/20">
              <input
                type="checkbox"
                checked={muteOriginalAudio}
                onChange={(e) => setMuteOriginalAudio(e.target.checked)}
                className="rounded accent-amber-400 cursor-pointer w-3.5 h-3.5"
              />
              <span>Tắt tiếng video gốc</span>
            </label>
            <button
              type="button"
              onClick={() => setIsVoiceoverModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium transition"
            >
              Đổi giọng khác
            </button>
            <button
              type="button"
              onClick={handleRemoveVoiceover}
              className="p-1.5 rounded-lg hover:bg-white/10 text-amber-300/70 hover:text-amber-200 transition"
              title="Gỡ giọng đọc"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expandable Reference Script Alignment Box */}
      {showScriptBox && (
        <div className="bg-surface/85 backdrop-blur-md p-5 rounded-2xl border border-primary/30 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface">
                  Kịch bản đọc đối chiếu (Chuẩn hóa chính tả 100% không lo AI
                  nghe nhầm)
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Whisper AI và thuật toán Sequence Alignment sẽ đối chiếu để
                  sửa sạch các lỗi sai âm trong khi bảo toàn 100% mốc thời gian.
                </p>
              </div>
            </div>
            {segments.length > 0 && (
              <button
                onClick={handleAlignScript}
                disabled={isAligningScript || !referenceScript.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold shadow-md transition disabled:opacity-40"
              >
                {isAligningScript ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                Khớp & Sửa chính tả tức thì
              </button>
            )}
          </div>
          <textarea
            value={referenceScript}
            onChange={(e) => setReferenceScript(e.target.value)}
            placeholder="Dán toàn bộ kịch bản hoặc văn bản bài đọc vào đây... Khi bấm 'Khớp & Sửa chính tả tức thì', hệ thống sẽ tự động ghép từng âm tiết chuẩn xác tuyệt đối mà vẫn bảo toàn 100% mốc thời gian!"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-variant/30 border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:border-primary/50 resize-y leading-relaxed font-sans"
          />
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>
              💡 Mẹo: Bạn có thể nhập trước khi bấm{" "}
              <strong>Tạo Phụ Đề AI</strong> hoặc dán sau khi đã có phụ đề để
              sửa lỗi ngay trong 0.1 giây.
            </span>
            <button
              onClick={() => setShowScriptBox(false)}
              className="text-xs text-on-surface-variant hover:text-on-surface underline"
            >
              Đóng ô này
            </button>
          </div>
        </div>
      )}

      {/* ─── 2. Main Studio Workspace: 3 Columns (Doc - Canvas - Inspector) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column: Doc / Script View (Tự động đồng bộ bằng đúng chiều cao Khung Preview) */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300",
            showInspector
              ? "lg:col-span-3 xl:col-span-3"
              : "lg:col-span-3 xl:col-span-3",
          )}
          style={{ height: previewHeight ? `${previewHeight}px` : undefined }}
        >
          <TranscriptDocEditor
            segments={segments}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSeek={seekTo}
            onUpdateSegments={setSegments}
            onOptimizeChunks={handleOptimizeChunks}
            isOptimizingChunks={isOptimizingChunks}
            onRestoreSync={handleRestoreSync}
            hasRawSegments={rawSegments.length > 0 || Boolean(sessionId)}
          />
        </div>

        {/* Center Column: Video Live Preview (Tự động ôm khít tỉ lệ gốc của video, không dư padding trên dưới) */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300",
            showInspector
              ? "lg:col-span-6 xl:col-span-6"
              : "lg:col-span-9 xl:col-span-9",
          )}
        >
          <div
            ref={videoContainerRef}
            style={{
              aspectRatio: videoAspectRatio ? `${videoAspectRatio}` : "16 / 9",
            }}
            className="relative w-full max-h-[68vh] 2k:max-h-[75vh] bg-black/95 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center select-none group"
          >
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={(e) => {
                    const vid = e.currentTarget;
                    const dur = vid.duration || 0;
                    setVideoDuration(dur);
                    if (vid.videoWidth && vid.videoHeight) {
                      setVideoAspectRatio(vid.videoWidth / vid.videoHeight);
                    }
                    if (dur > 0) {
                      setVideoClips((prev) => {
                        if (prev.length === 0) {
                          return [
                            {
                              id: `video_${Date.now()}`,
                              name: videoFile ? videoFile.name : "source_video.mp4",
                              start: 0,
                              duration: dur,
                              sourceStart: 0,
                            },
                          ];
                        }
                        return prev;
                      });
                    }
                  }}
                  onDurationChange={(e) => {
                    const vid = e.currentTarget;
                    const dur = vid.duration || 0;
                    setVideoDuration(dur);
                    if (vid.videoWidth && vid.videoHeight) {
                      setVideoAspectRatio(vid.videoWidth / vid.videoHeight);
                    }
                    if (dur > 0) {
                      setVideoClips((prev) => {
                        if (prev.length === 0) {
                          return [
                            {
                              id: `video_${Date.now()}`,
                              name: videoFile ? videoFile.name : "source_video.mp4",
                              start: 0,
                              duration: dur,
                              sourceStart: 0,
                            },
                          ];
                        }
                        return prev;
                      });
                    }
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain pointer-events-auto cursor-pointer select-none"
                  style={{
                    transform: zoomTransform.transform,
                    transformOrigin: "50% 50%",
                    willChange: "transform",
                    transition: `transform ${zoomTransform.duration}s cubic-bezier(0.25, 1, 0.5, 1)`,
                  }}
                  onClick={togglePlay}
                  playsInline
                />

                {/* ── Focus Ring Tâm ngắm Phóng to Zoom In (Kéo trực tiếp trên Video) ── */}
                {currentSelectedZoom && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsDraggingFocus(true);
                    }}
                    className="absolute z-40 -translate-x-1/2 -translate-y-1/2 cursor-move flex items-center justify-center pointer-events-auto group/focus"
                    style={{
                      left: `${currentSelectedZoom.originX}%`,
                      top: `${currentSelectedZoom.originY}%`,
                    }}
                    title="Nhấp giữ và kéo để chọn điểm phóng to (Focus Point)"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-purple-400 bg-purple-500/20 backdrop-blur-xs flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(168,85,247,0.8)]">
                      <Crosshair className="w-6 h-6 text-purple-300" />
                    </div>
                    <div className="absolute top-15 bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono text-purple-200 border border-purple-500/40 whitespace-nowrap pointer-events-none shadow flex items-center gap-1.5">
                      <span>Zoom {currentSelectedZoom.scale}x ({currentSelectedZoom.originX}%, {currentSelectedZoom.originY}%)</span>
                      <span className="text-purple-400 font-sans">⚡ {currentSelectedZoom.transitionDuration || 0.5}s</span>
                    </div>
                  </div>
                )}

                {/* ── Highlight Overlays (8 Điểm Neo Co Giãn Cạnh/Góc & Kéo Chuột Mượt Mà) ── */}
                {(activeHighlights.length > 0
                  ? activeHighlights
                  : currentSelectedHighlight && !isPlaying
                  ? [currentSelectedHighlight]
                  : []
                ).map((h) => {
                  const isSelected = selectedElement?.id === h.id;
                  const zIndex = 30 + (h.layerOrder || 1);

                  return (
                    <div
                      key={h.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElement({ id: h.id, type: "highlight" });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedElement({ id: h.id, type: "highlight" });
                        setHighlightTransform({
                          mode: "move",
                          startMouseX: e.clientX,
                          startMouseY: e.clientY,
                          initialX: h.x,
                          initialY: h.y,
                          initialW: h.width,
                          initialH: h.height,
                          elementId: h.id,
                        });
                      }}
                      className={cn(
                        "absolute transition-none rounded-xl pointer-events-auto select-none",
                        isSelected
                          ? "cursor-move ring-2 ring-white/80 shadow-2xl"
                          : "cursor-pointer hover:ring-1 hover:ring-white/40",
                        h.animation === "pulse" && "animate-pulse"
                      )}
                      style={{
                        left: `${h.x}%`,
                        top: `${h.y}%`,
                        width: `${h.width}%`,
                        height: `${h.height}%`,
                        zIndex: zIndex,
                        ...(h.type === "spotlight"
                          ? {
                              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                              border: isSelected ? "2px solid #fbbf24" : "1.5px solid rgba(255,255,255,0.4)",
                            }
                          : {
                              border: `3px solid ${h.color}`,
                              boxShadow: `0 0 25px ${h.color}, inset 0 0 15px ${h.color}30`,
                              backgroundColor: `${h.color}15`,
                            }),
                      }}
                      title="Nhấp giữ để kéo di chuyển | Dùng 8 điểm neo để chỉnh kích thước"
                    >
                      {/* Badge Tên & Thứ tự Layer */}
                      <div
                        className="absolute -top-6 left-0 text-[9px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1"
                        style={{
                          backgroundColor: h.type === "spotlight" ? "#f59e0b" : h.color,
                          color: "#000",
                        }}
                      >
                        <span>{h.type === "spotlight" ? "Spotlight" : "Highlight"}</span>
                        <span className="bg-black/25 text-white px-1 rounded text-[8px]">
                          Lớp {h.layerOrder || 1}
                        </span>
                      </div>

                      {/* 8 Điểm Neo Co Giãn Trực Tiếp Trên Khung (4 Góc + 4 Cạnh Chuẩn Figma/CapCut) */}
                      {isSelected && (
                        <>
                          {/* 4 Cạnh */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "n",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-2 bg-white rounded-sm border border-black/80 shadow-md cursor-ns-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo cạnh trên"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "s",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-2 bg-white rounded-sm border border-black/80 shadow-md cursor-ns-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo cạnh dưới"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "w",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-2 h-4 bg-white rounded-sm border border-black/80 shadow-md cursor-ew-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo cạnh trái"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "e",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-4 bg-white rounded-sm border border-black/80 shadow-md cursor-ew-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo cạnh phải"
                          />

                          {/* 4 Góc */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "nw",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-black/80 shadow-lg cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo góc trên-trái"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "ne",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-black/80 shadow-lg cursor-nesw-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo góc trên-phải"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "sw",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-black/80 shadow-lg cursor-nesw-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo góc dưới-trái"
                          />
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setHighlightTransform({
                                mode: "se",
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                initialX: h.x,
                                initialY: h.y,
                                initialW: h.width,
                                initialH: h.height,
                                elementId: h.id,
                              });
                            }}
                            className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-black/80 shadow-lg cursor-nwse-resize z-50 hover:scale-125 transition-transform"
                            title="Kéo góc dưới-phải"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* ── Sticker / Callouts Overlays (Kéo Mượt Mà & Phân Tầng Layer Z-Index) ── */}
                {(activeStickers.length > 0
                  ? activeStickers
                  : currentSelectedSticker && !isPlaying
                  ? [currentSelectedSticker]
                  : []
                ).map((stk) => {
                  const isSelected = selectedElement?.id === stk.id;
                  const zIndex = 30 + (stk.layerOrder || 1);

                  return (
                    <div
                      key={stk.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElement({ id: stk.id, type: "sticker" });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedElement({ id: stk.id, type: "sticker" });
                        setStickerTransform({
                          startMouseX: e.clientX,
                          startMouseY: e.clientY,
                          initialX: stk.x,
                          initialY: stk.y,
                          elementId: stk.id,
                        });
                      }}
                      className={cn(
                        "absolute cursor-grab active:cursor-grabbing transition-none pointer-events-auto select-none",
                        stk.animation === "bounce" && "animate-bounce",
                        stk.animation === "pulse" && "animate-pulse",
                        isSelected && "ring-2 ring-cyan-400 ring-offset-2 ring-offset-black rounded-lg"
                      )}
                      style={{
                        left: `${stk.x}%`,
                        top: `${stk.y}%`,
                        transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(${stk.scale})`,
                        zIndex: zIndex,
                      }}
                      title="Nhấp giữ để kéo thả vị trí sticker"
                    >
                      {/* Badge Lớp Layer */}
                      {isSelected && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 text-cyan-300 text-[8px] font-bold px-1.5 py-0.2 rounded border border-cyan-400/40 whitespace-nowrap shadow">
                          Lớp {stk.layerOrder || 1}
                        </div>
                      )}
                      {stk.type === "arrow" && (
                        <div className="flex items-center gap-1.5 bg-cyan-500 text-black font-extrabold px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.8)] border-2 border-white">
                          <ArrowRight className="w-5 h-5 stroke-[3]" />
                          {stk.text && <span className="text-xs">{stk.text}</span>}
                        </div>
                      )}

                      {stk.type === "pointer" && (
                        <div className="relative filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                          <MousePointer className="w-8 h-8 fill-white text-black stroke-[1.5]" />
                          {stk.text && (
                            <div className="absolute left-6 top-4 bg-black/90 border border-white/20 text-white font-medium text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap">
                              {stk.text}
                            </div>
                          )}
                        </div>
                      )}

                      {stk.type === "click" && (
                        <div className="relative flex items-center justify-center">
                          <div className="absolute w-12 h-12 rounded-full bg-cyan-400/30 animate-ping" />
                          <div className="w-8 h-8 rounded-full bg-cyan-500/80 border-2 border-white shadow-lg flex items-center justify-center">
                            <span className="w-3 h-3 rounded-full bg-white" />
                          </div>
                          {stk.text && (
                            <span className="absolute top-10 bg-black/80 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-400/40 whitespace-nowrap">
                              {stk.text}
                            </span>
                          )}
                        </div>
                      )}

                      {stk.type === "star" && (
                        <div className="flex items-center gap-1 bg-amber-400 text-black font-bold px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.8)] border border-white">
                          <Star className="w-4 h-4 fill-black text-black" />
                          {stk.text && <span className="text-xs">{stk.text}</span>}
                        </div>
                      )}

                      {stk.type === "alert" && (
                        <div className="flex items-center gap-1.5 bg-red-500 text-white font-bold px-2.5 py-1 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] border border-white">
                          <AlertTriangle className="w-4 h-4 text-white" />
                          {stk.text && <span className="text-xs">{stk.text}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}



                {/* Interactive Kinetic Subtitle Overlay (Kéo thả chuột trực tiếp trên Video) */}
                <div
                  onMouseDown={handleDragStart}
                  className={cn(
                    "absolute left-0 right-0 px-6 flex flex-col items-center z-20 cursor-grab transition-all group/caption",
                    isDragging && "cursor-grabbing opacity-90 scale-[1.02]",
                  )}
                  style={{
                    top: `${activeSegment?.customPositionY ?? style.position_y}%`,
                    transform: "translateY(-50%)",
                    fontFamily: style.font_name,
                  }}
                  title="Nhấp giữ chuột để kéo phụ đề lên/xuống (Áp dụng cho đoạn này)"
                >
                  {/* Position Tag Bar khi hover hoặc active */}
                  {activeSegment && (
                    <div className="mb-1.5 opacity-0 group-hover/caption:opacity-100 transition-opacity flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-[10px] select-none pointer-events-auto shadow-lg">
                      <span className="text-primary font-bold">Đoạn #{activeSegment.id}</span>
                      <span className="text-white/40">|</span>
                      <span className="font-mono text-white/90">Y: {activeSegment.customPositionY ?? style.position_y}%</span>
                      {activeSegment.customPositionY !== undefined ? (
                        <>
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium text-[9px] border border-amber-500/30">Tùy biến</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetSegmentPosition(activeSegment.id);
                            }}
                            className="text-[9px] text-white/60 hover:text-white underline ml-1 cursor-pointer"
                            title="Khôi phục về vị trí mặc định"
                          >
                            Đặt lại
                          </button>
                        </>
                      ) : (
                        <span className="text-white/40 text-[9px]">(Mặc định)</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyPositionToAll(activeSegment.customPositionY ?? style.position_y);
                        }}
                        className="text-[9px] text-primary hover:text-primary-hover font-semibold underline ml-1 cursor-pointer flex items-center gap-0.5"
                        title="Đồng bộ vị trí này cho tất cả các câu trong video"
                      >
                        <CheckCheck className="w-2.5 h-2.5" />
                        <span>Áp dụng tất cả</span>
                      </button>
                    </div>
                  )}

                  {activeSegment ? (
                    <div className="flex flex-wrap justify-center items-center gap-x-2.5 gap-y-1.5 text-center max-w-[90%] p-2 rounded-xl bg-black/20 backdrop-blur-[2px] border border-white/5 group-hover/caption:border-primary/30 transition">
                      {activeSegment.words.map((w, idx) => {
                        const isCurrent = idx === activeWordIdx;

                        return (
                          <span
                            key={idx}
                            className={cn(
                              "font-black tracking-wide uppercase transition-all duration-150 inline-block",
                              isCurrent
                                ? "scale-110 drop-shadow-[0_0_15px_rgba(255,255,0,0.8)] z-10"
                                : "opacity-90",
                            )}
                            style={{
                              fontSize: `${style.font_size}px`,
                              color: isCurrent
                                ? style.highlight_color
                                : style.primary_color,
                              WebkitTextStroke: `${style.outline_size}px ${style.outline_color}`,
                              paintOrder: "stroke fill",
                            }}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-white/30 italic px-3 py-1 bg-black/40 rounded-full border border-white/5 opacity-0 group-hover/caption:opacity-100 transition">
                      Kéo để định vị vị trí chữ ({style.position_y}%)
                    </div>
                  )}
                </div>

                {/* Floating Player Control Bar */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/75 backdrop-blur-md px-4 py-2 rounded-xl flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-30 border border-white/10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition"
                      title={
                        isPlaying ? "Tạm dừng (Space)" : "Phát video (Space)"
                      }
                    >
                      {isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                    </button>
                    <button
                      onClick={() => seekTo(0)}
                      className="p-1.5 text-on-surface-variant hover:text-on-surface transition"
                      title="Phát lại từ đầu"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono text-on-surface">
                      {currentTime.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <MoveVertical className="w-3 h-3 text-primary" />
                      Y: {activeSegment?.customPositionY ?? style.position_y}%
                    </span>

                    {bgmFile && (
                      <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        <Music className="w-3 h-3 animate-pulse" />
                        <span className="truncate max-w-[100px]">
                          {bgmFile.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-variant/40 flex items-center justify-center text-primary/80 border border-white/5">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">
                    Chưa có video nào được chọn
                  </h3>
                  <p className="text-sm text-on-surface-variant max-w-sm mt-1">
                    Nhấn vào nút "Chọn Video" phía trên để nạp video (.mp4,
                    .mov, .webm)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Inspector Panel (Tự động đồng bộ bằng đúng chiều cao Khung Preview) */}
        {showInspector && (
          <div
            className="lg:col-span-3 flex flex-col transition-all duration-300"
            style={{ height: previewHeight ? `${previewHeight}px` : undefined }}
          >
            <div className="bg-surface/70 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex-1 flex flex-col h-full overflow-hidden">
              {/* Tabs Switcher */}
              <div className="flex p-1 bg-surface-variant/40 rounded-xl border border-white/10 text-xs font-medium mb-3 gap-1">
                <button
                  onClick={() => setActiveTab("effects")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition",
                    activeTab === "effects"
                      ? "bg-primary text-on-primary shadow"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Hiệu ứng</span>
                </button>
                <button
                  onClick={() => setActiveTab("style")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition",
                    activeTab === "style"
                      ? "bg-primary text-on-primary shadow"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Kiểu chữ</span>
                </button>
                <button
                  onClick={() => setActiveTab("bgm")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 transition",
                    activeTab === "bgm"
                      ? "bg-primary text-on-primary shadow"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Nhạc nền</span>
                </button>
              </div>

              {/* Tab 0: Tutorial Effects & Overlays Controls */}
              {activeTab === "effects" && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 text-xs">
                  {/* Nếu đang chọn một Zoom effect */}
                  {selectedElement?.type === "zoom" && currentSelectedZoom && (
                    <div className="space-y-3 bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                          <Focus className="w-3.5 h-3.5 text-purple-400" />
                          Phóng to (Zoom In)
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="text-red-400 hover:text-red-300 text-[11px] underline"
                        >
                          Xóa
                        </button>
                      </div>

                      {/* Tỉ lệ Scale */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-on-surface-variant">Tỉ lệ phóng to (Scale):</span>
                          <span className="font-mono text-purple-300 font-bold">{currentSelectedZoom.scale}x</span>
                        </div>
                        <input
                          type="range"
                          min="1.2"
                          max="3.0"
                          step="0.1"
                          value={currentSelectedZoom.scale}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setZoomEffects((prev) =>
                              prev.map((z) => (z.id === currentSelectedZoom.id ? { ...z, scale: val } : z))
                            );
                          }}
                          className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>

                      {/* Vị trí Focus nhanh (Presets) */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-on-surface-variant">Vị trí điểm ngắm (Focus Point):</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { label: "Trên-Trái", x: 20, y: 20 },
                            { label: "Trên-Phải", x: 80, y: 20 },
                            { label: "Trung tâm", x: 50, y: 50 },
                            { label: "Dưới-Trái", x: 20, y: 80 },
                            { label: "Dưới-Phải", x: 80, y: 80 },
                          ].map((pos) => (
                            <button
                              key={pos.label}
                              onClick={() => {
                                setZoomEffects((prev) =>
                                  prev.map((z) =>
                                    z.id === currentSelectedZoom.id ? { ...z, originX: pos.x, originY: pos.y } : z
                                  )
                                );
                              }}
                              className={cn(
                                "py-1 px-1.5 rounded border text-[10px] truncate transition",
                                currentSelectedZoom.originX === pos.x && currentSelectedZoom.originY === pos.y
                                  ? "bg-purple-600/50 border-purple-400 text-white font-semibold"
                                  : "bg-surface-variant/20 border-white/5 text-on-surface-variant hover:bg-surface-variant/40"
                              )}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-purple-300/80 italic mt-1">
                          💡 Mẹo: Bạn có thể kéo trực tiếp vòng tròn ngắm trên màn hình video!
                        </p>
                      </div>

                      {/* Tốc độ chuyển động Zoom In/Out */}
                      <div className="space-y-1.5 pt-1 border-t border-purple-500/20">
                        <div className="flex justify-between text-[11px] items-center">
                          <span className="text-on-surface-variant flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-purple-400" />
                            Tốc độ Zoom (Transition Speed):
                          </span>
                          <span className="font-mono text-purple-300 font-bold">
                            {currentSelectedZoom.transitionDuration || 0.5}s
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.0"
                          step="0.1"
                          value={currentSelectedZoom.transitionDuration || 0.5}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setZoomEffects((prev) =>
                              prev.map((z) => (z.id === currentSelectedZoom.id ? { ...z, transitionDuration: val } : z))
                            );
                          }}
                          className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[9px] text-on-surface-variant/70">
                          <span>0.2s (Nhanh)</span>
                          <span>0.5s (Tự nhiên)</span>
                          <span>1.2s (Điện ảnh)</span>
                        </div>
                      </div>

                      {/* Thời lượng */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-on-surface-variant">Thời lượng duy trì:</span>
                          <span className="font-mono text-purple-300 font-bold">{currentSelectedZoom.duration}s</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="10.0"
                          step="0.5"
                          value={currentSelectedZoom.duration}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setZoomEffects((prev) =>
                              prev.map((z) => (z.id === currentSelectedZoom.id ? { ...z, duration: val } : z))
                            );
                          }}
                          className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Nếu đang chọn một Highlight effect */}
                  {selectedElement?.type === "highlight" && currentSelectedHighlight && (
                    <div className="space-y-3 bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                          <Highlighter className="w-3.5 h-3.5 text-amber-400" />
                          Khung Viền Highlight
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="text-red-400 hover:text-red-300 text-[11px] underline"
                        >
                          Xóa
                        </button>
                      </div>

                      {/* Phân Tầng Layer (CapCut Style) */}
                      <div className="bg-black/40 p-2 rounded-lg border border-amber-500/20 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-300 font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-amber-400" />
                            Thứ tự Lớp (Layer Z-Index):
                          </span>
                          <span className="bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.2 rounded font-bold">
                            Lớp #{currentSelectedHighlight.layerOrder || 1}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => handleBringToFront(currentSelectedHighlight.id, "highlight")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-amber-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Đưa lên trên cùng"
                          >
                            <ChevronsUp className="w-3 h-3" />
                            <span className="text-[8px]">Trên cùng</span>
                          </button>
                          <button
                            onClick={() => handleMoveLayerUp(currentSelectedHighlight.id, "highlight")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-amber-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Lên 1 lớp"
                          >
                            <ArrowUp className="w-3 h-3" />
                            <span className="text-[8px]">Lên 1 lớp</span>
                          </button>
                          <button
                            onClick={() => handleMoveLayerDown(currentSelectedHighlight.id, "highlight")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-amber-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Xuống 1 lớp"
                          >
                            <ArrowDown className="w-3 h-3" />
                            <span className="text-[8px]">Xuống 1 lớp</span>
                          </button>
                          <button
                            onClick={() => handleSendToBack(currentSelectedHighlight.id, "highlight")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-amber-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Đưa xuống dưới cùng"
                          >
                            <ChevronsDown className="w-3 h-3" />
                            <span className="text-[8px]">Dưới cùng</span>
                          </button>
                        </div>
                      </div>

                      {/* Loại Highlight */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-on-surface-variant">Kiểu hiệu ứng:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { type: "neon_border", label: "Viền Neon phát sáng" },
                            { type: "spotlight", label: "Spotlight (Rọi sáng)" },
                          ].map((item) => (
                            <button
                              key={item.type}
                              onClick={() => {
                                setHighlightEffects((prev) =>
                                  prev.map((h) =>
                                    h.id === currentSelectedHighlight.id ? { ...h, type: item.type as any } : h
                                  )
                                );
                              }}
                              className={cn(
                                "py-1.5 px-2 rounded-lg border text-[11px] transition text-center",
                                currentSelectedHighlight.type === item.type
                                  ? "bg-amber-600/50 border-amber-400 text-white font-semibold"
                                  : "bg-surface-variant/20 border-white/5 text-on-surface-variant hover:bg-surface-variant/40"
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Chọn màu viền */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-on-surface-variant">Màu sắc viền:</span>
                        <div className="flex items-center gap-2">
                          {[
                            { color: "#eab308", label: "Vàng" },
                            { color: "#06b6d4", label: "Cyan" },
                            { color: "#a855f7", label: "Tím" },
                            { color: "#ef4444", label: "Đỏ" },
                            { color: "#22c55e", label: "Xanh" },
                          ].map((c) => (
                            <button
                              key={c.color}
                              onClick={() => {
                                setHighlightEffects((prev) =>
                                  prev.map((h) =>
                                    h.id === currentSelectedHighlight.id ? { ...h, color: c.color } : h
                                  )
                                );
                              }}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition transform hover:scale-110",
                                currentSelectedHighlight.color === c.color ? "border-white scale-110 shadow-lg" : "border-transparent"
                              )}
                              style={{ backgroundColor: c.color }}
                              title={c.label}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Hướng dẫn thao tác 8 điểm neo */}
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200/90 leading-relaxed">
                        💡 <strong>Thao tác trực quan:</strong> Nhấp giữ kéo di chuyển khung trên video. Kéo 8 điểm neo hình tròn/chữ nhật ở 4 góc và 4 cạnh để chỉnh kích thước tùy ý!
                      </div>
                    </div>
                  )}

                  {/* Nếu đang chọn một Sticker */}
                  {selectedElement?.type === "sticker" && currentSelectedSticker && (
                    <div className="space-y-3 bg-cyan-950/30 border border-cyan-500/30 p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                          <Smile className="w-3.5 h-3.5 text-cyan-400" />
                          Nhãn dán / Mũi tên
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="text-red-400 hover:text-red-300 text-[11px] underline"
                        >
                          Xóa
                        </button>
                      </div>

                      {/* Phân Tầng Layer Sticker (CapCut Style) */}
                      <div className="bg-black/40 p-2 rounded-lg border border-cyan-500/20 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-cyan-300 font-semibold flex items-center gap-1">
                            <Layers className="w-3 h-3 text-cyan-400" />
                            Thứ tự Lớp (Layer Z-Index):
                          </span>
                          <span className="bg-cyan-500/20 text-cyan-300 font-mono px-1.5 py-0.2 rounded font-bold">
                            Lớp #{currentSelectedSticker.layerOrder || 1}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            onClick={() => handleBringToFront(currentSelectedSticker.id, "sticker")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Đưa lên trên cùng"
                          >
                            <ChevronsUp className="w-3 h-3" />
                            <span className="text-[8px]">Trên cùng</span>
                          </button>
                          <button
                            onClick={() => handleMoveLayerUp(currentSelectedSticker.id, "sticker")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Lên 1 lớp"
                          >
                            <ArrowUp className="w-3 h-3" />
                            <span className="text-[8px]">Lên 1 lớp</span>
                          </button>
                          <button
                            onClick={() => handleMoveLayerDown(currentSelectedSticker.id, "sticker")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Xuống 1 lớp"
                          >
                            <ArrowDown className="w-3 h-3" />
                            <span className="text-[8px]">Xuống 1 lớp</span>
                          </button>
                          <button
                            onClick={() => handleSendToBack(currentSelectedSticker.id, "sticker")}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-cyan-200 border border-white/10 flex flex-col items-center justify-center gap-0.5"
                            title="Đưa xuống dưới cùng"
                          >
                            <ChevronsDown className="w-3 h-3" />
                            <span className="text-[8px]">Dưới cùng</span>
                          </button>
                        </div>
                      </div>

                      {/* Chọn biểu tượng Icon */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-on-surface-variant">Chọn biểu tượng:</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { type: "arrow", label: "Mũi tên" },
                            { type: "pointer", label: "Con trỏ" },
                            { type: "click", label: "Bấm Click" },
                            { type: "star", label: "Ngôi sao" },
                            { type: "alert", label: "Cảnh báo" },
                          ].map((item) => (
                            <button
                              key={item.type}
                              onClick={() => {
                                setStickers((prev) =>
                                  prev.map((s) =>
                                    s.id === currentSelectedSticker.id ? { ...s, type: item.type as any } : s
                                  )
                                );
                              }}
                              className={cn(
                                "py-1.5 px-2 rounded-lg border text-[10px] transition text-center truncate",
                                currentSelectedSticker.type === item.type
                                  ? "bg-cyan-600/50 border-cyan-400 text-white font-semibold"
                                  : "bg-surface-variant/20 border-white/5 text-on-surface-variant hover:bg-surface-variant/40"
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Chữ hiển thị kèm */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-on-surface-variant">Nội dung chữ (tùy chọn):</span>
                        <input
                          id="sticker-text-input"
                          name="sticker-text"
                          type="text"
                          value={currentSelectedSticker.text || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStickers((prev) =>
                              prev.map((s) => (s.id === currentSelectedSticker.id ? { ...s, text: val } : s))
                            );
                          }}
                          placeholder="Ví dụ: Bấm vào đây..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-variant/30 border border-white/10 text-on-surface text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      {/* Góc xoay */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-on-surface-variant">Góc xoay:</span>
                          <span className="font-mono text-cyan-300 font-bold">{currentSelectedSticker.rotation}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={currentSelectedSticker.rotation}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setStickers((prev) =>
                              prev.map((s) => (s.id === currentSelectedSticker.id ? { ...s, rotation: val } : s))
                            );
                          }}
                          className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                      </div>

                      {/* Animation kiểu nhún */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-on-surface-variant">Hiệu ứng động (Animation):</span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { type: "bounce", label: "Nhún Bounce" },
                            { type: "pulse", label: "Đập Pulse" },
                            { type: "pop", label: "Tĩnh Solid" },
                          ].map((anim) => (
                            <button
                              key={anim.type}
                              onClick={() => {
                                setStickers((prev) =>
                                  prev.map((s) =>
                                    s.id === currentSelectedSticker.id ? { ...s, animation: anim.type as any } : s
                                  )
                                );
                              }}
                              className={cn(
                                "py-1 px-1 rounded border text-[10px] text-center truncate",
                                currentSelectedSticker.animation === anim.type
                                  ? "bg-cyan-600/50 border-cyan-400 text-white font-semibold"
                                  : "bg-surface-variant/20 border-white/5 text-on-surface-variant hover:bg-surface-variant/40"
                              )}
                            >
                              {anim.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── CapCut Style: Danh Sách Các Lớp Layer Hiện Có ── */}
                  {(highlightEffects.length > 0 || stickers.length > 0 || zoomEffects.length > 0) && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Các Lớp Layer (Cao đè Thấp):
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60 font-mono">
                          {highlightEffects.length + stickers.length + zoomEffects.length} lớp
                        </span>
                      </div>

                      <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                        {/* Sắp xếp layer từ cao xuống thấp (Cao hơn nằm trên danh sách) */}
                        {[
                          ...highlightEffects.map((h) => ({
                            id: h.id,
                            type: "highlight" as const,
                            order: h.layerOrder || 1,
                            title: h.type === "spotlight" ? "Spotlight Rọi sáng" : "Khung Viền Highlight",
                            color: h.color || "#eab308",
                            start: h.start,
                          })),
                          ...stickers.map((s) => ({
                            id: s.id,
                            type: "sticker" as const,
                            order: s.layerOrder || 1,
                            title: `Nhãn: ${s.text || s.type}`,
                            color: "#06b6d4",
                            start: s.start,
                          })),
                          ...zoomEffects.map((z) => ({
                            id: z.id,
                            type: "zoom" as const,
                            order: 999,
                            title: `Zoom ${z.scale}x (${z.originX}%, ${z.originY}%)`,
                            color: "#a855f7",
                            start: z.start,
                          })),
                        ]
                          .sort((a, b) => b.order - a.order)
                          .map((layer) => {
                            const isSelected = selectedElement?.id === layer.id;

                            return (
                              <div
                                key={layer.id}
                                onClick={() => {
                                  setSelectedElement({ id: layer.id, type: layer.type });
                                  seekTo(layer.start);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition",
                                  isSelected
                                    ? "bg-primary/20 border-primary text-white shadow-sm ring-1 ring-primary/40"
                                    : "bg-surface-variant/20 border-white/5 text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface"
                                )}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: layer.color }}
                                  />
                                  <span className="truncate text-[11px] font-medium">{layer.title}</span>
                                </div>
                                <span className="text-[9px] font-mono opacity-60 shrink-0">
                                  {layer.type === "zoom" ? "Zoom" : `Lớp #${layer.order}`}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Nút thêm nhanh */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Thêm hiệu ứng hướng dẫn:
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        onClick={handleAddZoom}
                        className="w-full py-2 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-medium text-left flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-2">
                          <Focus className="w-4 h-4 text-purple-400" />
                          <span>+ Phóng to điểm (Zoom In)</span>
                        </span>
                        <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-200">
                          {zoomEffects.length}
                        </span>
                      </button>

                      <button
                        onClick={handleAddHighlight}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-medium text-left flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-2">
                          <Highlighter className="w-4 h-4 text-amber-400" />
                          <span>+ Khung viền Highlight / Spotlight</span>
                        </span>
                        <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">
                          {highlightEffects.length}
                        </span>
                      </button>

                      <button
                        onClick={handleAddSticker}
                        className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-medium text-left flex items-center justify-between transition"
                      >
                        <span className="flex items-center gap-2">
                          <Smile className="w-4 h-4 text-cyan-400" />
                          <span>+ Mũi tên chỉ dẫn / Con trỏ</span>
                        </span>
                        <span className="text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded text-cyan-200">
                          {stickers.length}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 1: Style Controls */}
              {activeTab === "style" && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 text-sm">
                  {/* Font Family Selection */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-primary" />
                        Font ({SYSTEM_FONTS.length + customFonts.length})
                      </label>

                      <input
                        type="file"
                        ref={fontInputRef}
                        onChange={handleCustomFontUpload}
                        accept=".ttf,.otf,.woff,.woff2"
                        className="hidden"
                      />
                      <button
                        onClick={() => fontInputRef.current?.click()}
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                      >
                        <FileUp className="w-3 h-3" />
                        Tải Font
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 max-h-[170px] overflow-y-auto pr-1">
                      {customFonts.map((name) => (
                        <button
                          key={name}
                          onClick={() =>
                            setStyle({ ...style, font_name: name })
                          }
                          className={cn(
                            "p-2 rounded-lg border text-xs text-left transition flex items-center justify-between",
                            style.font_name === name
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-surface-variant/20 border-white/10 text-on-surface hover:bg-surface-variant/40",
                          )}
                          style={{ fontFamily: name }}
                        >
                          <span className="truncate">{name}</span>
                          <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded">
                            Custom
                          </span>
                        </button>
                      ))}

                      {SYSTEM_FONTS.map((f) => (
                        <button
                          key={f.name}
                          onClick={() =>
                            setStyle({ ...style, font_name: f.name })
                          }
                          className={cn(
                            "p-2 rounded-lg border text-sm text-left transition truncate",
                            style.font_name === f.name
                              ? "bg-primary/20 border-primary text-primary"
                              : "bg-surface-variant/20 border-white/10 text-on-surface hover:bg-surface-variant/40",
                          )}
                          style={{ fontFamily: f.name }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-on-surface-variant">
                        Cỡ chữ ({style.font_size}px)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="56"
                      value={style.font_size}
                      onChange={(e) =>
                        setStyle({
                          ...style,
                          font_size: Number(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Y Position - Cụm Điều Khiển Vị Trí Phụ Đề Riêng/Toàn Bộ */}
                  <div className="space-y-2 p-2.5 rounded-xl bg-surface-variant/20 border border-white/10">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                        <MoveVertical className="w-3.5 h-3.5 text-primary" />
                        Vị trí phụ đề (Y: {currentSegmentY}%)
                      </span>
                      {targetSegment && (
                        <div className="flex items-center gap-1">
                          {targetSegment.customPositionY !== undefined ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Đoạn #{targetSegment.id} riêng
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-on-surface-variant">
                              Mặc định chung
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={currentSegmentY}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (targetSegment) {
                          handleUpdateSegmentPositionY(targetSegment.id, val);
                        } else {
                          setStyle({ ...style, position_y: val });
                        }
                      }}
                      className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                    />

                    {/* Quick presets for segment positioning */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (targetSegment) {
                            handleUpdateSegmentPositionY(targetSegment.id, 15);
                          } else {
                            setStyle({ ...style, position_y: 15 });
                          }
                        }}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[10px] font-medium border transition text-center flex items-center justify-center gap-1",
                          currentSegmentY === 15
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-surface-variant/30 border-white/5 text-on-surface-variant hover:bg-surface-variant/60"
                        )}
                        title="Đặt phụ đề ở phía trên video (tránh che thanh điều khiển/nội dung dưới)"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                        Trên (15%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (targetSegment) {
                            handleUpdateSegmentPositionY(targetSegment.id, 50);
                          } else {
                            setStyle({ ...style, position_y: 50 });
                          }
                        }}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[10px] font-medium border transition text-center flex items-center justify-center gap-1",
                          currentSegmentY === 50
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-surface-variant/30 border-white/5 text-on-surface-variant hover:bg-surface-variant/60"
                        )}
                        title="Đặt phụ đề ở chính giữa khung hình"
                      >
                        Giữa (50%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (targetSegment) {
                            handleUpdateSegmentPositionY(targetSegment.id, 85);
                          } else {
                            setStyle({ ...style, position_y: 85 });
                          }
                        }}
                        className={cn(
                          "py-1 px-1.5 rounded-md text-[10px] font-medium border transition text-center flex items-center justify-center gap-1",
                          currentSegmentY === 85
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-surface-variant/30 border-white/5 text-on-surface-variant hover:bg-surface-variant/60"
                        )}
                        title="Đặt phụ đề ở phía dưới video (tiêu chuẩn)"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                        Dưới (85%)
                      </button>
                    </div>

                    {/* Sub-actions for segment position */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                      {targetSegment && targetSegment.customPositionY !== undefined ? (
                        <button
                          type="button"
                          onClick={() => handleResetSegmentPosition(targetSegment.id)}
                          className="flex items-center gap-1 text-amber-400/90 hover:text-amber-300 transition"
                          title="Hủy vị trí riêng, sử dụng vị trí chung của video"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Khôi phục đoạn này
                        </button>
                      ) : (
                        <span className="text-white/40 text-[9px]">
                          Kéo thả trên video để chỉnh nhanh
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleApplyPositionToAll(currentSegmentY)}
                        className="flex items-center gap-1 text-primary hover:text-primary-hover transition ml-auto"
                        title="Áp dụng vị trí này cho toàn bộ các đoạn trong video"
                      >
                        <CheckCheck className="w-2.5 h-2.5" />
                        Áp dụng tất cả
                      </button>
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Chữ gốc
                      </label>
                      <div className="flex items-center gap-2 p-1.5 bg-surface-variant/30 rounded-lg border border-white/10">
                        <input
                          type="color"
                          value={style.primary_color}
                          onChange={(e) =>
                            setStyle({
                              ...style,
                              primary_color: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] font-mono text-on-surface">
                          {style.primary_color}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Highlight
                      </label>
                      <div className="flex items-center gap-2 p-1.5 bg-surface-variant/30 rounded-lg border border-white/10">
                        <input
                          type="color"
                          value={style.highlight_color}
                          onChange={(e) =>
                            setStyle({
                              ...style,
                              highlight_color: e.target.value,
                            })
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-[11px] font-mono text-on-surface">
                          {style.highlight_color}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outline Size */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-on-surface-variant">
                        Độ dày viền ({style.outline_size}px)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={style.outline_size}
                      onChange={(e) =>
                        setStyle({
                          ...style,
                          outline_size: Number(e.target.value),
                        })
                      }
                      className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: BGM Controls */}
              {activeTab === "bgm" && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 text-xs">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-primary" />
                      Nhạc nền (.mp3/.wav)
                    </label>
                    <input
                      type="file"
                      ref={bgmInputRef}
                      onChange={handleBgmSelect}
                      accept="audio/mp3,audio/wav"
                      className="hidden"
                    />

                    <div
                      onClick={() => bgmInputRef.current?.click()}
                      className="border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer transition bg-surface-variant/10 hover:bg-surface-variant/30 space-y-1.5"
                    >
                      <Music className="w-6 h-6 text-primary/70 mx-auto" />
                      <p className="text-xs font-medium text-on-surface truncate">
                        {bgmFile ? bgmFile.name : "Tải lên nhạc nền (.mp3)"}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        Tự động hòa âm vào video
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between text-[11px] items-center">
                      <span className="font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                        <Volume2 className="w-3 h-3 text-primary" />
                        Âm lượng BGM
                      </span>
                      <span className="font-mono text-primary font-semibold">
                        {Math.round(bgmVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={bgmVolume}
                      onChange={(e) => setBgmVolume(Number(e.target.value))}
                      className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-[10px] text-on-surface-variant italic">
                      Khuyên dùng 20% - 30% để không át tiếng nói.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. Bottom Multi-track Studio Timeline ─────────────────────────── */}
      <TimelineEditor
        currentTime={currentTime}
        duration={videoDuration}
        segments={segments}
        videoFile={videoFile}
        videoUrl={videoUrl}
        isPlaying={isPlaying}
        onSeek={seekTo}
        onTogglePlay={togglePlay}
        zoomEffects={zoomEffects}
        onUpdateZoomEffects={setZoomEffects}
        highlightEffects={highlightEffects}
        onUpdateHighlightEffects={setHighlightEffects}
        stickers={stickers}
        onUpdateStickers={setStickers}
        selectedElement={selectedElement}
        onSelectElement={setSelectedElement}
        onAddZoom={handleAddZoom}
        onAddHighlight={handleAddHighlight}
        onAddSticker={handleAddSticker}
        onDeleteSelected={handleDeleteSelected}
        audioClips={audioClips}
        onUpdateAudioClips={(clips) => {
          pushHistorySnapshot();
          setAudioClips(clips);
        }}
        videoClips={videoClips}
        onUpdateVideoClips={(clips) => {
          pushHistorySnapshot();
          setVideoClips(clips);
        }}
        voiceoverName={voiceoverRecord?.title || (voiceoverUrl ? "Voiceover Audio" : undefined)}
        voiceoverStartTime={voiceoverStartTime}
        voiceoverDuration={voiceoverDuration}
        onUpdateVoiceoverStartTime={setVoiceoverStartTime}
        onSplit={handleSplit}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
      />

      {/* Hidden Audio Elements for BGM and Voiceover Synchronization */}
      {bgmUrl && (
        <audio
          ref={bgmAudioRef}
          src={bgmUrl}
          preload="auto"
        />
      )}
      {voiceoverUrl && (
        <audio
          ref={voiceoverAudioRef}
          src={voiceoverUrl}
          preload="auto"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
              setVoiceoverDuration(dur);
              setAudioClips((prev) => {
                if (prev.length === 0) {
                  return [
                    {
                      id: `audio_${Date.now()}`,
                      name: voiceoverRecord?.title || "Voiceover Audio",
                      url: voiceoverUrl,
                      start: 0,
                      duration: dur,
                      sourceStart: 0,
                      text: voiceoverRecord?.text,
                      originalText: voiceoverRecord?.text,
                    },
                  ];
                } else if (prev.length === 1 && prev[0].sourceStart === 0) {
                  return [{ ...prev[0], duration: dur, text: prev[0].text || voiceoverRecord?.text, originalText: prev[0].originalText || voiceoverRecord?.text }];
                }
                return prev;
              });
            }
          }}
          onTimeUpdate={() => {
            if (!videoRef.current && voiceoverAudioRef.current) {
              const aTime = voiceoverAudioRef.current.currentTime;
              if (audioClips.length > 0) {
                const activeClip = audioClips.find(
                  (c) => aTime >= c.sourceStart && aTime < c.sourceStart + c.duration,
                );
                if (activeClip) {
                  const timelineTime = activeClip.start + (aTime - activeClip.sourceStart);
                  setCurrentTime(Number(timelineTime.toFixed(2)));
                }
              } else {
                setCurrentTime(Number((voiceoverStartTime + aTime).toFixed(2)));
              }
            }
          }}
          onEnded={() => {
            if (!videoRef.current) {
              setIsPlaying(false);
            }
          }}
        />
      )}

      {/* Modal Lồng Giọng Đọc Voiceover */}
      <VoiceoverSelectorModal
        isOpen={isVoiceoverModalOpen}
        onClose={() => setIsVoiceoverModalOpen(false)}
        onSelectVoiceover={handleSelectVoiceover}
      />
    </div>
  );
}
