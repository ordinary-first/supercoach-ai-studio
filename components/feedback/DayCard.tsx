import React from 'react';
import { Check, MessageCircle, Sprout } from 'lucide-react';
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
  const dayIndex = (date.getDay() + 6) % 7;
  return t.feedback.dayNames[dayIndex];
};

const formatDateShort = (date: Date): string => `${date.getMonth() + 1}.${date.getDate()}`;

export const DayCard: React.FC<DayCardProps> = ({ date, state, card, t, index, onTap }) => {
  const dayLabel = formatDayLabel(date, t);
  const dateShort = formatDateShort(date);
  const delay = `${index * 42}ms`;

  const base =
    'fb-day-card flex-shrink-0 w-[146px] h-[186px] rounded-[20px] px-3.5 py-3 ' +
    'flex flex-col cursor-pointer transition-transform active:scale-[0.985]';

  if (state === 'future') {
    return (
      <button className={`${base} fb-day-card-future`} style={{ animationDelay: delay }} onClick={onTap}>
        <div className="text-[11px] text-th-text-secondary font-medium">
          {dayLabel} <span className="text-th-text-tertiary">{dateShort}</span>
        </div>
      </button>
    );
  }

  if (state === 'today-pending') {
    return (
      <button className={`${base} fb-day-card-today`} style={{ animationDelay: delay }} onClick={onTap}>
        <div className="text-[11px] text-th-text font-semibold">{t.feedback.today}</div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-[11px] text-th-text-secondary text-center whitespace-pre-line leading-relaxed">
            {t.feedback.todayPending}
          </p>
          <div className="flex gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="fb-mini-dot"
                style={{ animationDelay: `${i * 260}ms` }}
              />
            ))}
          </div>
        </div>
      </button>
    );
  }

  if (state === 'empty-past') {
    return (
      <button className={`${base} fb-day-card-empty`} style={{ animationDelay: delay }} onClick={onTap}>
        <div className="text-[11px] text-th-text-secondary font-medium">
          {dayLabel} <span className="text-th-text-tertiary">{dateShort}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Sprout size={16} className="text-th-text-tertiary mb-1.5" />
          <p className="text-[10px] text-th-text-muted text-center">{t.feedback.emptyRecord}</p>
        </div>
      </button>
    );
  }

  const completed = card?.completedTodos ?? [];
  const visibleItems = completed.slice(0, 3);

  return (
    <button className={`${base} fb-day-card-completed`} style={{ animationDelay: delay }} onClick={onTap}>
      <div className="text-[11px] text-th-text font-semibold mb-1.5">
        {dayLabel} <span className="text-th-text-secondary">{dateShort}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-hidden">
        {visibleItems.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Check size={10} className="text-th-accent mt-0.5 shrink-0" />
            <span className="text-[11px] text-th-text leading-tight line-clamp-1">{item}</span>
          </div>
        ))}
        {completed.length > 3 && (
          <span className="text-[10px] text-th-text-tertiary">+{completed.length - 3}</span>
        )}
      </div>

      {card?.coachComment && (
        <div className="mt-auto pt-1.5 border-t border-th-border/20">
          <p className="text-[10px] text-th-text-secondary italic line-clamp-2 leading-tight flex items-start gap-1">
            <MessageCircle size={10} className="shrink-0 mt-[1px] text-th-text-tertiary" />
            <span>{card.coachComment}</span>
          </p>
        </div>
      )}
    </button>
  );
};
