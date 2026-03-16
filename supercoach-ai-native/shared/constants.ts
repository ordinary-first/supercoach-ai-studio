import type { RepeatFrequency } from './types';

/** Human-readable labels for repeat frequencies. */
export const REPEAT_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  'weekly-2': '2x/week',
  'weekly-3': '3x/week',
  'weekly-4': '4x/week',
  'weekly-5': '5x/week',
  'weekly-6': '6x/week',
  monthly: 'Monthly',
};

export function getRepeatLabel(freq: RepeatFrequency | undefined): string | null {
  if (!freq) return null;
  return REPEAT_LABELS[freq] ?? freq;
}
