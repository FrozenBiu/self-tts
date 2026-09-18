import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

interface AudioPlayerBarProps {
  url: string;
  recordId: string;
  className?: string;
  activePlayingId?: string | null;
  onPlayStateChange?: (id: string, isPlaying: boolean) => void;
}

export function AudioPlayerBar({
  url,
  recordId,
  className = "",
  activePlayingId,
  onPlayStateChange,
}: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Dừng phát nếu một audio khác bắt đầu phát
  useEffect(() => {
    if (activePlayingId && activePlayingId !== recordId && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [activePlayingId, recordId, isPlaying]);

  // Cập nhật playbackRate khi thay đổi
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(recordId, false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        onPlayStateChange?.(recordId, true);
      }).catch((err) => {
        console.warn("Không thể phát âm thanh:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    onPlayStateChange?.(recordId, false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          onPlayStateChange?.(recordId, true);
        });
      }
    }
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-surface-dim/80 border border-white/5 backdrop-blur-sm ${className}`}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Nút Play / Pause */}
      <button
        type="button"
        onClick={handleTogglePlay}
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm ${
          isPlaying
            ? "bg-primary text-black shadow-primary/25 scale-105"
            : "bg-primary/20 text-primary hover:bg-primary hover:text-black border border-primary/30"
        }`}
        title={isPlaying ? "Tạm dừng" : "Phát âm thanh"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Nút Phát lại từ đầu */}
      <button
        type="button"
        onClick={handleRestart}
        className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
        title="Phát lại từ đầu"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Thời gian hiện tại */}
      <span className="text-[11px] font-mono-data text-on-surface-variant shrink-0 min-w-[32px]">
        {formatTime(currentTime)}
      </span>

      {/* Thanh tiến trình kéo thả (Scrub Bar) */}
      <div className="flex-1 relative flex items-center min-w-[80px]">
        <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-75"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-5 opacity-0 cursor-pointer z-10"
        />
      </div>

      {/* Tổng thời lượng */}
      <span className="text-[11px] font-mono-data text-on-surface-variant/70 shrink-0 min-w-[32px]">
        {formatTime(duration)}
      </span>

      {/* Nút chỉnh tốc độ phát */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="px-2 py-0.5 rounded text-[10px] font-mono-data font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/10 border border-white/5 transition-colors shrink-0 cursor-pointer"
        title="Nhấn để đổi tốc độ phát (1.0x -> 1.25x -> 1.5x -> 2.0x)"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
