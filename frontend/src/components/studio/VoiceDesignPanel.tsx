import React, { useState } from "react";
import { DESIGN_PRESETS, type DesignPreset } from "../../constants/studio";

interface VoiceDesignPanelProps {
  instruct: string;
  onUpdateInstruct: (instruct: string) => void;
}

export const VoiceDesignPanel: React.FC<VoiceDesignPanelProps> = ({
  instruct,
  onUpdateInstruct,
}) => {
  const [designGender, setDesignGender] = useState<"female" | "male">("female");
  const [designAge, setDesignAge] = useState<
    "child" | "teenager" | "young adult" | "middle-aged" | "elderly"
  >("young adult");
  const [designPitch, setDesignPitch] = useState<
    | "very low pitch"
    | "low pitch"
    | "moderate pitch"
    | "high pitch"
    | "very high pitch"
  >("moderate pitch");
  const [designStyle, setDesignStyle] = useState<"normal" | "whisper">("normal");

  const buildInstruct = (
    g: "female" | "male",
    a: "child" | "teenager" | "young adult" | "middle-aged" | "elderly",
    p:
      | "very low pitch"
      | "low pitch"
      | "moderate pitch"
      | "high pitch"
      | "very high pitch",
    s: "normal" | "whisper",
  ) => {
    const parts: string[] = [g, a, p];
    if (s === "whisper") {
      parts.push("whisper");
    }
    const newInstruct = parts.join(", ");
    onUpdateInstruct(newInstruct);
  };

  const handleSelectDesignPreset = (preset: DesignPreset) => {
    setDesignGender(preset.gender);
    setDesignAge(preset.age);
    setDesignPitch(preset.pitch);
    setDesignStyle(preset.style);
    buildInstruct(preset.gender, preset.age, preset.pitch, preset.style);
  };

  return (
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
            <span className="material-symbols-outlined text-[15px] text-primary">
              wc
            </span>
            Giới tính (Gender)
          </label>
          <select
            value={designGender}
            onChange={(e) => {
              const val = e.target.value as "female" | "male";
              setDesignGender(val);
              buildInstruct(val, designAge, designPitch, designStyle);
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
            <span className="material-symbols-outlined text-[15px] text-primary">
              cake
            </span>
            Độ tuổi (Age)
          </label>
          <select
            value={designAge}
            onChange={(e) => {
              const val = e.target.value as any;
              setDesignAge(val);
              buildInstruct(designGender, val, designPitch, designStyle);
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
            <span className="material-symbols-outlined text-[15px] text-primary">
              graphic_eq
            </span>
            Tông giọng (Pitch)
          </label>
          <select
            value={designPitch}
            onChange={(e) => {
              const val = e.target.value as any;
              setDesignPitch(val);
              buildInstruct(designGender, designAge, val, designStyle);
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
            <span className="material-symbols-outlined text-[15px] text-primary">
              record_voice_over
            </span>
            Phong cách (Style)
          </label>
          <select
            value={designStyle}
            onChange={(e) => {
              const val = e.target.value as any;
              setDesignStyle(val);
              buildInstruct(designGender, designAge, designPitch, val);
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
          <span className="text-xs font-label-caps text-on-surface-variant">
            Lệnh sẽ áp dụng:
          </span>
          <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono-data text-xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">sell</span>
            {instruct ||
              `${designGender}, ${designAge}, ${designPitch}${designStyle === "whisper" ? ", whisper" : ""}`}
          </span>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-on-surface-variant font-label-caps mr-1">
            Mẫu nhanh:
          </span>
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
  );
};
