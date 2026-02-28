import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';

import { WeekCoverCard } from './WeekCoverCard';
import type { FeedbackCard, ToDoItem } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface WeekCoverFlowProps {
  weeks: Date[];
  activeIndex: number;
  todos: ToDoItem[];
  feedbackCards: Map<string, FeedbackCard>;
  t: TranslationStrings;
  onIndexChange: (index: number) => void;
  onDayTap: (date: Date) => void;
  onWeekTap: (weekIndex: number) => void;
}

interface StackPreset {
  distance: number;
  scale: number;
  opacity: number;
  blur: number;
  rotateX: number;
}

const STACK_PRESETS: StackPreset[] = [
  { distance: 0,   scale: 1.00, opacity: 1.00, blur: 0,   rotateX: 0  },
  { distance: 70,  scale: 0.92, opacity: 0.78, blur: 0.4, rotateX: 14 },
  { distance: 130, scale: 0.84, opacity: 0.55, blur: 0.8, rotateX: 20 },
  { distance: 180, scale: 0.76, opacity: 0.35, blur: 1.2, rotateX: 26 },
  { distance: 220, scale: 0.70, opacity: 0.18, blur: 1.8, rotateX: 30 },
];

const lerp = (start: number, end: number, ratio: number): number =>
  start + (end - start) * ratio;

const getStackPreset = (offsetAbs: number): StackPreset => {
  const bounded = Math.max(0, offsetAbs);
  const lo = Math.min(Math.floor(bounded), STACK_PRESETS.length - 1);
  const hi = Math.min(lo + 1, STACK_PRESETS.length - 1);
  const mix = bounded - lo;
  return {
    distance: lerp(STACK_PRESETS[lo].distance, STACK_PRESETS[hi].distance, mix),
    scale: lerp(STACK_PRESETS[lo].scale, STACK_PRESETS[hi].scale, mix),
    opacity: lerp(STACK_PRESETS[lo].opacity, STACK_PRESETS[hi].opacity, mix),
    blur: lerp(STACK_PRESETS[lo].blur, STACK_PRESETS[hi].blur, mix),
    rotateX: lerp(STACK_PRESETS[lo].rotateX, STACK_PRESETS[hi].rotateX, mix),
  };
};

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Runway height for CoverFlow cards to extend above/below viewport.
// Uses Swiper's slidesOffsetBefore/After (NOT CSS padding, which breaks centeredSlides).
const RUNWAY_PX = 300;

