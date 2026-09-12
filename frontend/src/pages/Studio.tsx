import { useEffect, useRef, useState } from "react";

import { useTTSStore } from "../store/useTTSStore";

import { useStudioBlocks } from "../hooks/useStudioBlocks";
import { useStudioGenerate } from "../hooks/useStudioGenerate";
import { useStudioProject } from "../hooks/useStudioProject";

import { VoiceSelector } from "../components/studio/VoiceSelector";
import { VoiceDesignPanel } from "../components/studio/VoiceDesignPanel";
import { StudioTextInput } from "../components/studio/StudioTextInput";
import { StudioOutputSection } from "../components/studio/StudioOutputSection";
import { ModelSettingsPanel } from "../components/studio/ModelSettingsPanel";
import { SaveProjectModal } from "../components/studio/SaveProjectModal";
import { PauseSettingsModal } from "../components/PauseSettingsModal";
import { PronunciationModal } from "../components/PronunciationModal";

export default function Studio() {
  const {
    mode,
    instruct,
    cfg_value,
    speed,
    pitch,
    audioUrl,
    voices,
    selectedVoiceId,
    enhanceAudio,
    setEnhanceAudio,
    setMode,
    setInstruct,
    setCfgValue,
    setSpeed,
    setPitch,
    setAudioUrl,
    setAudioFormat,
    fetchVoices,
    setSelectedVoiceId,
    pinnedVoices,
    togglePin,
    text,
    setText,
    projects,
    pauseSettings,
    pronunciationWords,
  } = useTTSStore();

  // ── Custom Hooks ───────────────────────────────────────────────────────────
  const blocks = useStudioBlocks();
  const generator = useStudioGenerate();
  const project = useStudioProject();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isSaveProjectModalOpen, setIsSaveProjectModalOpen] = useState(false);
  const [isPauseSettingsOpen, setIsPauseSettingsOpen] = useState(false);
  const [isPronunciationModalOpen, setIsPronunciationModalOpen] =
    useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchVoices();
    blocks.initAudio();
    return blocks.cleanup;
  }, [fetchVoices]);

  // ── Wrappers kết nối hooks với nhau ───────────────────────────────────────
  const handleGenerate = () =>
    generator.handleGenerate(selectedProjectId, {
      saveStudioBlocks: blocks.saveStudioBlocks,
      setGenerationProgress: () => {}, // generator tự track nội bộ
    });

  const handleUpdateMasterAudio = () =>
    blocks.handleUpdateMasterAudio(setAudioUrl, pauseSettings.period);

  return (
    <div className="flex flex-col gap-6 2k:gap-8 animate-in fade-in duration-500 max-w-[1600px] 2k:max-w-[2000px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl 2k:text-3xl font-bold tracking-tight text-on-surface">
            OmniVoice Studio
          </h1>
          <p className="text-on-surface-variant text-sm 2k:text-base mt-0.5">
            Tổng hợp giọng nói AI chất lượng cao 24kHz với mô hình OmniVoice
            (k2-fsa)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 2k:gap-10 items-start">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-6 2k:gap-8">
          <div className="glass-card rounded-2xl p-6 md:p-8 2k:p-10 flex flex-col gap-6 2k:gap-8 shadow-2xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

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
                  Chọn giữa sao chép giọng mẫu hoặc tự thiết kế thuộc tính giọng
                  nói với OmniVoice
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
                  <span className="material-symbols-outlined text-[16px] 2k:text-[18px]">
                    record_voice_over
                  </span>
                  Voice Cloning
                </button>
                <button
                  type="button"
                  onClick={() => setMode("design")}
                  className={`px-3.5 2k:px-5 py-1.5 2k:py-2.5 rounded-lg font-label-caps text-xs 2k:text-sm flex items-center gap-1.5 2k:gap-2 transition-all duration-300 ${
                    mode === "design"
                      ? "bg-primary text-black font-semibold shadow-md"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] 2k:text-[18px]">
                    auto_fix_high
                  </span>
                  Voice Design
                </button>
              </div>
            </div>

            {/* Mode 1: Voice Cloning Carousel */}
            {mode === "clone" && (
              <VoiceSelector
                voices={voices}
                selectedVoiceId={selectedVoiceId}
                onSelectVoice={setSelectedVoiceId}
                pinnedVoices={pinnedVoices}
                onTogglePin={togglePin}
              />
            )}

            {/* Mode 2: Voice Design */}
            {mode === "design" && (
              <VoiceDesignPanel
                instruct={instruct}
                onUpdateInstruct={setInstruct}
              />
            )}

            {/* Text Input Section */}
            <StudioTextInput
              text={text}
              onChangeText={setText}
              textareaRef={textareaRef}
              onOpenPauseModal={() => setIsPauseSettingsOpen(true)}
              onOpenPronunciationModal={() => setIsPronunciationModalOpen(true)}
              pauseSettings={pauseSettings}
              pronunciationWords={pronunciationWords}
              isLoading={generator.isLoading}
              elapsedTime={generator.elapsedTime}
              generationProgress={generator.generationProgress}
            />

            {/* Output & Blocks Section */}
            <StudioOutputSection
              audioUrl={audioUrl}
              elapsedTime={generator.elapsedTime}
              onNavigateToVideo={project.handleNavigateToVideo}
              onDownload={project.handleDownloadMaster}
              studioBlocks={blocks.studioBlocks}
              voices={voices}
              hasModifiedSegments={blocks.hasModifiedSegments}
              isUpdatingMaster={blocks.isUpdatingMaster}
              onUpdateMasterAudio={handleUpdateMasterAudio}
              onOpenSaveProjectModal={() => setIsSaveProjectModalOpen(true)}
              isSegmentsCollapsed={blocks.isSegmentsCollapsed}
              onToggleCollapseSegments={() =>
                blocks.setIsSegmentsCollapsed(!blocks.isSegmentsCollapsed)
              }
              playingStudioBlockId={blocks.playingStudioBlockId}
              onPlayBlock={blocks.handlePlayStudioBlockPreview}
              onStopPlayback={blocks.handleStopStudioPlayback}
              onUpdateBlock={blocks.handleUpdateStudioBlock}
              onDeleteBlock={blocks.handleDeleteStudioBlock}
              onMoveBlock={blocks.handleMoveStudioBlock}
              onInsertBlockBelow={(idx) =>
                blocks.handleAddStudioBlock(voices, selectedVoiceId, idx)
              }
              onAddBlock={() =>
                blocks.handleAddStudioBlock(voices, selectedVoiceId)
              }
              onRenderBlock={blocks.renderSingleStudioBlock}
            />
          </div>
        </div>

        {/* Right Column: Model Settings */}
        <div className="lg:col-span-4 flex flex-col gap-6 2k:gap-8 sticky top-6">
          <ModelSettingsPanel
            cfg_value={cfg_value}
            setCfgValue={setCfgValue}
            speed={speed}
            setSpeed={setSpeed}
            pitch={pitch}
            setPitch={setPitch}
            audioFormat={
              (useTTSStore.getState().audioFormat as "mp3" | "wav") || "mp3"
            }
            setAudioFormat={setAudioFormat}
            enhanceAudio={enhanceAudio}
            setEnhanceAudio={setEnhanceAudio}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            projects={projects}
            isLoading={generator.isLoading}
            onGenerate={handleGenerate}
            onSaveConfig={project.saveModelConfig}
            configSaved={project.configSaved}
          />
        </div>
      </div>

      {/* Modal Lưu kịch bản vào Dự án */}
      <SaveProjectModal
        isOpen={isSaveProjectModalOpen}
        onClose={() => setIsSaveProjectModalOpen(false)}
        studioBlocksCount={blocks.studioBlocks.length}
        projects={projects}
        onSave={(params) =>
          project.handleSaveStudioAsProject(
            blocks.studioBlocks,
            () => setIsSaveProjectModalOpen(false),
            params,
          )
        }
      />

      {/* Modal Thiết lập ngắt nghỉ */}
      <PauseSettingsModal
        isOpen={isPauseSettingsOpen}
        onClose={() => setIsPauseSettingsOpen(false)}
      />

      {/* Modal Cách đọc */}
      <PronunciationModal
        isOpen={isPronunciationModalOpen}
        onClose={() => setIsPronunciationModalOpen(false)}
      />
    </div>
  );
}
