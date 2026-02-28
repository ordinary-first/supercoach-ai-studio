import React from 'react';
import { DayCard } from './DayCard';
import type { DayCardState } from './DayCard';
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

const deriveDayState = (
  date: Date,
  card: FeedbackCard | null,
  dayTodos: ToDoItem[],
): DayCardState => {
  const todayKey = toDateKey(new Date());
  const dateKey = toDateKey(date);

  if (dateKey > todayKey) return 'future';
  if (dateKey === todayKey) {
    if (card && card.completedTodos.length > 0) return 'completed';
    return 'today-pending';
  }
  if (card && (card.completedTodos.length > 0 || card.incompleteTodos.length > 0)) {
    return 'completed';
  }
  if (dayTodos.some((td) => td.completed)) return 'completed';
  if (dayTodos.length > 0) return 'completed';
  return 'empty-past';
};

const deriveFeedbackCard = (
  card: FeedbackCard | null,
  dayTodos: ToDoItem[],
  dateKey: string,
): FeedbackCard | null => {
  if (card) return card;
  if (dayTodos.length === 0) return null;
  return {
    date: dateKey,
    completedTodos: dayTodos.filter((td) => td.completed).map((td) => td.text),
    incompleteTodos: dayTodos.filter((td) => !td.completed).map((td) => td.text),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
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
      className={`fb-coverflow-card-shell fb-card-press p-3 md:p-4
        ${isActive ? '' : 'fb-coverflow-card-shell-inactive'}`}
    >
      <header className="mb-2">
        <p className="fb-coverflow-week-title text-[15px] font-semibold text-th-text">{label}</p>
        <p className="fb-coverflow-week-range text-[11px] text-th-text-secondary mt-0.5">{range}</p>
      </header>

      <section
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
        style={{ touchAction: 'pan-x' }}
        onClick={onCardTap}
      >
        {days.map((date, i) => {
          const dateKey = toDateKey(date);
          const card = feedbackCards.get(dateKey) ?? null;
          const dayTodos = getTodosForDay(todos, date);
          const state = deriveDayState(date, card, dayTodos);
          const displayCard = deriveFeedbackCard(card, dayTodos, dateKey);

          return (
            <DayCard
              key={dateKey}
              date={date}
              state={state}
              card={displayCard}
              t={t}
              index={i}
              onTap={() => onDayTap(date)}
            />
          );
        })}
      </section>
    </article>
  );
};
