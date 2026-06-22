import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Check, Share2, RefreshCw, Play, Pause } from 'lucide-react';
import type { VisualizationResult, GenerationSettings } from '../../hooks/useGenerationPipeline';
import { useTranslation } from '../../i18n/useTranslation';
import { FEATURES } from '../../features';
import VideoSection from './VideoSection';

interface DreamViewerProps {
  result: VisualizationResult;
  settings: GenerationSettings;
  isGenerating: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRegenerate?: () => void;
  onRefreshVideo?: () => void;
  isCheckingVideo?: boolean;
}

type EmotionKey = 'buoyant' | 'calm' | 'confident' | 'free';
type GenerationStatusLike = VisualizationResult['textStatus'] | VisualizationResult['videoStatus'];

const AURA_STOPS: Record<EmotionKey, [string, string]> = {
  buoyant: ['#71b7ff', '#f0d264'],
  calm: ['#71b7ff', '#4de8e0'],
  confident: ['#4de8e0', '#f0d264'],
  free: ['#71b7ff', '#9fe8d9'],
};
const DEFAULT_STOPS: [string, string] = ['#71b7ff', '#4de8e0'];
const HERO_H = '52%';

const styles = `
@keyframes dvSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes dvSheetDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes dvStaggerIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dvDrift { 0% { transform: scale(1.04) translate(0,0); } 100% { transform: scale(1.1) translate(-1.5%,-2%); } }
`;

