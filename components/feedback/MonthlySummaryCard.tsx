import React from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { FeedbackCard } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface MonthlySummaryCardProps {
  month: number;
  year: number;
  monthCards: FeedbackCard[];
  summaryText: string;
  isGenerating: boolean;
  t: TranslationStrings;
  onGenerate: () => void;
  onTap: () => void;
}

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = ({
  month,
  monthCards,
  summaryText,
  isGenerating,
  t,
  onGenerate,
  onTap,
}) => {
  const label = `${t.feedback.monthlyTitle} · ${month}월`;

  const allCompleted = monthCards.flatMap((card) => card.completedTodos);
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  const topItems = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hasContent = topItems.length > 0 || Boolean(summaryText);

  return (
    <div className="bg-transparent px-5 py-5 cursor-pointer fb-card-press" onClick={onTap}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-th-accent" />
        <p className="text-[13px] font-semibold text-th-text">{label}</p>
      </div>

      {!hasContent ? (
        <div className="text-center py-4">
          <p className="text-[12px] text-th-text-muted mb-3">{t.feedback.emptyRecord}</p>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onGenerate();
            }}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-th-accent/10
              text-th-accent text-[12px] font-semibold hover:bg-th-accent/20 transition-colors
              disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t.feedback.generating}
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                {t.feedback.generateMonthly}
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-th-text-tertiary mb-2">{t.feedback.monthlyCompleted}</p>
          <div className="space-y-1.5 mb-4">
            {topItems.map(([item, count], i) => (
              <div key={i} className="flex items-start gap-2">
                <Sparkles size={10} className="text-th-accent mt-0.5 shrink-0" />
                <span className="text-[12px] text-th-text leading-snug">
                  {item}
                  {count > 1 ? ` x${count}` : ''}
                </span>
              </div>
            ))}
          </div>

          {summaryText ? (
            <div className="border-t border-th-border pt-3">
              <p className="text-[12px] text-th-text-secondary italic leading-relaxed">“{summaryText}”</p>
            </div>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onGenerate();
              }}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-th-accent/10
                text-th-accent text-[11px] font-semibold hover:bg-th-accent/20 transition-colors
                disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  {t.feedback.generating}
                </>
              ) : (
                <>
                  <RefreshCw size={11} />
                  {t.feedback.generateMonthly}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
