
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { GoalNode, GoalLink, UserProfile, ToDoItem } from '../types';

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const readEnv = (key: string): string | undefined => {
  const metaEnv = (import.meta as any)?.env ?? {};
  return (
    (process.env as any)?.[key] ??
    metaEnv[key] ??
    metaEnv[`VITE_${key}`] ??
    undefined
  );
};

const firebaseConfig: FirebaseConfig = {
  apiKey: readEnv('FIREBASE_API_KEY'),
  authDomain: readEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('FIREBASE_APP_ID'),
  measurementId: readEnv('FIREBASE_MEASUREMENT_ID')
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([key, value]) => (key !== 'measurementId') && !value)
  .map(([key]) => key);

export const firebaseConfigStatus = {
  ready: missingFirebaseKeys.length === 0,
  missing: missingFirebaseKeys,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
};

if (!firebaseConfigStatus.ready) {
  console.error('Firebase config missing:', firebaseConfigStatus.missing);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
// 인증 시 항상 계정 선택 창이 뜨도록 설정
googleProvider.setCustomParameters({ prompt: 'select_account' });

const GUEST_KEY = 'super_coach_guest_user';
const SYNC_ERROR_EVENT = 'supercoach-sync-error';

type SyncErrorDetail = {
  action: string;
  code?: string;
  message?: string;
  time: number;
};

const recordSyncError = (action: string, error: any) => {
  const detail: SyncErrorDetail = {
    action,
    code: error?.code,
    message: error?.message ?? String(error),
    time: Date.now()
  };
  try {
    localStorage.setItem('supercoach_sync_last_error', JSON.stringify(detail));
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent(SYNC_ERROR_EVENT, { detail }));
  } catch (e) {}
  console.warn(`[sync:${action}]`, detail);
};

export const onSyncError = (cb: (detail: SyncErrorDetail) => void) => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as SyncErrorDetail;
    cb(detail);
  };
  window.addEventListener(SYNC_ERROR_EVENT, handler as EventListener);
  return () => window.removeEventListener(SYNC_ERROR_EVENT, handler as EventListener);
};

/**
 * 팝업 방식으로 구글 로그인 진행
 */
export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result?.user) {
      localStorage.removeItem(GUEST_KEY);
      return result.user;
    }
    return null;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error;
  }
};

export const loginAsGuest = () => {
  // Reuse existing guest session if available
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.uid) {
        window.dispatchEvent(new Event('guest-login-change'));
        return parsed;
      }
    }
  } catch (e) {}

  const guestUser = {
    uid: 'guest_' + Math.random().toString(36).substr(2, 9),
    name: '익명 사용자',
    email: 'guest@supercoach.ai',
    isGuest: true,
    gender: 'Other' as const,
    age: '25',
    location: 'Unknown',
    bio: '',
    gallery: [],
    avatarUrl: ''
  };
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guestUser));
    window.dispatchEvent(new Event('guest-login-change'));
  } catch (e) {
    console.warn("LocalStorage blocked. Guest session will not persist.");
  }
  return guestUser;
};

export const logout = async () => {
  localStorage.removeItem(GUEST_KEY);
  await signOut(auth);
  window.location.reload(); // 상태 초기화를 위해 새로고침
};

export const onAuthUpdate = (callback: (user: any) => void) => {
  // Firebase 인증 상태 변경 감지
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        name: user.displayName || 'User',
        email: user.email,
        googleId: user.uid,
        avatarUrl: user.photoURL,
        gender: 'Male', age: '30', location: 'Seoul', bio: '', gallery: []
      });
    } else {
      // 구글 로그인이 없으면 로컬 게스트 확인
      try {
        const guest = localStorage.getItem(GUEST_KEY);
        callback(guest ? JSON.parse(guest) : null);
      } catch (e) {
        callback(null);
      }
    }
  });

  const handleGuestChange = () => {
    try {
      const guest = localStorage.getItem(GUEST_KEY);
      callback(guest ? JSON.parse(guest) : null);
    } catch (e) {
      callback(null);
    }
  };
  window.addEventListener('guest-login-change', handleGuestChange);

  return () => {
    unsub();
    window.removeEventListener('guest-login-change', handleGuestChange);
  };
};

export const getUserId = (): string | null => {
  const user = auth.currentUser;
  if (user) return user.uid;
  try {
    const guest = localStorage.getItem(GUEST_KEY);
    if (guest) {
      const parsed = JSON.parse(guest);
      return parsed.uid || null;
    }
  } catch (e) {}
  return null;
};