// 결정론적 첫 문장 선택 (감정 단어 포함 우선, 없으면 첫 문장). 신성 캔버스 플로트는 1문장 캡.
function firstSentence(text?: string): string | null {
  if (!text) return null;
  const parts = text.split(/(?<=[.!?。\n])\s+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const emo = parts.find((s) => /(느낌|벅|평온|자신|자유|행복|설레|충만|편안)/.test(s));
  return (emo || parts[0]).slice(0, 80);
}

function DreamViewer({
  result, settings, isGenerating, isOpen, onClose, onSave, isSaving, isSaved,
  isPlaying, onTogglePlay, onRegenerate, onRefreshVideo, isCheckingVideo,
}: DreamViewerProps) {
  const { t } = useTranslation();
  const d = t.visualization.dawn;

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [emotion, setEmotion] = useState<EmotionKey | null>(null);
  const [stage, setStage] = useState<'gen' | 'cleave' | 'open'>('gen');
  const [cracked, setCracked] = useState(false);
  const [settled, setSettled] = useState(false); // open: 순수 이미지 머무름 → 크롬 진입
  const [readMode, setReadMode] = useState(false); // 전체 내러티브 읽기
  const [ring, setRing] = useState<{ x: number; y: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [imgFallback, setImgFallback] = useState(false);
  const sawGeneratingRef = useRef(false);

  const hasImage = !!(result.imageUrl || result.imageDataUrl);
  const imageSrc = imgFallback ? result.imageDataUrl : (result.imageUrl || result.imageDataUrl);
  const auraStops = emotion ? AURA_STOPS[emotion] : DEFAULT_STOPS;

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    sawGeneratingRef.current = isGenerating;
    const alreadyComplete = !isGenerating && (hasImage || result.textStatus === 'completed');
    setStage(alreadyComplete ? 'open' : 'gen');
    setCracked(false); setEmotion(null); setShowDetails(false); setReadMode(false);
    setSettled(alreadyComplete); // 저장본 로드는 즉시 정착
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (isGenerating) sawGeneratingRef.current = true; }, [isGenerating]);

  // 생성 종료 → img.decode() 후 가르기 준비
  useEffect(() => {
    if (stage !== 'gen' || isGenerating || !sawGeneratingRef.current) return;
    if (hasImage && imageSrc) {
      let alive = true;
      const img = new Image();
      img.src = imageSrc;
      const ready = () => {
        if (!alive) return;
        setStage('cleave');
        requestAnimationFrame(() => requestAnimationFrame(() => setCracked(true)));
      };
      img.decode().then(ready).catch(ready);
      return () => { alive = false; };
    }
    setStage('open');
  }, [stage, isGenerating, hasImage, imageSrc]);

  // open 진입 → settle 박자(순수 이미지 ~1.2s) 후 크롬 진입
  useEffect(() => {
    if (stage !== 'open' || settled) return;
    const timer = setTimeout(() => setSettled(true), 1200);
    return () => clearTimeout(timer);
  }, [stage, settled]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    const timer = setTimeout(() => { setIsVisible(false); onClose(); }, 300);
    return () => clearTimeout(timer);
  }, [onClose]);

  const completeReveal = useCallback((x?: number, y?: number) => {
    if (typeof x === 'number' && typeof y === 'number') setRing({ x, y });
    setStage('open');
  }, []);

  const handleImgError = () => { if (!imgFallback && result.imageDataUrl) setImgFallback(true); };

  if (!isVisible) return null;

  // 진행 점: settings 기반 데이터-구동
  const dots: { key: string; status: 'done' | 'work' | 'fail' }[] = [];
  const dotStatus = (s: GenerationStatusLike): 'done' | 'work' | 'fail' =>
    s === 'completed' || s === 'ready' ? 'done' : s === 'failed' ? 'fail' : 'work';
  if (settings.text) dots.push({ key: 'text', status: dotStatus(result.textStatus) });
  if (settings.image) dots.push({ key: 'image', status: dotStatus(result.imageStatus) });
  if (settings.audio) dots.push({ key: 'audio', status: dotStatus(result.audioStatus) });
  if (settings.video && FEATURES.videoGeneration) dots.push({ key: 'video', status: dotStatus(result.videoStatus) });

  // 생성 박자
  const textDone = !settings.text || result.textStatus !== 'idle';
  const imageWorking = settings.image && result.imageStatus === 'idle';
  const audioWorking = settings.audio && result.audioStatus === 'idle';
  const videoWorking = settings.video && FEATURES.videoGeneration && result.videoStatus === 'idle';
  let beat: 'dictating' | 'question' | 'wait' = 'dictating';
  if (textDone && imageWorking) beat = 'question';
  else if (result.imageStatus !== 'idle' && (audioWorking || videoWorking)) beat = 'wait';

  const firstDecl = firstSentence(result.text);
  const closingLine =
    emotion === 'buoyant' ? d.closingBuoyant
    : emotion === 'calm' ? d.closingCalm
    : emotion === 'confident' ? d.closingConfident
    : emotion === 'free' ? d.closingFree
    : d.closingDefault;

  const imagePartialFail = result.imageStatus === 'failed';
  const audioPartialFail = result.audioStatus === 'failed';
  const videoPartialFail = result.videoStatus === 'failed';
  const errorMeta = result.imageError || result.audioError || result.videoError;
  const badge = d.badge.replace('{year}', String(new Date().getFullYear()));
  const hasAudio = result.audioStatus === 'completed' && !!(result.audioUrl || result.audioData);
  const hasText = !!result.text;

  const auraStyle = {
    ['--aura-current-a']: auraStops[0],
    ['--aura-current-b']: auraStops[1],
  } as CSSProperties;

  const emotions: EmotionKey[] = ['buoyant', 'calm', 'confident', 'free'];
  const chipLabel: Record<EmotionKey, string> = {
    buoyant: d.chipBuoyant, calm: d.chipCalm, confident: d.chipConfident, free: d.chipFree,
  };

  const coachAvatar = (size: number) => (
    <span className="shrink-0 rounded-full" style={{ width: size, height: size, background: 'linear-gradient(135deg,#71b7ff,#4de8e0)', padding: size > 28 ? 2 : 1.5 }}>
      <span className="flex w-full h-full rounded-full items-center justify-center text-white"
        style={{ background: '#12141a', fontSize: size > 28 ? 13 : 10 }}>☀</span>
    </span>
  );

  const body = (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        zIndex: 9999, background: 'var(--dawn-canvas)',
        animation: isAnimating ? 'dvSheetUp 420ms cubic-bezier(0.32,0.72,0,1) forwards' : 'dvSheetDown 300ms ease-in forwards',
      }}
    >
      <style>{styles}</style>

      {/* 하단 지평선 오로라 (gen/cleave/settle 전까지) */}
      {(stage === 'gen' || (stage === 'open' && !hasImage)) && (
        <div className={`dawn-aurora ${stage === 'gen' ? 'is-breathing' : 'is-risen'}`} style={auraStyle} />
      )}

      {/* 상단 미니마이즈 셰브론 */}
      {(stage === 'gen' || (stage === 'open' && (settled || !hasImage))) && (
        <button onClick={handleClose}
          className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white/90"
          style={{ background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(8px)' }} aria-label={t.common?.back || 'close'}>
          <ChevronDown size={20} />
        </button>
      )}

      {/* ============ 생성 중 ============ */}
      {stage === 'gen' && (
        <div className="absolute inset-0 z-10 flex flex-col px-9 pt-28 pb-28">
          {beat !== 'dictating' && firstDecl && (
            <p key={firstDecl} className="text-[25px] font-light leading-snug text-white tracking-tight"
              style={{ animation: 'dvStaggerIn 480ms var(--ease-dawn) both', textShadow: '0 2px 26px rgba(0,0,0,.55)' }}>
              {firstDecl}
            </p>
          )}
          <div className="flex-1" />
          <div className="mb-2">
            <div className="flex items-start gap-2.5 mb-4">
              {coachAvatar(28)}
              <p className="text-[15px] text-th-text-secondary leading-relaxed">
                {beat === 'wait' ? (videoWorking ? d.videoWait : d.audioWait) : beat === 'question' ? d.question : d.dictating}
              </p>
            </div>
            {beat === 'question' && (
              <div className="flex flex-wrap gap-2.5 pl-9">
                {emotions.map((e) => (
                  <button key={e} onClick={() => setEmotion(e)}
                    className="px-5 py-2.5 rounded-full text-[15px] font-semibold text-white transition-all active:scale-95"
                    style={emotion === e ? {
                      background: 'linear-gradient(135deg,rgba(113,183,255,.30),rgba(240,210,100,.22))',
                      border: '1px solid rgba(113,183,255,.5)', boxShadow: '0 0 18px -4px rgba(113,183,255,.5)',
                    } : { background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)', backdropFilter: 'blur(20px) saturate(1.4)' }}>
                    {chipLabel[e]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-7 mt-7">
            {dots.map((dot) => (
              <span key={dot.key} className="w-[7px] h-[7px] rounded-full"
                style={dot.status === 'done' ? { background: 'var(--dawn-sacred)', boxShadow: '0 0 12px 2px rgba(240,210,100,.6)' }
                  : dot.status === 'fail' ? { background: 'var(--dawn-amber)' }
                  : { background: 'rgba(255,255,255,.85)', animation: 'dawnBreathe 1.6s ease-in-out infinite' }} />
            ))}
          </div>
        </div>
      )}

      {/* ============ 리빌 (가르기) ============ */}
      {stage === 'cleave' && hasImage && imageSrc && (
        <div className="absolute inset-0 z-10" onClick={(e) => completeReveal(e.clientX, e.clientY)}
          role="button" style={{ cursor: 'pointer' }}>
          <img src={imageSrc} alt={t.visualization.generatedImageAlt} onError={handleImgError}
            className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-0 bottom-0 left-0 w-1/2"
            style={{ background: 'var(--dawn-canvas)', transform: cracked ? 'translateX(-7%)' : 'translateX(0)', transition: 'transform 760ms var(--ease-cleave)' }} />
          <div className="absolute top-0 bottom-0 right-0 w-1/2"
            style={{ background: 'var(--dawn-canvas)', transform: cracked ? 'translateX(7%)' : 'translateX(0)', transition: 'transform 760ms var(--ease-cleave)' }} />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[14%] pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(113,183,255,.35) 35%,rgba(77,232,224,.45) 50%,rgba(113,183,255,.35) 65%,transparent)', boxShadow: '0 0 50px 8px rgba(113,183,255,.25)', opacity: cracked ? 1 : 0, transition: 'opacity 760ms var(--ease-cleave)' }} />
          <span className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{ background: 'var(--dawn-sacred)', boxShadow: '0 0 18px 4px rgba(240,210,100,.7)', animation: 'dawnBreathe 2.4s ease-in-out infinite' }} />
          <p className="absolute left-1/2 -translate-x-1/2 top-[calc(46%+18px)] text-[12px] font-semibold tracking-wide text-white/85 whitespace-nowrap">{d.revealTap}</p>
          <p className="absolute left-0 right-0 bottom-24 text-center text-[15px] text-th-text-secondary px-8">{d.revealHint}</p>
          <button onClick={(e) => { e.stopPropagation(); completeReveal(); }}
            className="absolute left-1/2 -translate-x-1/2 bottom-12 px-6 py-2.5 rounded-full apple-chip text-[13px] font-semibold text-th-text">
            {d.revealButton}
          </button>
        </div>
      )}
      {ring && stage === 'open' && (
        <span className="absolute w-16 h-16 rounded-full pointer-events-none z-20"
          style={{ left: ring.x, top: ring.y, background: 'radial-gradient(circle,rgba(240,210,100,.5),transparent 70%)', animation: 'dawnRingOut 700ms var(--ease-dawn) forwards' }} />
      )}

      {/* ============ 결과 (open) — 하이브리드: 영화적 settle → 에디토리얼 읽기 ============ */}
      {stage === 'open' && hasImage && imageSrc && (
        <>
          {/* 이미지 히어로: settle 전 풀블리드 → settle 후 52% → read 시 100% 블러 */}
          <div className="absolute inset-x-0 top-0 overflow-hidden z-0"
            style={{ height: readMode ? '100%' : (settled ? HERO_H : '100%'), transition: 'height 560ms var(--ease-cleave)' }}>
            <img src={imageSrc} alt={readMode ? '' : t.visualization.generatedImageAlt} aria-hidden={readMode} onError={handleImgError}
              className="w-full h-full object-cover"
              style={readMode
                ? { transform: 'scale(1.08)', filter: 'blur(10px) brightness(0.5) saturate(1.05)', transition: 'transform 600ms var(--ease-cleave), filter 520ms ease' }
                : { animation: 'dvDrift 24s ease-in-out infinite alternate' }} />
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 130px 26px rgba(0,0,0,0.45)' }} />
            {/* 하단 18% 방향성 램프(에디토리얼) / read 스크림 */}
            <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
              style={{ background: 'linear-gradient(to top, var(--dawn-canvas), transparent)', opacity: readMode ? 0 : (settled ? 1 : 0), transition: 'opacity 400ms ease' }} />
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(8,9,12,0.92) 0%, rgba(8,9,12,0.74) 40%, rgba(8,9,12,0.56) 100%)', opacity: readMode ? 1 : 0, transition: 'opacity 420ms ease' }} />
          </div>

          {/* 배지 */}
          {settled && !readMode && (
            <div className="absolute top-[60px] right-4 z-30 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white"
              style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}>
              ☀ {badge}
            </div>
          )}

          {/* 에디토리얼 본문 (settle 후, read 아님) */}
          {settled && !readMode && (
            <div className="absolute inset-x-0 z-10 flex flex-col" style={{ top: HERO_H, bottom: 0 }}>
              <div className="flex-1 overflow-hidden px-6 pt-4">
                {/* 코치 마무리 줄 */}
                <div className="flex items-start gap-2.5 mb-3" style={{ animation: 'dvStaggerIn 480ms var(--ease-dawn) both' }}>
                  {coachAvatar(24)}
                  <p className="text-[15px] font-medium text-white leading-relaxed">{closingLine}</p>
                </div>
                {imagePartialFail && <p className="mb-2 text-[13px] text-th-text-secondary">{d.partialFail}</p>}
                {audioPartialFail && <p className="mb-2 text-[13px] text-th-text-tertiary">{d.audioFailLine}</p>}
                {videoPartialFail && <p className="mb-2 text-[13px] text-th-text-tertiary">{d.videoFailLine}</p>}
                {/* 내러티브 프리뷰 — 탭하면 전체 읽기 */}
                {hasText && (
                  <div className="relative cursor-pointer" onClick={() => setReadMode(true)} role="button"
                    style={{ animation: 'dvStaggerIn 520ms var(--ease-dawn) 120ms both' }}>
                    <div className="text-[11px] font-semibold tracking-wide text-th-accent mb-2">{d.storyLabel}</div>
                    <p className="text-[14.5px] leading-[1.75] text-th-text-secondary whitespace-pre-wrap max-h-[7.5em] overflow-hidden">{result.text}</p>
                    <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
                      style={{ background: 'linear-gradient(to top, var(--dawn-canvas) 12%, transparent)' }} />
                    <div className="mt-1 flex items-center gap-1 text-th-accent text-[12px] font-semibold">
                      {d.readFull}<ChevronDown size={13} className="rotate-180" />
                    </div>
                  </div>
                )}
              </div>

              {/* 하단 바: 오디오 + 약속 */}
              <div className="px-6 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
                {settings.video && FEATURES.videoGeneration && (result.videoUrl || result.videoStatus === 'pending') && (
                  <div className="mb-3 rounded-2xl overflow-hidden">
                    <VideoSection videoUrl={result.videoUrl} videoStatus={result.videoStatus} isLoading={!!isCheckingVideo || result.videoStatus === 'pending'} />
                    {result.videoStatus === 'pending' && (
                      <button onClick={onRefreshVideo} disabled={isCheckingVideo} className="mt-2 flex items-center gap-1.5 text-[12px] text-th-accent">
                        <RefreshCw size={12} className={isCheckingVideo ? 'animate-spin' : ''} /> {d.videoPoster}
                      </button>
                    )}
                  </div>
                )}
                {hasAudio && (
                  <div className="flex items-center gap-3 mb-3">
                    <button onClick={onTogglePlay} className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{ background: 'linear-gradient(135deg,#71b7ff,#4de8e0)', boxShadow: '0 6px 22px -6px rgba(77,232,224,.6)' }}>
                      {isPlaying ? <Pause size={18} className="text-[#06121f] fill-current" /> : <Play size={18} className="text-[#06121f] fill-current translate-x-0.5" />}
                    </button>
                    <div className="flex-1 flex items-center gap-[3px] h-6">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <span key={i} className="flex-1 rounded-full" style={{ height: `${30 + ((i * 37) % 60)}%`, background: 'linear-gradient(180deg,#71b7ff,#4de8e0)', opacity: isPlaying ? 0.9 : 0.4 }} />
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={onSave} disabled={isSaving}
                  className="w-full py-3.5 rounded-2xl text-[16px] font-bold text-[#06121f] active:scale-[.98] transition-transform disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,rgba(113,183,255,.95),rgba(77,232,224,.9))', boxShadow: '0 10px 30px -10px rgba(77,232,224,.55)' }}>
                  {isSaving ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {t.visualization.saving}</span>
                    : isSaved ? <span className="inline-flex items-center gap-2"><Check size={16} /> {d.promiseDone}</span> : d.promiseCta}
                </button>
                <div className="flex items-center justify-center gap-7 mt-3 text-[13px] font-semibold text-th-text-tertiary">
                  <button className="flex items-center gap-1.5"><Share2 size={14} /> {t.visualization.shareButton}</button>
                  {onRegenerate && <button onClick={onRegenerate} className="flex items-center gap-1.5"><RefreshCw size={14} /> {d.retry}</button>}
                </div>
              </div>
            </div>
          )}

          {/* 전체 읽기 (read) */}
          {readMode && (
            <>
              <div className="absolute inset-0 z-10 overflow-y-auto px-7 pt-20 scrollbar-hide"
                style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 96px)' }}>
                <div className="flex items-center gap-2 mb-5" style={{ animation: 'dvStaggerIn 420ms var(--ease-dawn) both' }}>
                  {coachAvatar(22)}
                  <span className="text-[13px] font-medium" style={{ color: '#e9eef5', textShadow: '0 1px 12px rgba(0,0,0,.6)' }}>{closingLine}</span>
                </div>
                <p className="text-[18px] leading-[1.9] whitespace-pre-wrap font-body"
                  style={{ color: '#f1f3f7', textShadow: '0 1px 16px rgba(0,0,0,0.6)', animation: 'dvStaggerIn 520ms var(--ease-dawn) 90ms both' }}>
                  {result.text}
                </p>
              </div>
              <button onClick={() => setReadMode(false)}
                className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white/90"
                style={{ background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(8px)' }} aria-label={t.common?.back || 'back'}>
                <ChevronDown size={20} />
              </button>
              {hasAudio && (
                <button onClick={onTogglePlay} className="absolute right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ bottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)', background: 'rgba(113,183,255,0.94)', boxShadow: '0 6px 30px rgba(113,183,255,0.42)' }}>
                  {isPlaying ? <Pause size={22} style={{ color: '#06203a' }} className="fill-current" /> : <Play size={22} style={{ color: '#06203a' }} className="fill-current translate-x-0.5" />}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* 결과 — 이미지 없음(텍스트 전용) */}
      {stage === 'open' && !hasImage && (
        <div className="absolute inset-0 z-10 flex flex-col">
          <div className="flex-1 overflow-y-auto px-8 pt-24 scrollbar-hide" style={{ paddingBottom: 120 }}>
            <div className="flex items-center gap-2 mb-5">{coachAvatar(24)}<span className="text-[14px] text-th-text-secondary">{closingLine}</span></div>
            {imagePartialFail && <p className="mb-4 text-[14px] text-th-text-secondary">{d.partialFail}
              {errorMeta && <button onClick={() => setShowDetails((v) => !v)} className="ml-2 text-th-text-muted underline text-[12px]">{d.details}</button>}
              {showDetails && errorMeta && <span className="block mt-1 text-[11px] text-th-text-muted font-mono break-all">{[errorMeta.message, errorMeta.code, errorMeta.requestId].filter(Boolean).join(' · ')}</span>}
            </p>}
            <p className="text-[18px] font-light leading-[1.9] text-white whitespace-pre-wrap" style={{ textShadow: '0 2px 26px rgba(0,0,0,.5)' }}>
              {result.text || firstDecl || closingLine}
            </p>
          </div>
          <div className="px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' }}>
            <button onClick={onSave} disabled={isSaving}
              className="w-full py-3.5 rounded-2xl text-[16px] font-bold text-[#06121f] active:scale-[.98] transition-transform disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,rgba(113,183,255,.95),rgba(77,232,224,.9))', boxShadow: '0 10px 30px -10px rgba(77,232,224,.55)' }}>
              {isSaving ? t.visualization.saving : isSaved ? d.promiseDone : d.promiseCta}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(body, document.body);
}

export default DreamViewer;
