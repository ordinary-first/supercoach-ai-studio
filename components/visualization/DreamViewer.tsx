import { useState, useEffect, useCallback } from 'react';
import {
  X, Download, Share2, Loader2, Check, Play, Pause, ChevronDown, Maximize2,
} from 'lucide-react';
import { VisualizationResult } from '../../hooks/useGenerationPipeline';
import { useTranslation } from '../../i18n/useTranslation';
import { FEATURES } from '../../features';
import VideoSection from './VideoSection';
import ImageSection from './ImageSection';
import AudioSection from './AudioSection';
import NarrativeSection from './NarrativeSection';

interface DreamViewerProps {
  result: VisualizationResult;
  isGenerating: boolean;
  generatingStep: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRefreshVideo?: () => void;
  isCheckingVideo?: boolean;
}

type ViewMode = 'default' | 'image' | 'read';

const viewerStyles = `
@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sheetDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes dvFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dvFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dvWave { 0%,100% { height: 5px; } 50% { height: var(--max-h); } }
`;

const WAVE_BARS = [
  { h: '16px', d: '0s' }, { h: '24px', d: '0.15s' }, { h: '12px', d: '0.3s' },
  { h: '28px', d: '0.1s' }, { h: '18px', d: '0.25s' }, { h: '22px', d: '0.05s' },
  { h: '14px', d: '0.2s' }, { h: '26px', d: '0.12s' }, { h: '16px', d: '0.28s' },
];

