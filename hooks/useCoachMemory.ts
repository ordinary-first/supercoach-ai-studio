import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  CoachMemoryContext,
  GoalNode,
  ToDoItem,
} from '../types';
import { NodeType, NodeStatus } from '../types';
import {
  loadMemory,
  loadMemoryTimestamps,
  isMidTermStale,
} from '../services/coachMemoryService';
import {
  getRecentActions,
  cleanupOldActions,
} from '../services/actionLogService';

const API_BASE = '/api/coach-memory';

export const buildGoalContext = (nodes: GoalNode[]): string => {
  if (!nodes.length) return '목표 없음';

  const root = nodes.find(n => n.type === NodeType.ROOT);
  const children = nodes.filter(n => n.type === NodeType.SUB);

  const lines: string[] = [];
  if (root) {
    lines.push(`[ROOT] ${root.text} (진행률 ${root.progress}%)`);
  }

  for (const child of children) {
    const statusTag =
      child.status === NodeStatus.COMPLETED ? ' ✓' :
      child.status === NodeStatus.STUCK ? ' ⚠' : '';
    lines.push(
      `  ├ ${child.text} (진행률 ${child.progress}%, ${child.status}${statusTag})`,
    );
  }

  return lines.join('\n');
};

export const buildTodoContext = (todos: ToDoItem[]): string => {
  if (!todos.length) return '할일 없음';

  const completed = todos.filter(t => t.completed).length;
  const lines = [`오늘 할일: ${completed}/${todos.length} 완료`];

  const priorityLabel: Record<string, string> = {
    high: '높음',
    medium: '보통',
    low: '낮음',
  };

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
    const goalCtx = buildGoalContext(nodes);
    const todoCtx = buildTodoContext(todos);

    refreshInBackground(userId, goalCtx, todoCtx)
      .then(updated => {
        if (updated) setMemory(updated);
      })
      .catch(() => {});
  }, [isOpen, userId, nodes, todos]);

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

    // 단기 메모리 갱신
    const latestAction = actions.length > 0
      ? Math.max(...actions.map(a => a.timestamp))
      : 0;

    if (latestAction > timestamps.shortTermUpdatedAt && actions.length > 0) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'summarize-short',
            userId,
            actionLogs: actions,
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
          headers: { 'Content-Type': 'application/json' },
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

        const longRes = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'promote-long',
            userId,
            existingMemory: existing,
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
