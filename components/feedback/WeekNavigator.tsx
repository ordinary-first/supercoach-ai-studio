import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TranslationStrings } from '../../i18n/types';

interface WeekNavigatorProps {
  weekStart: Date;
  t: TranslationStrings;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
}

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

const formatRange = (start: Date, end: Date): string => {
  const s = `${start.getMonth() + 1}.${start.getDate()}`;
  const e = `${end.getMonth() + 1}.${end.getDate()}`;
  return `${s} - ${e}`;
};

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  weekStart,
  t,
  onPrev,
  onNext,
  canNext,
}) => {
  const month = weekStart.getMonth() + 1;
  const weekNum = getMonthWeekNumber(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const label = t.feedback.weekLabel
    .replace('{month}', String(month))
    .replace('{week}', String(weekNum));
  const range = formatRange(weekStart, weekEnd);

  return (
    <div className="sticky top-0 z-10 bg-th-base/90 backdrop-blur-md px-4 py-3 flex items-center justify-between">
      <button
        onClick={onPrev}
        className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
      >
        <ChevronLeft size={18} className="text-white/50" />
      </button>

      <div className="text-center">
        <p className="text-[15px] font-semibold text-white/90">{label}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{range}</p>
      </div>

      <button
        onClick={onNext}
        disabled={!canNext}
        className="p-1.5 rounded-full hover:bg-white/5 transition-colors disabled:opacity-20"
      >
        <ChevronRight size={18} className="text-white/50" />
      </button>
    </div>
  );
};
