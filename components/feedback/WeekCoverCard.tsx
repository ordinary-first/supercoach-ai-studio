import React from 'react';
import { Check, MessageCircle } from 'lucide-react';
import type { FeedbackCard, ToDoItem } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface WeekCoverCardProps {
  weekStart: Date;
  todos: ToDoItem[];
  feedbackCards: Map<string, FeedbackCard>;
  t: TranslationStrings;
  isActive: boolean;
  onDayTap: (date: Date) => void;
  onCardTap: () => void;
}

// ── Helpers (from WeekNavigator) ──

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

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const getDayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const getDayEnd = (d: Date): number => getDayStart(d) + 86400000 - 1;

type MiniCardState = 'completed' | 'today-pending' | 'future' | 'empty-past';

const deriveMiniState = (
  date: Date,
  card: FeedbackCard | null,
  dayTodos: ToDoItem[],
): MiniCardState => {
  const todayKey = toDateKey(new Date());
  const dateKey = toDateKey(date);
  if (dateKey > todayKey) return 'future';
  if (dateKey === todayKey) {
    return card && card.completedTodos.length > 0 ? 'completed' : 'today-pending';
  }
  if (card && (card.completedTodos.length > 0 || card.incompleteTodos.length > 0)) {
    return 'completed';
  }
  if (dayTodos.length > 0) return 'completed';
  return 'empty-past';
};

const getTodosForDay = (todos: ToDoItem[], date: Date): ToDoItem[] => {
  const start = getDayStart(date);
  const end = getDayEnd(date);
  return todos.filter((td) => {
    const ref = td.dueDate || td.createdAt;
    return ref >= start && ref <= end;
  });
};

// ── Mini Day Card (inline) ──

const MiniDayCard: React.FC<{
  date: Date;
  state: MiniCardState;
  hasComment: boolean;
  dayLabel: string;
  onTap: () => void;
}> = ({ date, state, hasComment, dayLabel, onTap }) => {
  const bgMap: Record<MiniCardState, string> = {
    'completed': 'bg-[#1E1E1E]',
    'today-pending': 'bg-[#111111] border-th-accent/30',
    'future': 'bg-[#0D0D0D]',
    'empty-past': 'bg-[#0D0D0D]',
  };

  const borderMap: Record<MiniCardState, string> = {
    'completed': 'border-white/[0.08]',
    'today-pending': 'border-white/[0.12]',
    'future': 'border-white/[0.04]',
    'empty-past': 'border-white/[0.04]',
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTap(); }}
      className={`flex-1 min-w-0 h-[48px] rounded-lg border flex flex-col items-center justify-center gap-0.5
        ${bgMap[state]} ${borderMap[state]}
        transition-transform active:scale-[0.93] duration-75`}
    >
      <span className={`text-[9px] font-medium leading-none ${
        state === 'today-pending' ? 'text-th-accent' : 'text-white/40'
      }`}>
        {dayLabel}
      </span>

      {state === 'completed' && (
        <div className="flex items-center gap-0.5">
          <Check size={10} className="text-th-accent" />
          {hasComment && <MessageCircle size={8} className="text-white/30" />}
        </div>
      )}

      {state === 'today-pending' && (
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-th-accent/40 animate-pulse"
              style={{ animationDelay: `${i * 300}ms` }}
            />
          ))}
        </div>
      )}
    </button>
  );
};

// ── Week Cover Card ──

export const WeekCoverCard: React.FC<WeekCoverCardProps> = ({
  weekStart,
  todos,
  feedbackCards,
  t,
  isActive,
  onDayTap,
  onCardTap,
}) => {
  const month = weekStart.getMonth() + 1;
  const weekNum = getMonthWeekNumber(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const label = t.feedback.weekLabel
    .replace('{month}', String(month))
    .replace('{week}', String(weekNum));
  const range = `${month}.${weekStart.getDate()} - ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div
      onClick={onCardTap}
      className={`w-full rounded-2xl border p-4 cursor-pointer
        transition-transform active:scale-[0.97] duration-75
        ${isActive
          ? 'bg-[#161616] border-white/[0.08]'
          : 'bg-[#121212] border-white/[0.06]'}`}
    >
      {/* Header */}
      <div className="mb-3">
        <p className="text-[16px] font-semibold text-white/90">{label}</p>
        <p className="text-[12px] text-white/40 mt-0.5">{range}</p>
      </div>

      {/* Mini day cards row */}
      <div className="flex gap-1.5">
        {days.map((date, i) => {
          const dateKey = toDateKey(date);
          const card = feedbackCards.get(dateKey) ?? null;
          const dayTodos = getTodosForDay(todos, date);
          const state = deriveMiniState(date, card, dayTodos);
          const dayIndex = (date.getDay() + 6) % 7; // Mon=0
          const dayLabel = t.feedback.dayNames[dayIndex];

          return (
            <MiniDayCard
              key={dateKey}
              date={date}
              state={state}
              hasComment={!!card?.coachComment}
              dayLabel={dayLabel}
              onTap={() => onDayTap(date)}
            />
          );
        })}
      </div>
    </div>
  );
};
