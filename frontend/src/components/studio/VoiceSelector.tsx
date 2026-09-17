import React, { useRef, useState, useEffect } from "react";
import type { Voice } from "../../store/useTTSStore";
import { globalAudio } from "../../utils/audioCoordinator";

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
  const [currentPage, setCurrentPage] = useState(0);
  const CARDS_PER_PAGE = 6;

  useEffect(() => {
    previewAudioRef.current = new Audio();
    previewAudioRef.current.onended = () => {
      setPlayingPreviewUrl(null);
    };

    return () => {
      globalAudio.stopAll();
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
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const handleScrollRightArrow = () => {
    const maxPage = Math.ceil(filteredVoices.length / CARDS_PER_PAGE) - 1;
    setCurrentPage((p) => Math.min(maxPage, p + 1));
  };

  const handlePlayPreview = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewAudioRef.current) return;

    if (playingPreviewUrl === url) {
      globalAudio.stopAll();
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setPlayingPreviewUrl(null);
    } else {
      previewAudioRef.current.src = url;
      globalAudio.play(previewAudioRef.current, () => {
        setPlayingPreviewUrl(null);
      });
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

  const totalPages = Math.ceil(filteredVoices.length / CARDS_PER_PAGE);
  const pagedVoices = filteredVoices.slice(
    currentPage * CARDS_PER_PAGE,
    (currentPage + 1) * CARDS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [gender, voiceType]);

  useEffect(() => {
    if (filteredVoices.length > 0) {
      const isCurrentInFiltered = filteredVoices.some(
        (v) => v.id === selectedVoiceId,
      );
      if (!selectedVoiceId || !isCurrentInFiltered) {
        onSelectVoice(filteredVoices[0].id);
      }
    }
  }, [filteredVoices, selectedVoiceId, onSelectVoice]);

  return (
    <div className="flex flex-col gap-4 z-10 animate-in fade-in duration-300">
      {/* Filter Row - Linh hoạt, chống nhảy hàng hoặc tràn lấn */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <label className="font-label-caps text-xs 2k:text-sm text-on-surface-variant flex items-center gap-1.5 shrink-0">
            <span className="material-symbols-outlined text-[18px] 2k:text-[20px]">
              record_voice_over
            </span>
            Mẫu giọng đọc
          </label>
          <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-0.5 shadow-inner h-8 2k:h-9">
            <button
              type="button"
              className={`px-2.5 sm:px-3 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "all" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
              onClick={() => setVoiceType("all")}
            >
              TẤT CẢ
            </button>
            <button
              type="button"
              className={`px-2.5 sm:px-3 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "preset" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
              onClick={() => setVoiceType("preset")}
            >
              HỆ THỐNG
            </button>
            <button
              type="button"
              className={`px-2.5 sm:px-3 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "custom" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
              onClick={() => setVoiceType("custom")}
            >
              CÁ NHÂN
            </button>
          </div>
        </div>

        <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-0.5 shadow-inner h-8 2k:h-9 shrink-0">
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs transition-all duration-300 ${!gender || gender === "all" ? "bg-[#FFB74D] text-black font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
            onClick={() => setGender("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs transition-all duration-300 ${gender === "male" ? "bg-[#FFB74D] text-black font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
            onClick={() => setGender("male")}
          >
            Nam
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded text-xs transition-all duration-300 ${gender === "female" ? "bg-[#FFB74D] text-black font-semibold shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
            onClick={() => setGender("female")}
          >
            Nữ
          </button>
        </div>
      </div>

      {/* Carousel: Arrow + Grid + Arrow */}
      <div className="flex items-center gap-2 sm:gap-3 2k:gap-4 w-full">
        {/* Left Arrow */}
        <button
          type="button"
          onClick={handleScrollLeftArrow}
          disabled={currentPage === 0}
          className="shrink-0 w-8 h-8 2k:w-10 2k:h-10 rounded-full bg-surface-variant/90 backdrop-blur
            text-on-surface flex items-center justify-center transition-all shadow-lg
            border border-white/20 hover:bg-primary hover:text-on-primary hover:scale-110
            disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-surface-variant/90
            disabled:hover:text-on-surface disabled:hover:scale-100"
        >
          <span className="material-symbols-outlined text-[20px] 2k:text-[24px]">
            chevron_left
          </span>
        </button>

        {/* Voice Grid — 6 ô linh hoạt */}
        {filteredVoices.length === 0 ? (
          <div className="flex-1 h-36 2k:h-44 flex items-center justify-center
            bg-surface-dim/50 rounded-xl border border-white/5">
            <p className="text-on-surface-variant text-sm 2k:text-base font-label-caps">
              Không tìm thấy giọng đọc nào
            </p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 2k:gap-4 min-w-0">
            {pagedVoices.map((voice, index) => {
              const isSelected = selectedVoiceId === voice.id;
              const isPinned = pinnedVoices?.includes(voice.id);
              const isPlaying = playingPreviewUrl === voice.url;

              return (
                <div
                  key={voice.id ?? index}
                  className="relative group h-36 2k:h-44 min-w-0"
                >
                  {/* Pin button */}
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onTogglePin(voice.id); }}
                      className={`w-6 h-6 2k:w-7 2k:h-7 rounded-full flex items-center justify-center transition-all ${
                        isPinned
                          ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                          : "text-primary/40 hover:text-primary/80 opacity-0 group-hover:opacity-100"
                      }`}
                      title={isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                    >
                      <span
                        className="material-symbols-outlined text-[15px] 2k:text-[17px]"
                        style={{ fontVariationSettings: isPinned ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  </div>

                  {/* Play preview button */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      type="button"
                      onClick={(e) => handlePlayPreview(voice.url, e)}
                      className="w-6 h-6 2k:w-7 2k:h-7 rounded-full bg-primary/20 backdrop-blur
                        text-primary flex items-center justify-center
                        hover:bg-primary hover:text-on-primary transition-colors
                        shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      title={isPlaying ? "Dừng phát" : "Nghe thử"}
                    >
                      <span
                        className="material-symbols-outlined text-[15px] 2k:text-[17px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {isPlaying ? "pause" : "play_arrow"}
                      </span>
                    </button>
                  </div>

                  {/* Voice card */}
                  <button
                    type="button"
                    onClick={() => onSelectVoice(voice.id)}
                    title={`${voice.name} - ${voice.description}`}
                    className={`w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 2k:p-3
                      rounded-xl bg-white/5 backdrop-blur-md transition-all duration-300 border min-w-0 overflow-hidden ${
                      isSelected
                        ? "border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-primary/10"
                        : "border-white/10 hover:border-primary/50 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-2xl 2k:text-3xl shrink-0 ${
                        isSelected ? "text-primary" : "text-on-surface-variant group-hover:text-primary"
                      }`}
                    >
                      {voice.icon}
                    </span>
                    <div className="text-center w-full px-0.5 min-w-0 overflow-hidden">
                      <p className="text-xs 2k:text-sm font-semibold text-on-surface truncate tracking-tight block">
                        {voice.name}
                      </p>
                      {voice.samples_count && voice.samples_count > 1 && (
                        <span className="inline-block text-[9px] px-1.5 py-[1px] rounded-full bg-primary/20 text-primary border border-primary/30 font-mono font-semibold mt-0.5">
                          {voice.samples_count} mẫu
                        </span>
                      )}
                      <p className="text-[10px] 2k:text-xs text-on-surface-variant/80 mt-0.5 truncate block">
                        {voice.description}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}

            {/* Ô trống để giữ đủ 6 cột khi < 6 kết quả */}
            {pagedVoices.length < CARDS_PER_PAGE &&
              Array.from({ length: CARDS_PER_PAGE - pagedVoices.length }).map((_, i) => (
                <div key={`empty-${i}`} className="h-36 2k:h-44 rounded-xl border border-dashed border-white/5 bg-white/[0.02] hidden sm:block" />
              ))
            }
          </div>
        )}


        {/* Right Arrow */}
        <button
          type="button"
          onClick={handleScrollRightArrow}
          disabled={currentPage >= totalPages - 1}
          className="shrink-0 w-8 h-8 2k:w-10 2k:h-10 rounded-full bg-surface-variant/90 backdrop-blur
            text-on-surface flex items-center justify-center transition-all shadow-lg
            border border-white/20 hover:bg-primary hover:text-on-primary hover:scale-110
            disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-surface-variant/90
            disabled:hover:text-on-surface disabled:hover:scale-100"
        >
          <span className="material-symbols-outlined text-[20px] 2k:text-[24px]">
            chevron_right
          </span>
        </button>
      </div>

      {/* Page indicator */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentPage(i)}
              className={`transition-all duration-300 rounded-full ${
                i === currentPage
                  ? "w-5 2k:w-6 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
