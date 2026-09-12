import React from "react";
import type { Project } from "../../store/useTTSStore";

interface ModelSettingsPanelProps {
  cfg_value: number;
  setCfgValue: (val: number) => void;
  speed: number;
  setSpeed: (val: number) => void;
  pitch: number;
  setPitch: (val: number) => void;
  audioFormat: "mp3" | "wav";
  setAudioFormat: (fmt: "mp3" | "wav") => void;
  enhanceAudio: boolean;
  setEnhanceAudio: (val: boolean) => void;
  selectedProjectId: string;
  setSelectedProjectId: (val: string) => void;
  projects: Project[];
  isLoading: boolean;
  onGenerate: () => void;
  onSaveConfig: () => void;
  configSaved: boolean;
}

export const ModelSettingsPanel: React.FC<ModelSettingsPanelProps> = ({
  cfg_value,
  setCfgValue,
  speed,
  setSpeed,
  pitch,
  setPitch,
  audioFormat,
  setAudioFormat,
  enhanceAudio,
  setEnhanceAudio,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  isLoading,
  onGenerate,
  onSaveConfig,
  configSaved,
}) => {
  return (
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
          onClick={onSaveConfig}
          title="Lưu CFG · Speed · Pitch · Format làm mặc định"
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-caps text-[11px] 2k:text-xs transition-all duration-300 border
            ${
              configSaved
                ? "bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                : "bg-white/5 hover:bg-primary/10 text-on-surface-variant hover:text-primary border-white/10 hover:border-primary/30"
            }`}
        >
          <span
            className={`material-symbols-outlined text-[14px] transition-all ${configSaved ? "scale-110" : ""}`}
          >
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
              type="button"
              className={`flex-1 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${audioFormat === "mp3" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
              onClick={() => setAudioFormat("mp3")}
            >
              .MP3 (Mặc định)
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 2k:py-2 rounded-md font-label-caps text-xs 2k:text-sm transition-all duration-300 ${audioFormat === "wav" ? "bg-primary/20 text-primary border border-primary/30 shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"}`}
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
            Độ bám sát văn bản. Mặc định 2.0. Sử dụng 2.5 cho code-switching (tiếng Anh xen tiếng Việt).
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
            Điều chỉnh tông giọng (bước âm - nửa cung). Tăng để giọng cao hơn, giảm để trầm hơn.
          </p>
        </div>

        {/* Studio Hi-Fi Vocal Enhancement */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-dim border border-white/10 hover:border-primary/30 transition-all shadow-inner">
          <div className="flex items-center justify-between">
            <label
              htmlFor="enhance-audio-toggle"
              className="font-label-caps text-xs 2k:text-sm text-on-surface flex items-center gap-2 cursor-pointer font-medium"
            >
              <span className="material-symbols-outlined text-primary text-[18px]">
                auto_fix_high
              </span>
              Bộ lọc Studio Hi-Fi (44.1kHz)
            </label>
            <button
              type="button"
              role="switch"
              id="enhance-audio-toggle"
              aria-checked={enhanceAudio}
              onClick={() => setEnhanceAudio(!enhanceAudio)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enhanceAudio ? "bg-primary" : "bg-white/15"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out ${
                  enhanceAudio
                    ? "translate-x-5 bg-black"
                    : "translate-x-0 bg-on-surface-variant"
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
            Cắt ù (Low-cut 75Hz), tăng độ sáng & âm xát (Air 9kHz), nén động học phát thanh và chuẩn hóa âm lượng.
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4 2k:mt-6">
        <button
          type="button"
          id="generate-btn"
          className={`w-full py-4 2k:py-5 px-6 2k:px-8 font-label-caps text-label-caps 2k:text-base rounded-xl 2k:rounded-2xl flex items-center justify-center gap-2 overflow-hidden relative group transition-all duration-300 shadow-[0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 ${isLoading ? "bg-surface-variant text-on-surface-variant cursor-not-allowed shadow-none hover:translate-y-0" : "bg-primary text-on-primary glow-button"}`}
          onClick={onGenerate}
          disabled={isLoading}
        >
          <span
            className={`relative z-10 flex items-center gap-2 text-sm 2k:text-base font-bold ${isLoading ? "hidden" : ""}`}
          >
            <span className="material-symbols-outlined 2k:text-2xl">
              play_arrow
            </span>
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
  );
};
