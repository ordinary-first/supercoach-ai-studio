import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
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
  const [viewingResult, setViewingResult] =
    useState<VisualizationResult | null>(null);
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

  const pipeline = useGenerationPipeline({ userProfile, nodes, isOpen });
  const audio = useVisualizationAudio();
  const chat = useDreamChat();
  const focusTrapRef = useFocusTrap(isOpen);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setViewState('tabs');
      setViewingResult(null);
      setReferenceImages([]);
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

    const result = await pipeline.handleGenerate(
      prompt,
      settings,
      referenceImages,
      imageQuality,
    );
    if (result) {
      setViewingResult(result);
      setViewState('viewer');
      prepareAudio(result);
    }
  }, [
    chat,
    nodes,
    pipeline,
    settings,
    referenceImages,
    imageQuality,
    prepareAudio,
  ]);

  const handleGalleryItemTap = useCallback(
    (item: SavedVisualization) => {
      const loaded = pipeline.handleLoadSaved(item);
      setViewingResult(loaded);
      setViewState('viewer');
      prepareAudio(loaded);
    },
    [pipeline, prepareAudio],
  );

  const handleGalleryItemDelete = useCallback(
    (id: string) => {
      void pipeline.handleDeleteSaved(id);
    },
    [pipeline],
  );

  const handleViewerClose = useCallback(() => {
    audio.stop();
    setViewState('tabs');
  }, [audio]);

  const handleSave = useCallback(() => {
    if (viewingResult) {
      void pipeline.handleSave(viewingResult);
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
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#0A0A0A' }}
    >
      {/* Header */}
      <div className="flex items-center justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Close"
        >
          <X size={20} color="rgba(255,255,255,0.7)" />
        </button>
      </div>

      {/* Pill Switcher */}
      <div className="flex justify-center pb-3">
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
            messages={chat.messages}
            onSendMessage={(content) =>
              chat.addMessage('user', content, 'user-input')
            }
            onGenerate={handleGenerate}
            isGenerating={pipeline.isGenerating}
            settings={settings}
            onSettingsChange={setSettings}
            imageQuality={imageQuality}
            onImageQualityChange={setImageQuality}
            referenceImages={referenceImages}
            onImageAttach={handleImageAttach}
            onImageRemove={handleImageRemove}
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

        {viewState === 'viewer' && viewingResult && (
          <DreamViewer
            result={viewingResult}
            audio={audio}
            isSaving={pipeline.isSaving}
            isSaved={pipeline.isSaved}
            onSave={handleSave}
            onClose={handleViewerClose}
            onRefreshVideo={() =>
              pipeline.refreshPendingVideo(viewingResult)
            }
            isCheckingPendingVideo={pipeline.isCheckingPendingVideo}
          />
        )}
      </div>
    </div>
  );
}
