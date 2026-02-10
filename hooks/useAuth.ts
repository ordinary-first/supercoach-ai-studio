import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GoalNode, GoalLink, ToDoItem } from '../types';
import {
  onAuthUpdate,
  getUserId,
  loadGoalData,
  loadTodos,
  loadProfile,
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

  // 1. Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthUpdate((profile) => {
      setUserProfile(profile);
      setIsInitializing(false);
      if (profile) {
        localStorage.setItem('user_profile', JSON.stringify(profile));
        const uid = getUserId();
        if (uid && uid !== userIdRef.current) {
          userIdRef.current = uid;
        }
      } else {
        userIdRef.current = null;
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Load user data from Firestore/localStorage when profile is available
  useEffect(() => {
    if (!userProfile) {
      setIsDataLoaded(false);
      return;
    }

    const userId = userIdRef.current || getUserId();
    if (!userId) {
      setIsDataLoaded(true);
      return;
    }
    userIdRef.current = userId;

    // Skip if already loaded for this user
    if (isDataLoaded) return;

    const loadData = async () => {
      // Update sync status + test Firestore connection
      setSyncStatus(getSyncStatus());
      testFirestoreConnection(userId).then(() => {
        setSyncStatus(getSyncStatus());
      });

      try {
        const [goalData, todoData, savedProfile] = await Promise.all([
          loadGoalData(userId),
          loadTodos(userId),
          loadProfile(userId),
        ]);

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
            };
          });
        }
      } catch (e) {
        console.error('Data loading error:', e);
      } finally {
        setIsDataLoaded(true);
      }
    };

    loadData();
  }, [userProfile, isDataLoaded, onGoalDataLoaded, onTodosLoaded]);

  return {
    userProfile,
    setUserProfile,
    isInitializing,
    isDataLoaded,
    syncStatus,
    userId: userIdRef.current,
  };
}