export const isGuestUserId = (userId: string | null | undefined): boolean => {
  return !userId || userId.startsWith('guest_');
};

export const isGuestUser = (): boolean => {
  const userId = getUserId();
  return isGuestUserId(userId);
};

export const saveGoalData = async (userId: string, nodes: GoalNode[], links: GoalLink[]): Promise<void> => {
  const serialized = {
    nodes: nodes.map(n => ({ id: n.id, text: n.text, type: n.type, status: n.status, progress: n.progress, parentId: n.parentId, imageUrl: n.imageUrl, collapsed: n.collapsed })),
    links: links.map(l => ({ source: typeof l.source === 'object' ? (l.source as any).id : l.source, target: typeof l.target === 'object' ? (l.target as any).id : l.target })),
  };

  // Always backup to localStorage
  try {
    localStorage.setItem(`supercoach_goals_${userId}`, JSON.stringify(serialized));
  } catch (e) { console.warn('localStorage save failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const serializedNodes = nodes.map(n => ({ id: n.id, text: n.text, type: n.type, status: n.status, progress: n.progress, parentId: n.parentId || null, imageUrl: n.imageUrl || null, collapsed: n.collapsed || false }));
      const serializedLinks = links.map(l => ({ source: typeof l.source === 'object' ? (l.source as any).id : l.source, target: typeof l.target === 'object' ? (l.target as any).id : l.target }));
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      await setDoc(docRef, { nodes: serializedNodes, links: serializedLinks, updatedAt: Date.now() });
    } catch (e) { recordSyncError('save-goals', e); }
  }
};

export const loadGoalData = async (userId: string): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  // Try Firestore first for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as { nodes: GoalNode[]; links: GoalLink[] };
        return data;
      }
    } catch (e) { recordSyncError('load-goals', e); }
  }
  // Fallback to localStorage (for both guest and Firestore failures)
  try {
    const data = localStorage.getItem(`supercoach_goals_${userId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};

export const saveTodos = async (userId: string, todos: ToDoItem[]): Promise<void> => {
  // Always backup to localStorage
  try {
    localStorage.setItem(`supercoach_todos_${userId}`, JSON.stringify(todos));
  } catch (e) { console.warn('localStorage save failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'todos');
      await setDoc(docRef, { items: todos, updatedAt: Date.now() });
    } catch (e) { recordSyncError('save-todos', e); }
  }
};

export const loadTodos = async (userId: string): Promise<ToDoItem[] | null> => {
  // Try Firestore first for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'todos');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return (snap.data() as any).items as ToDoItem[];
      }
    } catch (e) { recordSyncError('load-todos', e); }
  }
  // Fallback to localStorage (for both guest and Firestore failures)
  try {
    const data = localStorage.getItem(`supercoach_todos_${userId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};

export const saveProfile = async (userId: string, profile: UserProfile): Promise<void> => {
  // Always backup to localStorage
  try {
    localStorage.setItem(`supercoach_profile_${userId}`, JSON.stringify(profile));
  } catch (e) { console.warn('localStorage save failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const profileData = { ...profile };
      delete (profileData as any).gallery; // Gallery images are too large for Firestore, keep in localStorage
      const docRef = doc(db, 'users', userId, 'profile', 'main');
      await setDoc(docRef, { ...profileData, updatedAt: Date.now() });
    } catch (e) { recordSyncError('save-profile', e); }
  }

  // Save gallery separately in localStorage (base64 images are too large for Firestore)
  try {
    localStorage.setItem(`supercoach_gallery_${userId}`, JSON.stringify(profile.gallery || []));
  } catch (e) { console.warn('Gallery save failed:', e); }
};

export const loadProfile = async (userId: string): Promise<UserProfile | null> => {
  // Try Firestore first for non-guest users
  if (!isGuestUserId(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'profile', 'main');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        // Restore gallery from localStorage
        try {
          const gallery = localStorage.getItem(`supercoach_gallery_${userId}`);
          if (gallery) profile.gallery = JSON.parse(gallery);
        } catch (e) {}
        return profile;
      }
    } catch (e) { recordSyncError('load-profile', e); }
  }
  // Fallback to localStorage (for both guest and Firestore failures)
  try {
    const data = localStorage.getItem(`supercoach_profile_${userId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};
