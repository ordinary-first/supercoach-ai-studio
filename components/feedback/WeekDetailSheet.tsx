import React, { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { WeeklyCardScroll } from './WeeklyCardScroll';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { MonthlySummaryCard } from './MonthlySummaryCard';
import { GoalAdjustmentCard } from './GoalAdjustmentCard';
import type { FeedbackCard, ToDoItem, GoalAdjustment } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface WeekDetailSheetProps {
  weekStart: Date;
  todos: ToDoItem[];
  feedbackCards: Map<string, FeedbackCard>;
  t: TranslationStrings;
  onClose: () => void;
  onDayTap: (date: Date) => void;
  // Summary
  weekCards: FeedbackCard[];
  weeklySummary: string;
  isGeneratingWeekly: boolean;
  onGenerateWeekly: () => void;
  // Monthly (conditional)
  isLastWeekOfMonth: boolean;
  month: number;
  year: number;
  monthCards: FeedbackCard[];
  monthlySummary: string;
  isGeneratingMonthly: boolean;
  onGenerateMonthly: () => void;
  // Goal adjustments
  pendingAdjustments: GoalAdjustment[];
  adjustingId: string | null;
  onAcceptAdjustment: (adj: GoalAdjustment) => void;
  onDismissAdjustment: (goalId: string) => void;
  // Undo
  undoData: {
    goalId: string;
    oldText: string;
    todoUpdates: { id: string; oldText: string }[];
  } | null;
  recentAccepted: GoalAdjustment | undefined;
  onUndo: () => void;
}

// ── Helpers ──

const getMonthWeekNumber = (date: Date): number => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstMonday = new Date(firstOfMonth);
  const dayOfWeek = firstOfMonth.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  firstMonday.setDate(firstOfMonth.getDate() + daysUntilMonday);
  if (date < firstMonday) return 1;
  const diff = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 86400000));
  return diff + (daysUntilMonday === 0 ? 1 : 2);
};

export const WeekDetailSheet: React.FC<WeekDetailSheetProps> = ({
  weekStart,
  todos,
  feedbackCards,
  t,
  onClose,
  onDayTap,
  weekCards,
  weeklySummary,
  isGeneratingWeekly,
  onGenerateWeekly,
  isLastWeekOfMonth,
  month,
  year,
  monthCards,
  monthlySummary,
  isGeneratingMonthly,
  onGenerateMonthly,
  pendingAdjustments,
  adjustingId,
  onAcceptAdjustment,
  onDismissAdjustment,
  undoData,
  recentAccepted,
  onUndo,
}) => {
  const weekMonth = weekStart.getMonth() + 1;
  const weekNum = getMonthWeekNumber(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const label = t.feedback.weekLabel
    .replace('{month}', String(weekMonth))
    .replace('{week}', String(weekNum));
  const range = `${weekMonth}.${weekStart.getDate()} - ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;
  const swipeStartY = useRef(0);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleSwipeStart = useCallback((clientY: number) => {
    swipeStartY.current = clientY;
    setIsSwiping(true);
    setSwipeDelta(0);
  }, []);

  const handleSwipeMove = useCallback((clientY: number) => {
    if (!isSwiping) return;
    const delta = Math.max(0, clientY - swipeStartY.current);
    setSwipeDelta(Math.min(delta, 220));
  }, [isSwiping]);

  const handleSwipeEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);
    if (swipeDelta > 110) {
      onClose();
      return;
    }
    setSwipeDelta(0);
  }, [isSwiping, swipeDelta, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-[#141414] rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{
          transform: `translateY(${swipeDelta}px)`,
          transition: isSwiping
            ? 'none'
            : 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Handle */}
        <div
          className="flex justify-center pt-3 pb-1 touch-none"
          onTouchStart={(e) => handleSwipeStart(e.touches[0].clientY)}
          onTouchMove={(e) => {
            if (e.cancelable) e.preventDefault();
            handleSwipeMove(e.touches[0].clientY);
          }}
          onTouchEnd={handleSwipeEnd}
          onTouchCancel={handleSwipeEnd}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') return;
            handleSwipeStart(e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'touch') return;
            handleSwipeMove(e.clientY);
          }}
          onPointerUp={(e) => {
            if (e.pointerType === 'touch') return;
            handleSwipeEnd();
          }}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-white/90">{label}</h2>
            <p className="text-[11px] text-white/40 mt-0.5">{range}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <X size={16} className="text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          <div className="space-y-5">
            {/* 7-day horizontal scroll */}
            <WeeklyCardScroll
              weekStart={weekStart}
              todos={todos}
              feedbackCards={feedbackCards}
              t={t}
              onDayTap={onDayTap}
            />

            {/* Goal Adjustment Cards */}
            {pendingAdjustments.map((adj) => (
              <div key={adj.goalId} className="px-4">
                <GoalAdjustmentCard
                  adjustment={adj}
                  isAdjusting={adjustingId === adj.goalId}
                  t={t}
                  onAccept={() => onAcceptAdjustment(adj)}
                  onDismiss={() => onDismissAdjustment(adj.goalId)}
                />
              </div>
            ))}

            {/* Undo toast */}
            {recentAccepted && undoData && (
              <div className="mx-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between animate-fade-in">
                <span className="text-[12px] text-green-400">{t.feedback.adjustComplete}</span>
                <button
                  onClick={onUndo}
                  className="text-[11px] font-semibold text-white/70 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
                >
                  {t.feedback.undo}
                </button>
              </div>
            )}

            {/* Weekly Summary */}
            <div className="px-4">
              <WeeklySummaryCard
                weekStart={weekStart}
                weekCards={weekCards}
                summaryText={weeklySummary}
                isGenerating={isGeneratingWeekly}
                t={t}
                onGenerate={onGenerateWeekly}
                onTap={() => {}}
              />
            </div>

            {/* Monthly Summary (last week of month only) */}
            {isLastWeekOfMonth && (
              <div className="px-4">
                <MonthlySummaryCard
                  month={month}
                  year={year}
                  monthCards={monthCards}
                  summaryText={monthlySummary}
                  isGenerating={isGeneratingMonthly}
                  t={t}
                  onGenerate={onGenerateMonthly}
                  onTap={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
