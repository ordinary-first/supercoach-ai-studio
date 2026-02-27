import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useGenerationPipeline,
  toResultFromSaved,
  type GenerationSettings,
  type VisualizationResult,
} from '../../hooks/useGenerationPipeline';
import { useVisualizationAudio } from '../../hooks/useVisualizationAudio';
import { useDreamChat } from '../../hooks/useDreamChat';
import { useFocusTrap } from '../../hooks/useFocusTrap';
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
  const [pillTab, setPillTab] = useState<PillTab>('create');
  const [viewState, setViewState] = useState<ViewState>('tabs');
  const viewStateRef = useRef<ViewState>('tabs');
  const [viewingResult, setViewingResult] =
    useState<VisualizationResult | null>(null);
  const [backgroundComplete, setBackgroundComplete] = useState(false);
  const [settings, setSettings] = useState<GenerationSettings>({
    text: true,
    image: true,
    video: false,
    audio: false,
  });
  const [imageQuality, setImageQuality] = useState<'medium' | 'high'>(
    'medium',
  );
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  const setView = useCallback((v: ViewState) => {
    setViewState(v);
    viewStateRef.current = v;
  }, []);

  const pipeline = useGenerationPipeline({ userProfile, nodes, isOpen });
  const audio = useVisualizationAudio();
  const chat = useDreamChat();
  const focusTrapRef = useFocusTrap(isOpen);

  // Reset state when modal closes
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
    const prompt =
      chat.getLastScene() ||
      nodes.map((n) => `- ${n.text}`).join('\n');
    if (!prompt) return;

    // Viewer 즉시 오픈 (생성 전)
    setBackgroundComplete(false);
    setView('viewer');

    const result = await pipeline.handleGenerate(
      prompt,
      settings,
      referenceImages,
      imageQuality,
    );
    if (result) {
      setViewingResult(result);
      prepareAudio(result);
      // 생성 중 viewer 닫았으면 복귀 배너 표시
      if (viewStateRef.current !== 'viewer') {
        setBackgroundComplete(true);
      }
    }
  }, [
    chat,
    nodes,
    pipeline,
    settings,
    referenceImages,
    imageQuality,
    prepareAudio,
    setView,
  ]);

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
    if (target) {
      void pipeline.handleSave(target);
    }
  }, [pipeline, viewingResult]);

  const handleImageAttach = useCallback(
    (dataUrl: string) => {
      setReferenceImages((prev) =>
        prev.length >= 3 ? prev : [...prev, dataUrl],
      );
    },
    [],
  );

  const handleImageRemove = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateDream = useCallback(() => {
    setPillTab('create');
  }, []);

  if (!isOpen) return null;

  const isGeneratingBanner =
    pipeline.isGenerating ||
    pipeline.currentResult?.videoStatus === 'pending';

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-50 flex flex-col pb-16"
      style={{ background: '#0A0A0A' }}
    >
      {/* Pill Switcher */}
      <div className="flex justify-center pt-3 pb-3">
        <DreamPillSwitcher
          activeTab={pillTab}
          onTabChange={setPillTab}
        />
      </div>

      {/* Generating banner */}
      {isGeneratingBanner && (
        <div
          className="text-center py-2"
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            background: 'rgba(124,58,237,0.15)',
          }}
        >
          {pipeline.generatingStep || '생성 중...'}
        </div>
      )}

      {/* Error / Info messages */}
      {pipeline.errorMessage && (
        <div
          className="text-center py-2 px-4"
          style={{ fontSize: 12, color: '#f87171' }}
        >
          {pipeline.errorMessage}
        </div>
      )}
      {pipeline.infoMessage && (
        <div
          className="text-center py-2 px-4"
          style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
        >
          {pipeline.infoMessage}
        </div>
      )}

      {/* Tab content */}
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

      {/* Background complete banner */}
      {backgroundComplete && viewState === 'tabs' && (
        <button
          onClick={() => {
            setView('viewer');
            setBackgroundComplete(false);
          }}
          className="absolute top-14 left-4 right-4 rounded-xl px-4 py-3 text-sm text-white z-10"
          style={{
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.3)',
          }}
        >
          ✨ 드림이 완성되었습니다 — 결과 보기
        </button>
      )}

      {/* DreamViewer — 항상 렌더링, isOpen으로 제어 */}
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
          const r = pipeline.currentResult || viewingResult;
          void audio.togglePlay(r?.audioUrl, r?.audioData);
        }}
        isSaving={pipeline.isSaving}
        isSaved={pipeline.isSaved}
        onSave={handleSave}
        onClose={handleViewerClose}
        onRefreshVideo={() => {
          const r = pipeline.currentResult || viewingResult;
          if (r) void pipeline.refreshPendingVideo(r);
        }}
        isCheckingVideo={pipeline.isCheckingPendingVideo}
      />
    </div>
  );
}
