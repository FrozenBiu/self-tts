import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTTSStore, DEFAULT_PAUSE_SETTINGS, type PauseSettings } from "../store/useTTSStore";

interface PauseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StepperItemProps {
  label: string;
  symbol: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}

const StepperItem: React.FC<StepperItemProps> = ({
  label,
  symbol,
  value,
  min = 0.05,
  max = 5.0,
  step = 0.05,
  onChange,
}) => {
  const handleDecrement = () => {
    const next = Math.max(min, Math.round((value - step) * 100) / 100);
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, Math.round((value + step) * 100) / 100);
    onChange(next);
  };

  return (
    <div className="flex items-center justify-between gap-6 py-1">
      {/* Label & Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <span className="text-sm sm:text-[15px] font-body-md text-on-surface font-medium whitespace-nowrap">
          {label}
        </span>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-dim border border-white/15 text-primary text-xs font-mono-data font-bold shadow-sm">
          {symbol}
        </span>
      </div>

      {/* Stepper control */}
      <div className="flex items-center h-10 sm:h-11 border border-white/20 rounded-xl overflow-hidden bg-surface-dim/80 shadow-inner">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="w-11 sm:w-12 h-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-20 disabled:pointer-events-none transition-colors border-r border-white/15"
          title="Giảm thời gian nghỉ"
        >
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>

        <span className="w-24 sm:w-28 text-center font-mono-data text-sm sm:text-[15px] font-bold text-[#FFB74D] tracking-wider select-none px-2">
          {value.toFixed(2)}s
        </span>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="w-11 sm:w-12 h-full flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 active:bg-white/20 disabled:opacity-20 disabled:pointer-events-none transition-colors border-l border-white/15"
          title="Tăng thời gian nghỉ"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>
    </div>
  );
};

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({ isOpen, onClose }) => {
  const { pauseSettings, setPauseSettings, resetPauseSettings } = useTTSStore();
  const [localSettings, setLocalSettings] = useState<PauseSettings>(pauseSettings);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(pauseSettings);
    }
  }, [isOpen, pauseSettings]);

  if (!isOpen) return null;

  const handleSave = () => {
    setPauseSettings(localSettings);
    toast.success("Đã lưu thiết lập ngắt nghỉ giọng đọc!");
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_PAUSE_SETTINGS);
    resetPauseSettings();
    toast.info("Đã đặt lại thời gian ngắt nghỉ về mặc định.");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl lg:max-w-4xl bg-surface-variant/95 border border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-10 py-5 sm:py-6 border-b border-white/10 bg-surface-dim/50">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#FFB74D] text-[26px]">
              format_quote
            </span>
            <h3 className="text-lg sm:text-xl font-headline-sm font-bold text-on-surface tracking-tight">
              Thiết lập ngắt nghỉ
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Content Body - Bố cục 2 cột thoáng rộng theo đúng tỉ lệ */}
        <div className="px-6 sm:px-10 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-6 sm:gap-y-8">
            {/* Cột trái: Dấu chấm & Dấu chấm phẩy */}
            <div className="flex flex-col gap-6 sm:gap-7">
              <StepperItem
                label="Dấu chấm"
                symbol="•"
                value={localSettings.period}
                onChange={(val) => setLocalSettings((prev) => ({ ...prev, period: val }))}
              />

              <StepperItem
                label="Dấu chấm phẩy"
                symbol=";"
                value={localSettings.semicolon}
                onChange={(val) => setLocalSettings((prev) => ({ ...prev, semicolon: val }))}
              />
            </div>

            {/* Cột phải: Dấu phẩy & Xuống dòng */}
            <div className="flex flex-col gap-6 sm:gap-7">
              <StepperItem
                label="Dấu phẩy"
                symbol=","
                value={localSettings.comma}
                onChange={(val) => setLocalSettings((prev) => ({ ...prev, comma: val }))}
              />

              <StepperItem
                label="Xuống dòng"
                symbol="≡"
                value={localSettings.newline}
                max={10.0}
                onChange={(val) => setLocalSettings((prev) => ({ ...prev, newline: val }))}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-4 px-6 sm:px-10 py-5 border-t border-white/10 bg-surface-dim/60">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-label-caps font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/10 border border-white/15 transition-all active:scale-95"
          >
            Đặt mặc định
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-8 py-2.5 rounded-xl text-xs sm:text-sm font-label-caps font-bold bg-[#FFB74D] hover:bg-[#FFA726] text-black shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};
