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

interface VisualPreset {
  rotateX: number;
  scale: number;
  opacity: number;
  translateY: number;
  blur: number;
}

const PRESETS: VisualPreset[] = [
  { rotateX: 0, scale: 1, opacity: 1, translateY: 0, blur: 0 },
  { rotateX: 44, scale: 0.82, opacity: 0.72, translateY: -104, blur: 0.6 },
  { rotateX: 54, scale: 0.68, opacity: 0.48, translateY: -164, blur: 1.1 },
  { rotateX: 60, scale: 0.56, opacity: 0.31, translateY: -214, blur: 1.6 },
  { rotateX: 64, scale: 0.48, opacity: 0.18, translateY: -244, blur: 2.2 },
];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const getPreset = (offset: number): VisualPreset => {
  const normalized = Math.max(0, offset);
  const lower = Math.min(Math.floor(normalized), PRESETS.length - 1);
  const upper = Math.min(lower + 1, PRESETS.length - 1);
  const mix = normalized - lower;
  return {
    rotateX: lerp(PRESETS[lower].rotateX, PRESETS[upper].rotateX, mix),
    scale: lerp(PRESETS[lower].scale, PRESETS[upper].scale, mix),
    opacity: lerp(PRESETS[lower].opacity, PRESETS[upper].opacity, mix),
    translateY: lerp(PRESETS[lower].translateY, PRESETS[upper].translateY, mix),
    blur: lerp(PRESETS[lower].blur, PRESETS[upper].blur, mix),
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

  const flowClassName = useMemo(() => {
    const flags: string[] = ['fb-coverflow-swiper'];
    if (isLowPerf) flags.push('fb-coverflow-lowperf');
    if (isReducedMotion) flags.push('fb-coverflow-reduced');
    return flags.join(' ');
  }, [isLowPerf, isReducedMotion]);

  const applySlideStyles = useCallback((swiper: SwiperInstance) => {
    swiper.slides.forEach((slideEl) => {
      const host = slideEl.querySelector<HTMLElement>('.fb-coverflow-card-host');
      if (!host) return;

      const raw = Number((slideEl as unknown as { progress?: number }).progress ?? 0);
      const visualOffset = raw >= 0 ? raw : Math.abs(raw) * 0.55;
      const preset = getPreset(visualOffset);

      let translateY = preset.translateY;
      let rotateX = preset.rotateX;
      let scale = preset.scale;
      let opacity = preset.opacity;
      let blur = preset.blur;

      if (raw < 0) {
        const backward = Math.min(2.4, Math.abs(raw));
        translateY = 56 * backward;
        rotateX = -20;
        scale = 0.88 - backward * 0.09;
        opacity = Math.max(0.08, 0.38 - backward * 0.14);
        blur = Math.min(2, backward * 0.8);
      }

      const z = 120 - Math.round(Math.max(0, visualOffset) * 15);
      host.style.transform =
        `translate3d(0, ${translateY}px, 0) rotateX(${rotateX}deg) scale(${scale})`;
      host.style.opacity = String(opacity);
      host.style.zIndex = String(z);
      host.style.filter = isLowPerf || isReducedMotion
        ? 'none'
        : `blur(${blur.toFixed(2)}px) saturate(${(1.04 - visualOffset * 0.03).toFixed(2)})`;
      host.style.pointerEvents = Math.abs(raw) < 0.35 ? 'auto' : 'none';
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
    <div className="flex-1 relative overflow-hidden px-1 pb-4">
      <Swiper
        direction="vertical"
        slidesPerView={1}
        centeredSlides
        speed={isReducedMotion ? 220 : 420}
        threshold={8}
        resistance
        resistanceRatio={0.76}
        watchSlidesProgress
        className={flowClassName}
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
