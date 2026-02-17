import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GoalNode, GoalLink, ToDoItem } from '../types';
import {
  onAuthUpdate,
  getUserId,
  loadGoalData,
  loadTodos,
  loadProfile,
  ensureCreatedAt,
  testFirestoreConnection,
  getSyncStatus,
  SyncStatus,
} from '../services/firebaseService';

export interface AuthState {
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isInitializing: boolean;
  isDataLoaded: boolean;
  syncStatus: SyncStatus;
  userId: string | null;
  isTrialExpired: boolean;
}

export function useAuth(
  onGoalDataLoaded: (nodes: GoalNode[], links: GoalLink[]) => void,
  onTodosLoaded: (todos: ToDoItem[]) => void,
): AuthState {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const userIdRef = useRef<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  // 1. Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthUpdate((profile) => {
      setUserProfile(profile);
      setIsInitializing(false);

      // Use uid from the auth callback payload (googleId) to avoid timing races with auth.currentUser.
      const uid = profile ? (profile as UserProfile).googleId ?? getUserId() : null;
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

  // 2. Load user data from Firestore when profile is available
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
        const [goalData, todoData, savedProfile] = await Promise.all([
          loadGoalData(userId),
          loadTodos(userId),
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

        // Merge saved profile WITHOUT triggering re-render loop
        if (savedProfile) {
          setUserProfile(prev => {
            if (!prev) return savedProfile;
            return {
              ...prev,
              bio: savedProfile.bio,
              gallery: savedProfile.gallery,
              age: savedProfile.age,
              location: savedProfile.location,
              gender: savedProfile.gender,
              billingPlan: savedProfile.billingPlan,
              billingIsActive: savedProfile.billingIsActive,
              createdAt: savedProfile.createdAt,
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
  }, [userProfile, isDataLoaded, onGoalDataLoaded, onTodosLoaded]);

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
  };
}
