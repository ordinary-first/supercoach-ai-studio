import type { ToDoItem, RepeatFrequency } from '../types';

/** Default weekdays (0=Sun…6=Sat) for each weekly-N pattern */
export const DEFAULT_REPEAT_DAYS: Record<string, number[]> = {
  'weekly-2': [1, 4],       // Mon, Thu
  'weekly-3': [1, 3, 5],    // Mon, Wed, Fri
  'weekly-4': [1, 2, 4, 5], // Mon, Tue, Thu, Fri
  'weekly-5': [1, 2, 3, 4, 5],
  'weekly-6': [1, 2, 3, 4, 5, 6],
};

/** Returns the effective repeat-day array for a todo */
export function getRepeatDays(todo: ToDoItem): number[] | null {
  if (!todo.repeat) return null;
  if (todo.repeatDays && todo.repeatDays.length > 0) return todo.repeatDays;
  return DEFAULT_REPEAT_DAYS[todo.repeat] ?? null;
}

/**
 * Returns true if `todo` should appear on `targetDate`.
 * Handles all RepeatFrequency values + custom repeatDays.
 */
export function matchesOn(todo: ToDoItem, targetDate: Date): boolean {
  if (!todo.repeat) return false;

  const anchor = new Date(todo.dueDate ?? todo.createdAt);
  anchor.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  if (target < anchor) return false;

  const dow = target.getDay();

  if (todo.repeat === 'daily') return true;
  if (todo.repeat === 'weekdays') return dow >= 1 && dow <= 5;
  if (todo.repeat === 'weekly') return dow === anchor.getDay();
  if (todo.repeat === 'monthly') return target.getDate() === anchor.getDate();

  const days = getRepeatDays(todo);
  if (days) return days.includes(dow);

  return false;
}

/**
 * Returns the next occurrence date after `afterDate`.
 * Used by App.tsx completion handler to advance dueDate.
 */
export function nextOccurrence(todo: ToDoItem, afterDate: Date): Date | null {
  if (!todo.repeat) return null;

  const start = new Date(afterDate);
  start.setHours(0, 0, 0, 0);

  if (todo.repeat === 'daily') {
    const d = new Date(start);
    d.setDate(d.getDate() + 1);
    return d;
  }

  if (todo.repeat === 'monthly') {
    const anchor = new Date(todo.dueDate ?? todo.createdAt);
    const d = new Date(start);
    d.setMonth(d.getMonth() + 1);
    d.setDate(anchor.getDate());
    return d;
  }

  // For all day-of-week patterns, scan forward up to 14 days
  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    if (matchesOn(todo, candidate)) return candidate;
  }

  return null;
}

/** Used by the UI chip to display "X days/week" label */
export function repeatLabel(repeat: RepeatFrequency, days?: number[]): string {
  if (!repeat) return '';
  if (repeat === 'daily') return '매일';
  if (repeat === 'weekdays') return '주중';
  if (repeat === 'weekly') return '매주';
  if (repeat === 'monthly') return '매월';
  const effective = (days && days.length > 0) ? days : (DEFAULT_REPEAT_DAYS[repeat] ?? []);
  return `주${effective.length}회`;
}
