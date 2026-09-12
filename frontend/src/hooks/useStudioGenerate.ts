import { useState, useRef } from "react";
import { toast } from "sonner";

import { useTTSStore, applyPronunciationDictionary, type ScriptBlock } from "../store/useTTSStore";
import { API_BASE_URL } from "../constants/api";

interface ParsedSentence {
  text: string;
  pauseAfter: number;
}

interface GenerateOptions {
  saveStudioBlocks: (blocks: ScriptBlock[]) => void;
  setGenerationProgress: (progress: { current: number; total: number }) => void;
}

export function useStudioGenerate() {
  const {
    text,
    mode,
    instruct,
    cfg_value,
    seed,
    pauseSettings,
    speed,
    pitch,
    isLoading,
    enhanceAudio,
    selectedVoiceId,
    voices,
    pronunciationWords,
    setIsLoading,
    setAudioUrl,
    addHistory,
  } = useTTSStore();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ── Phân tích câu với thông tin ngắt nghỉ ─────────────────────────────
  const splitIntoSentencesWithPause = (input: string): ParsedSentence[] => {
    const trimmed = input.trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\r?\n+/);
    const result: ParsedSentence[] = [];

    lines.forEach((line, lineIdx) => {
      const lineTrimmed = line.trim();
      if (!lineTrimmed) return;

      const isLastLine = lineIdx === lines.length - 1;
      const parts = lineTrimmed.match(/[^.!?…;]+[.!?…;]*|\S+/g);
      if (!parts || parts.length === 0) {
        result.push({
          text: lineTrimmed,
          pauseAfter: isLastLine ? pauseSettings.period : pauseSettings.newline,
        });
        return;
      }

      parts.forEach((p, pIdx) => {
        const seg = p.trim();
        if (!seg) return;
        const isLastInLine = pIdx === parts.length - 1;

        let pause = pauseSettings.period;
        if (isLastInLine && !isLastLine) {
          pause = pauseSettings.newline;
        } else if (seg.endsWith(";")) {
          pause = pauseSettings.semicolon;
        } else {
          pause = pauseSettings.period;
        }

        result.push({ text: seg, pauseAfter: pause });
      });
    });

    return result.length > 0
      ? result
      : [{ text: trimmed, pauseAfter: pauseSettings.period }];
  };

  // ── Generate chính ───────────────────────────────────────────────────────
  const handleGenerate = async (
    selectedProjectId: string,
    { saveStudioBlocks, setGenerationProgress: setProgress }: GenerateOptions,
  ) => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập văn bản cần đọc");
      return;
    }

    setIsLoading(true);
    setAudioUrl(null);

    const toastId = toast.loading("Đang khởi tạo mô hình...", { duration: 30000 });

    setElapsedTime(0);
    cleanupTimer();
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      const processedText = applyPronunciationDictionary(text, pronunciationWords);
      const sentences = splitIntoSentencesWithPause(processedText);

      // ── Single sentence mode ─────────────────────────────────────────────
      if (sentences.length <= 1) {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sentences[0]?.text || processedText,
            mode,
            instruct: mode === "design" ? instruct : null,
            cfg_value,
            normalize: false,
            voice_id: mode === "clone" ? selectedVoiceId : null,
            seed,
            speed,
            pitch,
            format: useTTSStore.getState().audioFormat,
            enhance_audio: enhanceAudio,
            engine: "omnivoice",
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || "Lỗi kết nối đến máy chủ API");
        }

        const data = await response.json();
        setAudioUrl(data.audio_url);

        const singleBlock: ScriptBlock = {
          id: "seg_" + Math.random().toString(36).substring(2, 9),
          text: text.trim(),
          voiceId: mode === "clone" ? selectedVoiceId : null,
          voiceName:
            mode === "clone"
              ? voices.find((v) => v.id === selectedVoiceId)?.name || "Mặc định"
              : "Voice Design",
          speed,
          pitch,
          pauseAfter: sentences[0]?.pauseAfter || pauseSettings.period,
          status: "ready",
          audioUrl: data.audio_url,
          filename: data.filename,
        };
        saveStudioBlocks([singleBlock]);

        addHistory({
          text,
          url: data.audio_url,
          projectId: selectedProjectId || undefined,
          voiceId: mode === "clone" ? selectedVoiceId : null,
          voiceName:
            mode === "clone"
              ? voices.find((v) => v.id === selectedVoiceId)?.name || "Mặc định"
              : mode === "design"
                ? `Design: ${instruct.slice(0, 20) || "Tùy chỉnh"}`
                : "Tự động (Auto)",
          mode,
          instruct,
          cfg_value,
          seed,
          speed,
          pitch,
          engine: "omnivoice",
        });

        toast.success("Thành công! Đã tạo âm thanh mới.", { id: toastId });
      } else {
        // ── Batch (multi-sentence) mode ────────────────────────────────────
        toast.loading(`Đang xử lý ${sentences.length} phân đoạn câu...`, { id: toastId });

        const newBlocks: ScriptBlock[] = sentences.map((s, idx) => ({
          id: `seg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          text: s.text,
          voiceId: mode === "clone" ? selectedVoiceId : null,
          voiceName:
            mode === "clone"
              ? voices.find((v) => v.id === selectedVoiceId)?.name || "Mặc định"
              : "Voice Design",
          speed,
          pitch,
          pauseAfter: s.pauseAfter,
          status: "rendering",
        }));
        saveStudioBlocks(newBlocks);
        setProgress({ current: 0, total: sentences.length });
        setGenerationProgress({ current: 0, total: sentences.length });

        let completedBlocks: ScriptBlock[] = [...newBlocks];

        for (let i = 0; i < sentences.length; i++) {
          setProgress({ current: i + 1, total: sentences.length });
          setGenerationProgress({ current: i + 1, total: sentences.length });

          try {
            const res = await fetch(`${API_BASE_URL}/api/tts`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: sentences[i].text,
                mode,
                instruct: mode === "design" ? instruct : null,
                cfg_value,
                normalize: false,
                voice_id: mode === "clone" ? selectedVoiceId : null,
                seed,
                speed,
                pitch,
                format: useTTSStore.getState().audioFormat || "mp3",
                enhance_audio: enhanceAudio,
                engine: "omnivoice",
              }),
            });

            if (res.ok) {
              const bData = await res.json();
              completedBlocks = completedBlocks.map((b, bIdx) =>
                bIdx === i
                  ? { ...b, status: "ready" as const, audioUrl: bData.audio_url, filename: bData.filename }
                  : b,
              );
            } else {
              completedBlocks = completedBlocks.map((b, bIdx) =>
                bIdx === i ? { ...b, status: "error" as const, error: "Lỗi render" } : b,
              );
            }
          } catch (e: any) {
            completedBlocks = completedBlocks.map((b, bIdx) =>
              bIdx === i ? { ...b, status: "error" as const, error: e.message } : b,
            );
          }

          saveStudioBlocks(completedBlocks);
        }

        const readyBlocks = completedBlocks.filter(
          (b) => b.status === "ready" && (b.filename || b.audioUrl),
        );

        if (readyBlocks.length > 0) {
          const stitchRes = await fetch(`${API_BASE_URL}/api/tts/stitch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocks: readyBlocks.map((b) => ({
                filename: b.filename || b.audioUrl!.split("/").pop()!,
                pause_after:
                  typeof b.pauseAfter === "number" ? b.pauseAfter : pauseSettings.period,
                text: b.text,
              })),
              format: useTTSStore.getState().audioFormat || "mp3",
              project_name: "Studio_Master",
            }),
          });

          if (stitchRes.ok) {
            const stitchData = await stitchRes.json();
            setAudioUrl(stitchData.audio_url);

            addHistory({
              text,
              url: stitchData.audio_url,
              projectId: selectedProjectId || undefined,
              voiceId: mode === "clone" ? selectedVoiceId : null,
              voiceName:
                mode === "clone"
                  ? voices.find((v) => v.id === selectedVoiceId)?.name || "Mặc định"
                  : "Phân đoạn câu",
              mode,
              instruct,
              cfg_value,
              seed,
              speed,
              pitch,
              engine: "omnivoice",
            });

            toast.success(
              `Đã tạo xong và ghép nối ${readyBlocks.length} phân đoạn!`,
              { id: toastId },
            );
          } else {
            toast.warning(
              "Đã tạo xong các phân đoạn nhưng chưa thể tự ghép file master.",
              { id: toastId },
            );
          }
        } else {
          toast.error("Không có phân đoạn nào render thành công.", { id: toastId });
        }
      }
    } catch (err: any) {
      toast.error(`Tổng hợp thất bại: ${err.message}`, { id: toastId });
    } finally {
      setIsLoading(false);
      cleanupTimer();
    }
  };

  return {
    elapsedTime,
    generationProgress,
    isLoading,
    handleGenerate,
    cleanupTimer,
  };
}
