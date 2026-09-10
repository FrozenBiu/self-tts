import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Focus,
  Highlighter,
  Smile,
  Trash2,
  Scissors,
  Undo2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Video,
  Type,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ZoomEffect,
  HighlightEffect,
  StickerOverlay,
  SelectedElement,
  AudioClip,
  VideoClip,
} from "@/types/videoEffects";

// ─── Thuật toán Greedy Interval Partitioning (CapCut Multi-Lane Stack) ───
// Tự động phân chia các phần tử chồng lấn thời gian (cùng frame) thành các hàng (sub-track) độc lập
function computeLanes<T extends { id: string; start: number; duration: number }>(
  items: T[]
): T[][] {
  if (!items || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.start - b.start || b.duration - a.duration);
  const lanes: T[][] = [];

  for (const item of sorted) {
    let placed = false;
    for (const lane of lanes) {
      const lastItem = lane[lane.length - 1];
      // Nếu thời gian bắt đầu của item mới >= thời điểm kết thúc của item cũ (dung sai 0.05s)
      if (item.start >= lastItem.start + lastItem.duration - 0.05) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }
  return lanes;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface CaptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  customPositionY?: number; // Vị trí dọc riêng cho đoạn này (10% - 90%)
}

interface TimelineEditorProps {
  currentTime: number;
  duration: number;
  segments: CaptionSegment[];
  videoFile: File | null;
  videoUrl: string | null;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  zoomEffects: ZoomEffect[];
  onUpdateZoomEffects: (effects: ZoomEffect[]) => void;
  highlightEffects: HighlightEffect[];
  onUpdateHighlightEffects: (effects: HighlightEffect[]) => void;
  stickers: StickerOverlay[];
  onUpdateStickers: (stickers: StickerOverlay[]) => void;
  selectedElement: SelectedElement | null;
  onSelectElement: (el: SelectedElement | null) => void;
  onAddZoom: () => void;
  onAddHighlight: () => void;
  onAddSticker: () => void;
  onDeleteSelected: () => void;
  audioClips?: AudioClip[];
  onUpdateAudioClips?: (clips: AudioClip[]) => void;
  videoClips?: VideoClip[];
  onUpdateVideoClips?: (clips: VideoClip[]) => void;
  voiceoverName?: string;
  voiceoverStartTime?: number;
  voiceoverDuration?: number;
  onUpdateVoiceoverStartTime?: (newStart: number) => void;
  onSplit?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  className?: string;
}

export function TimelineEditor({
  currentTime,
  duration,
  segments,
  videoFile,
  videoUrl,
  isPlaying,
  onSeek,
  onTogglePlay,
  zoomEffects,
  onUpdateZoomEffects,
  highlightEffects,
  onUpdateHighlightEffects,
  stickers,
  onUpdateStickers,
  selectedElement,
  onSelectElement,
  onAddZoom,
  onAddHighlight,
  onAddSticker,
  onDeleteSelected,
  audioClips = [],
  onUpdateAudioClips,
  videoClips = [],
  onUpdateVideoClips,
  voiceoverName,
  voiceoverStartTime = 0,
  voiceoverDuration = 5,
  onUpdateVoiceoverStartTime,
  onSplit,
  canUndo = false,
  onUndo,
  className,
}: TimelineEditorProps) {
  // Zoom: số pixel hiển thị cho mỗi 1 giây video (mặc định 60px/s)
  const [zoom, setZoom] = useState<number>(60);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
  const [isDecodingAudio, setIsDecodingAudio] = useState<boolean>(false);

  // Vị trí kéo thả cục bộ 60 FPS (zero lag, không re-render toàn trang trong lúc rê chuột)
  const [localAudioPositions, setLocalAudioPositions] = useState<Record<string, number>>({});
  const [localVideoPositions, setLocalVideoPositions] = useState<Record<string, number>>({});
  const dragPosRef = useRef<{ id: string; start: number } | null>(null);

  // CapCut Layer Controls: Trạng thái Khóa (Lock) và Ẩn (Eye) từng sub-track/layer
  const [lockedTracks, setLockedTracks] = useState<Record<string, boolean>>({});
  const [hiddenTracks, setHiddenTracks] = useState<Record<string, boolean>>({});

  const toggleTrackLock = useCallback((key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLockedTracks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleTrackHidden = useCallback((key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenTracks((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Tự động phân tách đa tầng layer (CapCut Stack Lanes) khi trùng frame
  const zoomLanes = useMemo(() => computeLanes(zoomEffects), [zoomEffects]);
  const highlightLanes = useMemo(() => computeLanes(highlightEffects), [highlightEffects]);
  const stickerLanes = useMemo(() => computeLanes(stickers), [stickers]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ─── 1. Web Audio API: Giải mã âm thanh thực tế sang Audio Peaks Waveform ───
  useEffect(() => {
    let isCancelled = false;

    const extractAudioWaveform = async () => {
      if (!videoFile && !videoUrl) {
        setAudioPeaks([]);
        return;
      }

      setIsDecodingAudio(true);
      try {
        let arrayBuffer: ArrayBuffer;
        if (videoFile) {
          arrayBuffer = await videoFile.arrayBuffer();
        } else {
          const res = await fetch(videoUrl!);
          arrayBuffer = await res.arrayBuffer();
        }

        if (isCancelled) return;

        const AudioCtxClass =
          window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtxClass();

        // Decode audio data từ file video/audio
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (isCancelled) {
          audioCtx.close();
          return;
        }

        const channelData = audioBuffer.getChannelData(0); // Kênh mono trái
        const totalDuration = audioBuffer.duration;

        // Trích xuất ~80 sample/giây để vẽ sóng âm mượt mà
        const samplesPerSecond = 80;
        const totalPeaks = Math.max(100, Math.floor(totalDuration * samplesPerSecond));
        const step = Math.floor(channelData.length / totalPeaks);

        const peaks: number[] = new Array(totalPeaks);
        for (let i = 0; i < totalPeaks; i++) {
          const start = i * step;
          let maxVal = 0;
          for (let j = 0; j < step && start + j < channelData.length; j += 4) {
            const val = Math.abs(channelData[start + j]);
            if (val > maxVal) maxVal = val;
          }
          peaks[i] = Math.min(1, maxVal);
        }

        if (!isCancelled) {
          setAudioPeaks(peaks);
        }
        audioCtx.close();
      } catch (err) {
        console.warn("Không thể giải mã sóng âm thanh từ video:", err);
        // Fallback: Tạo sóng âm mẫu nếu không decode được trực tiếp qua browser codec
        const fallbackPeaks = Array.from({ length: 300 }, (_, i) =>
          Math.min(1, Math.max(0.08, Math.sin(i * 0.15) * 0.4 + Math.random() * 0.3))
        );
        if (!isCancelled) {
          setAudioPeaks(fallbackPeaks);
        }
      } finally {
        if (!isCancelled) setIsDecodingAudio(false);
      }
    };

    extractAudioWaveform();

    return () => {
      isCancelled = true;
    };
  }, [videoFile, videoUrl]);

  // Chiều rộng tổng của toàn bộ timeline theo zoom, luôn có khoảng đệm để kéo clip thoải mái
  const timelineDuration = useMemo(() => {
    const maxAudioEnd = (audioClips || []).reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0
    );
    const maxVideoEnd = (videoClips || []).reduce(
      (max, c) => Math.max(max, c.start + c.duration),
      0
    );
    const baseDur = Math.max(1, duration || 10);
    return Math.max(baseDur, maxAudioEnd + 20, maxVideoEnd + 20);
  }, [duration, audioClips, videoClips]);
  const totalTimelineWidth = Math.max(800, timelineDuration * zoom);

  // ─── 2. Vẽ Waveform lên Canvas ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = totalTimelineWidth;
    const height = 48; // Chiều cao track waveform

    // Đảm bảo độ phân giải sắc nét trên màn hình Retina/HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform tránh nhân dpr lũy thừa
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (audioPeaks.length === 0) {
      // Đường tim phẳng khi chưa có âm thanh
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const currentX = currentTime * zoom;
    const centerY = height / 2;

    // samplesPerSecond = 80 (chuẩn decode)
    const samplesPerSecond = 80;
    const barStep = zoom / samplesPerSecond;
    const barWidth = Math.max(1.5, Math.min(4, barStep * 0.9));

    // Vẽ từng cột sóng theo đúng hệ tọa độ thời gian thực t * zoom
    for (let i = 0; i < audioPeaks.length; i++) {
      const peakTime = i / samplesPerSecond;
      const x = peakTime * zoom;
      if (x > width + 50) break;

      const peak = audioPeaks[i];
      const barHeight = Math.max(2, peak * (height - 8));

      // Đã phát qua -> Màu cam Primary; Chưa phát qua -> Màu xám sáng
      if (x <= currentX) {
        ctx.fillStyle = "rgba(236, 111, 9, 0.9)";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      }

      // Vẽ sóng đối xứng qua trục giữa (kiểu Descript)
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }
  }, [audioPeaks, totalTimelineWidth, currentTime, zoom]);

  // ─── 3. Tự động cuộn Timeline theo kim Playhead khi video chạy ──────────────
  const lastScrollTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || isScrubbing || !containerRef.current) return;

    const container = containerRef.current;
    const playheadX = currentTime * zoom;
    const scrollLeft = container.scrollLeft;
    const viewportWidth = container.clientWidth;

    // Giữ Playhead trong tầm nhìn của viewport
    const now = Date.now();
    if (now - lastScrollTimeRef.current > 200) {
      if (playheadX > scrollLeft + viewportWidth * 0.72) {
        container.scrollLeft = playheadX - viewportWidth * 0.25;
        lastScrollTimeRef.current = now;
      } else if (playheadX < scrollLeft + 10) {
        container.scrollLeft = Math.max(0, playheadX - viewportWidth * 0.25);
        lastScrollTimeRef.current = now;
      }
    }
  }, [currentTime, zoom, isPlaying, isScrubbing]);

  // ─── 4. Tương tác Kéo rê kim thời gian (Scrubbing) ─────────────────────────
  const rafSeekRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);

  const applySeek = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left + containerRef.current.scrollLeft;
      const targetTime = Math.max(0, Math.min(timelineDuration, clickX / zoom));
      onSeek(Number(targetTime.toFixed(2)));
    },
    [timelineDuration, zoom, onSeek]
  );

  const handleSeekFromClientX = useCallback(
    (clientX: number, immediate = false) => {
      pendingClientXRef.current = clientX;
      if (immediate) {
        if (rafSeekRef.current !== null) {
          cancelAnimationFrame(rafSeekRef.current);
          rafSeekRef.current = null;
        }
        applySeek(clientX);
        return;
      }

      if (rafSeekRef.current === null) {
        rafSeekRef.current = requestAnimationFrame(() => {
          if (pendingClientXRef.current !== null) {
            applySeek(pendingClientXRef.current);
          }
          rafSeekRef.current = null;
        });
      }
    },
    [applySeek]
  );

  const wasPlayingBeforeScrubRef = useRef<boolean>(false);

  const handleMouseDownOnTimeline = (e: React.MouseEvent) => {
    // Không xử lý nếu click vào các nút điều khiển
    if ((e.target as HTMLElement).closest("button")) return;
    wasPlayingBeforeScrubRef.current = isPlaying;
    if (isPlaying) {
      onTogglePlay?.();
    }
    setIsScrubbing(true);
    handleSeekFromClientX(e.clientX, true);
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleSeekFromClientX(e.clientX, false);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsScrubbing(false);
      // Dứt khoát chốt mốc thời gian cuối cùng tại điểm thả chuột
      handleSeekFromClientX(e.clientX, true);

      if (wasPlayingBeforeScrubRef.current) {
        wasPlayingBeforeScrubRef.current = false;
        // Cho một khoảng nghỉ 100ms để decoder GPU/Blink giải mã I-frame lùi xong trước khi tiếp tục play
        setTimeout(() => {
          onTogglePlay?.();
        }, 100);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafSeekRef.current !== null) {
        cancelAnimationFrame(rafSeekRef.current);
        rafSeekRef.current = null;
      }
    };
  }, [isScrubbing, handleSeekFromClientX, onTogglePlay]);

  // ─── 5. Tính toán Thước đo thời gian (Time Ruler) ─────────────────────────
  const timeRulerTicks = useMemo(() => {
    let step = 1; // Giây
    if (zoom < 35) step = 5;
    else if (zoom < 55) step = 2;
    else if (zoom > 100) step = 0.5;

    const ticks: { time: number; x: number; isMajor: boolean; label: string }[] = [];
    for (let t = 0; t <= timelineDuration + step; t += step) {
      const roundedT = Math.round(t * 10) / 10;
      const mins = Math.floor(roundedT / 60);
      const secs = Math.floor(roundedT % 60);
      const ms = Math.floor((roundedT % 1) * 10);
      let label = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
      if (step < 1) label += `.${ms}`;

      const isMajor =
        step === 1 ? Math.round(roundedT) % 2 === 0 : roundedT % (step * 2) === 0;

      ticks.push({
        time: roundedT,
        x: roundedT * zoom,
        isMajor,
        label,
      });
    }
    return ticks;
  }, [timelineDuration, zoom]);

  // Format thời gian hiển thị (MM:SS.s)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}.${ms}`;
  };

  const handleFitToScreen = () => {
    if (containerRef.current && timelineDuration > 0) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const fitZoom = Math.max(20, Math.min(120, containerWidth / timelineDuration));
      setZoom(Math.round(fitZoom));
    }
  };

  // ─── Drag & Resize State cho các Khối Effect / Sticker / Audio trên Timeline ───
  const [dragState, setDragState] = useState<{
    mode: "move" | "resize-left" | "resize-right";
    elementType: "zoom" | "highlight" | "sticker" | "voiceover" | "audio" | "video";
    elementId: string;
    startX: number;
    initialStart: number;
    initialDuration: number;
    minAllowedStart?: number;
    maxAllowedStart?: number;
  } | null>(null);

  // Xử lý kéo thả chuột di chuyển hoặc co giãn clip
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;

      if (dragState.elementType === "zoom") {
        onUpdateZoomEffects(
          zoomEffects.map((item) => {
            if (item.id !== dragState.elementId) return item;
            if (dragState.mode === "move") {
              const newStart = Math.max(0, Math.min(timelineDuration - item.duration, dragState.initialStart + deltaTime));
              return { ...item, start: Number(newStart.toFixed(2)) };
            } else if (dragState.mode === "resize-right") {
              const newDur = Math.max(0.3, dragState.initialDuration + deltaTime);
              return { ...item, duration: Number(newDur.toFixed(2)) };
            } else if (dragState.mode === "resize-left") {
              const maxDelta = dragState.initialDuration - 0.3;
              const clampedDelta = Math.min(maxDelta, Math.max(-dragState.initialStart, deltaTime));
              return {
                ...item,
                start: Number((dragState.initialStart + clampedDelta).toFixed(2)),
                duration: Number((dragState.initialDuration - clampedDelta).toFixed(2)),
              };
            }
            return item;
          })
        );
      } else if (dragState.elementType === "highlight") {
        onUpdateHighlightEffects(
          highlightEffects.map((item) => {
            if (item.id !== dragState.elementId) return item;
            if (dragState.mode === "move") {
              const newStart = Math.max(0, Math.min(timelineDuration - item.duration, dragState.initialStart + deltaTime));
              return { ...item, start: Number(newStart.toFixed(2)) };
            } else if (dragState.mode === "resize-right") {
              const newDur = Math.max(0.3, dragState.initialDuration + deltaTime);
              return { ...item, duration: Number(newDur.toFixed(2)) };
            } else if (dragState.mode === "resize-left") {
              const maxDelta = dragState.initialDuration - 0.3;
              const clampedDelta = Math.min(maxDelta, Math.max(-dragState.initialStart, deltaTime));
              return {
                ...item,
                start: Number((dragState.initialStart + clampedDelta).toFixed(2)),
                duration: Number((dragState.initialDuration - clampedDelta).toFixed(2)),
              };
            }
            return item;
          })
        );
      } else if (dragState.elementType === "sticker") {
        onUpdateStickers(
          stickers.map((item) => {
            if (item.id !== dragState.elementId) return item;
            if (dragState.mode === "move") {
              const newStart = Math.max(0, Math.min(timelineDuration - item.duration, dragState.initialStart + deltaTime));
              return { ...item, start: Number(newStart.toFixed(2)) };
            } else if (dragState.mode === "resize-right") {
              const newDur = Math.max(0.3, dragState.initialDuration + deltaTime);
              return { ...item, duration: Number(newDur.toFixed(2)) };
            } else if (dragState.mode === "resize-left") {
              const maxDelta = dragState.initialDuration - 0.3;
              const clampedDelta = Math.min(maxDelta, Math.max(-dragState.initialStart, deltaTime));
              return {
                ...item,
                start: Number((dragState.initialStart + clampedDelta).toFixed(2)),
                duration: Number((dragState.initialDuration - clampedDelta).toFixed(2)),
              };
            }
            return item;
          })
        );
      } else if (dragState.elementType === "audio" || dragState.elementType === "voiceover") {
        if (dragState.mode === "move") {
          const minAllowed = dragState.minAllowedStart ?? 0;
          const maxAllowed = dragState.maxAllowedStart ?? (minAllowed + 3600);
          const rawStart = dragState.initialStart + deltaTime;
          const clampedStart = Math.max(minAllowed, Math.min(maxAllowed, rawStart));

          dragPosRef.current = { id: dragState.elementId, start: clampedStart };

          // Cập nhật vị trí hiển thị cục bộ mượt 120 FPS
          setLocalAudioPositions({
            [dragState.elementId]: Number(clampedStart.toFixed(2)),
          });
        }
      } else if (dragState.elementType === "video") {
        if (dragState.mode === "move") {
          const minAllowed = dragState.minAllowedStart ?? 0;
          const maxAllowed = dragState.maxAllowedStart ?? (minAllowed + 3600);
          const rawStart = dragState.initialStart + deltaTime;
          const clampedStart = Math.max(minAllowed, Math.min(maxAllowed, rawStart));

          dragPosRef.current = { id: dragState.elementId, start: clampedStart };

          setLocalVideoPositions({
            [dragState.elementId]: Number(clampedStart.toFixed(2)),
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        const currentPending = dragPosRef.current;
        if (currentPending && currentPending.id === dragState.elementId) {
          const finalStart = Number(currentPending.start.toFixed(2));
          if (Math.abs(finalStart - dragState.initialStart) > 0.01) {
            if (dragState.elementType === "audio" || dragState.elementType === "voiceover") {
              if (onUpdateAudioClips && audioClips.length > 0) {
                onUpdateAudioClips(
                  audioClips.map((clip) =>
                    clip.id === dragState.elementId
                      ? { ...clip, start: finalStart }
                      : clip
                  ).sort((a, b) => a.start - b.start)
                );
              }
              onUpdateVoiceoverStartTime?.(finalStart);
            } else if (dragState.elementType === "video") {
              if (onUpdateVideoClips && videoClips.length > 0) {
                onUpdateVideoClips(
                  videoClips.map((clip) =>
                    clip.id === dragState.elementId
                      ? { ...clip, start: finalStart }
                      : clip
                  ).sort((a, b) => a.start - b.start)
                );
              }
            }
          }
        }
        dragPosRef.current = null;
        setLocalAudioPositions({});
        setLocalVideoPositions({});
      }
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragState,
    zoom,
    timelineDuration,
    zoomEffects,
    highlightEffects,
    stickers,
    audioClips,
    onUpdateAudioClips,
    videoClips,
    onUpdateVideoClips,
    onUpdateVoiceoverStartTime,
    onUpdateZoomEffects,
    onUpdateHighlightEffects,
    onUpdateStickers,
  ]);

  // Phím tắt bàn phím: Delete xóa element đang chọn, S hoặc Ctrl+B gọi Cắt (Split), Ctrl+Z Hoàn tác
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        e.preventDefault();
        onDeleteSelected();
      }

      if (
        (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b")
      ) {
        e.preventDefault();
        onSplit?.();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, onDeleteSelected, onSplit, onUndo]);

  return (
    <div
      className={cn(
        "bg-surface/85 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden select-none",
        className
      )}
    >
      {/* ─── Top Control Bar: Video Controls & Tutorial Effect Actions ───── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-b border-white/10 bg-surface-variant/20 text-xs gap-2">
        {/* Play/Pause & Time counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            className="p-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim transition shadow"
            title={isPlaying ? "Tạm dừng (Space)" : "Phát (Space)"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>

          <button
            onClick={() => onSeek(0)}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition"
            title="Quay lại đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1 font-mono text-xs">
            <span className="text-on-surface font-semibold">{formatTime(currentTime)}</span>
            <span className="text-on-surface-variant/50">/</span>
            <span className="text-on-surface-variant">{formatTime(duration)}</span>
          </div>

          {isDecodingAudio && (
            <div className="flex items-center gap-1.5 text-primary text-[11px] bg-primary/10 px-2 py-0.5 rounded-md animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Đang đọc sóng âm...</span>
            </div>
          )}
        </div>

        {/* ── CapCut Toolbar (Hoàn tác Undo, Cắt Split, Zoom, Highlight, Sticker, Delete) ── */}
        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-white/5">
          {/* Nút Hoàn tác (Undo) */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition text-[11px] font-medium shadow-sm group",
              canUndo
                ? "bg-white/10 hover:bg-white/15 border-white/20 text-white cursor-pointer"
                : "bg-white/5 border-white/5 text-white/30 cursor-not-allowed opacity-50"
            )}
            title="Hoàn tác thao tác vừa thực hiện (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 text-white/80 group-hover:-rotate-45 transition-transform" />
            <span className="hidden sm:inline">Hoàn tác</span>
            <kbd className="hidden md:inline text-[9px] bg-black/40 text-white/60 px-1 rounded font-mono">Ctrl+Z</kbd>
          </button>

          <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

          {/* Nút Cắt Split kiểu CapCut */}
          <button
            onClick={onSplit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary transition text-[11px] font-medium shadow-sm group"
            title="Cắt clip / tách câu phụ đề tại vị trí kim thời gian (Phím S hoặc Ctrl+B)"
          >
            <Scissors className="w-3.5 h-3.5 text-primary group-hover:rotate-12 transition-transform" />
            <span>Cắt (Split)</span>
            <kbd className="hidden sm:inline text-[9px] bg-black/40 text-primary/80 px-1 rounded font-mono">S</kbd>
          </button>

          <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />

          <button
            onClick={onAddZoom}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 transition text-[11px] font-medium shadow-sm"
            title="Thêm phóng to tại vị trí kim thời gian"
          >
            <Focus className="w-3 h-3 text-purple-400" />
            <span>+ Zoom In/Out</span>
          </button>

          <button
            onClick={onAddHighlight}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition text-[11px] font-medium shadow-sm"
            title="Thêm khung viền highlight hoặc spotlight"
          >
            <Highlighter className="w-3 h-3 text-amber-400" />
            <span>+ Highlight</span>
          </button>

          <button
            onClick={onAddSticker}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 transition text-[11px] font-medium shadow-sm"
            title="Thêm mũi tên chỉ dẫn hoặc nhãn dán con trỏ chuột"
          >
            <Smile className="w-3 h-3 text-cyan-400" />
            <span>+ Nhãn dán / Mũi tên</span>
          </button>

          {selectedElement && (
            <>
              <div className="h-3.5 w-[1px] bg-white/10 mx-0.5" />
              <button
                onClick={onDeleteSelected}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 transition text-[11px] font-medium"
                title="Xóa đối tượng đang chọn (Phím Delete)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa</span>
              </button>
            </>
          )}
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(20, z - 15))}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition"
            title="Thu nhỏ timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="font-mono text-[11px] text-on-surface-variant min-w-[36px] text-center">
            {Math.round((zoom / 60) * 100)}%
          </span>

          <button
            onClick={() => setZoom((z) => Math.min(160, z + 15))}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition"
            title="Phóng to timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-[1px] bg-white/10 mx-1" />

          <button
            onClick={handleFitToScreen}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition flex items-center gap-1"
            title="Vừa khít màn hình"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="text-[10px]">Fit</span>
          </button>
        </div>
      </div>

      {/* ─── Scrollable Timeline Body with 2-Column Professional Architecture ─── */}
      <div className="relative flex-1 flex flex-row overflow-y-auto max-h-[360px] 2k:max-h-[440px] bg-[#0b0c10] border-t border-white/10 select-none scrollbar-thin scrollbar-thumb-white/10">
        {/* ─── Cột Trái: Track Headers Sidebar (CapCut Style: Luôn cố định, hiển thị Icon, Tên, Lock, Eye) ─── */}
        <div className="w-32 shrink-0 flex flex-col bg-[#101118] border-r border-white/10 select-none z-10 sticky left-0 shadow-lg">
          {/* Header Thước đo */}
          <div className="h-6 border-b border-white/10 bg-[#141520] px-2 flex items-center justify-between text-[9px] font-bold text-white/40 uppercase tracking-wider">
            <span>Layers</span>
            <span className="text-[8px] font-mono text-white/20">CapCut</span>
          </div>

          {/* Headers: Zoom In/Out */}
          {(zoomLanes.length > 0 ? zoomLanes : [[]]).map((_, lIndex) => {
            const trackKey = `zoom_lane_${lIndex}`;
            const isLocked = !!lockedTracks[trackKey];
            const isHidden = !!hiddenTracks[trackKey];
            const trackLabel = zoomLanes.length > 1 ? `Zoom ${lIndex + 1}` : "Zoom";

            return (
              <div
                key={trackKey}
                className="h-8 border-b border-white/5 bg-[#15121e]/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5 truncate pointer-events-none">
                  <Focus className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                  <span className="truncate text-purple-200">{trackLabel}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => toggleTrackLock(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isLocked ? "Mở khóa layer này" : "Khóa layer này"}
                  >
                    {isLocked ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={(e) => toggleTrackHidden(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isHidden ? "Hiện layer này" : "Ẩn layer này"}
                  >
                    {isHidden ? <EyeOff className="w-2.5 h-2.5 text-rose-400" /> : <Eye className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Headers: Highlight */}
          {(highlightLanes.length > 0 ? highlightLanes : [[]]).map((_, lIndex) => {
            const trackKey = `highlight_lane_${lIndex}`;
            const isLocked = !!lockedTracks[trackKey];
            const isHidden = !!hiddenTracks[trackKey];
            const trackLabel = highlightLanes.length > 1 ? `Highlight ${lIndex + 1}` : "Highlight";

            return (
              <div
                key={trackKey}
                className="h-8 border-b border-white/5 bg-[#17130f]/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5 truncate pointer-events-none">
                  <Highlighter className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span className="truncate text-amber-200">{trackLabel}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => toggleTrackLock(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isLocked ? "Mở khóa layer này" : "Khóa layer này"}
                  >
                    {isLocked ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={(e) => toggleTrackHidden(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isHidden ? "Hiện layer này" : "Ẩn layer này"}
                  >
                    {isHidden ? <EyeOff className="w-2.5 h-2.5 text-rose-400" /> : <Eye className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Headers: Sticker */}
          {(stickerLanes.length > 0 ? stickerLanes : [[]]).map((_, lIndex) => {
            const trackKey = `sticker_lane_${lIndex}`;
            const isLocked = !!lockedTracks[trackKey];
            const isHidden = !!hiddenTracks[trackKey];
            const trackLabel = stickerLanes.length > 1 ? `Nhãn dán ${lIndex + 1}` : "Nhãn dán";

            return (
              <div
                key={trackKey}
                className="h-8 border-b border-white/5 bg-[#0f171d]/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5 truncate pointer-events-none">
                  <Smile className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                  <span className="truncate text-cyan-200">{trackLabel}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => toggleTrackLock(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isLocked ? "Mở khóa layer này" : "Khóa layer này"}
                  >
                    {isLocked ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
                  </button>
                  <button
                    onClick={(e) => toggleTrackHidden(trackKey, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                    title={isHidden ? "Hiện layer này" : "Ẩn layer này"}
                  >
                    {isHidden ? <EyeOff className="w-2.5 h-2.5 text-rose-400" /> : <Eye className="w-2.5 h-2.5" />}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Header: Phụ đề */}
          <div className="h-9 border-b border-white/5 bg-[#151620]/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 truncate pointer-events-none">
              <Type className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="truncate text-amber-200">Phụ đề</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => toggleTrackLock("captions", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Khóa/Mở khóa phụ đề"
              >
                {lockedTracks["captions"] ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={(e) => toggleTrackHidden("captions", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Ẩn/Hiện phụ đề"
              >
                {hiddenTracks["captions"] ? <EyeOff className="w-2.5 h-2.5 text-rose-400" /> : <Eye className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>

          {/* Header: Video gốc */}
          <div className="h-8 border-b border-white/5 bg-[#09100e]/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 truncate pointer-events-none">
              <Video className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span className="truncate text-emerald-200">Video gốc</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => toggleTrackLock("video_track", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Khóa video gốc"
              >
                {lockedTracks["video_track"] ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={(e) => toggleTrackHidden("video_track", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Ẩn video gốc"
              >
                {hiddenTracks["video_track"] ? <EyeOff className="w-2.5 h-2.5 text-rose-400" /> : <Eye className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>

          {/* Header: Âm thanh */}
          <div className="h-10 bg-black/90 px-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 truncate pointer-events-none">
              <Volume2 className="w-2.5 h-2.5 text-blue-400 shrink-0" />
              <span className="truncate text-blue-200">Âm thanh</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => toggleTrackLock("audio_track", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Khóa âm thanh"
              >
                {lockedTracks["audio_track"] ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Unlock className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={(e) => toggleTrackHidden("audio_track", e)}
                className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition"
                title="Bật/Tắt tiếng âm thanh"
              >
                {hiddenTracks["audio_track"] ? <VolumeX className="w-2.5 h-2.5 text-rose-400" /> : <Volume2 className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Cột Phải: Scrollable Timeline Content (Bắt đầu từ 0s mượt mà 100%) ─── */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownOnTimeline}
          className="flex-1 overflow-x-auto relative cursor-pointer select-none scrollbar-thin scrollbar-thumb-white/10"
        >
          <div
            className="relative"
            style={{ width: `${totalTimelineWidth}px`, minWidth: "100%" }}
          >
            {/* 1. Time Ruler (Thước đo thời gian đồng bộ tuyệt đối từ 0s) */}
            <div
              className="sticky top-0 z-20 h-6 border-b border-white/10 bg-[#12131a] flex items-end pointer-events-none"
              style={{ width: `${totalTimelineWidth}px` }}
            >
              {timeRulerTicks.map((tick, idx) => (
                <div
                  key={idx}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${tick.x}px` }}
                >
                  <div
                    className={cn(
                      "w-[1px] bg-white/20",
                      tick.isMajor ? "h-3 bg-white/40" : "h-1.5"
                    )}
                  />
                  {tick.isMajor && (
                    <span className="text-[9px] font-mono text-on-surface-variant/70 -translate-x-1/2 select-none mb-0.5 pointer-events-none">
                      {tick.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* 2. Track Zoom In/Out Lanes */}
            {(zoomLanes.length > 0 ? zoomLanes : [[]]).map((laneItems, lIndex) => {
              const trackKey = `zoom_lane_${lIndex}`;
              const isLocked = !!lockedTracks[trackKey];
              const isHidden = !!hiddenTracks[trackKey];

              return (
                <div
                  key={trackKey}
                  className={cn(
                    "relative h-8 border-b border-white/5 bg-[#15121e]/40 flex items-center group transition-opacity",
                    isHidden && "opacity-30"
                  )}
                >
                  {laneItems.map((z) => {
                    const left = z.start * zoom;
                    const width = Math.max(24, z.duration * zoom);
                    const isSelected = selectedElement?.id === z.id;
                    const isActive = currentTime >= z.start && currentTime <= z.start + z.duration;

                    return (
                      <div
                        key={z.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: z.id, type: "zoom" });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: z.id, type: "zoom" });
                          if (isLocked) return;
                          setDragState({
                            mode: "move",
                            elementType: "zoom",
                            elementId: z.id,
                            startX: e.clientX,
                            initialStart: z.start,
                            initialDuration: z.duration,
                          });
                        }}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between border text-[10px] font-semibold transition-shadow select-none",
                          isLocked ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                          isSelected
                            ? "bg-purple-600/90 border-white text-white shadow-lg ring-2 ring-purple-400/50 z-10"
                            : isActive
                            ? "bg-purple-600/60 border-purple-400 text-purple-100"
                            : "bg-purple-900/40 border-purple-700/50 text-purple-300 hover:bg-purple-900/60"
                        )}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        title={`Zoom In: ${z.scale}x tại (${z.originX}%, ${z.originY}%) | Kéo 2 đầu để chỉnh thời gian`}
                      >
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: z.id, type: "zoom" });
                              setDragState({
                                mode: "resize-left",
                                elementType: "zoom",
                                elementId: z.id,
                                startX: e.clientX,
                                initialStart: z.start,
                                initialDuration: z.duration,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-l-md"
                          />
                        )}

                        <div className="flex items-center gap-1 truncate pointer-events-none">
                          <Focus className="w-2.5 h-2.5 shrink-0 text-purple-300" />
                          <span className="truncate">Zoom {z.scale}x</span>
                        </div>

                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: z.id, type: "zoom" });
                              setDragState({
                                mode: "resize-right",
                                elementType: "zoom",
                                elementId: z.id,
                                startX: e.clientX,
                                initialStart: z.start,
                                initialDuration: z.duration,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-r-md"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 3. Track Highlight Lanes */}
            {(highlightLanes.length > 0 ? highlightLanes : [[]]).map((laneItems, lIndex) => {
              const trackKey = `highlight_lane_${lIndex}`;
              const isLocked = !!lockedTracks[trackKey];
              const isHidden = !!hiddenTracks[trackKey];

              return (
                <div
                  key={trackKey}
                  className={cn(
                    "relative h-8 border-b border-white/5 bg-[#17130f]/40 flex items-center group transition-opacity",
                    isHidden && "opacity-30"
                  )}
                >
                  {laneItems.map((h) => {
                    const left = h.start * zoom;
                    const width = Math.max(24, h.duration * zoom);
                    const isSelected = selectedElement?.id === h.id;
                    const isActive = currentTime >= h.start && currentTime <= h.start + h.duration;

                    return (
                      <div
                        key={h.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: h.id, type: "highlight" });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: h.id, type: "highlight" });
                          if (isLocked) return;
                          setDragState({
                            mode: "move",
                            elementType: "highlight",
                            elementId: h.id,
                            startX: e.clientX,
                            initialStart: h.start,
                            initialDuration: h.duration,
                          });
                        }}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between border text-[10px] font-semibold transition-shadow select-none",
                          isLocked ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                          isSelected
                            ? "bg-amber-600/90 border-white text-white shadow-lg ring-2 ring-amber-400/50 z-10"
                            : isActive
                            ? "bg-amber-600/60 border-amber-400 text-amber-100"
                            : "bg-amber-900/40 border-amber-700/50 text-amber-300 hover:bg-amber-900/60"
                        )}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        title={`Highlight: ${h.type} | Kéo 2 đầu để chỉnh thời gian`}
                      >
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: h.id, type: "highlight" });
                              setDragState({
                                mode: "resize-left",
                                elementType: "highlight",
                                elementId: h.id,
                                startX: e.clientX,
                                initialStart: h.start,
                                initialDuration: h.duration,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-l-md"
                          />
                        )}
                        <div className="flex items-center gap-1 truncate pointer-events-none">
                          <Highlighter className="w-2.5 h-2.5 shrink-0 text-amber-300" />
                          <span className="truncate">{h.type === "spotlight" ? "Spotlight" : "Viền Highlight"}</span>
                        </div>
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: h.id, type: "highlight" });
                              setDragState({
                                mode: "resize-right",
                                elementType: "highlight",
                                elementId: h.id,
                                startX: e.clientX,
                                initialStart: h.start,
                                initialDuration: h.duration,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-r-md"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 4. Track Sticker Lanes */}
            {(stickerLanes.length > 0 ? stickerLanes : [[]]).map((laneItems, lIndex) => {
              const trackKey = `sticker_lane_${lIndex}`;
              const isLocked = !!lockedTracks[trackKey];
              const isHidden = !!hiddenTracks[trackKey];

              return (
                <div
                  key={trackKey}
                  className={cn(
                    "relative h-8 border-b border-white/5 bg-[#0f171d]/40 flex items-center group transition-opacity",
                    isHidden && "opacity-30"
                  )}
                >
                  {laneItems.map((stk) => {
                    const left = stk.start * zoom;
                    const width = Math.max(24, stk.duration * zoom);
                    const isSelected = selectedElement?.id === stk.id;
                    const isActive = currentTime >= stk.start && currentTime <= stk.start + stk.duration;

                    return (
                      <div
                        key={stk.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: stk.id, type: "sticker" });
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectElement({ id: stk.id, type: "sticker" });
                          if (isLocked) return;
                          setDragState({
                            mode: "move",
                            elementType: "sticker",
                            elementId: stk.id,
                            startX: e.clientX,
                            initialStart: stk.start,
                            initialDuration: stk.duration,
                          });
                        }}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between border text-[10px] font-semibold transition-shadow select-none",
                          isLocked ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                          isSelected
                            ? "bg-cyan-600/90 border-white text-white shadow-lg ring-2 ring-cyan-400/50 z-10"
                            : isActive
                            ? "bg-cyan-600/60 border-cyan-400 text-cyan-100"
                            : "bg-cyan-900/40 border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/60"
                        )}
                        style={{ left: `${left}px`, width: `${width}px` }}
                        title={`Sticker: ${stk.type} | Kéo 2 đầu để chỉnh thời gian`}
                      >
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: stk.id, type: "sticker" });
                              setDragState({
                                mode: "resize-left",
                                elementType: "sticker",
                                elementId: stk.id,
                                startX: e.clientX,
                                initialStart: stk.start,
                                initialDuration: stk.duration,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-l-md"
                          />
                        )}
                        <div className="flex items-center gap-1 truncate pointer-events-none">
                          <Smile className="w-2.5 h-2.5 shrink-0 text-cyan-300" />
                          <span className="truncate">{stk.text || stk.type}</span>
                        </div>
                        {!isLocked && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              onSelectElement({ id: stk.id, type: "sticker" });
                              setDragState({
                                mode: "resize-right",
                                elementType: "sticker",
                                elementId: stk.id,
                                startX: e.clientX,
                                initialStart: stk.start,
                                initialDuration: stk.duration,
                              });
                            }}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize rounded-r-md"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 5. Track Phụ đề (Captions / Subtitles Chunks) */}
            <div className="relative h-9 border-b border-white/5 px-1 py-1 flex items-center bg-[#151620]/40 group">
              <div className={cn("relative flex-1 h-full flex items-center", hiddenTracks["captions"] && "opacity-30")}>
                {segments.length === 0 ? (
                  <span className="text-[10px] text-white/30 italic px-3">
                    Chưa có phụ đề bóc tách (Bấm Tạo Phụ Đề AI)
                  </span>
                ) : (
                  segments.map((seg) => {
                    const segLeft = seg.start * zoom;
                    const segWidth = Math.max(18, (seg.end - seg.start) * zoom);
                    const isActive = currentTime >= seg.start && currentTime <= seg.end;

                    return (
                      <div
                        key={seg.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(seg.start);
                        }}
                        className={cn(
                          "absolute top-0.5 bottom-0.5 rounded-md px-2 flex items-center justify-between overflow-hidden border transition-all text-[11px] font-medium shadow-sm",
                          isActive
                            ? "bg-primary/25 border-primary text-white shadow-primary/20 z-10"
                            : "bg-surface-variant/30 border-white/10 text-on-surface hover:border-primary/50 hover:bg-surface-variant/50"
                        )}
                        style={{
                          left: `${segLeft}px`,
                          width: `${segWidth}px`,
                        }}
                        title={`Câu #${seg.id}: ${seg.text} (${seg.start}s - ${seg.end}s)${seg.customPositionY !== undefined ? ` | Vị trí: ${seg.customPositionY}%` : ""}`}
                      >
                        <span className="truncate font-sans font-medium text-[11px] leading-tight flex-1">
                          {seg.text}
                        </span>
                        {seg.customPositionY !== undefined && (
                          <span className="shrink-0 text-[8px] font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-1">
                            Y:{seg.customPositionY}%
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 6. Track Video gốc */}
            <div className="relative h-8 border-b border-white/5 flex items-center bg-[#0d1614]/40 group">
              {videoClips && videoClips.length > 0 ? (
                videoClips.map((vClip) => {
                  const isSelected = selectedElement?.id === vClip.id;
                  const displayStart = localVideoPositions[vClip.id] !== undefined
                    ? localVideoPositions[vClip.id]
                    : vClip.start;
                  const isCurrentlyDragging = dragState?.elementId === vClip.id;

                  return (
                    <div
                      key={vClip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectElement({ id: vClip.id, type: "video" });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectElement({ id: vClip.id, type: "video" });
                        if (lockedTracks["video_track"]) return;

                        const otherClips = videoClips.filter((c) => c.id !== vClip.id);
                        const prevClips = otherClips.filter((c) => c.start < vClip.start + 0.05);
                        const prevClip = prevClips.length > 0
                          ? prevClips.sort((a, b) => (b.start + b.duration) - (a.start + a.duration))[0]
                          : null;
                        const minAllowedStart = prevClip ? Math.max(0, prevClip.start + prevClip.duration) : 0;

                        const nextClips = otherClips.filter((c) => c.start > vClip.start + 0.05);
                        const nextClip = nextClips.length > 0
                          ? nextClips.sort((a, b) => a.start - b.start)[0]
                          : null;
                        const maxAllowedStart = nextClip
                          ? Math.max(minAllowedStart, nextClip.start - vClip.duration)
                          : minAllowedStart + 3600;

                        setDragState({
                          mode: "move",
                          elementType: "video",
                          elementId: vClip.id,
                          startX: e.clientX,
                          initialStart: vClip.start,
                          initialDuration: vClip.duration,
                          minAllowedStart,
                          maxAllowedStart,
                        });
                      }}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between border text-[10px] font-medium select-none shadow-sm z-10",
                        !isCurrentlyDragging && "transition-all",
                        isCurrentlyDragging && "transition-none shadow-2xl z-30 ring-2 ring-emerald-300",
                        lockedTracks["video_track"] ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                        isSelected
                          ? "border-emerald-400 bg-emerald-600/80 text-white ring-2 ring-emerald-400/60 shadow-lg"
                          : "border-emerald-700/50 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300",
                        hiddenTracks["video_track"] && "opacity-20"
                      )}
                      style={{
                        left: `${displayStart * zoom}px`,
                        width: `${Math.max(40, vClip.duration * zoom)}px`,
                        willChange: isCurrentlyDragging ? "left" : "auto",
                      }}
                      title={`Video: Bắt đầu ${displayStart.toFixed(2)}s (Dài ${vClip.duration.toFixed(2)}s) | Nhấp để chọn / cắt (S) / kéo di chuyển`}
                    >
                      <div className="flex items-center gap-1.5 truncate pointer-events-none">
                        <Video className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate font-mono">
                          {vClip.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono opacity-80 shrink-0 ml-1 pointer-events-none">
                        {displayStart.toFixed(1)}s
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectElement({ id: "video_main", type: "video" });
                  }}
                  className={cn(
                    "absolute top-1 bottom-1 rounded-md px-2 flex items-center gap-2 border border-emerald-700/40 bg-emerald-950/30 text-emerald-300 text-[10px] font-medium select-none cursor-pointer shadow-sm hover:border-emerald-500",
                    selectedElement?.type === "video" && "ring-2 ring-emerald-400 border-emerald-400",
                    hiddenTracks["video_track"] && "opacity-20"
                  )}
                  style={{
                    left: "0px",
                    width: `${timelineDuration * zoom}px`,
                  }}
                  title="Video gốc: Nhấp để chọn và bấm Cắt (Split) tại vị trí kim thời gian"
                >
                  <Video className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate font-mono">
                    {videoFile ? videoFile.name : "source_video.mp4"} ({timelineDuration.toFixed(1)}s)
                  </span>
                </div>
              )}
            </div>

            {/* 7. Track Âm thanh (Khối Voiceover Clip có thể kéo thả & Sóng âm Waveform) */}
            <div className="relative h-10 flex items-center bg-black/40 group overflow-hidden">
              <canvas
                ref={canvasRef}
                className={cn("absolute inset-0 w-full h-full pointer-events-none", hiddenTracks["audio_track"] && "opacity-20")}
                style={{ width: `${totalTimelineWidth}px`, height: "40px" }}
              />

              {/* Khối các Audio Clips có thể cắt và kéo di chuyển trực tiếp trên timeline */}
              {audioClips && audioClips.length > 0 ? (
                audioClips.map((clip) => {
                  const isSelected = selectedElement?.id === clip.id;
                  const displayStart = localAudioPositions[clip.id] !== undefined
                    ? localAudioPositions[clip.id]
                    : clip.start;
                  const isCurrentlyDragging = dragState?.elementId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectElement({ id: clip.id, type: "audio" });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelectElement({ id: clip.id, type: "audio" });
                        if (lockedTracks["audio_track"]) return;

                        const otherClips = audioClips.filter((c) => c.id !== clip.id);
                        const prevClips = otherClips.filter((c) => c.start < clip.start + 0.05);
                        const prevClip = prevClips.length > 0
                          ? prevClips.sort((a, b) => (b.start + b.duration) - (a.start + a.duration))[0]
                          : null;
                        const minAllowedStart = prevClip ? Math.max(0, prevClip.start + prevClip.duration) : 0;

                        const nextClips = otherClips.filter((c) => c.start > clip.start + 0.05);
                        const nextClip = nextClips.length > 0
                          ? nextClips.sort((a, b) => a.start - b.start)[0]
                          : null;
                        const maxAllowedStart = nextClip
                          ? Math.max(minAllowedStart, nextClip.start - clip.duration)
                          : minAllowedStart + 3600;

                        setDragState({
                          mode: "move",
                          elementType: "audio",
                          elementId: clip.id,
                          startX: e.clientX,
                          initialStart: clip.start,
                          initialDuration: clip.duration,
                          minAllowedStart,
                          maxAllowedStart,
                        });
                      }}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-lg px-2.5 flex items-center justify-between border text-[10px] font-semibold select-none shadow-md z-10",
                        !isCurrentlyDragging && "transition-all",
                        isCurrentlyDragging && "transition-none shadow-2xl z-30 ring-2 ring-amber-300",
                        lockedTracks["audio_track"] ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                        isSelected
                          ? "bg-amber-600/95 border-white text-white ring-2 ring-amber-400/60 shadow-lg"
                          : "bg-amber-700/65 hover:bg-amber-700/85 border-amber-500/50 text-amber-100"
                      )}
                      style={{
                        left: `${displayStart * zoom}px`,
                        width: `${Math.max(40, clip.duration * zoom)}px`,
                        willChange: isCurrentlyDragging ? "left" : "auto",
                      }}
                      title={`Âm thanh: ${clip.text || clip.name} (Bắt đầu từ ${displayStart.toFixed(2)}s, Dài ${clip.duration.toFixed(2)}s) | Nhấp để cắt (S) hoặc kéo di chuyển`}
                    >
                      <div className="flex items-center gap-1.5 truncate pointer-events-none">
                        <Mic className="w-3 h-3 text-amber-200 shrink-0" />
                        <span className="truncate font-sans font-medium text-[10px]">
                          {clip.text || clip.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono opacity-80 shrink-0 ml-1 pointer-events-none">
                        {displayStart.toFixed(1)}s
                      </span>
                    </div>
                  );
                })
              ) : voiceoverName ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectElement({ id: "voiceover", type: "audio" });
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onSelectElement({ id: "voiceover", type: "audio" });
                    if (lockedTracks["audio_track"]) return;
                    setDragState({
                      mode: "move",
                      elementType: "voiceover",
                      elementId: "voiceover",
                      startX: e.clientX,
                      initialStart: voiceoverStartTime || 0,
                      initialDuration: voiceoverDuration || 5,
                    });
                  }}
                  className={cn(
                    "absolute top-1 bottom-1 rounded-lg px-2.5 flex items-center justify-between border text-[10px] font-semibold transition-all select-none shadow-md z-10",
                    lockedTracks["audio_track"] ? "cursor-not-allowed opacity-80" : "cursor-grab active:cursor-grabbing",
                    selectedElement?.id === "voiceover"
                      ? "bg-amber-600/90 border-white text-white ring-2 ring-amber-400/50 shadow-lg"
                      : "bg-amber-700/60 hover:bg-amber-700/80 border-amber-500/50 text-amber-100"
                  )}
                  style={{
                    left: `${(voiceoverStartTime || 0) * zoom}px`,
                    width: `${Math.max(60, (voiceoverDuration || 5) * zoom)}px`,
                  }}
                  title={`Giọng đọc lồng tiếng: Bắt đầu từ ${(voiceoverStartTime || 0).toFixed(2)}s | Nhấp để cắt hoặc kéo di chuyển`}
                >
                  <div className="flex items-center gap-1.5 truncate pointer-events-none">
                    <Mic className="w-3 h-3 text-amber-200 shrink-0" />
                    <span className="truncate font-sans font-medium text-[10px]">
                      {voiceoverName}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono opacity-80 shrink-0 ml-1 pointer-events-none">
                    {(voiceoverStartTime || 0).toFixed(1)}s
                  </span>
                </div>
              ) : null}
            </div>

            {/* 8. Playhead (Kim phát thời gian tương tác Descript 60 FPS đồng bộ tuyệt đối) */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{
                left: `${currentTime * zoom}px`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="w-3.5 h-3.5 bg-primary rounded-b-sm rotate-45 -translate-y-1 mx-auto shadow-md ring-1 ring-white/50" />
              <div className="w-[2px] h-full bg-primary mx-auto shadow-[0_0_8px_rgba(236,111,9,0.8)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
