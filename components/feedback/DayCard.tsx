import React from 'react';
import { Check, Sprout } from 'lucide-react';
import type { FeedbackCard } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

export type DayCardState = 'completed' | 'today-pending' | 'future' | 'empty-past';

interface DayCardProps {
  date: Date;
  state: DayCardState;
  card: FeedbackCard | null;
  t: TranslationStrings;
  index: number;
  onTap: () => void;
}

const formatDayLabel = (date: Date, t: TranslationStrings): string => {
  const dayIndex = (date.getDay() + 6) % 7; // Mon=0
  return t.feedback.dayNames[dayIndex];
};

const formatDateShort = (date: Date): string => {
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

export const DayCard: React.FC<DayCardProps> = ({
  date,
  state,
  card,
  t,
  index,
  onTap,
}) => {
  const dayLabel = formatDayLabel(date, t);
  const dateShort = formatDateShort(date);

  const baseClasses =
    'flex-shrink-0 w-[140px] h-[180px] rounded-2xl p-3 flex flex-col cursor-pointer ' +
    'transition-transform active:scale-[0.97] duration-75';

  const staggerDelay = `${index * 50}ms`;

  if (state === 'future') {
    return (
      <div
        className={`${baseClasses} bg-[#0D0D0D] border border-white/[0.04]`}
        style={{ animationDelay: staggerDelay }}
        onClick={onTap}
      >
        <div className="text-[11px] text-white/30 font-medium">
          {dayLabel} <span className="text-white/20">{dateShort}</span>
        </div>
      </div>
    );
  }

  if (state === 'today-pending') {
    return (
      <div
        className={`${baseClasses} bg-[#111111] border border-white/[0.12]`}
        style={{ animationDelay: staggerDelay }}
        onClick={onTap}
      >
        <div className="text-[11px] text-white/50 font-semibold">
          {t.feedback.today}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-[11px] text-white/30 text-center whitespace-pre-line leading-relaxed">
            {t.feedback.todayPending}
          </p>
          <div className="flex gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
                style={{ animationDelay: `${i * 300}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'empty-past') {
    return (
      <div
        className={`${baseClasses} bg-[#0D0D0D] border border-white/[0.04]`}
        style={{ animationDelay: staggerDelay }}
        onClick={onTap}
      >
        <div className="text-[11px] text-white/30 font-medium">
          {dayLabel} <span className="text-white/20">{dateShort}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Sprout size={16} className="text-white/15 mb-1" />
          <p className="text-[10px] text-white/20 text-center">
            {t.feedback.emptyRecord}
          </p>
        </div>
      </div>
    );
  }

  // state === 'completed'
  const completed = card?.completedTodos ?? [];
  const maxItems = 3;
  const visibleItems = completed.slice(0, maxItems);

  return (
    <div
      className={`${baseClasses} bg-[#161616] border border-white/[0.08]`}
      style={{ animationDelay: staggerDelay }}
      onClick={onTap}
    >
      <div className="text-[11px] text-white/50 font-semibold mb-1.5">
        {dayLabel} <span className="text-white/30">{dateShort}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-hidden">
        {visibleItems.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Check size={10} className="text-th-accent mt-0.5 shrink-0" />
            <span className="text-[11px] text-white/75 leading-tight line-clamp-1">
              {item}
            </span>
          </div>
        ))}
        {completed.length > maxItems && (
          <span className="text-[10px] text-white/30">
            +{completed.length - maxItems}
          </span>
        )}
      </div>

      {card?.coachComment && (
        <div className="mt-auto pt-1.5 border-t border-white/[0.04]">
          <p className="text-[10px] text-white/50 italic line-clamp-2 leading-tight">
            💬 {card.coachComment}
          </p>
        </div>
      )}
    </div>
  );
};
