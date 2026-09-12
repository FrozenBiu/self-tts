import React, { useRef, useState, useEffect } from "react";
import type { Voice } from "../../store/useTTSStore";

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoiceId: string | null;
  onSelectVoice: (id: string) => void;
  pinnedVoices: string[];
  onTogglePin: (id: string) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceId,
  onSelectVoice,
  pinnedVoices,
  onTogglePin,
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startScrollLeft, setStartScrollLeft] = useState(0);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [voiceType, setVoiceType] = useState<"all" | "preset" | "custom">("all");
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    previewAudioRef.current = new Audio();
    previewAudioRef.current.onended = () => {
      setPlayingPreviewUrl(null);
    };

    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDown(true);
    if (carouselRef.current) {
      setStartX(e.pageX - carouselRef.current.offsetLeft);
      setStartScrollLeft(carouselRef.current.scrollLeft);
    }
  };

  const handleMouseLeave = () => setIsDown(false);
  const handleMouseUp = () => setIsDown(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    carouselRef.current.scrollLeft = startScrollLeft - walk;
  };

  const handleScrollLeftArrow = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleScrollRightArrow = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const handlePlayPreview = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewAudioRef.current) return;

    if (playingPreviewUrl === url) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPlayingPreviewUrl(null);
    } else {
      previewAudioRef.current.src = url;
      previewAudioRef.current.play().catch((err) => {
        console.warn("Lỗi phát preview:", err);
        setPlayingPreviewUrl(null);
      });
      setPlayingPreviewUrl(url);
    }
  };

  const filteredVoices = voices
    .filter(
      (v) =>
        (gender === "all" || v.gender === gender) &&
        (voiceType === "all" ||
          (voiceType === "preset"
            ? !v.type || v.type === "preset"
            : v.type === "custom")),
    )
    .sort((a, b) => {
      const aPinned = pinnedVoices?.includes(a.id) || false;
      const bPinned = pinnedVoices?.includes(b.id) || false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

  useEffect(() => {
    if (filteredVoices.length > 0 && !selectedVoiceId) {
      onSelectVoice(filteredVoices[0].id);
    }
  }, [voices, gender, voiceType, pinnedVoices, selectedVoiceId, onSelectVoice]);

  return (
    <div className="flex flex-col gap-4 relative group/carousel z-10 h-full animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-4">
            <label className="font-label-caps text-label-caps 2k:text-sm text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] 2k:text-[20px]">
                record_voice_over
              </span>
              Mẫu giọng đọc
            </label>
            <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-1 shadow-inner h-8 2k:h-9">
              <button
                type="button"
                className={`px-3 2k:px-4 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "all" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
                onClick={() => setVoiceType("all")}
              >
                TẤT CẢ
              </button>
              <button
                type="button"
                className={`px-3 2k:px-4 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "preset" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
                onClick={() => setVoiceType("preset")}
              >
                HỆ THỐNG
              </button>
              <button
                type="button"
                className={`px-3 2k:px-4 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "custom" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
                onClick={() => setVoiceType("custom")}
              >
                CÁ NHÂN
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-1 w-fit shadow-inner">
            <button
              type="button"
              className={`px-4 2k:px-5 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${!gender || gender === "all" ? "bg-[#FFB74D] text-black shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
              onClick={() => setGender("all")}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`px-4 2k:px-5 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${gender === "male" ? "bg-[#FFB74D] text-black shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
              onClick={() => setGender("male")}
            >
              Nam
            </button>
            <button
              type="button"
              className={`px-4 2k:px-5 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${gender === "female" ? "bg-[#FFB74D] text-black shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
              onClick={() => setGender("female")}
            >
              Nữ
            </button>
          </div>
        </div>
      </div>

      {/* Carousel navigation arrows */}
      <div className="absolute left-0 top-[60%] -translate-y-1/2 z-20 hidden md:flex items-center -ml-4 2k:-ml-5">
        <button
          type="button"
          onClick={handleScrollLeftArrow}
          className="w-8 h-8 2k:w-10 2k:h-10 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shadow-lg border border-white/20 hover:scale-110"
        >
          <span className="material-symbols-outlined text-[20px] 2k:text-[24px]">
            chevron_left
          </span>
        </button>
      </div>
      <div className="absolute right-0 top-[60%] -translate-y-1/2 z-20 hidden md:flex items-center -mr-4 2k:-mr-5">
        <button
          type="button"
          onClick={handleScrollRightArrow}
          className="w-8 h-8 2k:w-10 2k:h-10 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shadow-lg border border-white/20 hover:scale-110"
        >
          <span className="material-symbols-outlined text-[20px] 2k:text-[24px]">
            chevron_right
          </span>
        </button>
      </div>

      <div
        ref={carouselRef}
        className={`flex gap-4 2k:gap-5 overflow-x-auto py-2 px-1 hide-scrollbar cursor-grab ${isDown ? "active:cursor-grabbing snap-none" : "snap-x snap-proximity"} scroll-smooth -mx-1`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {filteredVoices.length === 0 ? (
          <div className="w-full h-40 2k:h-48 flex items-center justify-center bg-surface-dim/50 rounded-xl border border-white/5">
            <p className="text-on-surface-variant text-sm 2k:text-base font-label-caps">
              Không tìm thấy giọng đọc nào
            </p>
          </div>
        ) : (
          filteredVoices.map((voice, index) => {
            const isSelected = selectedVoiceId === voice.id;
            const isPinned = pinnedVoices?.includes(voice.id);
            const isPlaying = playingPreviewUrl === voice.url;

            return (
              <div
                key={index}
                className="snap-start shrink-0 w-36 2k:w-44 h-40 2k:h-48 relative group"
              >
                <div className="absolute top-2 left-2 opacity-100 z-10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(voice.id);
                    }}
                    className={`w-7 h-7 2k:w-8 2k:h-8 rounded-full flex items-center justify-center transition-all ${isPinned ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "text-primary/40 hover:text-primary/80 opacity-0 group-hover:opacity-100"}`}
                    title={isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  >
                    <span
                      className="material-symbols-outlined text-[16px] 2k:text-[18px]"
                      style={{
                        fontVariationSettings: isPinned
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      star
                    </span>
                  </button>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={(e) => handlePlayPreview(voice.url, e)}
                    className="w-7 h-7 2k:w-8 2k:h-8 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                    title={isPlaying ? "Dừng phát" : "Nghe thử"}
                  >
                    <span
                      className="material-symbols-outlined text-[16px] 2k:text-[18px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectVoice(voice.id)}
                  className={`w-full h-full flex flex-col items-center justify-center gap-2 p-3 2k:p-4 rounded-xl bg-white/5 backdrop-blur-md transition-all duration-300 relative top-[1px] border ${isSelected ? "border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-primary/10" : "border-white/10 hover:border-primary/50 hover:bg-white/10"}`}
                >
                  <span
                    className={`material-symbols-outlined text-3xl 2k:text-4xl ${isSelected ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
                  >
                    {voice.icon}
                  </span>
                  <div className="text-center mt-1 w-full">
                    <p className="font-label-caps text-sm 2k:text-base text-on-surface truncate px-1">
                      {voice.name}
                    </p>
                    <p className="text-xs 2k:text-sm text-on-surface-variant mt-1 line-clamp-2 px-1">
                      {voice.description}
                    </p>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
