import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthHeaders } from '../services/authFetch';
import { API_BASE } from '../services/config';
import type {
  CoachMemoryContext,
  GoalNode,
  ToDoItem,
  ShortTermMemory,
  MidTermMemory,
  LongTermMemory,
} from '../shared/types';
import { NodeType, NodeStatus } from '../shared/types';
import type { AppLanguage } from '../shared/i18n/types';

const API_CHAT = `${API_BASE}/api/chat`;

const STORAGE_PREFIX = 'secretcoach-memory';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ── Goal / Todo context builders ──

export const buildGoalContext = (
  nodes: GoalNode[],
  language: AppLanguage = 'ko',
): string => {
  if (!nodes.length) return language === 'ko' ? '목표 없음' : 'No goals';

  const root = nodes.find((n) => n.type === NodeType.ROOT);
  const children = nodes.filter((n) => n.type === NodeType.SUB);
  const progressLabel = language === 'ko' ? '진행률' : 'progress';

  const lines: string[] = [];
  if (root) {
    lines.push(`[ROOT] ${root.text} (${progressLabel} ${root.progress}%)`);
  }

  for (const child of children) {
    const statusTag =
      child.status === NodeStatus.COMPLETED
        ? ' ✓'
        : child.status === NodeStatus.STUCK
          ? ' ⚠'
          : '';
    lines.push(
      `  ├ ${child.text} (${progressLabel} ${child.progress}%, ${child.status}${statusTag})`,
    );
  }

  return lines.join('\n');
};

export const buildTodoContext = (
  todos: ToDoItem[],
  language: AppLanguage = 'ko',
): string => {
  if (!todos.length) return language === 'ko' ? '할일 없음' : 'No todos';

  const completed = todos.filter((t) => t.completed).length;
  const header =
    language === 'ko'
      ? `오늘 할일: ${completed}/${todos.length} 완료`
      : `Today: ${completed}/${todos.length} completed`;
  const lines = [header];

  const priorityLabel: Record<string, string> =
    language === 'ko'
      ? { high: '높음', medium: '보통', low: '낮음' }
      : { high: 'high', medium: 'medium', low: 'low' };

  for (const todo of todos) {
    const icon = todo.completed ? '✓' : '□';
    const pLabel = priorityLabel[todo.priority || 'medium'];
    lines.push(`${icon} ${todo.text} (${pLabel})`);
  }

  return lines.join('\n');
};

// ── AsyncStorage-based memory (replaces localStorage) ──

const EMPTY_MEMORY: CoachMemoryContext = {
  shortTerm: null,
  midTerm: null,
  longTerm: null,
};

interface StoredMemoryData {
  memory: CoachMemoryContext;
  shortTermUpdatedAt: number;
  midTermUpdatedAt: number;
}

const loadStoredMemory = async (): Promise<StoredMemoryData> => {
  try {
    const [short, mid, long] = await Promise.all([
      AsyncStorage.getItem(`${STORAGE_PREFIX}-shortTerm`),
      AsyncStorage.getItem(`${STORAGE_PREFIX}-midTerm`),
      AsyncStorage.getItem(`${STORAGE_PREFIX}-longTerm`),
    ]);
    const shortParsed = short ? (JSON.parse(short) as ShortTermMemory) : null;
    const midParsed = mid ? (JSON.parse(mid) as MidTermMemory) : null;
    const longParsed = long ? (JSON.parse(long) as LongTermMemory) : null;
    return {
      memory: {
        shortTerm: shortParsed?.summary ?? null,
        midTerm: midParsed?.summary ?? null,
        longTerm: longParsed?.summary ?? null,
      },
      shortTermUpdatedAt: shortParsed?.updatedAt ?? 0,
      midTermUpdatedAt: midParsed?.updatedAt ?? 0,
    };
  } catch {
    return {
      memory: EMPTY_MEMORY,
      shortTermUpdatedAt: 0,
      midTermUpdatedAt: 0,
    };
  }
};

// ── Hook ──

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

    // Phase 1: load cached memory quickly
    loadStoredMemory()
      .then(({ memory: cached }) => {
        setMemory(cached);
      })
      .catch(() => {});

    // Phase 2: background refresh
    refreshInBackground(userId)
      .then((updated) => {
        if (updated) setMemory(updated);
      })
      .catch(() => {});
  }, [isOpen, userId, nodes, todos, language]);

  return memory;
};

const isMidTermStale = (midTermUpdatedAt: number): boolean =>
  Date.now() - midTermUpdatedAt > SEVEN_DAYS_MS;

async function refreshInBackground(
  userId: string | null,
): Promise<CoachMemoryContext | null> {
  if (!userId) return null;

  try {
    const stored = await loadStoredMemory();
    const existing = stored.memory;
    const timestamps = {
      shortTermUpdatedAt: stored.shortTermUpdatedAt,
      midTermUpdatedAt: stored.midTermUpdatedAt,
    };

    let changed = false;

    // Mid-term + long-term memory refresh when stale (>7 days)
    if (isMidTermStale(timestamps.midTermUpdatedAt)) {
      try {
        const midRes = await fetch(API_CHAT, {
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

        const longRes = await fetch(API_CHAT, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            action: 'promote-long',
            userId,
            existingMemory: existing,
            feedbackHistory: [],
          }),
        });
        if (longRes.ok) {
          existing.longTerm = (await longRes.json()).summary;
          changed = true;
        }
      } catch {
        /* stale data is fine */
      }
    }

    return changed ? existing : null;
  } catch {
    return null;
  }
}