function DreamViewer({
  result,
  isGenerating,
  generatingStep,
  isOpen,
  onClose,
  onSave,
  isSaving,
  isSaved,
  isPlaying,
  onTogglePlay,
  onRefreshVideo,
  isCheckingVideo,
}: DreamViewerProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mode, setMode] = useState<ViewMode>('default');
  const [imgFallback, setImgFallback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('default');
      setIsVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  const showVideo =
    FEATURES.videoGeneration &&
    (result.videoUrl ||
      result.videoStatus === 'pending' ||
      result.videoStatus === 'ready' ||
      (isGenerating && generatingStep.includes('video')));

  const imgSrc = imgFallback ? result.imageDataUrl : (result.imageUrl || result.imageDataUrl);
  const hasImage = !!(result.imageUrl || result.imageDataUrl);
  const showImage = hasImage || (isGenerating && generatingStep.includes('image'));

  const hasAudio = result.audioStatus === 'completed' && !!(result.audioUrl || result.audioData);
  const showAudio =
    hasAudio || result.audioStatus !== 'idle' || (isGenerating && generatingStep.includes('audio'));
  const audioLoading = isGenerating && result.audioStatus === 'idle';

  const hasText = !!result.text;
  const showNarrative =
    result.text || result.textStatus !== 'idle' || (isGenerating && generatingStep.includes('text'));
  const textLoading = isGenerating && !result.text;

  const handleImgError = () => {
    if (!imgFallback && result.imageDataUrl) setImgFallback(true);
  };

  /* ── Shared chrome ── */
  const generatingChip = isGenerating && generatingStep && (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-1.5
      rounded-full apple-chip bg-th-accent-muted border-th-accent/20">
      <Loader2 size={14} className="animate-spin text-th-accent" />
      <span className="text-xs font-semibold text-th-accent">{generatingStep}</span>
    </div>
  );

  /* ── Audio bar (slim player) ── */
  const audioBar = showAudio && (
    <div
      className="shrink-0 px-4 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
    >
      <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 apple-chip border-th-border/40">
        <button
          onClick={onTogglePlay}
          disabled={!hasAudio}
          className="w-9 h-9 rounded-full bg-th-accent flex items-center justify-center shrink-0
            hover:brightness-110 active:scale-90 transition-all disabled:opacity-40"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {audioLoading ? (
            <Loader2 size={16} className="animate-spin text-th-text-inverse" />
          ) : isPlaying ? (
            <Pause size={16} className="text-th-text-inverse fill-th-text-inverse" />
          ) : (
            <Play size={16} className="text-th-text-inverse fill-th-text-inverse translate-x-0.5" />
          )}
        </button>
        <div className="flex-1 flex items-center gap-[3px] h-7 overflow-hidden">
          {WAVE_BARS.map((bar, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: '3px',
                minHeight: '5px',
                height: isPlaying ? undefined : '5px',
                backgroundColor: isPlaying ? 'var(--accent)' : 'var(--text-muted)',
                opacity: isPlaying ? 1 : 0.5,
                ['--max-h' as string]: bar.h,
                ...(isPlaying ? { animation: `dvWave 0.8s ease-in-out ${bar.d} infinite` } : {}),
              }}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-th-text-tertiary shrink-0">
          {t.visualization.typeAudio}
        </span>
      </div>
    </div>
  );

  /* ── Sheet wrapper ── */
  const sheet = (children: React.ReactNode) => (
    <div
      className="fixed inset-0 flex flex-col apple-tab-shell"
      style={{
        zIndex: 9999,
        animation: isAnimating
          ? 'sheetUp 420ms cubic-bezier(0.32,0.72,0,1) forwards'
          : 'sheetDown 300ms ease-in forwards',
      }}
    >
      <style>{viewerStyles}</style>
      {children}
    </div>
  );

  /* ── Legacy stacked layout (video enabled) ── */
  if (showVideo) {
    return sheet(
      <>
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full apple-chip flex items-center
            justify-center text-th-text-secondary hover:text-th-text transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        {generatingChip}
        <div className="flex-1 overflow-y-auto pt-16 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex flex-col gap-0.5 px-0.5">
            <VideoSection
              videoUrl={result.videoUrl}
              videoStatus={result.videoStatus}
              isLoading={isGenerating || result.videoStatus === 'pending' || !!isCheckingVideo}
            />
            {showImage && (
              <ImageSection
                imageUrl={result.imageUrl}
                imageDataUrl={result.imageDataUrl}
                isLoading={isGenerating && !hasImage}
              />
            )}
            {showAudio && (
              <AudioSection
                hasAudio={hasAudio}
                isLoading={audioLoading}
                isPlaying={isPlaying}
                onTogglePlay={onTogglePlay}
              />
            )}
            {showNarrative && <NarrativeSection text={result.text} isLoading={textLoading} />}
          </div>
        </div>
        <div
          className="fixed bottom-0 left-0 right-0 flex items-center justify-center h-20 z-20"
          style={{
            background: 'linear-gradient(to top, var(--bg-base) 60%, transparent)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <SaveShare {...{ onSave, isSaving, isSaved, t }} />
        </div>
      </>,
    );
  }

  /* ── Image-only fullscreen ── */
  if (mode === 'image' && hasImage && imgSrc) {
    return sheet(
      <div
        className="absolute inset-0 bg-black flex items-center justify-center"
        style={{ animation: 'dvFade 260ms ease forwards' }}
        onClick={() => setMode('default')}
      >
        <img src={imgSrc} alt="Dream" className="w-full h-full object-contain" onError={handleImgError} />
        <button
          onClick={(e) => { e.stopPropagation(); setMode('default'); }}
          className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center
            text-white/90 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
          aria-label="Back"
        >
          <ChevronDown size={20} />
        </button>
      </div>,
    );
  }

  /* ── Read mode: narrative fullscreen over the image as a readable backdrop ── */
  if (mode === 'read' && hasText) {
    return sheet(
      <div className="absolute inset-0" style={{ animation: 'dvFade 260ms ease forwards' }}>
        {hasImage && imgSrc && (
          <img
            src={imgSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'blur(9px) brightness(0.55) saturate(1.05)' }}
            onError={handleImgError}
          />
        )}
        {/* readability scrim — keeps text legible over any image, light or dark */}
        <div className="absolute inset-0" style={{ background: 'rgba(8,10,14,0.74)' }} />
        <div
          className="absolute inset-0 overflow-y-auto px-7 pt-20 scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 96px)' }}
        >
          <div
            className="text-[11px] font-semibold tracking-[0.22em] mb-5"
            style={{ color: '#a9cdff', textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}
          >
            {t.visualization.sceneLabel.toUpperCase()}
          </div>
          <p
            className="text-[18px] leading-[1.9] whitespace-pre-wrap font-body"
            style={{ color: '#f1f3f7', textShadow: '0 1px 16px rgba(0,0,0,0.6)' }}
          >
            {result.text}
          </p>
        </div>
        <button
          onClick={() => setMode('default')}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full flex items-center justify-center
            text-white/90 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
          aria-label="Back"
        >
          <ChevronDown size={20} />
        </button>
        {showAudio && (
          <button
            onClick={onTogglePlay}
            disabled={!hasAudio}
            className="absolute right-5 z-10 w-14 h-14 rounded-full flex items-center justify-center
              disabled:opacity-40 active:scale-95 transition-transform"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)',
              background: 'rgba(113,183,255,0.92)',
              boxShadow: '0 6px 28px rgba(113,183,255,0.4)',
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={22} style={{ color: '#06203a' }} className="fill-current" />
            ) : (
              <Play size={22} style={{ color: '#06203a' }} className="fill-current translate-x-0.5" />
            )}
          </button>
        )}
      </div>,
    );
  }

  /* ── Default: editorial ── */
  return sheet(
    <div className="absolute inset-0 flex flex-col">
      {/* Hero media — tap to view image fullscreen */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: '54%' }}
        onClick={() => hasImage && setMode('image')}
        role={hasImage ? 'button' : undefined}
      >
        {showImage && imgSrc ? (
          <img src={imgSrc} alt="Dream" className="w-full h-full object-cover" onError={handleImgError} />
        ) : (
          <div className="w-full h-full bg-th-surface flex items-center justify-center">
            {isGenerating && <Loader2 size={28} className="animate-spin text-th-accent/70" />}
          </div>
        )}
        {/* fade into the canvas below */}
        <div
          className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--bg-base), transparent)' }}
        />
        {hasImage && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full
            pointer-events-none" style={{ background: 'rgba(0,0,0,0.32)' }}>
            <Maximize2 size={12} className="text-white/85" />
          </div>
        )}
      </div>

      {/* Narrative preview — tap to read fullscreen */}
      <div
        className="flex-1 min-h-0 relative px-6 pt-4 cursor-pointer"
        onClick={() => hasText && setMode('read')}
        role={hasText ? 'button' : undefined}
      >
        <div className="text-[11px] font-semibold tracking-[0.2em] text-th-accent mb-3">
          {t.visualization.sceneLabel.toUpperCase()}
        </div>
        {textLoading ? (
          <div className="flex flex-col gap-3">
            {[100, 88, 70].map((w, i) => (
              <div key={i} className="h-4 rounded bg-th-surface" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] leading-[1.78] text-th-text-secondary whitespace-pre-wrap">
            {result.text}
          </p>
        )}
        {/* bottom fade + read affordance */}
        {hasText && (
          <>
            <div
              className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
              style={{ background: 'linear-gradient(to top, var(--bg-base) 18%, transparent)' }}
            />
            <div className="absolute bottom-2.5 right-6 flex items-center gap-1 text-th-accent text-[12px] font-semibold">
              {t.visualization.readFull}
              <ChevronDown size={14} className="rotate-180" />
            </div>
          </>
        )}
      </div>

      {audioBar}

      {/* Top chrome */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center
          text-white/90 hover:text-white transition-colors"
        style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(6px)' }}
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={isSaving || isSaved}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 disabled:opacity-70
            hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(6px)' }}
          aria-label={t.visualization.saveButton}
        >
          {isSaving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isSaved ? (
            <Check size={18} className="text-green-400" />
          ) : (
            <Download size={18} />
          )}
        </button>
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:text-white transition-colors"
          style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(6px)' }}
          aria-label={t.visualization.shareButton}
        >
          <Share2 size={18} />
        </button>
      </div>
      {generatingChip}
    </div>,
  );
}

/* ── Save / Share row (legacy video layout) ── */
function SaveShare({
  onSave, isSaving, isSaved, t,
}: {
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div className="flex items-center gap-5">
      <button
        onClick={onSave}
        disabled={isSaving || isSaved}
        className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-th-text
          hover:bg-th-surface-hover disabled:opacity-50 shadow-sm transition-all"
      >
        {isSaving ? (
          <Loader2 size={16} className="animate-spin text-th-accent" />
        ) : isSaved ? (
          <Check size={16} className="text-green-500" />
        ) : (
          <Download size={16} className="text-th-accent" />
        )}
        <span className="font-semibold">
          {isSaving ? t.visualization.saving : isSaved ? t.visualization.savedLabel : t.visualization.saveButton}
        </span>
      </button>
      <button className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-th-text hover:bg-th-surface-hover shadow-sm transition-all">
        <Share2 size={16} className="text-th-text-tertiary" />
        <span className="font-semibold">{t.visualization.shareButton}</span>
      </button>
    </div>
  );
}

export default DreamViewer;
