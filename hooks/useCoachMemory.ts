import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../services/authFetch';
import type {
  CoachMemoryContext,
  GoalNode,
  ToDoItem,
} from '../types';
import { NodeType, NodeStatus } from '../types';
import type { AppLanguage } from '../i18n/types';
import {
  loadMemory,
  loadMemoryTimestamps,
  isMidTermStale,
} from '../services/coachMemoryService';
import {
  getRecentActions,
  cleanupOldActions,
} from '../services/actionLogService';
import { loadFeedbackCards } from '../services/firebaseService';

const API_BASE = '/api/chat';

export const buildGoalContext = (nodes: GoalNode[], language: AppLanguage = 'ko'): string => {
  if (!nodes.length) return language === 'ko' ? '목표 없음' : 'No goals';

  const root = nodes.find(n => n.type === NodeType.ROOT);
  const children = nodes.filter(n => n.type === NodeType.SUB);
  const progressLabel = language === 'ko' ? '진행률' : 'progress';

  const lines: string[] = [];
  if (root) {
    lines.push(`[ROOT] ${root.text} (${progressLabel} ${root.progress}%)`);
  }

  for (const child of children) {
    const statusTag =
      child.status === NodeStatus.COMPLETED ? ' ✓' :
      child.status === NodeStatus.STUCK ? ' ⚠' : '';
    lines.push(
      `  ├ ${child.text} (${progressLabel} ${child.progress}%, ${child.status}${statusTag})`,
    );
  }

  return lines.join('\n');
};

export const buildTodoContext = (todos: ToDoItem[], language: AppLanguage = 'ko'): string => {
  if (!todos.length) return language === 'ko' ? '할일 없음' : 'No todos';

  const completed = todos.filter(t => t.completed).length;
  const header = language === 'ko'
    ? `오늘 할일: ${completed}/${todos.length} 완료`
    : `Today: ${completed}/${todos.length} completed`;
  const lines = [header];

  const priorityLabel: Record<string, string> = language === 'ko'
    ? { high: '높음', medium: '보통', low: '낮음' }
    : { high: 'high', medium: 'medium', low: 'low' };

  for (const todo of todos) {
    const icon = todo.completed ? '✓' : '□';
    const pLabel = priorityLabel[todo.priority || 'medium'];
    lines.push(`${icon} ${todo.text} (${pLabel})`);
  }

  return lines.join('\n');
};

const EMPTY_MEMORY: CoachMemoryContext = {
  shortTerm: null,
  midTerm: null,
  longTerm: null,
};

export const useCoachMemory = (
  userId: string | null,
  isOpen: boolean,
  nodes: GoalNode[],
  todos: ToDoItem[],
  language: AppLanguage = 'ko',
) => {
  const [memory, setMemory] = useState<CoachMemoryContext>(EMPTY_MEMORY);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      activeRef.current = false;
      setMemory(EMPTY_MEMORY);
      return;
    }
    if (activeRef.current) return;
    activeRef.current = true;

    // Phase 1: 기존 캐시 즉시 로드 (빠름, ~100ms)
    loadMemory(userId).then(cached => {
      setMemory(cached);
    }).catch(() => {});

    // Phase 2: 백그라운드 갱신 (느림, 2-3초)
    const goalCtx = buildGoalContext(nodes, language);
    const todoCtx = buildTodoContext(todos, language);

    refreshInBackground(userId, goalCtx, todoCtx)
      .then(updated => {
        if (updated) setMemory(updated);
      })
      .catch(() => {});
  }, [isOpen, userId, nodes, todos, language]);

  return memory;
};

async function refreshInBackground(
  userId: string | null,
  goalContext: string,
  todoContext: string,
): Promise<CoachMemoryContext | null> {
  if (!userId) return null;

  try {
    const [existing, timestamps, actions] = await Promise.all([
      loadMemory(userId),
      loadMemoryTimestamps(userId),
      getRecentActions(userId),
    ]);

    let changed = false;

    // 단기 메모리 갱신 — 새 로그 5개 이상일 때만 GPT 호출
    const MIN_NEW_ACTIONS = 5;
    const newActions = actions.filter(
      a => a.timestamp > timestamps.shortTermUpdatedAt,
    );

    if (newActions.length >= MIN_NEW_ACTIONS) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: 'summarize-short',
            userId,
            actionLogs: newActions,
            goalContext,
            todoContext,
            existingMemory: existing,
          }),
        });
        if (res.ok) {
          existing.shortTerm = (await res.json()).summary;
          changed = true;
        }
      } catch { /* stale data로 진행 */ }
    }

    // 중기 + 장기 메모리 갱신 (7일 초과 시)
    if (isMidTermStale(timestamps.midTermUpdatedAt)) {
      try {
        const midRes = await fetch(API_BASE, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: 'summarize-mid',
            userId,
            existingMemory: existing,
          }),
        });
        if (midRes.ok) {
          existing.midTerm = (await midRes.json()).summary;
          changed = true;
        }

        // 최근 30일 피드백 카드 → 장기 메모리 enrichment
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const fmt = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let feedbackHistory: { date: string; completedTodos: string[]; comment: string }[] = [];
        try {
          const cards = await loadFeedbackCards(userId, fmt(thirtyDaysAgo), fmt(new Date()));
          feedbackHistory = cards
            .filter(c => c.completedTodos.length > 0)
            .map(c => ({ date: c.date, completedTodos: c.completedTodos, comment: c.coachComment || '' }));
        } catch { /* proceed without feedback */ }

        const longRes = await fetch(API_BASE, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: 'promote-long',
            userId,
            existingMemory: existing,
            feedbackHistory,
          }),
        });
        if (longRes.ok) {
          existing.longTerm = (await longRes.json()).summary;
          changed = true;
        }
      } catch { /* stale data로 진행 */ }
    }

    // 30일 초과 로그 정리
    cleanupOldActions(userId).catch(() => {});

    return changed ? existing : null;
  } catch {
    return null;
  }
}
