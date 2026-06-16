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
  const chat = useDreamChat(language);
  const focusTrapRef = useFocusTrap(isOpen);

  // 모바일 소프트 키보드가 열리면 하단 도크 예약 공간(pb-16)을 키보드 높이만큼으로
  // 바꿔, 입력창이 키보드 바로 위에 붙도록 한다. 입력창을 position:fixed 로 띄우면
  // 상위 backdrop-filter 글래스 패널이 컨테이닝 블록이 되어 도크 높이(64px)만큼
  // 어긋나므로, 대신 셸의 하단 패딩만 조절해 입력창을 일반 흐름에 둔다.
  //   · 터치 기기에서 텍스트 필드가 포커스됨 == 키보드 열림 (모드 무관 신뢰 신호)
  //   · resizes-visual(iOS/크롬): visualViewport 인셋 = 키보드 높이 → 그만큼 패딩
  //   · resizes-content(삼성/구안드로이드): 레이아웃이 이미 줄어 인셋≈0 → 패딩 0
  const [keyboardPad, setKeyboardPad] = useState<number | null>(null);
  useEffect(() => {
    const nav = navigator as unknown as { virtualKeyboard?: { overlaysContent: boolean } };
    if (nav.virtualKeyboard) nav.virtualKeyboard.overlaysContent = true;

    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const vv = window.visualViewport;
    let focused = false;

    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

    const compute = () => {
      if (!focused || !coarse) {
        setKeyboardPad(null);
        return;
      }
      const inset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      setKeyboardPad(inset);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target)) {
        focused = true;
        compute();
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        focused = isField(document.activeElement);
        compute();
      }, 50);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', compute);
    vv?.addEventListener('scroll', compute);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', compute);
      vv?.removeEventListener('scroll', compute);
    };
  }, []);

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
    const prompt = chat.getCurrentScene() || nodes.map((node) => `- ${node.text}`).join('\n');
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
    <div
      ref={focusTrapRef}
      className="apple-tab-shell fixed inset-0 z-50 flex flex-col pb-16 font-body"
      style={keyboardPad !== null ? { paddingBottom: keyboardPad } : undefined}
    >
      <div className="apple-glass-header flex justify-center pt-3 pb-3">
        <DreamPillSwitcher activeTab={pillTab} onTabChange={setPillTab} />
      </div>

      {isGeneratingBanner && (
        <div className="apple-card text-center py-2.5 mx-4 mt-2 text-[13px] text-th-text-secondary bg-th-accent/5 border-th-accent/20 animate-pulse">
          {pipeline.generatingStep || t.visualization.generating}
        </div>
      )}

      {pipeline.errorMessage && (
        <div className="apple-card text-center py-2 px-4 mx-4 mt-2 text-xs text-red-400">
          {pipeline.errorMessage}
        </div>
      )}

      {pipeline.infoMessage && (
        <div className="apple-card text-center py-2 px-4 mx-4 mt-2 text-xs text-th-text-tertiary bg-th-surface/50">
          {pipeline.infoMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {viewState === 'tabs' && pillTab === 'create' && (
          <DreamChat
            nodes={nodes}
            userProfile={userProfile}
            savedTitles={pipeline.savedItems
              .map((item) => item.inputText || item.text || '')
              .filter(Boolean)}
            messages={chat.messages}
            isAiTyping={chat.isAiTyping}
            isRefining={chat.isRefining}
            currentScene={chat.currentScene}
            refine={chat.refine}
            branch={chat.branch}
            onSendMessage={chat.sendMessage}
            onTapRefine={chat.tapRefine}
            onPickBranch={chat.pickBranch}
            onDismissBranch={chat.dismissBranch}
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
            text-th-accent font-semibold z-10 bg-th-accent-muted border-th-accent/30 shadow-xl animate-fade-in-up"
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