export const WeekCoverFlow: React.FC<WeekCoverFlowProps> = ({
  weeks,
  activeIndex,
  todos,
  feedbackCards,
  t,
  onIndexChange,
  onDayTap,
  onWeekTap,
}) => {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [isLowPerf, setIsLowPerf] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Reverse: oldest=index 0 (top in vertical Swiper), current=last index (center).
  const reversedWeeks = useMemo(() => [...weeks].reverse(), [weeks]);
  const lastIdx = reversedWeeks.length - 1;
  const toReverseIdx = useCallback((i: number) => lastIdx - i, [lastIdx]);
  const toOriginalIdx = useCallback((ri: number) => lastIdx - ri, [lastIdx]);

  useEffect(() => {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
    setIsLowPerf(cores <= 4);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setIsReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const className = useMemo(() => {
    const cls: string[] = ['fb-coverflow-swiper'];
    if (isLowPerf) cls.push('fb-coverflow-lowperf');
    if (isReducedMotion) cls.push('fb-coverflow-reduced');
    return cls.join(' ');
  }, [isLowPerf, isReducedMotion]);

  const applySlideStyles = useCallback((swiper: SwiperInstance) => {
    swiper.slides.forEach((slideEl, slideIndex) => {
      const host = slideEl.querySelector<HTMLElement>('.fb-coverflow-card-host');
      if (!host) return;

      const reportedProgress = Number((slideEl as unknown as { progress?: number }).progress ?? NaN);
      const fallbackProgress = slideIndex - swiper.activeIndex;
      let rawProgress = Number.isFinite(reportedProgress) ? reportedProgress : fallbackProgress;
      const isActive = slideIndex === swiper.activeIndex
        || slideEl.classList.contains('swiper-slide-active');
      if (isActive) rawProgress = 0;
      if (!Number.isFinite(rawProgress)) rawProgress = fallbackProgress;

      const offsetAbs = Math.min(4.2, Math.abs(rawProgress));
      const preset = getStackPreset(offsetAbs);

      // Past (rawProgress < 0) = above active. Below (rawProgress > 0) = newer, push harder.
      const direction = rawProgress === 0 ? 0 : rawProgress > 0 ? 1 : -1;
      const isBelowActive = rawProgress > 0;
      const distance = direction * preset.distance * (isBelowActive ? 1.5 : 1);
      const rotateX = direction === 0 ? 0 : -direction * preset.rotateX;

      const scale = isLowPerf ? Math.max(0.54, preset.scale) : preset.scale;
      let opacity = preset.opacity;
      if (isActive) opacity = 1;
      if (isBelowActive) opacity *= 0.65;

      const zIndex = 220 - Math.round(offsetAbs * 26);
      const blurValue = isLowPerf || isReducedMotion ? 0 : preset.blur;

      host.style.transform = `translate3d(0, ${distance}px, 0) rotateX(${rotateX}deg) scale(${scale})`;
      host.style.opacity = String(opacity);
      (slideEl as HTMLElement).style.zIndex = String(zIndex);
      host.style.zIndex = String(zIndex);
      host.style.filter = blurValue <= 0
        ? 'none'
        : `blur(${blurValue.toFixed(2)}px) saturate(${(1.06 - offsetAbs * 0.04).toFixed(2)})`;
      host.style.pointerEvents = Math.abs(rawProgress) < 0.32 ? 'auto' : 'none';
    });
  }, [isLowPerf, isReducedMotion]);

  const applyTransition = useCallback((swiper: SwiperInstance, durationMs: number) => {
    swiper.slides.forEach((slideEl) => {
      const host = slideEl.querySelector<HTMLElement>('.fb-coverflow-card-host');
      if (!host) return;
      host.style.transitionDuration = `${durationMs}ms`;
    });
  }, []);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    const targetIdx = toReverseIdx(activeIndex);
    if (swiper.activeIndex !== targetIdx) {
      swiper.slideTo(targetIdx, isReducedMotion ? 220 : 420);
    }
    applySlideStyles(swiper);
  }, [activeIndex, isReducedMotion, applySlideStyles, toReverseIdx]);

  return (
    <div className="fb-coverflow-stage flex-1 relative overflow-hidden px-1">
      <Swiper
        modules={[Mousewheel]}
        direction="vertical"
        slidesPerView="auto"
        centeredSlides
        observer
        observeParents
        speed={isReducedMotion ? 220 : 420}
        threshold={2}
        spaceBetween={isLowPerf ? -120 : -150}
        slidesOffsetBefore={RUNWAY_PX}
        slidesOffsetAfter={RUNWAY_PX}
        resistance
        resistanceRatio={0.82}
        watchSlidesProgress
        simulateTouch
        mousewheel={{ sensitivity: 1, forceToAxis: true, invert: true }}
        grabCursor
        longSwipes
        longSwipesRatio={0.12}
        longSwipesMs={180}
        shortSwipes
        className={className}
        initialSlide={toReverseIdx(activeIndex)}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          // Force recalc + center after all slides are measured
          swiper.update();
          const target = toReverseIdx(activeIndex);
          swiper.slideTo(target, 0);
          requestAnimationFrame(() => applySlideStyles(swiper));
        }}
        onProgress={(swiper) => applySlideStyles(swiper)}
        onSetTransition={(swiper, duration) => applyTransition(swiper, duration)}
        onSlideChange={(swiper) => onIndexChange(toOriginalIdx(swiper.activeIndex))}
      >
        {reversedWeeks.map((weekStart, rIndex) => (
          <SwiperSlide key={toDateKey(weekStart)}>
            <div className="fb-coverflow-slide-shell">
              <div className="fb-coverflow-card-host">
                <WeekCoverCard
                  weekStart={weekStart}
                  todos={todos}
                  feedbackCards={feedbackCards}
                  t={t}
                  isActive={rIndex === toReverseIdx(activeIndex)}
                  onDayTap={onDayTap}
                  onCardTap={() => onWeekTap(toOriginalIdx(rIndex))}
                />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};
