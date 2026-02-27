import React, { useRef } from 'react';
import { DayCard } from './DayCard';
import type { DayCardState } from './DayCard';
import type { FeedbackCard, ToDoItem } from '../../types';
import type { TranslationStrings } from '../../i18n/types';

interface WeeklyCardScrollProps {
  weekStart: Date;
  todos: ToDoItem[];
  feedbackCards: Map<string, FeedbackCard>;
  t: TranslationStrings;
  onDayTap: (date: Date) => void;
}

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const getDayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const getDayEnd = (d: Date): number => getDayStart(d) + 86400000 - 1;

const deriveDayState = (
  date: Date,
  card: FeedbackCard | null,
  dayTodos: ToDoItem[],
): DayCardState => {
  const now = new Date();
  const todayKey = toDateKey(now);
  const dateKey = toDateKey(date);

  if (dateKey > todayKey) return 'future';
  if (dateKey === todayKey) {
    if (card && card.completedTodos.length > 0) return 'completed';
    return 'today-pending';
  }
  // Past
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

const getTodosForDay = (todos: ToDoItem[], date: Date): ToDoItem[] => {
  const start = getDayStart(date);
  const end = getDayEnd(date);
  return todos.filter((td) => {
    const ref = td.dueDate || td.createdAt;
    return ref >= start && ref <= end;
  });
};

export const WeeklyCardScroll: React.FC<WeeklyCardScrollProps> = ({
  weekStart,
  todos,
  feedbackCards,
  t,
  onDayTap,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pl-4 pr-4 pb-2 snap-x snap-mandatory scrollbar-hide"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {days.map((date, i) => {
        const dateKey = toDateKey(date);
        const card = feedbackCards.get(dateKey) ?? null;
        const dayTodos = getTodosForDay(todos, date);
        const state = deriveDayState(date, card, dayTodos);
        const displayCard = deriveFeedbackCard(card, dayTodos, dateKey);

        return (
          <div key={dateKey} className="snap-start" style={{ scrollSnapAlign: 'start' }}>
            <DayCard
              date={date}
              state={state}
              card={displayCard}
              t={t}
              index={i}
              onTap={() => onDayTap(date)}
            />
          </div>
        );
      })}
    </div>
  );
};
