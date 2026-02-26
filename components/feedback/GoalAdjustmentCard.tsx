import React from 'react';
import { Target, Check, Loader2 } from 'lucide-react';
import type { GoalAdjustment } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface GoalAdjustmentCardProps {
  adjustment: GoalAdjustment;
  isAdjusting: boolean;
  t: TranslationStrings;
  onAccept: () => void;
  onDismiss: () => void;
}

export const GoalAdjustmentCard: React.FC<GoalAdjustmentCardProps> = ({
  adjustment,
  isAdjusting,
  t,
  onAccept,
  onDismiss,
}) => {
  const { goalText, currentMetric, suggestedMetric, avgCompletion, weeks } = adjustment;

  return (
    <div className="mx-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <Target size={14} className="text-amber-400 shrink-0" />
        <span className="text-[12px] font-semibold text-amber-400/90">
          {t.feedback.goalAdjustment}
        </span>
      </div>

      {/* Goal text */}
      <div className="px-4 pb-2">
        <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">
          "{goalText}"
        </p>
      </div>

      {/* Metric comparison */}
      <div className="mx-4 mb-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03]">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-white/30 mb-0.5">현재</p>
          <p className="text-[15px] font-bold text-white/60">{currentMetric}</p>
        </div>
        <div className="text-white/20 text-[14px]">→</div>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-amber-400/60 mb-0.5">제안</p>
          <p className="text-[15px] font-bold text-amber-400">{suggestedMetric}</p>
        </div>
      </div>

      {/* Reason */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-white/30">
          {t.feedback.adjustReason
            .replace('{avg}', String(avgCompletion))
            .replace('{weeks}', String(weeks))}
        </p>
      </div>

      {/* Actions */}
      <div className="flex border-t border-white/[0.06]">
        <button
          onClick={onDismiss}
          disabled={isAdjusting}
          className="flex-1 py-3 text-[12px] font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors disabled:opacity-50"
        >
          {t.feedback.keepCurrent}
        </button>
        <div className="w-px bg-white/[0.06]" />
        <button
          onClick={onAccept}
          disabled={isAdjusting}
          className="flex-1 py-3 text-[12px] font-semibold text-amber-400 hover:bg-amber-400/5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isAdjusting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              {t.feedback.adjusting}
            </>
          ) : (
            <>
              <Check size={12} />
              {t.feedback.adjustGoal}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
