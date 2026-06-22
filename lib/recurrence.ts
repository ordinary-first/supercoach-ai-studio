import type { ToDoItem } from '../types';

/** Returns true if targetDate falls on a recurrence day for the given todo. */
export const checkRecurrenceMatch = (todo: ToDoItem, targetDate: Date): boolean => {
  if (!todo.repeat) return false;

  const anchorTimestamp = todo.dueDate || todo.createdAt;

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const start = new Date(anchorTimestamp);
  start.setHours(0, 0, 0, 0);

  if (target.getTime() < start.getTime()) return false;

  const day = target.getDay();

  if (todo.repeat === 'daily') return true;

  if (todo.repeat === 'weekdays') {
    return day !== 0 && day !== 6;
  }

  if (todo.repeat === 'weekly') {
    return day === start.getDay();
  }

  if (todo.repeat === 'monthly') {
    const startDay = start.getDate();
    const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return target.getDate() === Math.min(startDay, daysInMonth);
  }

  switch (todo.repeat) {
    case 'weekly-2':
      return day === 1 || day === 4;
    case 'weekly-3':
      return day === 1 || day === 3 || day === 5;
    case 'weekly-4':
      return day === 1 || day === 2 || day === 4 || day === 5;
    case 'weekly-5':
      return day >= 1 && day <= 5;
    case 'weekly-6':
      return day >= 1 && day <= 6;
    default:
      return false;
  }
};
