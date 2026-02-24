import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GoalNode, GoalLink, ToDoItem, TodoList, TodoGroup } from '../types';
import {
  onAuthUpdate,
  getUserId,
  loadGoalData,
  loadTodos,
  loadTodoLists,
  loadProfile,
  ensureCreatedAt,
  testFirestoreConnection,
  getSyncStatus,
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
  const isDevMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev');

  // 0. Dev auto-login: ?dev=1 → mock user (dev only, UI testing)
  useEffect(() => {
    if (!isDevMode) return;
    const devId = 'dev_local_' + Date.now();
    userIdRef.current = devId;
    loadedUserIdRef.current = devId;
    setUserProfile({
      name: 'Dev User',
      email: 'dev@localhost',
      googleId: devId,
      gender: 'Other',
      age: '',
      location: '',
      bio: '',
      gallery: [],
    });
    setIsInitializing(false);
    setIsDataLoaded(true);
  }, []);

  // 1. Auth state listener (skip in dev mode)
  useEffect(() => {
    if (isDevMode) return;
    const unsubscribe = onAuthUpdate((authProfile) => {
      setUserProfile((prev) => {
        if (!authProfile) return null;
        if (!prev) return authProfile;
        // auth 필드만 업데이트, 나머지(빌링 등) 보존
        return {
          ...prev,
          name: authProfile.name || prev.name,
          email: authProfile.email || prev.email,
          googleId: authProfile.googleId || prev.googleId,
          avatarUrl: authProfile.avatarUrl || prev.avatarUrl,
        };
      });
      setIsInitializing(false);

      // Use uid from the auth callback payload (googleId) to avoid timing races with auth.currentUser.
      const uid = authProfile ? (authProfile as UserProfile).googleId ?? getUserId() : null;
      const prevUid = userIdRef.current;

      // Important: data is scoped by uid. If uid changes, force a reload.
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
  }, []);

  // 2. Load user data from Firestore when profile is available (skip in dev mode)
  useEffect(() => {
    if (isDevMode) return;
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

    // Skip if already loaded for this user
    if (loadedUserIdRef.current === userId && isDataLoaded) return;
    if (isLoadingRef.current) return;

    const loadData = async () => {
      isLoadingRef.current = true;
      setIsDataLoaded(false);

      // Update sync status + test Firestore connection
      setSyncStatus(getSyncStatus());
      testFirestoreConnection(userId).then(() => {
        setSyncStatus(getSyncStatus());
      });

      // 최초 로그인 시 createdAt 보장
      await ensureCreatedAt(userId);

      try {
        const [goalData, todoData, todoListsData, savedProfile] = await Promise.all([
          loadGoalData(userId),
          loadTodos(userId),
          loadTodoLists(userId),
          loadProfile(userId),
        ]);

        // If user switched accounts while loading, ignore this result.
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

        // 온보딩 완료 여부 판단 (source of truth: Firestore onboardingCompleted 필드)
        if (savedProfile) {
          const needsOnboarding = savedProfile.onboardingCompleted === false;
          setIsNewUser(needsOnboarding);

          let billingPlan = savedProfile.billingPlan;
          let billingIsActive = savedProfile.billingIsActive;
          let billingSubscriptionId = savedProfile.billingSubscriptionId;
          let billingCancelAtPeriodEnd = savedProfile.billingCancelAtPeriodEnd;

          // 항상 Polar에서 최신 구독 상태 동기화 (Firestore 캐시 문제 방지)
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

          setUserProfile(prev => {
            if (!prev) return savedProfile;
            return {
              ...prev,
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
      } catch (e) {
        console.error('Data loading error:', e);
      } finally {
        isLoadingRef.current = false;
        if (userIdRef.current === userId) {
          loadedUserIdRef.current = userId;
          setIsDataLoaded(true);
        }
      }
    };

    loadData();
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
