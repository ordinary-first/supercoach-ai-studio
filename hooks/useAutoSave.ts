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
  // Refs for beforeunload (always have latest values)
  const nodesRef = useRef(nodes);
  const linksRef = useRef(links);
  const todosRef = useRef(todos);
  const isDataLoadedRef = useRef(isDataLoaded);
  const userIdRef = useRef(userId);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);
  useEffect(() => { todosRef.current = todos; }, [todos]);
  useEffect(() => { isDataLoadedRef.current = isDataLoaded; }, [isDataLoaded]);
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

  // Flush pending saves before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const uid = userIdRef.current;
      if (!uid || !isDataLoadedRef.current) return;

      // Cancel pending debounced saves
      if (goalSaveTimerRef.current) clearTimeout(goalSaveTimerRef.current);
      if (todoSaveTimerRef.current) clearTimeout(todoSaveTimerRef.current);

      // Synchronously save to localStorage (Firestore is async and won't complete before unload)
      try {
        const currentNodes = nodesRef.current;
        const currentLinks = linksRef.current;
        const currentTodos = todosRef.current;
        const now = Date.now();

        const serializedGoals = {
          nodes: currentNodes.map(n => ({
            id: n.id, text: n.text, type: n.type, status: n.status,
            progress: n.progress, parentId: n.parentId || null,
            imageUrl: n.imageUrl || null, collapsed: n.collapsed || false,
          })),
          links: currentLinks.map(l => ({
            source: getLinkId(l.source),
            target: getLinkId(l.target),
          })),
          updatedAt: now,
        };
        localStorage.setItem(`secretcoach_goals_${uid}`, JSON.stringify(serializedGoals));
        localStorage.setItem(`secretcoach_todos_${uid}`, JSON.stringify({ items: currentTodos, updatedAt: now }));
      } catch (e) {
        console.warn('beforeunload save failed:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // Empty deps - registered once, uses refs for latest values
}
