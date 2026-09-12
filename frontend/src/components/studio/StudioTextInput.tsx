import React from "react";
import { NON_VERBAL_SYMBOLS } from "../../constants/studio";
import type { PauseSettings, PronunciationWord } from "../../store/useTTSStore";

interface StudioTextInputProps {
  text: string;
  onChangeText: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onOpenPauseModal: () => void;
  onOpenPronunciationModal: () => void;
  pauseSettings: PauseSettings;
  pronunciationWords: PronunciationWord[];
  isLoading: boolean;
  elapsedTime: number;
  generationProgress: { current: number; total: number };
}

export const StudioTextInput: React.FC<StudioTextInputProps> = ({
  text,
  onChangeText,
  textareaRef,
  onOpenPauseModal,
  onOpenPronunciationModal,
  pauseSettings,
  pronunciationWords,
  isLoading,
  elapsedTime,
  generationProgress,
}) => {
  const handleInsertSymbol = (symbol: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChangeText((text ? text + " " : "") + symbol);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const spacerBefore = before.length > 0 && !before.endsWith(" ") ? " " : "";
    const spacerAfter = after.length > 0 && !after.startsWith(" ") ? " " : " ";
    const newText = before + spacerBefore + symbol + spacerAfter + after;
    onChangeText(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos =
        start + spacerBefore.length + symbol.length + spacerAfter.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const activePronunciationCount = pronunciationWords.filter(
    (w) => w.enabled,
  ).length;

  return (
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

        {/* Action toolbars: Pause settings & Emotion tags */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút Thiết lập ngắt nghỉ */}
          <button
            type="button"
            onClick={onOpenPauseModal}
            className="px-2.5 2k:px-3 py-1 rounded-lg text-[11px] 2k:text-xs font-label-caps bg-surface-dim hover:bg-primary/20 text-on-surface hover:text-primary border border-white/10 hover:border-primary/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 group"
            title="Thiết lập ngắt nghỉ: Dấu chấm, Dấu phẩy, Dấu chấm phẩy, Xuống dòng"
          >
            <span className="material-symbols-outlined text-primary text-[17px] group-hover:scale-110 transition-transform">
              format_quote
            </span>
            <span className="font-semibold">Thiết lập ngắt nghỉ</span>
            <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded text-[10px] font-mono-data border border-primary/20">
              .{pauseSettings.period}s | ↵{pauseSettings.newline}s
            </span>
          </button>

          {/* Nút Cách đọc */}
          <button
            type="button"
            onClick={onOpenPronunciationModal}
            className="px-2.5 2k:px-3 py-1 rounded-lg text-[11px] 2k:text-xs font-label-caps bg-surface-dim hover:bg-primary/20 text-on-surface hover:text-primary border border-white/10 hover:border-primary/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 group"
            title="Từ điển phát âm: Thiết lập cách đọc từ viết tắt, từ nước ngoài, số, v.v."
          >
            <span className="material-symbols-outlined text-primary text-[17px] group-hover:scale-110 transition-transform">
              record_voice_over
            </span>
            <span className="font-semibold">Cách đọc</span>
            {activePronunciationCount > 0 && (
              <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded text-[10px] font-mono-data border border-primary/20">
                {activePronunciationCount}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>

          {/* Non-verbal symbols toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 2k:gap-2">
            <span className="text-[11px] 2k:text-xs font-label-caps text-on-surface-variant/70 mr-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] 2k:text-[16px] text-primary">
                sentiment_satisfied
              </span>
              Biểu cảm:
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
      </div>

      <textarea
        ref={textareaRef as any}
        id="script-input"
        className="w-full h-56 2k:h-72 bg-surface-dim/80 backdrop-blur border border-white/10 rounded-xl 2k:rounded-2xl p-5 2k:p-6 text-on-surface text-sm 2k:text-base 2k:leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-on-surface-variant/50 font-body-md shadow-inner"
        placeholder="Nhập nội dung cần chuyển thành giọng nói tại đây... (Hỗ trợ tiếng Việt và các thẻ cảm xúc như [laughter], [sigh])"
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
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
              {generationProgress.total > 1
                ? `Đang tổng hợp phân đoạn (${generationProgress.current}/${generationProgress.total})...`
                : "Đang xử lý âm thanh..."}
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
  );
};
