import { useTTSStore } from "../store/useTTSStore";
import { toast } from "sonner";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { downloadAudioFile } from "../utils/download";

export default function Studio() {
  const navigate = useNavigate();
  const {
    text,
    mode,
    instruct,
    cfg_value,
    seed,
    speed,
    pitch,
    isLoading,
    audioUrl,
    voices,
    selectedVoiceId,
    setText,
    setMode,
    setInstruct,
    setCfgValue,
    setSpeed,
    setPitch,
    setIsLoading,
    setAudioUrl,
    setAudioFormat,
    addHistory,
    fetchVoices,
    setSelectedVoiceId,
    pinnedVoices,
    togglePin,
    projects,
    history,
    setPendingVoiceForVideo,
  } = useTTSStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Lưu cấu hình mô hình vào localStorage ─────────────────────────────────
  const [configSaved, setConfigSaved] = useState(false);

  const saveModelConfig = useCallback(() => {
    const config = {
      cfg_value,
      speed,
      pitch,
      audioFormat: useTTSStore.getState().audioFormat,
    };
    localStorage.setItem("tts_model_config", JSON.stringify(config));
    setConfigSaved(true);
    toast.success(
      `Đã lưu cấu hình: CFG ${cfg_value.toFixed(1)} · Speed ${speed.toFixed(2)}x · Pitch ${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}`,
      { duration: 3000 },
    );
    setTimeout(() => setConfigSaved(false), 2000);
  }, [cfg_value, speed, pitch]);

  const NON_VERBAL_SYMBOLS = [
    { tag: "[laughter]", label: "Cười", emoji: "😄" },
    { tag: "[sigh]", label: "Thở dài", emoji: "😮‍💨" },
    { tag: "[surprise-ah]", label: "Ngạc nhiên (Ah)", emoji: "😲" },
    { tag: "[surprise-oh]", label: "Bất ngờ (Oh)", emoji: "😯" },
    { tag: "[dissatisfaction-hnn]", label: "Khó chịu", emoji: "😤" },
    { tag: "[question-ah]", label: "Nghi vấn (Ah)", emoji: "❓" },
  ];

  const DESIGN_PRESETS = [
    {
      label: "Nữ thanh niên trong trẻo",
      gender: "female" as const,
      age: "young adult" as const,
      pitch: "high pitch" as const,
      style: "normal" as const,
    },
    {
      label: "Nam trung niên trầm ấm",
      gender: "male" as const,
      age: "middle-aged" as const,
      pitch: "low pitch" as const,
      style: "normal" as const,
    },
    {
      label: "Nam thanh niên truyền cảm",
      gender: "male" as const,
      age: "young adult" as const,
      pitch: "moderate pitch" as const,
      style: "normal" as const,
    },
    {
      label: "Nữ thì thầm bí ẩn",
      gender: "female" as const,
      age: "young adult" as const,
      pitch: "moderate pitch" as const,
      style: "whisper" as const,
    },
    {
      label: "Bé gái đáng yêu",
      gender: "female" as const,
      age: "child" as const,
      pitch: "high pitch" as const,
      style: "normal" as const,
    },
    {
      label: "Cụ già chậm rãi",
      gender: "male" as const,
      age: "elderly" as const,
      pitch: "low pitch" as const,
      style: "normal" as const,
    },
  ];

  const handleInsertSymbol = (symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((text ? text + " " : "") + symbol);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const spacerBefore = before.length > 0 && !before.endsWith(" ") ? " " : "";
    const spacerAfter = after.length > 0 && !after.startsWith(" ") ? " " : " ";
    const newText = before + spacerBefore + symbol + spacerAfter + after;
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + spacerBefore.length + symbol.length + spacerAfter.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const carouselRef = useRef<HTMLDivElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [voiceType, setVoiceType] = useState<"all" | "preset" | "custom">(
    "all",
  );
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(
    null,
  );

  // Lưu trữ vị trí scroll ban đầu khi bắt đầu kéo
  const [startScrollLeft, setStartScrollLeft] = useState(0);

  // Thuộc tính thiết kế giọng nói (Voice Design Dropdowns)
  const [designGender, setDesignGender] = useState<"female" | "male">("female");
  const [designAge, setDesignAge] = useState<
    "child" | "teenager" | "young adult" | "middle-aged" | "elderly"
  >("young adult");
  const [designPitch, setDesignPitch] = useState<
    "very low pitch" | "low pitch" | "moderate pitch" | "high pitch" | "very high pitch"
  >("moderate pitch");
  const [designStyle, setDesignStyle] = useState<"normal" | "whisper">("normal");

  const updateDesignInstruct = (
    g: "female" | "male",
    a: "child" | "teenager" | "young adult" | "middle-aged" | "elderly",
    p: "very low pitch" | "low pitch" | "moderate pitch" | "high pitch" | "very high pitch",
    s: "normal" | "whisper",
  ) => {
    const parts: string[] = [g, a, p];
    if (s === "whisper") {
      parts.push("whisper");
    }
    const newInstruct = parts.join(", ");
    setInstruct(newInstruct);
  };

  const handleSelectDesignPreset = (preset: (typeof DESIGN_PRESETS)[0]) => {
    setDesignGender(preset.gender);
    setDesignAge(preset.age);
    setDesignPitch(preset.pitch);
    setDesignStyle(preset.style);
    updateDesignInstruct(preset.gender, preset.age, preset.pitch, preset.style);
  };

  useEffect(() => {
    fetchVoices();

    // Khởi tạo Audio instance cho việc preview
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
    const walk = (x - startX) * 1.5; // giảm hệ số kéo để mượt hơn
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
      previewAudioRef.current.play();
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
    if (filteredVoices.length > 0) {
      setSelectedVoiceId(filteredVoices[0].id);
    }
  }, [voices, gender, voiceType, pinnedVoices]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập văn bản cần đọc");
      return;
    }

    setIsLoading(true);
    setAudioUrl(null);

    const toastId = toast.loading("Đang khởi tạo mô hình...", {
      duration: 30000,
    });

    // Ước tính thời gian xử lý: khoảng 1.5s cho mỗi 50 ký tự (với 10 timesteps)
    setElapsedTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      const response = await fetch("http://localhost:8000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          mode,
          instruct: mode === "design" ? instruct : null,
          cfg_value,
          normalize: false,
          voice_id: mode === "clone" ? selectedVoiceId : null,
          seed,
          speed,
          pitch,
          format: useTTSStore.getState().audioFormat,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Lỗi kết nối đến máy chủ API");
      }

      const data = await response.json();

      // Hoàn thành tiến trình
      setAudioUrl(data.audio_url);

      addHistory({
        text,
        url: data.audio_url,
        projectId: selectedProjectId || undefined,
        voiceId: mode === "clone" ? selectedVoiceId : null,
        voiceName:
          mode === "clone"
            ? (voices.find((v) => v.id === selectedVoiceId)?.name || "Mặc định")
            : mode === "design"
            ? `Design: ${instruct.slice(0, 20) || "Tùy chỉnh"}`
            : "Tự động (Auto)",
        mode,
        instruct,
        cfg_value,
        seed,
        speed,
        pitch,
      });

      if (data.message && data.message.includes("Cache Hit")) {
        toast.success("Thành công! Tái sử dụng âm thanh từ Cache (0ms).", {
          id: toastId,
          icon: "⚡",
        });
      } else {
        toast.success("Thành công! Đã tạo giọng nói mới.", { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Thất bại: ${error.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div className="w-full max-w-7xl 2k:max-w-[1720px] mx-auto flex flex-col gap-6 md:gap-8 2k:gap-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 2k:gap-5 px-2">
        <div className="w-12 h-12 2k:w-16 2k:h-16 rounded-xl 2k:rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="material-symbols-outlined text-primary text-2xl 2k:text-3xl">
            graphic_eq
          </span>
        </div>
        <div>
          <h1 className="font-display text-headline-sm md:text-headline-md 2k:text-3xl 2k:font-bold text-on-surface tracking-tight">
            OmniVoice Studio
          </h1>
          <p className="text-on-surface-variant text-sm 2k:text-base mt-0.5">
            Tổng hợp giọng nói AI chất lượng cao 24kHz với mô hình OmniVoice (k2-fsa)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 2k:gap-10 items-start">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-6 2k:gap-8">
          <div className="glass-card rounded-2xl p-6 md:p-8 2k:p-10 flex flex-col gap-6 2k:gap-8 shadow-2xl border border-white/5 relative overflow-hidden">
            {/* Background decorative gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5 2k:pb-6 z-10">
              <div>
                <label className="font-label-caps text-xs 2k:text-sm text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] 2k:text-[20px] text-primary">
                    tune
                  </span>
                  Chế độ sinh giọng
                </label>
                <p className="text-xs 2k:text-sm text-on-surface-variant/60 mt-0.5">
                  Chọn giữa sao chép giọng mẫu hoặc tự thiết kế thuộc tính giọng nói
                </p>
              </div>

              <div className="inline-flex bg-surface-dim border border-white/10 rounded-xl p-1 2k:p-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode("clone")}
                  className={`px-3.5 2k:px-5 py-1.5 2k:py-2.5 rounded-lg font-label-caps text-xs 2k:text-sm flex items-center gap-1.5 2k:gap-2 transition-all duration-300 ${
                    mode === "clone"
                      ? "bg-primary text-black font-semibold shadow-md"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] 2k:text-[18px]">record_voice_over</span>
                  Voice Cloning
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("design");
                    if (!instruct || instruct.includes("gentle")) {
                      updateDesignInstruct(designGender, designAge, designPitch, designStyle);
                    }
                  }}
                  className={`px-3.5 2k:px-5 py-1.5 2k:py-2.5 rounded-lg font-label-caps text-xs 2k:text-sm flex items-center gap-1.5 2k:gap-2 transition-all duration-300 ${
                    mode === "design"
                      ? "bg-primary text-black font-semibold shadow-md"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] 2k:text-[18px]">auto_fix_high</span>
                  Voice Design
                </button>
              </div>
            </div>

            {/* Mode 1: Voice Cloning Carousel */}
            {mode === "clone" && (
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
                          className={`px-3 2k:px-4 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "all" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
                          onClick={() => setVoiceType("all")}
                        >
                          TẤT CẢ
                        </button>
                        <button
                          className={`px-3 2k:px-4 py-1 rounded font-label-caps text-[10px] 2k:text-xs transition-all duration-300 ${voiceType === "preset" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent"}`}
                          onClick={() => setVoiceType("preset")}
                        >
                          HỆ THỐNG
                        </button>
                        <button
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
                        className={`px-4 2k:px-5 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${!gender || gender === "all" ? "bg-[#FFB74D] text-black shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
                        onClick={() => setGender("all")}
                      >
                        Tất cả
                      </button>
                      <button
                        className={`px-4 2k:px-5 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${gender === "male" ? "bg-[#FFB74D] text-black shadow-md" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
                        onClick={() => setGender("male")}
                      >
                        Nam
                      </button>
                      <button
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
                    filteredVoices.map((voice, index) => (
                      <div
                        key={index}
                        className="snap-start shrink-0 w-36 2k:w-44 h-40 2k:h-48 relative group"
                      >
                        <div className="absolute top-2 left-2 opacity-100 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(voice.id);
                            }}
                            className={`w-7 h-7 2k:w-8 2k:h-8 rounded-full flex items-center justify-center transition-all ${pinnedVoices?.includes(voice.id) ? "text-primary bg-primary/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "text-primary/40 hover:text-primary/80 opacity-0 group-hover:opacity-100"}`}
                            title={
                              pinnedVoices?.includes(voice.id)
                                ? "Bỏ ghim"
                                : "Ghim lên đầu"
                            }
                          >
                            <span
                              className="material-symbols-outlined text-[16px] 2k:text-[18px]"
                              style={{
                                fontVariationSettings: pinnedVoices?.includes(
                                  voice.id,
                                )
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
                            onClick={(e) => handlePlayPreview(voice.url, e)}
                            className="w-7 h-7 2k:w-8 2k:h-8 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                            title={
                              playingPreviewUrl === voice.url
                                ? "Dừng phát"
                                : "Nghe thử"
                            }
                          >
                            <span
                              className="material-symbols-outlined text-[16px] 2k:text-[18px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {playingPreviewUrl === voice.url
                                ? "pause"
                                : "play_arrow"}
                            </span>
                          </button>
                        </div>
                        <button
                          onClick={() => setSelectedVoiceId(voice.id)}
                          className={`w-full h-full flex flex-col items-center justify-center gap-2 p-3 2k:p-4 rounded-xl bg-white/5 backdrop-blur-md transition-all duration-300 relative top-[1px] border ${selectedVoiceId === voice.id ? "border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-primary/10" : "border-white/10 hover:border-primary/50 hover:bg-white/10"}`}
                        >
                          <span
                            className={`material-symbols-outlined text-3xl 2k:text-4xl ${selectedVoiceId === voice.id ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
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
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: Voice Design (Dropdown Selectors) */}
            {mode === "design" && (
              <div className="flex flex-col gap-4 p-5 2k:p-6 rounded-xl bg-surface-dim/70 border border-white/10 z-10 animate-in fade-in duration-300">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <label className="font-label-caps text-xs 2k:text-sm text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                    Thiết kế thuộc tính giọng nói (Voice Attributes)
                  </label>
                  <span className="text-[11px] 2k:text-xs text-on-surface-variant font-mono-data">
                    OmniVoice Standard Tags
                  </span>
                </div>

                {/* 4 Dropdowns Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 2k:gap-4">
                  {/* Dropdown 1: Giới tính */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[11px] 2k:text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">wc</span>
                      Giới tính (Gender)
                    </label>
                    <select
                      value={designGender}
                      onChange={(e) => {
                        const val = e.target.value as "female" | "male";
                        setDesignGender(val);
                        updateDesignInstruct(val, designAge, designPitch, designStyle);
                      }}
                      className="bg-surface-variant/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer font-body-md"
                    >
                      <option value="female">Nữ (Female)</option>
                      <option value="male">Nam (Male)</option>
                    </select>
                  </div>

                  {/* Dropdown 2: Độ tuổi */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[11px] 2k:text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">cake</span>
                      Độ tuổi (Age)
                    </label>
                    <select
                      value={designAge}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setDesignAge(val);
                        updateDesignInstruct(designGender, val, designPitch, designStyle);
                      }}
                      className="bg-surface-variant/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer font-body-md"
                    >
                      <option value="young adult">Thanh niên (18-35 tuổi)</option>
                      <option value="middle-aged">Trung niên (35-60 tuổi)</option>
                      <option value="teenager">Thiếu niên (13-18 tuổi)</option>
                      <option value="child">Trẻ em (Dưới 12 tuổi)</option>
                      <option value="elderly">Người cao tuổi (&gt; 60 tuổi)</option>
                    </select>
                  </div>

                  {/* Dropdown 3: Tông giọng */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[11px] 2k:text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">graphic_eq</span>
                      Tông giọng (Pitch)
                    </label>
                    <select
                      value={designPitch}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setDesignPitch(val);
                        updateDesignInstruct(designGender, designAge, val, designStyle);
                      }}
                      className="bg-surface-variant/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer font-body-md"
                    >
                      <option value="moderate pitch">Vừa phải / Tự nhiên</option>
                      <option value="low pitch">Trầm ấm</option>
                      <option value="very low pitch">Rất trầm</option>
                      <option value="high pitch">Cao / Trong trẻo</option>
                      <option value="very high pitch">Rất cao</option>
                    </select>
                  </div>

                  {/* Dropdown 4: Phong cách */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[11px] 2k:text-xs text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-primary">record_voice_over</span>
                      Phong cách (Style)
                    </label>
                    <select
                      value={designStyle}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setDesignStyle(val);
                        updateDesignInstruct(designGender, designAge, designPitch, val);
                      }}
                      className="bg-surface-variant/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer font-body-md"
                    >
                      <option value="normal">Bình thường (Tiêu chuẩn)</option>
                      <option value="whisper">Thì thầm bí ẩn (Whisper)</option>
                    </select>
                  </div>
                </div>

                {/* Preview Selected Tags & Presets */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-label-caps text-on-surface-variant">Lệnh sẽ áp dụng:</span>
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono-data text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">sell</span>
                      {instruct || `${designGender}, ${designAge}, ${designPitch}${designStyle === "whisper" ? ", whisper" : ""}`}
                    </span>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-on-surface-variant font-label-caps mr-1">Mẫu nhanh:</span>
                    {DESIGN_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectDesignPreset(preset)}
                        className="px-2.5 py-1 rounded-md text-xs font-label-caps bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/5 hover:border-primary/30 transition-all text-on-surface-variant"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* Input section */}
            <div className="flex flex-col gap-3 2k:gap-4 z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  className="font-label-caps text-label-caps 2k:text-sm text-on-surface-variant flex items-center gap-2"
                  htmlFor="script-input"
                >
                  <span className="material-symbols-outlined text-[18px] 2k:text-[20px]">
                    edit_document
                  </span>
                  Văn bản đầu vào
                </label>

                {/* Non-verbal symbols toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 2k:gap-2">
                  <span className="text-[11px] 2k:text-xs font-label-caps text-on-surface-variant/70 mr-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] 2k:text-[16px] text-primary">sentiment_satisfied</span>
                    Thẻ biểu cảm:
                  </span>
                  {NON_VERBAL_SYMBOLS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleInsertSymbol(s.tag)}
                      className="px-2 2k:px-3 py-0.5 2k:py-1 rounded-md 2k:rounded-lg text-[11px] 2k:text-xs font-label-caps bg-surface-dim hover:bg-primary/20 text-on-surface hover:text-primary border border-white/10 hover:border-primary/30 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      title={`Chèn thẻ ${s.tag}`}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                id="script-input"
                className="w-full h-56 2k:h-72 bg-surface-dim/80 backdrop-blur border border-white/10 rounded-xl 2k:rounded-2xl p-5 2k:p-6 text-on-surface text-sm 2k:text-base 2k:leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-on-surface-variant/50 font-body-md shadow-inner"
                placeholder="Nhập nội dung cần chuyển thành giọng nói tại đây... (Hỗ trợ tiếng Việt và các thẻ cảm xúc như [laughter], [sigh])"
                value={text}
                onChange={(e) => setText(e.target.value)}
              ></textarea>
              <div className="flex justify-between items-center mt-1 px-1">
                <div className="flex gap-2">
                  <span className="inline-flex items-center rounded-md bg-secondary/10 px-2.5 2k:px-3 py-1 2k:py-1.5 font-label-caps text-[10px] 2k:text-xs uppercase text-secondary ring-1 ring-inset ring-secondary/20">
                    600+ Ngôn ngữ
                  </span>
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 2k:px-3 py-1 2k:py-1.5 font-label-caps text-[10px] 2k:text-xs uppercase text-primary ring-1 ring-inset ring-primary/20">
                    OmniVoice 24kHz
                  </span>
                </div>
                <span
                  className={`font-mono-data text-mono-data text-xs 2k:text-sm ${text.length > 4500 ? "text-error" : "text-on-surface-variant"}`}
                >
                  {text.length} / 5000 chars
                </span>
              </div>
              {isLoading && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in zoom-in-95 bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-label-caps text-primary flex items-center gap-3">
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        progress_activity
                      </span>
                      Đang xử lý âm thanh...
                    </span>
                    <div className="flex items-center gap-2 bg-surface-dim px-3 py-1.5 rounded-lg border border-primary/20">
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        timer
                      </span>
                      <span className="text-sm font-mono-data text-primary">
                        {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:
                        {String(elapsedTime % 60).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Output Area (in-place) */}
            {audioUrl && (
              <div className="flex flex-col gap-4 bg-primary/5 p-5 rounded-xl border border-primary/20 animate-in slide-in-from-bottom-4 fade-in duration-500 shadow-[0_0_20px_rgba(245,158,11,0.05)] mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      headphones
                    </span>
                    Âm thanh đầu ra
                  </span>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-surface-dim px-2 py-1 rounded border border-white/10 text-on-surface-variant font-mono-data text-[10px]">
                      <span className="material-symbols-outlined text-[14px]">
                        timer
                      </span>
                      {String(Math.floor(elapsedTime / 60)).padStart(2, "0")}:
                      {String(elapsedTime % 60).padStart(2, "0")}
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (!audioUrl) return;
                        const latestRecord = history[0] || {
                          id: `voice_${Date.now()}`,
                          text,
                          url: audioUrl,
                          timestamp: Date.now(),
                          voiceName: voices.find((v) => v.id === selectedVoiceId)?.name || "Giọng đọc mới",
                        };
                        setPendingVoiceForVideo(latestRecord);
                        toast.success("Đang chuyển sang Video Studio với giọng đọc này!");
                        navigate("/autocaption");
                      }}
                      className="px-3.5 py-1.5 bg-primary/20 hover:bg-primary hover:text-black text-primary border border-primary/40 rounded-md font-label-caps text-xs transition-all shadow-sm flex items-center gap-1.5 font-semibold group"
                      title="Chuyển sang làm video với giọng đọc này trong Auto Caption Studio"
                    >
                      <span className="material-symbols-outlined text-[16px] group-hover:rotate-6 transition-transform">
                        movie_edit
                      </span>
                      LÀM VIDEO NGAY
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (!audioUrl) return;
                        const filename =
                          audioUrl.split("/").pop() ||
                          `audio.${useTTSStore.getState().audioFormat}`;
                        downloadAudioFile(audioUrl, filename);
                      }}
                      className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface border border-white/10 rounded-md font-label-caps text-xs transition-colors shadow-sm flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        download
                      </span>
                      TẢI VỀ
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <audio
                    src={audioUrl}
                    controls
                    className="w-full h-10 outline-none"
                    autoPlay
                    style={{ colorScheme: "dark" }}
                  ></audio>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings Sidebar */}
        {/* Right Column: Settings */}
        <div className="lg:col-span-4 flex flex-col gap-6 2k:gap-8 sticky top-6">
          <div className="glass-card rounded-2xl p-6 2k:p-8 shadow-2xl border border-white/5 flex flex-col gap-8 2k:gap-9 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none"></div>

            <div className="flex items-center gap-2 border-b border-white/5 pb-4 2k:pb-5">
              <span className="material-symbols-outlined text-primary text-[20px] 2k:text-[24px]">
                tune
              </span>
              <h3 className="font-label-caps text-label-caps 2k:text-base text-on-surface">
                Cài đặt mô hình
              </h3>
              {/* Nút Lưu cấu hình */}
              <button
                type="button"
                onClick={saveModelConfig}
                title="Lưu CFG · Speed · Pitch · Format làm mặc định"
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-caps text-[11px] 2k:text-xs transition-all duration-300 border
                  ${configSaved
                    ? "bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                    : "bg-white/5 hover:bg-primary/10 text-on-surface-variant hover:text-primary border-white/10 hover:border-primary/30"
                  }`}
              >
                <span className={`material-symbols-outlined text-[14px] transition-all ${configSaved ? "scale-110" : ""}`}>
                  {configSaved ? "bookmark_added" : "bookmark"}
                </span>
                {configSaved ? "Đã lưu!" : "Lưu cấu hình"}
              </button>
            </div>

            <div className="flex flex-col gap-7 2k:gap-8">
              {/* Project Selection */}
              <div className="flex flex-col gap-3 2k:gap-3.5">
                <label className="font-label-caps text-sm 2k:text-base text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] 2k:text-[18px]">
                    workspaces
                  </span>
                  Lưu vào dự án
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-surface-dim border border-white/5 rounded-lg px-4 py-2.5 2k:py-3 text-sm 2k:text-base text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md w-full cursor-pointer"
                >
                  <option value="">-- Thư viện chung --</option>
                  {projects.map((p, index) => (
                    <option key={index} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Selection */}
              <div className="flex flex-col gap-3 2k:gap-3.5">
                <label className="font-label-caps text-sm 2k:text-base text-on-surface-variant flex items-center gap-2">
                  Định dạng tải về
                </label>
                <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-1 w-full shadow-inner">
                  <button
                    className={`flex-1 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${useTTSStore.getState().audioFormat === "mp3" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
                    onClick={() => setAudioFormat("mp3")}
                  >
                    .MP3 (Mặc định)
                  </button>
                  <button
                    className={`flex-1 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${useTTSStore.getState().audioFormat === "wav" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
                    onClick={() => setAudioFormat("wav")}
                  >
                    .WAV
                  </button>
                </div>
              </div>

              {/* CFG Scale */}
              <div className="flex flex-col gap-3 2k:gap-3.5">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-caps text-sm 2k:text-base text-on-surface-variant flex items-center gap-2"
                    htmlFor="cfg-scale"
                  >
                    Tỉ lệ hướng dẫn (CFG)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 2k:px-3 py-0.5 2k:py-1 rounded border border-primary/20 shadow-inner text-sm 2k:text-base">
                    {cfg_value.toFixed(1)}
                  </span>
                </div>
                <input
                  className="w-full accent-primary"
                  id="cfg-scale"
                  max="3.0"
                  min="1.0"
                  step="0.1"
                  type="range"
                  value={cfg_value}
                  onChange={(e) => setCfgValue(parseFloat(e.target.value))}
                />
                <p className="text-[11px] 2k:text-xs text-on-surface-variant/70 leading-relaxed">
                  Độ bám sát văn bản. Mặc định 2.0. Sử dụng 2.5 cho
                  code-switching (tiếng Anh xen tiếng Việt).
                </p>
              </div>


              {/* Speed */}
              <div className="flex flex-col gap-3 2k:gap-3.5">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-caps text-sm 2k:text-base text-on-surface-variant flex items-center gap-2"
                    htmlFor="speed"
                  >
                    Tốc độ (Speed)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 2k:px-3 py-0.5 2k:py-1 rounded border border-primary/20 shadow-inner text-sm 2k:text-base">
                    {speed.toFixed(2)}x
                  </span>
                </div>
                <input
                  className="w-full accent-primary"
                  id="speed"
                  max="2.0"
                  min="0.5"
                  step="0.05"
                  type="range"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
                <p className="text-[11px] 2k:text-xs text-on-surface-variant/70 leading-relaxed">
                  Tốc độ phát (0.5x - 2.0x). 1.0x là tốc độ bình thường.
                </p>
              </div>

              {/* Pitch */}
              <div className="flex flex-col gap-3 2k:gap-3.5">
                <div className="flex justify-between items-center">
                  <label
                    className="font-label-caps text-sm 2k:text-base text-on-surface-variant flex items-center gap-2"
                    htmlFor="pitch"
                  >
                    Cao độ (Pitch)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 2k:px-3 py-0.5 2k:py-1 rounded border border-primary/20 shadow-inner text-sm 2k:text-base">
                    {pitch > 0 ? "+" : ""}
                    {pitch.toFixed(1)}
                  </span>
                </div>
                <input
                  className="w-full accent-primary"
                  id="pitch"
                  max="12.0"
                  min="-12.0"
                  step="0.5"
                  type="range"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                />
                <p className="text-[11px] 2k:text-xs text-on-surface-variant/70 leading-relaxed">
                  Điều chỉnh tông giọng (bước âm - nửa cung). Tăng để giọng cao
                  hơn, giảm để trầm hơn.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-4 2k:mt-6">
              <button
                id="generate-btn"
                className={`w-full py-4 2k:py-5 px-6 2k:px-8 font-label-caps text-label-caps 2k:text-base rounded-xl 2k:rounded-2xl flex items-center justify-center gap-2 overflow-hidden relative group transition-all duration-300 shadow-[0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 ${isLoading ? "bg-surface-variant text-on-surface-variant cursor-not-allowed shadow-none hover:translate-y-0" : "bg-primary text-on-primary glow-button"}`}
                onClick={handleGenerate}
                disabled={isLoading}
              >
                <span
                  className={`relative z-10 flex items-center gap-2 text-sm 2k:text-base font-bold ${isLoading ? "hidden" : ""}`}
                >
                  <span className="material-symbols-outlined 2k:text-2xl">play_arrow</span>
                  BẮT ĐẦU TỔNG HỢP
                </span>
                <div
                  className={`relative z-10 flex items-center gap-2 text-sm 2k:text-base ${isLoading ? "" : "hidden"}`}
                >
                  <span className="material-symbols-outlined animate-spin 2k:text-2xl">
                    sync
                  </span>
                  ĐANG XỬ LÝ...
                </div>
                {!isLoading && (
                  <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
