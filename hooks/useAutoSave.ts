import { useCallback, useEffect, useRef } from 'react';
import { GoalNode, GoalLink, ToDoItem, TodoList, TodoGroup, UserProfile } from '../types';
import { saveGoalData, saveTodos, saveTodoLists } from '../services/firebaseService';

// Helper to safely get link source/target ID (D3 may store objects or strings)
export const getLinkId = (ref: string | GoalNode | { id: string }): string => {
  if (typeof ref === 'string') return ref;
  return ref.id;
};

interface AutoSaveReturn {
  flushAll: () => Promise<void>;
}

export function useAutoSave(
  nodes: GoalNode[],
  links: GoalLink[],
  todos: ToDoItem[],
  todoLists: TodoList[],
  todoGroups: TodoGroup[],
  userProfile: UserProfile | null,
  isDataLoaded: boolean,
  userId: string | null,
): AutoSaveReturn {
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Refs for latest data (flushAll reads from these to avoid stale closures)
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const todosRef = useRef(todos);
  const todoListsRef = useRef(todoLists);
  const todoGroupsRef = useRef(todoGroups);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);
  useEffect(() => { todosRef.current = todos; }, [todos]);
  useEffect(() => { todoListsRef.current = todoLists; }, [todoLists]);
  useEffect(() => { todoGroupsRef.current = todoGroups; }, [todoGroups]);

  // Debounce timers
  const goalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track dirty state (pending saves)
  const goalDirtyRef = useRef(false);
  const todoDirtyRef = useRef(false);
  const listDirtyRef = useRef(false);

  // Loading guard
  const isLoadingDataRef = useRef(false);
  const prevIsDataLoadedRef = useRef(isDataLoaded);
  useEffect(() => {
    if (!prevIsDataLoadedRef.current && isDataLoaded) {
      // Data just finished loading; first auto-save trigger is from loaded data.
    }
    prevIsDataLoadedRef.current = isDataLoaded;
  }, [isDataLoaded]);

  // --- flushAll: 즉시 pending save 전부 실행 (로그아웃/beforeunload 용) ---
  const flushAll = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;

    // Cancel pending timers
    if (goalSaveTimerRef.current) { clearTimeout(goalSaveTimerRef.current); goalSaveTimerRef.current = null; }
    if (todoSaveTimerRef.current) { clearTimeout(todoSaveTimerRef.current); todoSaveTimerRef.current = null; }
    if (listSaveTimerRef.current) { clearTimeout(listSaveTimerRef.current); listSaveTimerRef.current = null; }

    // Save only dirty data from refs (latest values)
    const saves: Promise<void>[] = [];
    if (goalDirtyRef.current) {
      saves.push(saveGoalData(uid, nodesRef.current, linksRef.current).catch(() => {}));
      goalDirtyRef.current = false;
    }
    if (todoDirtyRef.current) {
      saves.push(saveTodos(uid, todosRef.current).catch(() => {}));
      todoDirtyRef.current = false;
    }
    if (listDirtyRef.current) {
      saves.push(saveTodoLists(uid, todoListsRef.current, todoGroupsRef.current).catch(() => {}));
      listDirtyRef.current = false;
    }

    if (saves.length > 0) await Promise.allSettled(saves);
  }, []);

  // beforeunload — 브라우저 닫힘/새로고침 시 pending save flush
  useEffect(() => {
    const handleBeforeUnload = () => { flushAll(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushAll]);

  // Auto-save goals (nodes + links) with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    goalDirtyRef.current = true;
    if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
    goalSaveTimerRef.current = setTimeout(() => {
      goalDirtyRef.current = false;
      saveGoalData(currentUserId, nodes, links).catch(e => console.error('Goal save error:', e));
    }, 1500);

    return () => {
      if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
    };
  }, [nodes, links, userProfile, isDataLoaded]);

  // Auto-save todos with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    todoDirtyRef.current = true;
    if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    todoSaveTimerRef.current = setTimeout(() => {
      todoDirtyRef.current = false;
      saveTodos(currentUserId, todos).catch(e => console.error('Todo save error:', e));
    }, 1500);

    return () => {
      if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    };
  }, [todos, userProfile, isDataLoaded]);

  // Auto-save todo lists & groups with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    listDirtyRef.current = true;
    if (listSaveTimerRef.current) clearTimeout(listSaveTimerRef.current);
    listSaveTimerRef.current = setTimeout(() => {
      listDirtyRef.current = false;
      saveTodoLists(currentUserId, todoLists, todoGroups).catch(e => console.error('TodoLists save error:', e));
    }, 1500);

    return () => {
      if (listSaveTimerRef.current) clearTimeout(listSaveTimerRef.current);
    };
  }, [todoLists, todoGroups, userProfile, isDataLoaded]);

  return { flushAll };
}
