import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  font_size: 36,
  primary_color: "#FFFFFF",
  highlight_color: "#ec6f09",
  outline_color: "#000000",
  outline_size: 3,
  position_y: 80,
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // BGM State
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [bgmVolume, setBgmVolume] = useState(0.25);

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

  // Active Tab
  const [activeTab, setActiveTab] = useState<"transcript" | "style" | "bgm">(
    "transcript",
  );

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const bgmInputRef = useRef<HTMLInputElement | null>(null);
  const fontInputRef = useRef<HTMLInputElement | null>(null);

  // ─── 60 FPS RequestAnimationFrame Loop ────────────────────────────────────
  // Khắc phục hoàn toàn lỗi trễ/nhảy từ của onTimeUpdate (250ms)
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (videoRef.current && !videoRef.current.paused) {
        setCurrentTime(videoRef.current.currentTime);
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Synchronize BGM audio with video player
  useEffect(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

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
    setSegments([]);
    setSessionId(null);
    setExportResultUrl(null);
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
      setSegments(data.segments || []);
      toast.success(
        `Hoàn tất! Bóc tách được ${data.segments?.length || 0} câu có mốc thời gian chi tiết.`,
      );
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
      setSegments(data.segments || []);
      toast.success(
        "✨ Đã đối chiếu và chuẩn hóa 100% chính tả theo kịch bản mẫu!",
      );
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
          console.warn("FontFace API fallback to @font-face style tag:", fontApiErr);
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

      // Sync BGM
      if (
        bgmAudioRef.current &&
        Math.abs(bgmAudioRef.current.currentTime - time) > 0.3
      ) {
        bgmAudioRef.current.currentTime = time;
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      bgmAudioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      bgmAudioRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      if (bgmAudioRef.current) {
        bgmAudioRef.current.currentTime = seconds;
      }
      videoRef.current.play();
      bgmAudioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

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

  // ─── Drag & Drop Interactive Positioning ──────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const pct = Math.max(
        10,
        Math.min(90, Math.round((relativeY / rect.height) * 100)),
      );
      setStyle((s) => ({ ...s, position_y: pct }));
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
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
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // ─── Continuous Word Matching (Tránh chớp giật & bỏ sót từ) ───────────────
  const activeSegment = segments.find(
    (seg) => currentTime >= seg.start - 0.05 && currentTime <= seg.end + 0.1,
  );

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
    <div className="w-full max-w-[1600px] mx-auto pb-20 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl 2k:text-3xl font-bold text-on-surface tracking-tight">
                Auto Kinetic Caption Studio
              </h1>
              <p className="text-sm text-on-surface-variant">
                Bóc tách phụ đề chạy từng từ 60 FPS, sửa trực tiếp cả câu, kéo
                thả định vị và nạp Font Custom
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            type="file"
            ref={videoInputRef}
            onChange={handleVideoSelect}
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
          />

          <button
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:border-primary/50 bg-surface-variant/40 hover:bg-surface-variant text-on-surface transition-all text-sm font-medium"
          >
            <Upload className="w-4 h-4 text-primary" />
            {videoFile ? "Đổi video khác" : "Chọn Video (.mp4)"}
          </button>

          {videoFile && (
            <button
              onClick={() => setShowScriptBox((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all",
                showScriptBox || referenceScript.trim()
                  ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                  : "bg-surface-variant/40 border-white/10 hover:border-white/20 text-on-surface",
              )}
              title="Nhập văn bản đọc gốc để so khớp chính tả 100%"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span>
                {referenceScript.trim()
                  ? "Kịch bản (Đã nhập)"
                  : "Kịch bản đối chiếu"}
              </span>
              {referenceScript.trim() && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          )}

          {videoFile && (
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold transition-all shadow-lg hover:shadow-primary/20 disabled:opacity-50 text-sm"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang phân tích AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Tạo Phụ Đề AI
                </>
              )}
            </button>
          )}
        </div>
      </div>

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
                  sửa sạch các lỗi sai âm (như "sắc nhận" → "xác nhận", "rau
                  diện" → "giao diện").
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
            placeholder="Dán toàn bộ kịch bản hoặc văn bản bài đọc vào đây (ví dụ: 'Sau đó, nhấn xác nhận để vào giao diện làm việc chính...').&#10;Khi bấm 'Tạo Phụ Đề AI' hoặc 'Khớp & Sửa chính tả tức thì', hệ thống sẽ tự động ghép từng âm tiết chuẩn xác tuyệt đối mà vẫn bảo toàn 100% mốc thời gian!"
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

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Video Live Preview & Interactive Overlay (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            ref={videoContainerRef}
            className="relative aspect-[9/16] md:aspect-video w-full bg-black/95 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center select-none group"
          >
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain pointer-events-auto cursor-pointer"
                  onClick={togglePlay}
                  playsInline
                />

                {bgmUrl && <audio ref={bgmAudioRef} src={bgmUrl} loop />}

                {/* Interactive Kinetic Subtitle Overlay (Có thể KÉO THẢ chuột trực tiếp) */}
                <div
                  onMouseDown={handleDragStart}
                  className={cn(
                    "absolute left-0 right-0 px-6 flex justify-center z-20 cursor-grab transition-all",
                    isDragging && "cursor-grabbing opacity-90 scale-[1.02]",
                  )}
                  style={{
                    top: `${style.position_y}%`,
                    transform: "translateY(-50%)",
                    fontFamily: style.font_name,
                  }}
                  title="Nhấp giữ chuột để kéo phụ đề lên/xuống"
                >
                  {activeSegment ? (
                    <div className="flex flex-wrap justify-center items-center gap-x-2.5 gap-y-1.5 text-center max-w-[90%] p-2 rounded-xl bg-black/20 backdrop-blur-[2px] border border-white/5 group-hover:border-primary/30 transition">
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
                    <div className="text-xs text-white/30 italic px-3 py-1 bg-black/40 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition">
                      Kéo để định vị vị trí chữ ({style.position_y}%)
                    </div>
                  )}
                </div>

                {/* Floating Player Control Bar */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-xl flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-30">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                    <button
                      onClick={() => seekTo(0)}
                      className="p-2 text-on-surface-variant hover:text-on-surface transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-on-surface-variant">
                      {currentTime.toFixed(1)}s
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <MoveVertical className="w-3.5 h-3.5 text-primary" />
                      Y: {style.position_y}%
                    </span>

                    {bgmFile && (
                      <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        <Music className="w-3.5 h-3.5 animate-pulse" />
                        <span>BGM: {bgmFile.name.slice(0, 14)}</span>
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
                    Nhấn vào nút "Chọn Video" phía trên hoặc kéo thả video
                    (.mp4, .mov) vào đây
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Export Action Card */}
          {segments.length > 0 && (
            <div className="p-5 bg-surface/60 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-on-surface flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Sẵn sàng xuất video hoàn chỉnh
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  FFmpeg sẽ ép cứng phụ đề Kinetic Karaoke và hòa âm nhạc nền
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-fixed-dim text-on-primary font-semibold text-sm transition shadow-lg hover:shadow-primary/20 disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang render FFmpeg...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Xuất Video MP4
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Control Panels & Sentence Editor (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Navigation Tabs */}
          <div className="flex p-1 bg-surface-variant/40 rounded-xl border border-white/10 text-sm font-medium">
            <button
              onClick={() => setActiveTab("transcript")}
              className={cn(
                "flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition",
                activeTab === "transcript"
                  ? "bg-primary text-on-primary shadow"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Edit3 className="w-4 h-4" />
              Lời thoại ({segments.length})
            </button>
            <button
              onClick={() => setActiveTab("style")}
              className={cn(
                "flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition",
                activeTab === "style"
                  ? "bg-primary text-on-primary shadow"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Palette className="w-4 h-4" />
              Kiểu dáng
            </button>
            <button
              onClick={() => setActiveTab("bgm")}
              className={cn(
                "flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition",
                activeTab === "bgm"
                  ? "bg-primary text-on-primary shadow"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Music className="w-4 h-4" />
              Nhạc nền
            </button>
          </div>

          {/* Tab 1: Sentence Transcript Editor (Chỉnh theo câu cực nhanh) */}
          {activeTab === "transcript" && (
            <div className="bg-surface/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex-1 flex flex-col min-h-[500px] max-h-[680px]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Chỉnh sửa theo câu
                  </span>
                  {segments.length > 0 && (
                    <button
                      onClick={handleOptimizeChunks}
                      disabled={isOptimizingChunks}
                      className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-fixed-dim px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 transition disabled:opacity-40"
                      title="Tự động chia câu dài thành các câu 4-9 từ chuẩn ngắn gọn"
                    >
                      {isOptimizingChunks ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Scissors className="w-3 h-3" />
                      )}
                      <span>Chia ngắn câu</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowScriptBox((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {referenceScript.trim()
                    ? "Kịch bản mẫu (Đã có)"
                    : "Đối chiếu kịch bản mẫu"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {segments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-on-surface-variant space-y-2">
                    <Clock className="w-8 h-8 opacity-40" />
                    <p className="text-sm">Chưa có phụ đề.</p>
                    <p className="text-xs opacity-75">
                      Bấm "Tạo Phụ Đề AI" để tự động tách giọng nói thành văn
                      bản.
                    </p>
                  </div>
                ) : (
                  segments.map((seg, segIdx) => {
                    const isSegActive =
                      currentTime >= seg.start - 0.05 &&
                      currentTime <= seg.end + 0.1;
                    const isExpanded = expandedSegId === seg.id;

                    return (
                      <div
                        key={seg.id}
                        className={cn(
                          "p-3 rounded-xl border transition-all duration-200 space-y-2",
                          isSegActive
                            ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/20"
                            : "bg-surface-variant/20 border-white/5 hover:border-white/20",
                        )}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <button
                            onClick={() => seekTo(seg.start)}
                            className="flex items-center gap-1.5 font-mono text-primary hover:underline"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            {seg.start}s - {seg.end}s
                          </button>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-on-surface-variant">
                              Câu #{seg.id} ({seg.words.length} từ)
                            </span>
                            <button
                              onClick={() =>
                                setExpandedSegId(isExpanded ? null : seg.id)
                              }
                              className="p-1 hover:text-primary transition"
                              title="Xem chi tiết từng từ"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Sentence Textarea: Gõ sửa trực tiếp cả câu */}
                        <textarea
                          rows={2}
                          value={seg.text}
                          onChange={(e) =>
                            handleSentenceChange(segIdx, e.target.value)
                          }
                          placeholder="Nhập nội dung câu..."
                          className="w-full bg-surface-variant/40 border border-white/10 rounded-lg p-2.5 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:outline-none resize-none transition"
                        />

                        {/* Collapsible Word Detail Chips */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-white/5 space-y-1.5">
                            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block">
                              Mốc thời gian chi tiết từng từ:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {seg.words.map((w, wIdx) => {
                                const isWordActive =
                                  currentTime >= w.start &&
                                  currentTime <= w.end;

                                return (
                                  <button
                                    key={wIdx}
                                    onClick={() => seekTo(w.start)}
                                    className={cn(
                                      "px-2 py-0.5 text-[11px] rounded-md border font-mono transition-all",
                                      isWordActive
                                        ? "bg-primary text-on-primary border-primary font-bold scale-105"
                                        : "bg-surface-variant/60 text-on-surface border-white/10 hover:border-primary/40",
                                    )}
                                  >
                                    {w.word} ({w.start}s)
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Style Controls */}
          {activeTab === "style" && (
            <div className="bg-surface/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-5">
              {/* Font Family Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                    <Type className="w-4 h-4 text-primary" />
                    Phông chữ ({SYSTEM_FONTS.length + customFonts.length})
                  </label>

                  {/* Nút Upload Font Custom */}
                  <input
                    type="file"
                    ref={fontInputRef}
                    onChange={handleCustomFontUpload}
                    accept=".ttf,.otf,.woff,.woff2"
                    className="hidden"
                  />
                  <button
                    onClick={() => fontInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Tải Font (.ttf/.otf)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {/* Custom Fonts */}
                  {customFonts.map((name) => (
                    <button
                      key={name}
                      onClick={() => setStyle({ ...style, font_name: name })}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-medium text-left transition flex items-center justify-between",
                        style.font_name === name
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-surface-variant/20 border-white/10 text-on-surface hover:bg-surface-variant/40",
                      )}
                      style={{ fontFamily: name }}
                    >
                      <span>{name}</span>
                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        Custom
                      </span>
                    </button>
                  ))}

                  {/* System/Google Fonts */}
                  {SYSTEM_FONTS.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => setStyle({ ...style, font_name: f.name })}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-medium text-left transition",
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

              {/* Font Size Slider: 8px - 60px */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-on-surface-variant">
                    Cỡ chữ ({style.font_size}px)
                  </span>
                  <span className="text-on-surface-variant font-mono">
                    8px - 60px
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="60"
                  value={style.font_size}
                  onChange={(e) =>
                    setStyle({ ...style, font_size: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Vị trí hiển thị (Y-Position Slider) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <MoveVertical className="w-3.5 h-3.5 text-primary" />
                    Vị trí theo chiều dọc ({style.position_y}%)
                  </span>
                  <span className="text-xs text-primary/80 italic">
                    (Hoặc kéo trực tiếp trên Video)
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={style.position_y}
                  onChange={(e) =>
                    setStyle({ ...style, position_y: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Color Customization */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Màu chữ gốc
                  </label>
                  <div className="flex items-center gap-3 p-2 bg-surface-variant/30 rounded-xl border border-white/10">
                    <input
                      type="color"
                      value={style.primary_color}
                      onChange={(e) =>
                        setStyle({ ...style, primary_color: e.target.value })
                      }
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono text-on-surface">
                      {style.primary_color}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Màu Highlight Kinetic
                  </label>
                  <div className="flex items-center gap-3 p-2 bg-surface-variant/30 rounded-xl border border-white/10">
                    <input
                      type="color"
                      value={style.highlight_color}
                      onChange={(e) =>
                        setStyle({ ...style, highlight_color: e.target.value })
                      }
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-xs font-mono text-on-surface">
                      {style.highlight_color}
                    </span>
                  </div>
                </div>
              </div>

              {/* Outline / Stroke */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-on-surface-variant">
                    Độ dày viền đen ({style.outline_size}px)
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={style.outline_size}
                  onChange={(e) =>
                    setStyle({ ...style, outline_size: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Tab 3: BGM Mixer */}
          {activeTab === "bgm" && (
            <div className="bg-surface/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-5">
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Nhạc nền video (BGM)
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
                  className="border-2 border-dashed border-white/10 hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer transition bg-surface-variant/10 hover:bg-surface-variant/30 space-y-2"
                >
                  <Music className="w-8 h-8 text-primary/70 mx-auto" />
                  <p className="text-sm font-medium text-on-surface">
                    {bgmFile ? bgmFile.name : "Tải lên file nhạc nền (.mp3)"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Nhạc nền sẽ tự động hòa âm (mix) theo âm lượng bạn chỉ định
                  </p>
                </div>
              </div>

              {/* Volume Slider */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-xs items-center">
                  <span className="font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary" />
                    Âm lượng nhạc nền
                  </span>
                  <span className="font-mono text-primary">
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
                <p className="text-[11px] text-on-surface-variant italic">
                  * Khuyên dùng mức 20% - 30% để không át tiếng người nói chính.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
