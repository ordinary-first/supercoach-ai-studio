import type { ToDoItem } from '../types';

/**
 * 할일의 "기간(날짜 범위)"을 단일 진실로 계산한다.
 * 할일 탭과 일정 탭이 공유하는 헬퍼 — 어느 화면에서든 같은 규칙으로 날짜를 해석.
 *
 * 규칙:
 *  - startDate & endDate 둘 다 있으면 → 그 범위 (기간 할일)
 *  - 없고 dueDate만 있으면 → {dueDate, dueDate} (단일 할일, 레거시 호환)
 *  - 셋 다 없으면 → null (미배정, 캘린더에 안 뜸)
 *
 * 옛 할일은 데이터를 고치지 않아도 dueDate가 단일 범위로 해석되므로 마이그레이션 불필요.
 */
export interface TodoSpan {
  start: number; // ms
  end: number;   // ms
  isRange: boolean; // 시작≠종료 (여러 날 걸침)
}

/** start-of-day(00:00) 타임스탬프로 정규화 */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** end-of-day(23:59:59.999) 타임스탬프로 정규화 */
export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** 두 ms 타임스탬프가 같은 달력 날짜인지 */
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** 자정 기준 두 날짜 사이의 일 수 차이 (a→b, 양수면 b가 나중) */
export function dayDiff(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

/**
 * 할일의 기간을 반환. 없으면 null.
 * start/end는 항상 start ≤ end가 되도록 정렬해 반환(입력이 뒤집혀 있어도 안전).
 */
export function getTodoSpan(todo: ToDoItem): TodoSpan | null {
  const hasRange = todo.startDate != null && todo.endDate != null;
  if (hasRange) {
    let s = todo.startDate as number;
    let e = todo.endDate as number;
    if (s > e) [s, e] = [e, s]; // 뒤집힌 입력 방어
    return { start: s, end: e, isRange: !isSameDay(s, e) };
  }
  if (todo.dueDate != null) {
    return { start: todo.dueDate, end: todo.dueDate, isRange: false };
  }
  return null;
}

/**
 * 해당 할일이 targetDate(그 날) 안에 걸쳐 있는지.
 * raw ms가 아니라 일 단위(start-of-day ~ end-of-day)로 비교해
 * 정오 앵커/시간 포함 할일도 그 날 전체에 포함되도록 한다.
 */
export function spansDate(todo: ToDoItem, targetDate: Date): boolean {
  const span = getTodoSpan(todo);
  if (!span) return false;
  const dayStart = startOfDay(targetDate.getTime());
  const dayEnd = endOfDay(targetDate.getTime());
  return startOfDay(span.start) <= dayEnd && endOfDay(span.end) >= dayStart;
}

/** 기간 할일을 만들 때 쓰는 정오 앵커 타임스탬프(종일, DST/날짜 밀림 방어) */
export function noonOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}
