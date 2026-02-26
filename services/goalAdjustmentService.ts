import type { ToDoItem, GoalNode, FeedbackCard, GoalAdjustment } from '../types';

/**
 * 목표별 완료율 분석 → 재조정 제안 생성
 * - 3주 연속 <50% → 하향 조정 제안
 * - 3주 연속 ≥95% → 상향 조정 제안
 */

const getWeekKeys = (weeksBack: number): string[][] => {
  const result: string[][] = [];
  const now = new Date();
  const getMonday = (d: Date): Date => {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  };

  for (let w = 1; w <= weeksBack; w++) {
    const weekStart = new Date(getMonday(now));
    weekStart.setDate(weekStart.getDate() - w * 7);
    const keys: string[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      keys.push(`${y}-${m}-${dd}`);
    }
    result.push(keys);
  }
  return result;
};

interface GoalWeeklyStats {
  totalTodos: number;
  completedTodos: number;
  rate: number;
}

const extractNumericMetric = (text: string): { value: number; unit: string; match: string } | null => {
  // 숫자+단위 패턴: "1시간", "30분", "5km", "3회", "10개" 등
  const pattern = /(\d+(?:\.\d+)?)\s*(시간|분|km|회|개|번|장|페이지|권|잔|리터|ml|kg|g|%|분간)/;
  const m = text.match(pattern);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: m[2], match: m[0] };
};

const suggestMetric = (
  current: { value: number; unit: string; match: string },
  avgRate: number,
  direction: 'down' | 'up',
): string => {
  let newValue: number;
  if (direction === 'down') {
    // 달성률에 비례하여 하향 (최소 50% 수준)
    const factor = Math.max(0.5, avgRate / 100);
    newValue = Math.round(current.value * factor * 10) / 10;
    // 최소 1
    if (newValue < 1 && current.value >= 1) newValue = 1;
  } else {
    // 상향: 20~50% 증가
    const factor = 1.2 + (avgRate - 95) * 0.01;
    newValue = Math.round(current.value * Math.min(factor, 1.5) * 10) / 10;
  }
  // 정수 가능하면 정수로
  if (newValue === Math.floor(newValue)) newValue = Math.floor(newValue);
  return `${newValue}${current.unit}`;
};

export const analyzeGoalCompletionRates = (
  todos: ToDoItem[],
  nodes: GoalNode[],
  feedbackCards: Map<string, FeedbackCard>,
  weeks: number = 3,
): GoalAdjustment[] => {
  if (weeks < 2 || nodes.length === 0) return [];

  const weekKeysList = getWeekKeys(weeks);
  if (weekKeysList.length < weeks) return [];

  // 목표별 linkedTodo 매핑
  const goalTodoMap = new Map<string, ToDoItem[]>();
  todos.forEach((td) => {
    const goalId = td.linkedNodeId || td.linkedGoalId;
    if (!goalId) return;
    const list = goalTodoMap.get(goalId) || [];
    list.push(td);
    goalTodoMap.set(goalId, list);
  });

  const adjustments: GoalAdjustment[] = [];

  for (const node of nodes) {
    const linkedTodos = goalTodoMap.get(node.id);
    if (!linkedTodos || linkedTodos.length === 0) continue;

    // 텍스트에서 수치 메트릭 추출 가능한지 확인
    const metric = extractNumericMetric(node.text);
    if (!metric) continue;

    // 주별 달성률 계산
    const weeklyStats: GoalWeeklyStats[] = weekKeysList.map((dayKeys) => {
      let total = 0;
      let completed = 0;
      for (const key of dayKeys) {
        const card = feedbackCards.get(key);
        if (!card) continue;
        // 해당 목표와 연결된 todo 텍스트가 card에 있는지
        linkedTodos.forEach((td) => {
          if (card.completedTodos.includes(td.text)) {
            total += 1;
            completed += 1;
          } else if (card.incompleteTodos.includes(td.text)) {
            total += 1;
          }
        });
      }
      const rate = total > 0 ? (completed / total) * 100 : -1; // -1 = no data
      return { totalTodos: total, completedTodos: completed, rate };
    });

    // 데이터 없는 주 제외
    const validWeeks = weeklyStats.filter((s) => s.rate >= 0);
    if (validWeeks.length < 2) continue;

    const avgRate = Math.round(
      validWeeks.reduce((sum, s) => sum + s.rate, 0) / validWeeks.length,
    );

    // 모든 유효 주가 <50% → 하향 제안
    const allLow = validWeeks.every((s) => s.rate < 50);
    // 모든 유효 주가 ≥95% → 상향 제안
    const allHigh = validWeeks.every((s) => s.rate >= 95);

    if (!allLow && !allHigh) continue;

    const direction = allLow ? 'down' : 'up';
    const suggested = suggestMetric(metric, avgRate, direction);

    if (suggested === metric.match) continue; // 변화 없음

    adjustments.push({
      goalId: node.id,
      goalText: node.text,
      currentMetric: metric.match,
      suggestedMetric: suggested,
      reason: `${validWeeks.length}주 평균 ${avgRate}%`,
      avgCompletion: avgRate,
      weeks: validWeeks.length,
      status: 'pending',
    });
  }

  return adjustments;
};
