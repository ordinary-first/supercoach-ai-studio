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

type MiniCardState = 'completed' | 'today-pending' | 'future' | 'empty-past';

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

const getTodosForDay = (todos: ToDoItem[], date: Date): ToDoItem[] => {
  const start = getDayStart(date);
  const end = getDayEnd(date);
  return todos.filter((todo) => {
    const ref = todo.dueDate || todo.createdAt;
    return ref >= start && ref <= end;
  });
};

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

const MiniDayCard: React.FC<{
  state: MiniCardState;
  hasComment: boolean;
  dayLabel: string;
  onTap: () => void;
}> = ({ state, hasComment, dayLabel, onTap }) => {
  const classByState: Record<MiniCardState, string> = {
    completed: 'fb-mini-day fb-mini-day-completed',
    'today-pending': 'fb-mini-day fb-mini-day-today',
    future: 'fb-mini-day fb-mini-day-future',
    'empty-past': 'fb-mini-day fb-mini-day-future',
  };

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onTap();
      }}
      className={`${classByState[state]} flex-1 min-w-0 h-[52px] px-1.5
        flex flex-col items-center justify-center gap-0.5`}
    >
      <span className={`text-[9px] font-medium ${state === 'today-pending' ? 'text-th-accent' : 'text-th-text-tertiary'
        }`}>
        {dayLabel}
      </span>

      {state === 'completed' && (
        <div className="flex items-center gap-1">
          <Check size={10} className="text-th-accent" />
          {hasComment && <MessageCircle size={8} className="text-th-text-tertiary" />}
        </div>
      )}

      {state === 'today-pending' && (
        <div className="flex items-center gap-1">
          <span className="fb-mini-dot" />
          <span className="fb-mini-dot" style={{ animationDelay: '280ms' }} />
          <span className="fb-mini-dot" style={{ animationDelay: '560ms' }} />
        </div>
      )}
    </button>
  );
};

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
    <article
      onClick={onCardTap}
      className={`fb-coverflow-card-shell fb-card-press p-4 md:p-5
        ${isActive ? '' : 'fb-coverflow-card-shell-inactive'}`}
    >
      <header className="mb-3.5">
        <p className="fb-coverflow-week-title text-[17px] font-semibold text-th-text">{label}</p>
        <p className="fb-coverflow-week-range text-[12px] text-th-text-secondary mt-0.5">{range}</p>
      </header>

      <section className="flex gap-1.5">
        {days.map((date) => {
          const dateKey = toDateKey(date);
          const card = feedbackCards.get(dateKey) ?? null;
          const dayTodos = getTodosForDay(todos, date);
          const state = deriveMiniState(date, card, dayTodos);
          const dayIndex = (date.getDay() + 6) % 7;
          const dayLabel = t.feedback.dayNames[dayIndex];

          return (
            <MiniDayCard
              key={dateKey}
              state={state}
              hasComment={Boolean(card?.coachComment)}
              dayLabel={dayLabel}
              onTap={() => onDayTap(date)}
            />
          );
        })}
      </section>
    </article>
  );
};
