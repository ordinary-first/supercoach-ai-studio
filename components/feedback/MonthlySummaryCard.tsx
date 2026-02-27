import React from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import type { FeedbackCard } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface MonthlySummaryCardProps {
  month: number; // 1-12
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
  const label = `${t.feedback.monthlyTitle}  ${month}월`;

  // Aggregate completed items for the month
  const allCompleted = monthCards.flatMap((c) => c.completedTodos);
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });
  const topItems = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasContent = topItems.length > 0 || summaryText;

  return (
    <div
      className="mx-4 bg-[#161616] border border-white/[0.08] rounded-[20px] p-5 cursor-pointer transition-transform active:scale-[0.98] duration-75"
      onClick={onTap}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-th-accent" />
        <p className="text-[13px] font-semibold text-white/70">{label}</p>
      </div>

      {!hasContent ? (
        <div className="text-center py-4">
          <p className="text-[12px] text-white/30 mb-3">{t.feedback.emptyRecord}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onGenerate(); }}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-th-accent/10 text-th-accent text-[12px] font-semibold hover:bg-th-accent/20 transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 size={12} className="animate-spin" />{t.feedback.generating}</>
            ) : (
              <><RefreshCw size={12} />{t.feedback.generateMonthly}</>
            )}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-white/40 mb-2">{t.feedback.monthlyCompleted}</p>
          <div className="space-y-1.5 mb-4">
            {topItems.map(([item, count], i) => (
              <div key={i} className="flex items-start gap-2">
                <Sparkles size={10} className="text-th-accent mt-0.5 shrink-0" />
                <span className="text-[12px] text-white/70 leading-snug">
                  {item}{count > 1 ? ` ${count}회` : ''}
                </span>
              </div>
            ))}
          </div>

          {summaryText && (
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-[12px] text-white/50 italic leading-relaxed">
                💬 &ldquo;{summaryText}&rdquo;
              </p>
            </div>
          )}

          {!summaryText && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-th-accent/10 text-th-accent text-[11px] font-semibold hover:bg-th-accent/20 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <><Loader2 size={11} className="animate-spin" />{t.feedback.generating}</>
              ) : (
                <><RefreshCw size={11} />{t.feedback.generateMonthly}</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
