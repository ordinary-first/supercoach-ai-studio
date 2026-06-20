import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

const EASE = 'cubic-bezier(0.32,0.72,0,1)';
const HERO_H = '54%';
const NO_IMAGE_BG =
  'radial-gradient(80% 60% at 50% 32%, rgba(113,183,255,0.16), transparent 62%), linear-gradient(180deg,#1b2530 0%,#11151b 60%,#0a0c10 100%)';
// subtle tiling film grain for cinematic texture
const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const viewerStyles = `
@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sheetDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes dvFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dvRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dvWave { 0%,100% { height: 5px; } 50% { height: var(--max-h); } }
@keyframes dvDrift { 0% { transform: scale(1.04) translate(0,0); } 100% { transform: scale(1.1) translate(-1.5%,-2%); } }
@keyframes dvZoomIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
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
  const textLoading = isGenerating && !result.text;

  const isRead = mode === 'read';
  const handleImgError = () => { if (!imgFallback && result.imageDataUrl) setImgFallback(true); };

  const generatingChip = isGenerating && generatingStep && (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1.5
      rounded-full apple-chip bg-th-accent-muted border-th-accent/20">
      <Loader2 size={14} className="animate-spin text-th-accent" />
      <span className="text-xs font-semibold text-th-accent">{generatingStep}</span>
    </div>
  );

  const frostBtn = 'flex items-center justify-center rounded-full text-white/90 hover:text-white transition-colors';
  const frostStyle = { background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as React.CSSProperties;

  const audioBar = showAudio && (
    <div className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 apple-chip border-th-border/40">
      <button
        onClick={onTogglePlay}
        disabled={!hasAudio}
        className="w-10 h-10 rounded-full bg-th-accent flex items-center justify-center shrink-0
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
          <span key={i} className="rounded-full" style={{
            width: '3px', minHeight: '5px', height: isPlaying ? undefined : '5px',
            backgroundColor: isPlaying ? 'var(--accent)' : 'var(--text-muted)', opacity: isPlaying ? 1 : 0.5,
            ['--max-h' as string]: bar.h,
            ...(isPlaying ? { animation: `dvWave 0.8s ease-in-out ${bar.d} infinite` } : {}),
          }} />
        ))}
      </div>
      <span className="text-[11px] font-semibold tracking-wide text-th-text-tertiary shrink-0">
        {t.visualization.typeAudio}
      </span>
    </div>
  );

  // Portal to <body> so the fullscreen viewer escapes VisualizationTab's
  // stacking context (z-50) and truly covers the dock (z-55) and coach bubble (z-58).
  const sheet = (children: React.ReactNode) => createPortal(
    <div
      className="fixed inset-0 flex flex-col apple-tab-shell"
      style={{
        zIndex: 9999,
        animation: isAnimating
          ? `sheetUp 420ms ${EASE} forwards`
          : 'sheetDown 300ms ease-in forwards',
      }}
    >
      <style>{viewerStyles}</style>
      {children}
    </div>,
    document.body,
  );

  /* ── Legacy stacked layout (video enabled) ── */
  if (showVideo) {
    const showNarrative =
      result.text || result.textStatus !== 'idle' || (isGenerating && generatingStep.includes('text'));
    return sheet(
      <>
        <button onClick={handleClose} className={`absolute top-4 left-4 z-30 w-10 h-10 apple-chip ${frostBtn} text-th-text-secondary`} aria-label="Close">
          <X size={20} />
        </button>
        {generatingChip}
        <div className="flex-1 overflow-y-auto pt-16 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex flex-col gap-0.5 px-0.5">
            <VideoSection videoUrl={result.videoUrl} videoStatus={result.videoStatus} isLoading={isGenerating || result.videoStatus === 'pending' || !!isCheckingVideo} />
            {showImage && <ImageSection imageUrl={result.imageUrl} imageDataUrl={result.imageDataUrl} isLoading={isGenerating && !hasImage} />}
            {showAudio && <AudioSection hasAudio={hasAudio} isLoading={audioLoading} isPlaying={isPlaying} onTogglePlay={onTogglePlay} />}
            {showNarrative && <NarrativeSection text={result.text} isLoading={textLoading} />}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center h-20 z-20"
          style={{ background: 'linear-gradient(to top, var(--bg-base) 60%, transparent)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <SaveShare {...{ onSave, isSaving, isSaved, t }} />
        </div>
      </>,
    );
  }

  /* ── Image-only fullscreen ── */
  if (mode === 'image' && hasImage && imgSrc) {
    return sheet(
      <div className="absolute inset-0 bg-black flex items-center justify-center" style={{ animation: 'dvFade 260ms ease forwards' }} onClick={() => setMode('default')}>
        <img src={imgSrc} alt="Dream" className="w-full h-full object-contain" onError={handleImgError} style={{ animation: `dvZoomIn 360ms ${EASE} both` }} />
        <button onClick={(e) => { e.stopPropagation(); setMode('default'); }} className={`absolute top-4 left-4 w-10 h-10 ${frostBtn}`} style={frostStyle} aria-label="Back">
          <ChevronDown size={20} />
        </button>
      </div>,
    );
  }

  /* ── Default + Read (shared persistent image) ── */
  return sheet(
    <div className="absolute inset-0 overflow-hidden">
      {/* Persistent image layer — its box + filter animate between editorial and read */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: isRead ? '100%' : HERO_H, transition: `height 520ms ${EASE}` }}
      >
        {showImage && imgSrc ? (
          <img
            src={imgSrc}
            alt={isRead ? '' : 'Dream'}
            aria-hidden={isRead}
            onError={handleImgError}
            className="w-full h-full object-cover"
            style={isRead
              ? { transform: 'scale(1.08)', filter: 'blur(10px) brightness(0.52) saturate(1.05)', transition: `transform 600ms ${EASE}, filter 520ms ease` }
              : { animation: 'dvDrift 24s ease-in-out infinite alternate', transition: 'filter 520ms ease' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: NO_IMAGE_BG }}>
            {isGenerating && <Loader2 size={28} className="animate-spin text-th-accent/70" />}
          </div>
        )}

        {/* cinematic vignette + film grain (both modes) */}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 130px 26px rgba(0,0,0,0.5)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("${GRAIN}")`, opacity: 0.05, mixBlendMode: 'overlay' }} />

        {/* editorial bottom fade (default) */}
        <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--bg-base), transparent)', opacity: isRead ? 0 : 1, transition: 'opacity 280ms ease' }} />
        {/* readability scrim (read) — graded, heavier where text sits, keeps image atmosphere */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(6,8,11,0.92) 0%, rgba(6,8,11,0.74) 38%, rgba(6,8,11,0.6) 72%, rgba(6,8,11,0.5) 100%)',
            opacity: isRead ? 1 : 0, transition: 'opacity 420ms ease',
          }} />
      </div>

      {/* DEFAULT content */}
      {mode === 'default' && (
        <>
          {/* image tap zone + affordance */}
          {hasImage && (
            <>
              <button onClick={() => setMode('image')} className="absolute inset-x-0 top-0 z-10" style={{ height: HERO_H, background: 'transparent' }} aria-label={t.visualization.imageAlt} />
              <div className="absolute z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full pointer-events-none"
                style={{ top: `calc(${HERO_H} - 46px)`, right: '16px', background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(6px)' }}>
                <Maximize2 size={13} className="text-white/90" />
              </div>
            </>
          )}

          {/* narrative preview — tap to read */}
          <div
            className="absolute left-0 right-0 z-10 px-6 overflow-hidden cursor-pointer"
            style={{ top: HERO_H, bottom: showAudio ? '92px' : '24px', paddingTop: '18px' }}
            onClick={() => hasText && setMode('read')}
            role={hasText ? 'button' : undefined}
          >
            <div className="text-[12px] font-semibold tracking-wide text-th-accent mb-3">
              {t.visualization.sceneLabel}
            </div>
            {textLoading ? (
              <div className="flex flex-col gap-3">
                {[100, 88, 70].map((w, i) => (<div key={i} className="h-4 rounded bg-th-surface" style={{ width: `${w}%` }} />))}
              </div>
            ) : (
              <p className="text-[15.5px] leading-[1.8] text-th-text-secondary whitespace-pre-wrap">{result.text}</p>
            )}
            {hasText && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, var(--bg-base) 16%, transparent)' }} />
                <div className="absolute bottom-1.5 right-6 flex items-center gap-1 text-th-accent text-[12px] font-semibold">
                  {t.visualization.readFull}
                  <ChevronDown size={14} className="rotate-180" />
                </div>
              </>
            )}
          </div>

          {/* audio bar */}
          {showAudio && (
            <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-2"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
              {audioBar}
            </div>
          )}

          {/* chrome */}
          <button onClick={handleClose} className={`absolute top-4 left-4 z-30 w-10 h-10 ${frostBtn}`} style={frostStyle} aria-label="Close"><X size={20} /></button>
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            <button onClick={onSave} disabled={isSaving || isSaved}
              className={`h-10 flex items-center justify-center rounded-full text-white/90 hover:text-white transition-all disabled:opacity-90 ${isSaving || isSaved ? 'px-3.5 gap-1.5' : 'w-10'}`}
              style={frostStyle} aria-label={t.visualization.saveButton}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : isSaved ? <Check size={16} className="text-green-400" /> : <Download size={18} />}
              {(isSaving || isSaved) && (
                <span className="text-[13px] font-semibold whitespace-nowrap">
                  {isSaving ? t.visualization.saving : t.visualization.savedLabel}
                </span>
              )}
            </button>
            <button className={`w-10 h-10 ${frostBtn}`} style={frostStyle} aria-label={t.visualization.shareButton}><Share2 size={18} /></button>
          </div>
        </>
      )}

      {/* READ content */}
      {isRead && (
        <>
          <div className="absolute inset-0 z-10 overflow-y-auto px-7 pt-20 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 104px)' }}>
            <div className="text-[12px] font-semibold tracking-wide mb-5" style={{ color: '#a9cdff', textShadow: '0 1px 10px rgba(0,0,0,0.5)', animation: `dvRise 420ms ${EASE} both` }}>
              {t.visualization.sceneLabel}
            </div>
            <p className="text-[18px] leading-[1.92] whitespace-pre-wrap font-body" style={{ color: '#f1f3f7', textShadow: '0 1px 16px rgba(0,0,0,0.6)', animation: `dvRise 520ms ${EASE} 90ms both` }}>
              {result.text}
            </p>
          </div>
          <button onClick={() => setMode('default')} className={`absolute top-4 left-4 z-30 w-10 h-10 ${frostBtn}`} style={frostStyle} aria-label="Back"><ChevronDown size={20} /></button>
          {hasAudio && (
            <button onClick={onTogglePlay} className="absolute right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 26px)', background: 'rgba(113,183,255,0.94)', boxShadow: '0 6px 30px rgba(113,183,255,0.42)' }}
              aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={22} style={{ color: '#06203a' }} className="fill-current" /> : <Play size={22} style={{ color: '#06203a' }} className="fill-current translate-x-0.5" />}
            </button>
          )}
        </>
      )}

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
      <button onClick={onSave} disabled={isSaving || isSaved}
        className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-th-text hover:bg-th-surface-hover disabled:opacity-50 shadow-sm transition-all">
        {isSaving ? <Loader2 size={16} className="animate-spin text-th-accent" /> : isSaved ? <Check size={16} className="text-green-500" /> : <Download size={16} className="text-th-accent" />}
        <span className="font-semibold">{isSaving ? t.visualization.saving : isSaved ? t.visualization.savedLabel : t.visualization.saveButton}</span>
      </button>
      <button className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-th-text hover:bg-th-surface-hover shadow-sm transition-all">
        <Share2 size={16} className="text-th-text-tertiary" />
        <span className="font-semibold">{t.visualization.shareButton}</span>
      </button>
    </div>
  );
}

export default DreamViewer;
