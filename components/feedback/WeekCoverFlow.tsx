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

// ── Transform presets (spec §4.3) ──

interface CardTransform {
  rotateX: number;
  scale: number;
  opacity: number;
  translateY: number;
  zIndex: number;
}

const PRESETS: CardTransform[] = [
  { rotateX: 0,  scale: 1.0,  opacity: 1.0,  translateY: 0,    zIndex: 10 },  // active
  { rotateX: 45, scale: 0.75, opacity: 0.6,  translateY: -120, zIndex: 9 },   // prev-1
  { rotateX: 55, scale: 0.6,  opacity: 0.4,  translateY: -180, zIndex: 8 },   // prev-2
  { rotateX: 60, scale: 0.5,  opacity: 0.25, translateY: -220, zIndex: 7 },   // prev-3
  { rotateX: 65, scale: 0.4,  opacity: 0.15, translateY: -250, zIndex: 6 },   // prev-4+
];

const SNAP_THRESHOLD = 80;      // px to trigger snap
const BOUNCE_MAX = 25;          // px max bounce
const VISIBLE_RANGE = 5;        // render active ± 5
const SPRING_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SNAP_DURATION = 350;      // ms

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const getPreset = (offset: number): CardTransform => {
  const idx = Math.min(Math.abs(offset), PRESETS.length - 1);
  return PRESETS[idx];
};

const interpolateTransform = (
  offset: number,
  dragProgress: number,
): CardTransform => {
  // offset = visual distance from active (0=active, 1=prev-1, etc.)
  // dragProgress = -1..1 fractional progress toward next/prev
  const currentPreset = getPreset(Math.round(offset));

  // Target preset if we fully snap
  const targetOffset = offset + (dragProgress > 0 ? -1 : 1);
  const targetPreset = getPreset(Math.round(Math.max(0, targetOffset)));
  const t = Math.abs(dragProgress);

  return {
    rotateX: lerp(currentPreset.rotateX, targetPreset.rotateX, t),
    scale: lerp(currentPreset.scale, targetPreset.scale, t),
    opacity: lerp(currentPreset.opacity, targetPreset.opacity, t),
    translateY: lerp(currentPreset.translateY, targetPreset.translateY, t),
    zIndex: currentPreset.zIndex,
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
  const lastY = useRef(0);

  const maxIndex = weeks.length - 1;

  // Compute drag progress as fraction (-1 to 1)
  const dragProgress = useMemo(() => {
    if (!isDragging && dragDelta === 0) return 0;

    // Positive dragDelta = swiped up = go to past (increase index)
    // Negative dragDelta = swiped down = go to current (decrease index)

    // Bounce at boundaries
    if (activeIndex === 0 && dragDelta < 0) {
      // At current week, swiping down → bounce
      return -(Math.min(Math.abs(dragDelta), BOUNCE_MAX) / BOUNCE_MAX) * 0.15;
    }
    if (activeIndex >= maxIndex && dragDelta > 0) {
      // At oldest week, swiping up → bounce
      return (Math.min(Math.abs(dragDelta), BOUNCE_MAX) / BOUNCE_MAX) * 0.15;
    }

    return Math.max(-1, Math.min(1, dragDelta / 200));
  }, [dragDelta, isDragging, activeIndex, maxIndex]);

  const handleStart = useCallback((clientY: number) => {
    if (isAnimating) return;
    startY.current = clientY;
    lastY.current = clientY;
    setIsDragging(true);
    setDragDelta(0);
  }, [isAnimating]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = startY.current - clientY; // positive = swipe up
    lastY.current = clientY;
    setDragDelta(delta);
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const delta = dragDelta;

    // Check if we should snap to next/prev
    if (Math.abs(delta) > SNAP_THRESHOLD) {
      if (delta > 0 && activeIndex < maxIndex) {
        // Swipe up → past
        setIsAnimating(true);
        onIndexChange(activeIndex + 1);
        setTimeout(() => { setIsAnimating(false); setDragDelta(0); }, SNAP_DURATION);
        return;
      }
      if (delta < 0 && activeIndex > 0) {
        // Swipe down → current
        setIsAnimating(true);
        onIndexChange(activeIndex - 1);
        setTimeout(() => { setIsAnimating(false); setDragDelta(0); }, SNAP_DURATION);
        return;
      }
    }

    // Snap back
    setDragDelta(0);
  }, [isDragging, dragDelta, activeIndex, maxIndex, onIndexChange]);

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Pointer handlers (desktop fallback)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return; // avoid double handling
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

  // Compute card styles
  const getCardStyle = useCallback((weekIndex: number): React.CSSProperties => {
    const offset = weekIndex - activeIndex;
    const useTransition = !isDragging;

    let tf: CardTransform;

    if (isDragging && dragProgress !== 0) {
      // During drag: interpolate based on drag progress
      const visualOffset = offset - dragProgress;
      tf = interpolateTransform(Math.max(0, visualOffset), 0);
    } else {
      tf = getPreset(Math.max(0, offset));
    }

    // Cards below active (future) should be hidden
    if (offset < 0) {
      return { display: 'none' };
    }

    return {
      position: 'absolute' as const,
      left: '16px',
      right: '16px',
      bottom: '72px',
      transformStyle: 'preserve-3d' as const,
      transformOrigin: 'center bottom',
      transform: `rotateX(${tf.rotateX}deg) scale(${tf.scale}) translateY(${tf.translateY}px)`,
      opacity: tf.opacity,
      zIndex: tf.zIndex,
      transition: useTransition
        ? `transform ${SNAP_DURATION}ms ${SPRING_EASING}, opacity ${SNAP_DURATION}ms ease`
        : 'none',
      pointerEvents: offset === 0 ? 'auto' as const : 'none' as const,
      willChange: 'transform, opacity',
    };
  }, [activeIndex, isDragging, dragProgress]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden select-none"
      style={{
        perspective: '1200px',
        perspectiveOrigin: '50% 30%',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {weeks.map((weekStart, i) => {
        // Only render visible cards
        const offset = i - activeIndex;
        if (offset < 0 || offset > VISIBLE_RANGE) return null;

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

      {/* Swipe hint (subtle peek of prev card at top) */}
      {activeIndex === 0 && weeks.length > 1 && (
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="w-8 h-1 rounded-full bg-white/10" />
        </div>
      )}
    </div>
  );
};
