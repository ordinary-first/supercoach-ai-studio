/**
 * Shared date utility functions for the feedback module.
 * Extracted to avoid duplication across feedback components.
 */
import type { TranslationStrings } from './i18n/types';

export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const getMonday = (d: Date): Date => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

export const addWeeks = (d: Date, n: number): Date => {
  const result = new Date(d);
  result.setDate(result.getDate() + n * 7);
  return result;
};

export const isLastWeekOfMonth = (weekStart: Date): boolean => {
  const nextWeek = addWeeks(weekStart, 1);
  return nextWeek.getMonth() !== weekStart.getMonth();
};

export const getMonthWeekNumber = (date: Date): number => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstMonday = new Date(firstOfMonth);
  const dayOfWeek = firstOfMonth.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  firstMonday.setDate(firstOfMonth.getDate() + daysUntilMonday);
  if (date < firstMonday) return 1;
  const diff = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 86400000));
  return diff + (daysUntilMonday === 0 ? 1 : 2);
};

export const getDayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const getDayEnd = (d: Date): number => getDayStart(d) + 86400000 - 1;

export const formatDayLabel = (date: Date, t: TranslationStrings): string => {
  const dayIndex = (date.getDay() + 6) % 7;
  return t.feedback.dayNames[dayIndex];
};

export const formatDateShort = (date: Date): string =>
  `${date.getMonth() + 1}.${date.getDate()}`;

export const getWeekLabel = (weekStart: Date, t: TranslationStrings): string => {
  const month = weekStart.getMonth() + 1;
  const weekNum = getMonthWeekNumber(weekStart);
  return t.feedback.weekLabel
    .replace('{month}', String(month))
    .replace('{week}', String(weekNum));
};

export const getClientTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
};

export const parseTime = (value: string, fallback: string): { hh: string; mm: string } => {
  const [rawHh, rawMm] = value.split(':');
  const [fallbackHh, fallbackMm] = fallback.split(':');
  const hh = /^\d{2}$/.test(rawHh || '') && Number(rawHh) >= 0 && Number(rawHh) <= 23
    ? rawHh
    : fallbackHh;
  const mm = /^\d{2}$/.test(rawMm || '') && Number(rawMm) >= 0 && Number(rawMm) <= 59
    ? rawMm
    : fallbackMm;
  return { hh, mm };
};

export const toDisplayTime = (time: string, language: 'ko' | 'en'): string => {
  const { hh, mm } = parseTime(time, '00:00');
  const hNum = Number(hh);
  if (language === 'ko') {
    const period = hNum < 12 ? '오전' : '오후';
    const hour12 = hNum % 12 === 0 ? 12 : hNum % 12;
    return `${period} ${hour12}:${mm}`;
  }
  const period = hNum < 12 ? 'AM' : 'PM';
  const hour12 = hNum % 12 === 0 ? 12 : hNum % 12;
  return `${hour12}:${mm} ${period}`;
};
