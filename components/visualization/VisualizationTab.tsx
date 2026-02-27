import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useGenerationPipeline,
  type GenerationSettings,
  type VisualizationResult,
} from '../../hooks/useGenerationPipeline';
import { useVisualizationAudio } from '../../hooks/useVisualizationAudio';
import { useDreamChat } from '../../hooks/useDreamChat';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTranslation } from '../../i18n/useTranslation';
import DreamPillSwitcher from './DreamPillSwitcher';
import DreamChat from './DreamChat';
import DreamGallery from './DreamGallery';
import DreamViewer from './DreamViewer';
import type { UserProfile, GoalNode } from '../../types';
import type { SavedVisualization } from '../../services/firebaseService';

interface VisualizationTabProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  nodes: GoalNode[];
}

type PillTab = 'create' | 'gallery';
type ViewState = 'tabs' | 'viewer';

export default function VisualizationTab({
  isOpen,
  onClose,
  userProfile,
  nodes,
}: VisualizationTabProps) {
  const { language, t } = useTranslation();
  const [pillTab, setPillTab] = useState<PillTab>('create');
  const [viewState, setViewState] = useState<ViewState>('tabs');
  const viewStateRef = useRef<ViewState>('tabs');
  const [viewingResult, setViewingResult] = useState<VisualizationResult | null>(null);
  const [backgroundComplete, setBackgroundComplete] = useState(false);
  const [settings, setSettings] = useState<GenerationSettings>({
    text: true,
    image: true,
    video: false,
    audio: false,
  });
  const [imageQuality, setImageQuality] = useState<'medium' | 'high'>('medium');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  const setView = useCallback((nextView: ViewState) => {
    setViewState(nextView);
    viewStateRef.current = nextView;
  }, []);

  const pipeline = useGenerationPipeline({ userProfile, nodes, isOpen });
  const audio = useVisualizationAudio();
  const chat = useDreamChat();
  const focusTrapRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setView('tabs');
      setViewingResult(null);
      setReferenceImages([]);
      setBackgroundComplete(false);
      chat.clearMessages();
      audio.stop();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const prepareAudio = useCallback(
    (result: VisualizationResult) => {
      audio.stop();
      if (result.audioUrl) {
        void audio.prepareFromUrl(result.audioUrl);
      } else if (result.audioData) {
        void audio.prepareFromPcm(result.audioData);
      }
    },
    [audio],
  );

  const handleGenerate = useCallback(async () => {
    const prompt = chat.getLastScene() || nodes.map((node) => `- ${node.text}`).join('\n');
    if (!prompt) return;

    setBackgroundComplete(false);
    setView('viewer');

    const result = await pipeline.handleGenerate(prompt, settings, referenceImages, imageQuality);
    if (!result) return;

    setViewingResult(result);
    prepareAudio(result);
    if (viewStateRef.current !== 'viewer') setBackgroundComplete(true);
  }, [chat, imageQuality, nodes, pipeline, prepareAudio, referenceImages, setView, settings]);

  const handleGalleryItemTap = useCallback(
    (item: SavedVisualization) => {
      const loaded = pipeline.handleLoadSaved(item);
      setViewingResult(loaded);
      setView('viewer');
      prepareAudio(loaded);
    },
    [pipeline, prepareAudio, setView],
  );

  const handleGalleryItemDelete = useCallback(
    (id: string) => {
      void pipeline.handleDeleteSaved(id);
    },
    [pipeline],
  );

  const handleViewerClose = useCallback(() => {
    audio.stop();
    setView('tabs');
  }, [audio, setView]);

  const handleSave = useCallback(() => {
    const target = pipeline.currentResult || viewingResult;
    if (target) void pipeline.handleSave(target);
  }, [pipeline, viewingResult]);

  const handleImageAttach = useCallback((dataUrl: string) => {
    setReferenceImages((prev) => (prev.length >= 3 ? prev : [...prev, dataUrl]));
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateDream = useCallback(() => {
    setPillTab('create');
  }, []);

  if (!isOpen) return null;

  const isGeneratingBanner =
    pipeline.isGenerating || pipeline.currentResult?.videoStatus === 'pending';

  const completeBannerLabel = language === 'ko'
    ? '✨ 드림이 완성되었습니다 — 결과 보기'
    : '✨ Dream is ready — View result';

  return (
    <div ref={focusTrapRef} className="apple-tab-shell fixed inset-0 z-50 flex flex-col pb-16 font-body">
      <div className="apple-glass-header flex justify-center pt-3 pb-3">
        <DreamPillSwitcher activeTab={pillTab} onTabChange={setPillTab} />
      </div>

      {isGeneratingBanner && (
        <div className="apple-card text-center py-2 mx-4 mt-2 text-[13px] text-white/70">
          {pipeline.generatingStep || t.visualization.generating}
        </div>
      )}

      {pipeline.errorMessage && (
        <div className="apple-card text-center py-2 px-4 mx-4 mt-2 text-xs text-red-400">
          {pipeline.errorMessage}
        </div>
      )}

      {pipeline.infoMessage && (
        <div className="apple-card text-center py-2 px-4 mx-4 mt-2 text-xs text-white/60">
          {pipeline.infoMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {viewState === 'tabs' && pillTab === 'create' && (
          <DreamChat
            nodes={nodes}
            messages={chat.messages}
            onSendMessage={chat.sendMessage}
            isAiTyping={chat.isAiTyping}
            onGenerate={handleGenerate}
            isGenerating={pipeline.isGenerating}
            settings={settings}
            onSettingsChange={setSettings}
            imageQuality={imageQuality}
            onImageQualityChange={setImageQuality}
            referenceImages={referenceImages}
            onImageAttach={handleImageAttach}
            onRemoveImage={handleImageRemove}
          />
        )}

        {viewState === 'tabs' && pillTab === 'gallery' && (
          <DreamGallery
            items={pipeline.savedItems}
            onItemTap={handleGalleryItemTap}
            onItemDelete={handleGalleryItemDelete}
            onCreateDream={handleCreateDream}
          />
        )}
      </div>

      {backgroundComplete && viewState === 'tabs' && (
        <button
          onClick={() => {
            setView('viewer');
            setBackgroundComplete(false);
          }}
          className="apple-glass-panel absolute top-14 left-4 right-4 rounded-xl px-4 py-3 text-sm
            text-white z-10 bg-[rgba(76,96,196,0.22)] border-[rgba(165,184,255,0.34)]"
        >
          {completeBannerLabel}
        </button>
      )}

      <DreamViewer
        isOpen={viewState === 'viewer'}
        result={pipeline.currentResult || viewingResult || {
          inputText: '',
          textStatus: 'idle',
          imageStatus: 'idle',
          audioStatus: 'idle',
          videoStatus: 'idle',
        }}
        isGenerating={pipeline.isGenerating}
        generatingStep={pipeline.generatingStep}
        isPlaying={audio.isPlaying}
        onTogglePlay={() => {
          const result = pipeline.currentResult || viewingResult;
          void audio.togglePlay(result?.audioUrl, result?.audioData);
        }}
        isSaving={pipeline.isSaving}
        isSaved={pipeline.isSaved}
        onSave={handleSave}
        onClose={handleViewerClose}
        onRefreshVideo={() => {
          const result = pipeline.currentResult || viewingResult;
          if (result) void pipeline.refreshPendingVideo(result);
        }}
        isCheckingVideo={pipeline.isCheckingPendingVideo}
      />
    </div>
  );
}
