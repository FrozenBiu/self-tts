import { useState, useRef } from "react";
import { toast } from "sonner";

import { useTTSStore, applyPronunciationDictionary, type ScriptBlock } from "../store/useTTSStore";
import { API_BASE_URL } from "../constants/api";

export function useStudioBlocks() {
  const { pronunciationWords, enhanceAudio } = useTTSStore();

  // ── State ────────────────────────────────────────────────────────────────
  const [studioBlocks, setStudioBlocks] = useState<ScriptBlock[]>(() =>
    JSON.parse(localStorage.getItem("tts_studio_blocks") || "[]"),
  );
  const [isSegmentsCollapsed, setIsSegmentsCollapsed] = useState(false);
  const [hasModifiedSegments, setHasModifiedSegments] = useState(false);
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  const [playingStudioBlockId, setPlayingStudioBlockId] = useState<string | null>(null);

  const studioSequenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const studioSequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const saveStudioBlocks = (newBlocks: ScriptBlock[]) => {
    setStudioBlocks(newBlocks);
    localStorage.setItem("tts_studio_blocks", JSON.stringify(newBlocks));
  };

  const initAudio = () => {
    if (!studioSequenceAudioRef.current) {
      studioSequenceAudioRef.current = new Audio();
    }
  };

  const cleanup = () => {
    if (studioSequenceAudioRef.current) {
      studioSequenceAudioRef.current.pause();
    }
    if (studioSequenceTimeoutRef.current) {
      clearTimeout(studioSequenceTimeoutRef.current);
    }
  };

  // ── CRUD Handlers ────────────────────────────────────────────────────────
  const handleAddStudioBlock = (voices: { id: string; name: string }[], selectedVoiceId: string | null, afterIndex?: number) => {
    const newBlock: ScriptBlock = {
      id: "block_" + Math.random().toString(36).substring(2, 9),
      text: "",
      voiceId: selectedVoiceId || (voices.length > 0 ? voices[0].id : null),
      voiceName:
        voices.find((v) => v.id === (selectedVoiceId || voices[0]?.id))?.name ||
        "Mặc định",
      speed: 1.0,
      pitch: 0.0,
      pauseAfter: 0.5,
      status: "idle",
    };

    if (typeof afterIndex === "number" && afterIndex >= 0) {
      const updated = [...studioBlocks];
      updated.splice(afterIndex + 1, 0, newBlock);
      saveStudioBlocks(updated);
    } else {
      saveStudioBlocks([...studioBlocks, newBlock]);
    }
  };

  const handleDeleteStudioBlock = (blockId: string) => {
    const target = studioBlocks.find((b) => b.id === blockId);
    if (target?.audioUrl) {
      const fn = target.filename || target.audioUrl.split("/").pop();
      if (fn) {
        fetch(`${API_BASE_URL}/api/tts/${fn}`, { method: "DELETE" }).catch(() => {});
      }
    }
    saveStudioBlocks(studioBlocks.filter((b) => b.id !== blockId));
    toast.success("Đã xóa phân đoạn");
  };

  const handleUpdateStudioBlock = (blockId: string, updatedFields: Partial<ScriptBlock>) => {
    const updated = studioBlocks.map((b) =>
      b.id === blockId ? { ...b, ...updatedFields } : b,
    );
    saveStudioBlocks(updated);
  };

  const handleMoveStudioBlock = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= studioBlocks.length) return;

    const updated = [...studioBlocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    saveStudioBlocks(updated);
  };

  // ── Render single block ──────────────────────────────────────────────────
  const renderSingleStudioBlock = async (blockId: string) => {
    const target = studioBlocks.find((b) => b.id === blockId);
    if (!target || !target.text.trim()) {
      toast.error("Nội dung phân đoạn không được để trống");
      return;
    }

    handleUpdateStudioBlock(blockId, { status: "rendering", error: undefined });

    try {
      const processedText = applyPronunciationDictionary(
        target.text.trim(),
        pronunciationWords,
      );

      const res = await fetch(`${API_BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: processedText,
          mode: "clone",
          voice_id: target.voiceId || null,
          speed: target.speed || 1.0,
          pitch: target.pitch || 0.0,
          format: useTTSStore.getState().audioFormat || "mp3",
          enhance_audio: enhanceAudio,
          engine: "omnivoice",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Lỗi tạo âm thanh từ server");
      }

      const data = await res.json();

      // Đo duration audio
      let audioDuration = 0;
      try {
        const tempAudio = new Audio(data.audio_url);
        await new Promise((resolve) => {
          tempAudio.addEventListener("loadedmetadata", () => {
            audioDuration = tempAudio.duration;
            resolve(true);
          });
          tempAudio.addEventListener("error", () => resolve(false));
          setTimeout(resolve, 2000);
        });
      } catch (e) {
        console.warn("Không thể lấy duration audio:", e);
      }

      const oldFilename =
        target.filename ||
        (target.audioUrl ? target.audioUrl.split("/").pop() : null);

      handleUpdateStudioBlock(blockId, {
        status: "ready",
        audioUrl: data.audio_url,
        filename: data.filename,
        duration: audioDuration > 0 ? audioDuration : undefined,
      });

      // Xóa file cũ nếu tồn tại
      if (oldFilename && oldFilename !== data.filename) {
        fetch(`${API_BASE_URL}/api/tts/${oldFilename}`, { method: "DELETE" }).catch(() => {});
      }

      setHasModifiedSegments(true);
      toast.success(
        "Render phân đoạn thành công! Bạn có thể bấm 'Cập nhật Audio chính' để nghe bản hoàn chỉnh.",
      );
    } catch (error: any) {
      handleUpdateStudioBlock(blockId, {
        status: "error",
        error: error.message || "Lỗi không xác định",
      });
      toast.error(`Render thất bại: ${error.message}`);
    }
  };

  // ── Update master audio ──────────────────────────────────────────────────
  const handleUpdateMasterAudio = async (
    setAudioUrl: (url: string | null) => void,
    pausePeriod: number,
  ) => {
    const readyBlocks = studioBlocks.filter(
      (b) => b.status === "ready" && (b.filename || b.audioUrl),
    );
    if (readyBlocks.length === 0) {
      toast.error("Vui lòng render ít nhất một phân đoạn trước khi cập nhật");
      return;
    }

    setIsUpdatingMaster(true);
    const toastId = toast.loading("Đang ghép nối và cập nhật lại Audio chính...");

    try {
      const payload = {
        blocks: readyBlocks.map((b) => ({
          filename: b.filename || b.audioUrl!.split("/").pop()!,
          pause_after: typeof b.pauseAfter === "number" ? b.pauseAfter : pausePeriod,
          text: b.text.trim(),
        })),
        format: useTTSStore.getState().audioFormat || "mp3",
        project_name: "Studio_Master",
      };

      const res = await fetch(`${API_BASE_URL}/api/tts/stitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Không thể ghép nối âm thanh");
      }

      const data = await res.json();
      setAudioUrl(data.audio_url);
      setHasModifiedSegments(false);
      toast.success(`Đã cập nhật Audio chính thành công! (${data.total_duration}s)`, {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(`Cập nhật thất bại: ${err.message}`, { id: toastId });
    } finally {
      setIsUpdatingMaster(false);
    }
  };

  // ── Playback ─────────────────────────────────────────────────────────────
  const handlePlayStudioBlockPreview = (block: ScriptBlock) => {
    if (!block.audioUrl) return;
    initAudio();
    if (!studioSequenceAudioRef.current) return;

    if (studioSequenceTimeoutRef.current) {
      clearTimeout(studioSequenceTimeoutRef.current);
    }

    setPlayingStudioBlockId(block.id);
    studioSequenceAudioRef.current.src = block.audioUrl;
    studioSequenceAudioRef.current.onended = () => setPlayingStudioBlockId(null);
    studioSequenceAudioRef.current.play().catch((e) => {
      console.warn("Lỗi phát:", e);
      setPlayingStudioBlockId(null);
    });
  };

  const handleStopStudioPlayback = () => {
    if (studioSequenceAudioRef.current) {
      studioSequenceAudioRef.current.pause();
      studioSequenceAudioRef.current.currentTime = 0;
    }
    if (studioSequenceTimeoutRef.current) {
      clearTimeout(studioSequenceTimeoutRef.current);
    }
    setPlayingStudioBlockId(null);
  };

  return {
    // State
    studioBlocks,
    isSegmentsCollapsed,
    hasModifiedSegments,
    isUpdatingMaster,
    playingStudioBlockId,
    // Setters
    saveStudioBlocks,
    setIsSegmentsCollapsed,
    setHasModifiedSegments,
    // Handlers
    handleAddStudioBlock,
    handleDeleteStudioBlock,
    handleUpdateStudioBlock,
    handleMoveStudioBlock,
    renderSingleStudioBlock,
    handleUpdateMasterAudio,
    handlePlayStudioBlockPreview,
    handleStopStudioPlayback,
    // Lifecycle
    initAudio,
    cleanup,
  };
}
