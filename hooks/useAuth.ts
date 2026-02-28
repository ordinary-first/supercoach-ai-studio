import React, { useEffect, useRef, useState } from 'react';
import { GoalLink, GoalNode, ToDoItem, TodoGroup, TodoList, UserProfile } from '../types';
import {
  ensureCreatedAt,
  getSyncStatus,
  getUserId,
  loadGoalData,
  loadProfile,
  loadTodoLists,
  loadTodos,
  loginAnonymously,
  loginWithDevToken,
  onAuthUpdate,
  testFirestoreConnection,
  SyncStatus,
} from '../services/firebaseService';
import { syncSubscription } from '../services/polarService';

export interface AuthState {
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isInitializing: boolean;
  isDataLoaded: boolean;
  syncStatus: SyncStatus;
  userId: string | null;
  isTrialExpired: boolean;
  isNewUser: boolean;
  setIsNewUser: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAuth(
  onGoalDataLoaded: (nodes: GoalNode[], links: GoalLink[]) => void,
  onTodosLoaded: (todos: ToDoItem[]) => void,
  onTodoListsLoaded: (lists: TodoList[], groups: TodoGroup[]) => void,
): AuthState {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [isNewUser, setIsNewUser] = useState(false);

  const userIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const devAuthBootstrappingRef = useRef(false);

  const isDevMode =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev');
  const devAuthToken =
    import.meta.env.DEV ? new URLSearchParams(window.location.search).get('devToken') : null;

  // In dev mode, authenticate against Firebase so backend paths are exercised.
  useEffect(() => {
    if (!isDevMode) return;
    devAuthBootstrappingRef.current = true;
    let cancelled = false;
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved && !cancelled) {
        setIsInitializing(false);
      }
    }, 8000);
    (async () => {
      const user = devAuthToken
        ? await loginWithDevToken(devAuthToken)
        : await loginAnonymously();
      resolved = true;
      devAuthBootstrappingRef.current = false;
      clearTimeout(timeout);
      if (!user && !cancelled) {
        setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
      devAuthBootstrappingRef.current = false;
      clearTimeout(timeout);
    };
  }, [devAuthToken, isDevMode]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthUpdate((authProfile) => {
      if (isDevMode && !authProfile && devAuthBootstrappingRef.current) {
        return;
      }

      setUserProfile((prev) => {
        if (!authProfile) return null;
        if (!prev) return authProfile;
        return {
          ...prev,
          name: authProfile.name || prev.name,
          email: authProfile.email || prev.email,
          googleId: authProfile.googleId || prev.googleId,
          avatarUrl: authProfile.avatarUrl || prev.avatarUrl,
        };
      });

      setIsInitializing(false);

      const uid = authProfile ? authProfile.googleId ?? getUserId() : null;
      const prevUid = userIdRef.current;

      if (uid && uid !== prevUid) {
        userIdRef.current = uid;
        loadedUserIdRef.current = null;
        setIsDataLoaded(false);
      } else if (!uid) {
        userIdRef.current = null;
        loadedUserIdRef.current = null;
        setIsDataLoaded(false);
      }
    });

    return () => unsubscribe();
  }, [isDevMode]);

  // Load user-scoped data from Firestore
  useEffect(() => {
    if (!userProfile) {
      loadedUserIdRef.current = null;
      isLoadingRef.current = false;
      setIsDataLoaded(false);
      setSyncStatus('offline');
      return;
    }

    const userId = userIdRef.current || userProfile.googleId || getUserId();
    if (!userId) {
      setIsDataLoaded(true);
      return;
    }
    userIdRef.current = userId;

    if (loadedUserIdRef.current === userId && isDataLoaded) return;
    if (isLoadingRef.current) return;

    const loadData = async () => {
      isLoadingRef.current = true;
      setIsDataLoaded(false);

      setSyncStatus(getSyncStatus());
      testFirestoreConnection(userId).then(() => {
        setSyncStatus(getSyncStatus());
      });

      await ensureCreatedAt(userId);

      try {
        const [goalData, todoData, todoListsData, savedProfile] = await Promise.all([
          loadGoalData(userId),
          loadTodos(userId),
          loadTodoLists(userId),
          loadProfile(userId),
        ]);

        if (userIdRef.current !== userId) return;

        if (goalData && goalData.nodes.length > 0) {
          onGoalDataLoaded(goalData.nodes, goalData.links);
        }

        if (todoData && todoData.length > 0) {
          onTodosLoaded(todoData);
        }

        if (todoListsData) {
          onTodoListsLoaded(todoListsData.lists, todoListsData.groups);
        }

        if (savedProfile) {
          const needsOnboarding = savedProfile.onboardingCompleted === false;
          setIsNewUser(needsOnboarding);

          let billingPlan = savedProfile.billingPlan;
          let billingIsActive = savedProfile.billingIsActive;
          let billingSubscriptionId = savedProfile.billingSubscriptionId;
          let billingCancelAtPeriodEnd = savedProfile.billingCancelAtPeriodEnd;

          try {
            const syncResult = await syncSubscription(userId);
            if (syncResult.isActive && syncResult.plan) {
              billingPlan = syncResult.plan;
              billingIsActive = true;
              billingSubscriptionId = syncResult.subscriptionId;
              billingCancelAtPeriodEnd = syncResult.cancelAtPeriodEnd;
            }
          } catch (syncError) {
            console.error('[Billing] Polar sync failed:', syncError);
          }

          setUserProfile((prev) => {
            if (!prev) return savedProfile;
            return {
              ...prev,
              avatarUrl: savedProfile.avatarUrl || prev.avatarUrl,
              bio: savedProfile.bio,
              gallery: savedProfile.gallery,
              age: savedProfile.age,
              location: savedProfile.location,
              gender: savedProfile.gender,
              billingPlan,
              billingIsActive,
              billingSubscriptionId,
              billingCancelAtPeriodEnd,
              createdAt: savedProfile.createdAt,
              onboardingCompleted: savedProfile.onboardingCompleted,
            };
          });
        }
      } catch (error) {
        console.error('Data loading error:', error);
      } finally {
        isLoadingRef.current = false;
        if (userIdRef.current === userId) {
          loadedUserIdRef.current = userId;
          setIsDataLoaded(true);
        }
      }
    };

    void loadData();
  }, [userProfile, isDataLoaded, onGoalDataLoaded, onTodosLoaded, onTodoListsLoaded]);

  const TRIAL_DAYS = 3;
  const isTrialExpired = (() => {
    if (!userProfile) return false;
    const plan = userProfile.billingPlan;
    if (plan === 'essential' || plan === 'visionary' || plan === 'master') return false;
    if (userProfile.billingIsActive) return false;
    const created = userProfile.createdAt;
    if (!created) return false;
    return Date.now() > created + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  })();

  return {
    userProfile,
    setUserProfile,
    isInitializing,
    isDataLoaded,
    syncStatus,
    userId: userIdRef.current,
    isTrialExpired,
    isNewUser,
    setIsNewUser,
  };
}
