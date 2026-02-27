import React, { useRef, useState, useCallback, useMemo } from 'react';
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

interface CardTransform {
  rotateX: number;
  scale: number;
  opacity: number;
  translateY: number;
}

const PRESETS: CardTransform[] = [
  { rotateX: 0, scale: 1.0, opacity: 1.0, translateY: 0 },
  { rotateX: 45, scale: 0.75, opacity: 0.6, translateY: -120 },
  { rotateX: 55, scale: 0.6, opacity: 0.4, translateY: -180 },
  { rotateX: 60, scale: 0.5, opacity: 0.25, translateY: -220 },
  { rotateX: 65, scale: 0.4, opacity: 0.15, translateY: -250 },
];

const DRAG_STEP = 220;
const SNAP_THRESHOLD = DRAG_STEP / 2;
const BOUNCE_PROGRESS = 0.18;
const VISIBLE_RANGE = 5;
const SPRING_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_DURATION = 350;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const getTransformAtOffset = (offset: number): CardTransform => {
  const normalized = Math.max(0, offset);
  const lowerIndex = Math.min(Math.floor(normalized), PRESETS.length - 1);
  const upperIndex = Math.min(lowerIndex + 1, PRESETS.length - 1);
  const mix = normalized - lowerIndex;
  const lower = PRESETS[lowerIndex];
  const upper = PRESETS[upperIndex];

  return {
    rotateX: lerp(lower.rotateX, upper.rotateX, mix),
    scale: lerp(lower.scale, upper.scale, mix),
    opacity: lerp(lower.opacity, upper.opacity, mix),
    translateY: lerp(lower.translateY, upper.translateY, mix),
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const startY = useRef(0);

  const maxIndex = weeks.length - 1;

  const dragProgress = useMemo(() => {
    if (!isDragging && dragDelta === 0) return 0;

    const raw = dragDelta / DRAG_STEP;

    if (activeIndex === 0 && raw < 0) return Math.max(raw, -BOUNCE_PROGRESS);
    if (activeIndex >= maxIndex && raw > 0) return Math.min(raw, BOUNCE_PROGRESS);

    return Math.max(-1, Math.min(1, raw));
  }, [dragDelta, isDragging, activeIndex, maxIndex]);

  const activePosition = activeIndex + dragProgress;

  const handleStart = useCallback((clientY: number) => {
    if (isAnimating) return;
    startY.current = clientY;
    setIsDragging(true);
    setDragDelta(0);
  }, [isAnimating]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    setDragDelta(startY.current - clientY);
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const delta = dragDelta;

    if (Math.abs(delta) >= SNAP_THRESHOLD) {
      if (delta > 0 && activeIndex < maxIndex) {
        setIsAnimating(true);
        onIndexChange(activeIndex + 1);
        setTimeout(() => {
          setIsAnimating(false);
          setDragDelta(0);
        }, SNAP_DURATION);
        return;
      }

      if (delta < 0 && activeIndex > 0) {
        setIsAnimating(true);
        onIndexChange(activeIndex - 1);
        setTimeout(() => {
          setIsAnimating(false);
          setDragDelta(0);
        }, SNAP_DURATION);
        return;
      }
    }

    setDragDelta(0);
  }, [isDragging, dragDelta, activeIndex, maxIndex, onIndexChange]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onTouchCancel = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    handleStart(e.clientY);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [handleStart]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    handleMove(e.clientY);
  }, [handleMove]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    handleEnd();
  }, [handleEnd]);

  const getCardStyle = useCallback((weekIndex: number): React.CSSProperties => {
    const visualOffset = weekIndex - activePosition;
    if (visualOffset < -0.2 || visualOffset > VISIBLE_RANGE) {
      return { display: 'none' };
    }

    const tf = getTransformAtOffset(visualOffset);
    const isFrontCard = Math.abs(visualOffset) < 0.35;
    const zIndex = Math.max(1, 100 - Math.round(Math.max(0, visualOffset) * 10));

    return {
      position: 'absolute' as const,
      left: '16px',
      right: '16px',
      bottom: '72px',
      transformStyle: 'preserve-3d' as const,
      transformOrigin: 'center bottom',
      transform: `rotateX(${tf.rotateX}deg) scale(${tf.scale}) translateY(${tf.translateY}px)`,
      opacity: tf.opacity,
      zIndex,
      transition: !isDragging
        ? `transform ${SNAP_DURATION}ms ${SPRING_EASING}, opacity ${SNAP_DURATION}ms ease`
        : 'none',
      pointerEvents: isFrontCard && !isDragging ? 'auto' as const : 'none' as const,
      willChange: 'transform, opacity',
    };
  }, [activePosition, isDragging]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden select-none"
      style={{
        perspective: '1200px',
        perspectiveOrigin: '50% 30%',
        touchAction: 'none',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {weeks.map((weekStart, i) => {
        const offset = i - Math.floor(activePosition);
        if (offset < -1 || offset > VISIBLE_RANGE) return null;

        return (
          <div key={i} style={getCardStyle(i)}>
            <WeekCoverCard
              weekStart={weekStart}
              todos={todos}
              feedbackCards={feedbackCards}
              t={t}
              isActive={i === activeIndex}
              onDayTap={onDayTap}
              onCardTap={() => onWeekTap(i)}
            />
          </div>
        );
      })}
    </div>
  );
};
