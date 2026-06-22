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
  // 어긋나므로(기존 버그), 대신 셸의 하단 패딩만 조절해 입력창을 일반 흐름에 둔다.
  //
  // 키보드 높이는 두 신호의 MAX 로 측정해 브라우저/모드 무관하게 동작시킨다:
  //   · VirtualKeyboard API: overlaysContent=true 면 키보드가 뷰포트를 줄이지 않고
  //     콘텐츠 위에 덮이므로 visualViewport 는 줄지 않는다(=인셋 0). 이때는
  //     boundingRect.height 가 유일한 키보드 높이 신호다. (할일 탭이 이 방식으로 동작)
  //   · visualViewport(resizes-visual, iOS/구형): innerHeight-vv.height = 키보드 높이.
  //   · resizes-content(일부 안드로이드): 레이아웃이 이미 줄어 둘 다 ≈0 → 패딩 0
  //     이면 셸이 이미 줄어든 만큼 입력창이 키보드 위에 붙는다.
  // overlaysContent 는 앱 전역 플래그(할일 탭도 true 로 설정)라 값에 의존하지 않도록
  // 두 신호를 모두 보고 큰 값을 쓴다.
  const [keyboardPad, setKeyboardPad] = useState<number | null>(null);
  useEffect(() => {
    const nav = navigator as unknown as {
      virtualKeyboard?: {
        overlaysContent: boolean;
        boundingRect: DOMRect;
        addEventListener: (e: string, fn: () => void) => void;
        removeEventListener: (e: string, fn: () => void) => void;
      };
    };
    const vk = nav.virtualKeyboard;
    if (vk) vk.overlaysContent = true;

    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const vv = window.visualViewport;
    let focused = false;

    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

    const compute = () => {
      const vvH = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      if (vk) {
        // VirtualKeyboard 지원 기기(크롬/대부분의 안드로이드): boundingRect.height 가
        // 정확하고 키보드가 닫히면 0 (셀프 게이팅). overlaysContent=true 면 visualViewport
        // 가 줄지 않아 boundingRect 가 유일한 신호, false 여도 vvH 가 받쳐준다.
        // 포커스 게이트를 쓰지 않으므로, 포커스~키보드 등장 사이에 입력창이 잠깐
        // 바닥으로 떨어지는 깜빡임이 없다.
        const h = Math.max(Math.round(vk.boundingRect?.height ?? 0), vvH);
        setKeyboardPad(h > 0 ? h : null);
        return;
      }
      // VirtualKeyboard 미지원 폴백(iOS Safari·일부 구형): 터치 기기에서 입력 필드 포커스 시.
      if (!(focused && coarse)) {
        setKeyboardPad(null);
        return;
      }
      // vvH>0(resizes-visual, iOS 포함): 키보드 높이만큼 패딩 → flush.
      // vvH===0: 아직 키보드 높이를 알 수 없는 상태다. 세 경우가 섞인다 —
      //   ① iOS 포커스 직후~visualViewport resize 도착 전(애니메이션 중),
      //   ② 하드웨어 키보드(소프트 키보드 없음), ③ resizes-content(레이아웃이 이미 줄어듦).
      // ①②에서 패딩 0(도크 제거)을 주면 입력창이 도크/올라오는 키보드에 가려진다.
      // 그래서 null(pb-16 유지)로 둔다 — ③에선 64px 빈틈이 남지만 가려지는 것보다 안전하고,
      // ①은 resize 가 도착하면 vvH=키보드높이로 보정돼 flush 로 정착한다.
      setKeyboardPad(vvH > 0 ? vvH : null);
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
    vk?.addEventListener('geometrychange', compute);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', compute);
      vv?.removeEventListener('scroll', compute);
      vk?.removeEventListener('geometrychange', compute);
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
        settings={settings}
        isGenerating={pipeline.isGenerating}
        isPlaying={audio.isPlaying}
        onTogglePlay={() => {
          const result = pipeline.currentResult || viewingResult;
          void audio.togglePlay(result?.audioUrl, result?.audioData);
        }}
        isSaving={pipeline.isSaving}
        isSaved={pipeline.isSaved}
        onSave={handleSave}
        onRegenerate={handleGenerate}
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
