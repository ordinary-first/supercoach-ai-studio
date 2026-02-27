import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
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
  { distance: 0, scale: 1, opacity: 1, blur: 0, rotateX: 0 },
  { distance: 118, scale: 0.84, opacity: 0.7, blur: 0.7, rotateX: 38 },
  { distance: 178, scale: 0.68, opacity: 0.46, blur: 1.2, rotateX: 52 },
  { distance: 230, scale: 0.56, opacity: 0.28, blur: 1.8, rotateX: 60 },
  { distance: 264, scale: 0.48, opacity: 0.14, blur: 2.3, rotateX: 64 },
];

const lerp = (start: number, end: number, ratio: number): number => {
  return start + (end - start) * ratio;
};

const getStackPreset = (offsetAbs: number): StackPreset => {
  const bounded = Math.max(0, offsetAbs);
  const lowerIndex = Math.min(Math.floor(bounded), STACK_PRESETS.length - 1);
  const upperIndex = Math.min(lowerIndex + 1, STACK_PRESETS.length - 1);
  const mix = bounded - lowerIndex;
  return {
    distance: lerp(STACK_PRESETS[lowerIndex].distance, STACK_PRESETS[upperIndex].distance, mix),
    scale: lerp(STACK_PRESETS[lowerIndex].scale, STACK_PRESETS[upperIndex].scale, mix),
    opacity: lerp(STACK_PRESETS[lowerIndex].opacity, STACK_PRESETS[upperIndex].opacity, mix),
    blur: lerp(STACK_PRESETS[lowerIndex].blur, STACK_PRESETS[upperIndex].blur, mix),
    rotateX: lerp(STACK_PRESETS[lowerIndex].rotateX, STACK_PRESETS[upperIndex].rotateX, mix),
  };
};

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
    const classNames: string[] = ['fb-coverflow-swiper'];
    if (isLowPerf) classNames.push('fb-coverflow-lowperf');
    if (isReducedMotion) classNames.push('fb-coverflow-reduced');
    return classNames.join(' ');
  }, [isLowPerf, isReducedMotion]);

  const applySlideStyles = useCallback((swiper: SwiperInstance) => {
    swiper.slides.forEach((slideEl, slideIndex) => {
      const host = slideEl.querySelector<HTMLElement>('.fb-coverflow-card-host');
      if (!host) return;

      const reportedProgress = Number((slideEl as unknown as { progress?: number }).progress ?? NaN);
      const fallbackProgress = slideIndex - swiper.activeIndex;
      let rawProgress = Number.isFinite(reportedProgress) ? reportedProgress : fallbackProgress;
      const isActive = slideEl.classList.contains('swiper-slide-active');
      if (isActive && Math.abs(rawProgress) > 0.45) rawProgress = 0;

      const offsetAbs = Math.min(4.2, Math.abs(rawProgress));
      const preset = getStackPreset(offsetAbs);
      const direction = rawProgress === 0 ? 0 : rawProgress > 0 ? 1 : -1;
      const distance = direction * preset.distance;
      const rotateX = direction === 0 ? 0 : direction > 0 ? -preset.rotateX : preset.rotateX;
      const scale = isLowPerf ? Math.max(0.54, preset.scale) : preset.scale;
      let opacity = preset.opacity;
      if (swiper.activeIndex === 0 && rawProgress < -0.001) {
        opacity = 0;
      }
      if (isActive) opacity = 1;

      const zIndex = 220 - Math.round(offsetAbs * 26);
      const blurValue = isLowPerf || isReducedMotion ? 0 : preset.blur;

      host.style.transform = `translate3d(0, ${distance}px, 0) rotateX(${rotateX}deg) scale(${scale})`;
      host.style.opacity = String(opacity);
      host.style.zIndex = String(zIndex);
      host.style.filter = blurValue <= 0
        ? 'none'
        : `blur(${blurValue.toFixed(2)}px) saturate(${(1.04 - offsetAbs * 0.03).toFixed(2)})`;
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
    if (swiper.activeIndex !== activeIndex) {
      swiper.slideTo(activeIndex, isReducedMotion ? 220 : 420);
    }
    applySlideStyles(swiper);
  }, [activeIndex, isReducedMotion, applySlideStyles]);

  return (
    <div className="fb-coverflow-stage flex-1 relative overflow-hidden px-1 pb-4">
      <Swiper
        direction="vertical"
        slidesPerView="auto"
        centeredSlides
        speed={isReducedMotion ? 220 : 420}
        threshold={2}
        spaceBetween={isLowPerf ? -124 : -148}
        resistance
        resistanceRatio={0.82}
        watchSlidesProgress
        touchRatio={-1}
        longSwipes
        longSwipesRatio={0.12}
        longSwipesMs={180}
        shortSwipes
        className={className}
        initialSlide={activeIndex}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          applySlideStyles(swiper);
        }}
        onProgress={(swiper) => applySlideStyles(swiper)}
        onSetTransition={(swiper, duration) => applyTransition(swiper, duration)}
        onSlideChange={(swiper) => onIndexChange(swiper.activeIndex)}
      >
        {weeks.map((weekStart, index) => (
          <SwiperSlide key={toDateKey(weekStart)}>
            <div className="fb-coverflow-slide-shell">
              <div className="fb-coverflow-card-host">
                <WeekCoverCard
                  weekStart={weekStart}
                  todos={todos}
                  feedbackCards={feedbackCards}
                  t={t}
                  isActive={index === activeIndex}
                  onDayTap={onDayTap}
                  onCardTap={() => onWeekTap(index)}
                />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
