import React from 'react';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import type { FeedbackCard } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface WeeklySummaryCardProps {
  weekStart: Date;
  weekCards: FeedbackCard[];
  summaryText: string;
  isGenerating: boolean;
  t: TranslationStrings;
  onGenerate: () => void;
  onTap: () => void;
}

const getWeekLabel = (weekStart: Date, t: TranslationStrings): string => {
  const month = weekStart.getMonth() + 1;
  const firstOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const firstMonday = new Date(firstOfMonth);
  const dayOfWeek = firstOfMonth.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  firstMonday.setDate(firstOfMonth.getDate() + daysUntilMonday);

  const weekNum = weekStart >= firstMonday
    ? Math.floor((weekStart.getTime() - firstMonday.getTime()) / (7 * 86400000)) +
    (daysUntilMonday === 0 ? 1 : 2)
    : 1;

  return t.feedback.weekLabel
    .replace('{month}', String(month))
    .replace('{week}', String(weekNum));
};

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  weekStart,
  weekCards,
  summaryText,
  isGenerating,
  t,
  onGenerate,
  onTap,
}) => {
  const label = `${t.feedback.weeklyTitle} · ${getWeekLabel(weekStart, t)}`;

  const allCompleted = weekCards.flatMap((card) => card.completedTodos);
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  const topItems = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hasContent = topItems.length > 0 || Boolean(summaryText);

  return (
    <div
      className="bg-transparent px-5 py-5 cursor-pointer fb-card-press"
      onClick={onTap}
    >
      <p className="text-[13px] font-semibold text-th-text mb-4">{label}</p>

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
                {t.feedback.generateWeekly}
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-th-text-tertiary mb-2">{t.feedback.weeklyCompleted}</p>
          <div className="space-y-1.5 mb-4">
            {topItems.map(([item, count], i) => (
              <div key={i} className="flex items-start gap-2">
                <Trophy size={10} className="text-th-accent mt-0.5 shrink-0" />
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
                  {t.feedback.generateWeekly}
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
