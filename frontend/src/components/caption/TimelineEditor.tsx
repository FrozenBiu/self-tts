import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Scissors,
  Undo2,
  Type,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  customPositionY?: number;
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
  onUpdateSegments?: (newSegments: CaptionSegment[]) => void;
  onSplit?: () => void;
  canUndo?: boolean;
  onUndo?: () => void;
  selectedSegmentId?: number | null;
  onSelectSegment?: (segId: number | null) => void;
  className?: string;
  // Props dự phòng tương thích ngược
  zoomEffects?: any[];
  onUpdateZoomEffects?: any;
  highlightEffects?: any[];
  onUpdateHighlightEffects?: any;
  stickers?: any[];
  onUpdateStickers?: any;
  selectedElement?: any;
  onSelectElement?: any;
  onAddZoom?: any;
  onAddHighlight?: any;
  onAddSticker?: any;
  onDeleteSelected?: any;
  audioClips?: any[];
  onUpdateAudioClips?: any;
  videoClips?: any[];
  onUpdateVideoClips?: any;
  voiceoverName?: any;
  voiceoverStartTime?: any;
  voiceoverDuration?: any;
  onUpdateVoiceoverStartTime?: any;
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
  onUpdateSegments,
  onSplit,
  canUndo = false,
  onUndo,
  selectedSegmentId,
  onSelectSegment,
  className,
}: TimelineEditorProps) {
  // Zoom: số pixel hiển thị cho mỗi 1 giây video (mặc định 70px/s)
  const [zoom, setZoom] = useState<number>(70);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [audioPeaks, setAudioPeaks] = useState<number[]>([]);
  const [isDecodingAudio, setIsDecodingAudio] = useState<boolean>(false);

  // Kéo chỉnh mốc thời gian của từng khối phụ đề
  const [dragHandle, setDragHandle] = useState<{
    segId: number;
    type: "left" | "right" | "move";
    startX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const safeDuration = Math.max(duration || 0, 1);
  const timelineWidth = Math.max(800, safeDuration * zoom + 120);

  // ─── 1. Web Audio API: Giải mã âm thanh video để vẽ waveform sóng âm thực ───
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

        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();

        try {
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          if (isCancelled) {
            ctx.close();
            return;
          }

          const rawData = decoded.getChannelData(0);
          const totalBars = 300;
          const blockSize = Math.floor(rawData.length / totalBars);
          const peaks: number[] = [];

          for (let i = 0; i < totalBars; i++) {
            let maxVal = 0;
            const start = i * blockSize;
            const end = Math.min(start + blockSize, rawData.length);
            for (let j = start; j < end; j += 4) {
              const absVal = Math.abs(rawData[j]);
              if (absVal > maxVal) maxVal = absVal;
            }
            peaks.push(Math.min(1.0, maxVal * 1.8));
          }

          if (!isCancelled) {
            setAudioPeaks(peaks);
          }
        } finally {
          ctx.close();
        }
      } catch (err) {
        console.warn("[Timeline] Không thể giải mã Audio Waveform:", err);
      } finally {
        if (!isCancelled) {
          setIsDecodingAudio(false);
        }
      }
    };

    extractAudioWaveform();
    return () => {
      isCancelled = true;
    };
  }, [videoFile, videoUrl]);

  // ─── 2. Tự động cuộn timeline theo đầu đọc Playhead khi đang phát ──────────
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const scrollEl = scrollRef.current;
    const playheadPx = currentTime * zoom;
    const visibleLeft = scrollEl.scrollLeft;
    const visibleRight = visibleLeft + scrollEl.clientWidth;

    if (playheadPx > visibleRight - 100 || playheadPx < visibleLeft) {
      scrollEl.scrollLeft = Math.max(0, playheadPx - 150);
    }
  }, [currentTime, isPlaying, zoom]);

  // ─── 3. Scrubbing trên thước đo thời gian ──────────────────────────────────
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragHandle) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = Math.max(0, Math.min(safeDuration, clickX / zoom));
    onSeek(targetTime);
    setIsScrubbing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const targetTime = Math.max(0, Math.min(safeDuration, curX / zoom));
        onSeek(targetTime);
      } else if (dragHandle && onUpdateSegments) {
        const deltaX = e.clientX - dragHandle.startX;
        const deltaTime = deltaX / zoom;
        const dur = dragHandle.initialEnd - dragHandle.initialStart;

        const updated = segments.map((seg) => {
          if (seg.id !== dragHandle.segId) return seg;

          let newStart = seg.start;
          let newEnd = seg.end;

          if (dragHandle.type === "left") {
            newStart = Math.max(
              0,
              Math.min(
                dragHandle.initialEnd - 0.2,
                Number((dragHandle.initialStart + deltaTime).toFixed(2)),
              ),
            );
          } else if (dragHandle.type === "right") {
            newEnd = Math.max(
              dragHandle.initialStart + 0.2,
              Math.min(
                safeDuration,
                Number((dragHandle.initialEnd + deltaTime).toFixed(2)),
              ),
            );
          } else if (dragHandle.type === "move") {
            newStart = Math.max(
              0,
              Number((dragHandle.initialStart + deltaTime).toFixed(2)),
            );
            newEnd = Number((newStart + dur).toFixed(2));
            if (newEnd > safeDuration) {
              newEnd = safeDuration;
              newStart = Math.max(0, Number((newEnd - dur).toFixed(2)));
            }
          }

          // Cập nhật lại phân bổ word timings tương đối
          const wordsList = seg.words || [];
          const segDur = Math.max(0.2, newEnd - newStart);
          const step = segDur / Math.max(1, wordsList.length);
          const adjustedWords = wordsList.map((w, idx) => ({
            ...w,
            start: Number((newStart + idx * step).toFixed(2)),
            end: Number((newStart + (idx + 1) * step).toFixed(2)),
          }));

          return {
            ...seg,
            start: newStart,
            end: newEnd,
            words: adjustedWords,
          };
        });

        onUpdateSegments(updated);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) setIsScrubbing(false);
      if (dragHandle) setDragHandle(null);
    };

    if (isScrubbing || dragHandle) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isScrubbing, dragHandle, zoom, safeDuration, onSeek, onUpdateSegments, segments]);

  // Format giây sang mm:ss.d
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
  };

  return (
    <div
      className={cn(
        "w-full bg-surface/80 backdrop-blur-md rounded-2xl border border-white/10 p-3.5 shadow-xl flex flex-col gap-2 select-none",
        className,
      )}
    >
      {/* ─── 1. Header Toolbar của Timeline ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition shadow-md cursor-pointer"
            title={isPlaying ? "Tạm dừng (Space)" : "Phát video (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          {/* Reset 0s */}
          <button
            onClick={() => onSeek(0)}
            className="p-2 rounded-xl bg-surface-variant/40 hover:bg-surface-variant text-on-surface transition border border-white/10 cursor-pointer"
            title="Tua về đầu video"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Time Counter */}
          <div className="px-3 py-1 rounded-xl bg-surface-variant/50 border border-white/10 font-mono text-xs text-on-surface">
            <span className="text-primary font-bold">
              {formatTime(currentTime)}
            </span>
            <span className="text-on-surface-variant mx-1">/</span>
            <span className="text-on-surface-variant">
              {formatTime(safeDuration)}
            </span>
          </div>
        </div>

        {/* Nút thao tác nhanh */}
        <div className="flex items-center gap-2">
          {/* Nút Cắt tại Playhead */}
          {onSplit && (
            <button
              onClick={onSplit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/10 text-on-surface hover:text-primary transition text-xs font-medium cursor-pointer"
              title="Cắt câu phụ đề tại vị trí kim thời gian (Phím tắt: S)"
            >
              <Scissors className="w-3.5 h-3.5 text-primary" />
              <span>Cắt câu (S)</span>
            </button>
          )}

          {/* Nút Hoàn tác */}
          {onUndo && canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-variant/40 hover:bg-surface-variant border border-white/10 text-on-surface transition text-xs font-medium cursor-pointer"
              title="Hoàn tác thao tác trước (Ctrl + Z)"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Hoàn tác</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-surface-variant/40 border border-white/10 rounded-xl px-2 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(30, z - 15))}
              className="p-1 hover:text-primary text-on-surface-variant transition cursor-pointer"
              title="Thu nhỏ timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-on-surface-variant w-12 text-center">
              {zoom}px/s
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(180, z + 15))}
              className="p-1 hover:text-primary text-on-surface-variant transition cursor-pointer"
              title="Phóng to timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Vùng hiển thị Dòng thời gian cuộn ngang ─────────────────────── */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-black/40 relative scrollbar-thin scrollbar-thumb-white/20 select-none h-44"
      >
        <div
          ref={containerRef}
          onMouseDown={handleTimelineMouseDown}
          style={{ width: `${timelineWidth}px` }}
          className="relative h-full cursor-pointer flex flex-col justify-start"
        >
          {/* ─── 2.1 Thước đo thời gian (Time Ruler) ────────────────────────── */}
          <div className="h-6 w-full border-b border-white/10 bg-surface-variant/20 flex items-end relative text-[9px] font-mono text-on-surface-variant">
            {Array.from({ length: Math.ceil(safeDuration) + 1 }).map((_, sec) => {
              const isMajor = sec % 5 === 0;
              return (
                <div
                  key={sec}
                  style={{ left: `${sec * zoom}px` }}
                  className="absolute bottom-0 flex flex-col items-center pointer-events-none"
                >
                  {isMajor && (
                    <span className="mb-0.5 text-[9px] text-white/50 -translate-x-1/2">
                      {sec}s
                    </span>
                  )}
                  <div
                    className={cn(
                      "w-[1px]",
                      isMajor ? "h-3 bg-white/40" : "h-1.5 bg-white/15",
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* ─── 2.2 Track 1: Sóng âm thanh Video (Audio Waveform) ─────────── */}
          <div className="h-16 w-full relative border-b border-white/5 bg-surface-variant/10 flex items-center px-1 group/audio">
            <div className="absolute left-2 top-1.5 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-white/60 bg-black/60 px-2 py-0.5 rounded border border-white/10">
              <Volume2 className="w-3 h-3 text-cyan-400" />
              <span>Âm thanh video</span>
              {isDecodingAudio && (
                <span className="text-[9px] text-cyan-300 animate-pulse">
                  (Đang giải mã...)
                </span>
              )}
            </div>

            {/* Render Waveform Bars */}
            {audioPeaks.length > 0 ? (
              <div className="w-full h-full flex items-center gap-[1px] opacity-70">
                {audioPeaks.map((peak, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-cyan-600/70 via-cyan-400/80 to-cyan-300 rounded-full"
                    style={{
                      height: `${Math.max(3, peak * 48)}px`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="w-full text-center text-[10px] text-white/30 italic">
                {videoUrl
                  ? "Đang phân tích biểu đồ sóng âm thanh..."
                  : "Chưa có video để hiển thị biểu đồ sóng âm"}
              </div>
            )}
          </div>

          {/* ─── 2.3 Track 2: Dải Phụ Đề (Caption Segments Track) ──────────── */}
          <div className="h-20 w-full relative bg-surface-variant/15 flex items-center">
            <div className="absolute left-2 top-1 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-white/60 bg-black/60 px-2 py-0.5 rounded border border-white/10">
              <Type className="w-3 h-3 text-amber-400" />
              <span>Phụ đề Kinetic ({segments.length} câu)</span>
            </div>

            {/* Các khối Caption Blocks */}
            {segments.map((seg, segIdx) => {
              const blockLeft = seg.start * zoom;
              const blockWidth = Math.max(24, (seg.end - seg.start) * zoom);
              const isCurrent =
                currentTime >= seg.start - 0.05 && currentTime <= seg.end + 0.1;
              const isSelected = selectedSegmentId === seg.id;

              return (
                <div
                  key={seg.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(seg.start);
                    onSelectSegment?.(seg.id);
                  }}
                  style={{
                    left: `${blockLeft}px`,
                    width: `${blockWidth}px`,
                  }}
                  className={cn(
                    "absolute top-5 bottom-2 rounded-lg border flex items-center justify-between px-2 cursor-pointer transition-all duration-100 group/seg overflow-hidden select-none",
                    isCurrent || isSelected
                      ? "bg-amber-500/35 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-1 ring-amber-400/50 z-20"
                      : "bg-surface-variant/60 hover:bg-surface-variant border-white/20 text-white/90 z-10",
                  )}
                  title={`[${seg.start}s - ${seg.end}s]: ${seg.text}`}
                >
                  {/* Handle kéo mép trái (Chỉnh mốc Start) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragHandle({
                        segId: seg.id,
                        type: "left",
                        startX: e.clientX,
                        initialStart: seg.start,
                        initialEnd: seg.end,
                      });
                    }}
                    className="absolute left-0 top-0 bottom-0 w-3 bg-amber-400/40 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/seg:opacity-100 transition-opacity z-30"
                    title="Kéo mép để chỉnh mốc bắt đầu"
                  />

                  {/* Nội dung tóm tắt của câu phụ đề */}
                  <div className="flex items-center gap-1.5 truncate text-[11px] font-medium min-w-0 pr-1 pointer-events-none">
                    <span className="text-[9px] font-mono text-amber-300/80 shrink-0">
                      #{segIdx + 1}
                    </span>
                    <span className="truncate text-white font-semibold">
                      {seg.text}
                    </span>
                  </div>

                  {/* Handle kéo mép phải (Chỉnh mốc End) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDragHandle({
                        segId: seg.id,
                        type: "right",
                        startX: e.clientX,
                        initialStart: seg.start,
                        initialEnd: seg.end,
                      });
                    }}
                    className="absolute right-0 top-0 bottom-0 w-3 bg-amber-400/40 hover:bg-amber-400 cursor-ew-resize opacity-0 group-hover/seg:opacity-100 transition-opacity z-30"
                    title="Kéo mép để chỉnh mốc kết thúc"
                  />
                </div>
              );
            })}
          </div>

          {/* ─── 2.4 Kim đọc Playhead chạy mượt mà 60 FPS ────────────────────── */}
          <div
            style={{ left: `${currentTime * zoom}px` }}
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 pointer-events-none -translate-x-1/2 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
          >
            {/* Tam giác đỉnh kim */}
            <div className="w-3.5 h-3.5 bg-red-500 rotate-45 -translate-x-[5px] -translate-y-1.5 shadow-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
