import { useEffect, useRef } from 'react';
import { GoalNode, GoalLink, ToDoItem, UserProfile } from '../types';
import { saveGoalData, saveTodos } from '../services/firebaseService';

// Helper to safely get link source/target ID (D3 may store objects or strings)
export const getLinkId = (ref: string | GoalNode | { id: string }): string => {
  if (typeof ref === 'string') return ref;
  return ref.id;
};

export function useAutoSave(
  nodes: GoalNode[],
  links: GoalLink[],
  todos: ToDoItem[],
  userProfile: UserProfile | null,
  isDataLoaded: boolean,
  userId: string | null,
): void {
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Debounce timers for auto-save
  const goalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal loading guard - prevents saving during the render cycle
  // where isDataLoaded just became true alongside new data
  const isLoadingDataRef = useRef(false);

  // Track when isDataLoaded transitions from false to true to set loading guard
  const prevIsDataLoadedRef = useRef(isDataLoaded);
  useEffect(() => {
    if (!prevIsDataLoadedRef.current && isDataLoaded) {
      // Data just finished loading; the first auto-save trigger is from loaded data.
      // isLoadingDataRef is already false at this point (matching original behavior).
    }
    prevIsDataLoadedRef.current = isDataLoaded;
  }, [isDataLoaded]);

  // Auto-save goals (nodes + links) with debounce
  useEffect(() => {
    if (!userProfile || !isDataLoaded || isLoadingDataRef.current) return;

    const currentUserId = userIdRef.current;
    if (!currentUserId) return;

    if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
    goalSaveTimerRef.current = setTimeout(() => {
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

    if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    todoSaveTimerRef.current = setTimeout(() => {
      saveTodos(currentUserId, todos).catch(e => console.error('Todo save error:', e));
    }, 1500);

    return () => {
      if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);
    };
  }, [todos, userProfile, isDataLoaded]);

  // No local persistence fallback: backend is the single source of truth.
}
