
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc } from "firebase/firestore";
import { GoalNode, GoalLink, UserProfile, ToDoItem } from '../types';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use persistent local cache so Firestore writes are cached in IndexedDB
// and survive page close, then auto-sync when app reopens
let db: ReturnType<typeof initializeFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (_) {
  // Already initialized (e.g. HMR) — reuse existing instance
  db = getFirestore(app);
}
export { db };

const googleProvider = new GoogleAuthProvider();
// 인증 시 항상 계정 선택 창이 뜨도록 설정
googleProvider.setCustomParameters({ prompt: 'select_account' });

const GUEST_KEY = 'super_coach_guest_user';

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

export const isGuestUser = (): boolean => {
  const userId = getUserId();
  return !userId || userId.startsWith('guest_');
};

/**
 * Firestore 읽기/쓰기 접근 테스트.
 * 로그인 후 한 번 호출하여 Firestore가 정상 동작하는지 확인.
 */
export const testFirestoreAccess = async (userId: string): Promise<boolean> => {
  if (!userId || userId.startsWith('guest_')) return true; // guest는 Firestore 안 씀
  try {
    const testRef = doc(db, 'users', userId, 'data', '_connection_test');
    await setDoc(testRef, { ok: true, ts: Date.now() });
    const snap = await getDoc(testRef);
    const success = snap.exists() && snap.data()?.ok === true;
    if (!success) console.error('[Firestore] 쓰기 테스트 실패: 데이터를 읽을 수 없음');
    return success;
  } catch (e) {
    console.error('[Firestore] 접근 테스트 실패:', e);
    return false;
  }
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
  if (userId && !userId.startsWith('guest_')) {
    const serializedNodes = nodes.map(n => ({ id: n.id, text: n.text, type: n.type, status: n.status, progress: n.progress, parentId: n.parentId || null, imageUrl: n.imageUrl || null, collapsed: n.collapsed || false }));
    const serializedLinks = links.map(l => ({ source: typeof l.source === 'object' ? (l.source as any).id : l.source, target: typeof l.target === 'object' ? (l.target as any).id : l.target }));
    const docRef = doc(db, 'users', userId, 'data', 'goals');
    await setDoc(docRef, { nodes: serializedNodes, links: serializedLinks, updatedAt: Date.now() });
  }
};

export const loadGoalData = async (userId: string): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  // Try Firestore first for non-guest users (use userId param directly to avoid auth.currentUser race condition)
  if (userId && !userId.startsWith('guest_')) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as { nodes: GoalNode[]; links: GoalLink[] };
        return data;
      }
    } catch (e) { console.warn('Firestore goal load failed, falling back to localStorage:', e); }
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
  if (userId && !userId.startsWith('guest_')) {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    await setDoc(docRef, { items: todos, updatedAt: Date.now() });
  }
};

export const loadTodos = async (userId: string): Promise<ToDoItem[] | null> => {
  // Try Firestore first for non-guest users (use userId param directly to avoid auth.currentUser race condition)
  if (userId && !userId.startsWith('guest_')) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'todos');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return (snap.data() as any).items as ToDoItem[];
      }
    } catch (e) { console.warn('Firestore todo load failed, falling back to localStorage:', e); }
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
  if (userId && !userId.startsWith('guest_')) {
    const profileData = { ...profile };
    delete (profileData as any).gallery; // Gallery images are too large for Firestore, keep in localStorage
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    await setDoc(docRef, { ...profileData, updatedAt: Date.now() });
  }

  // Save gallery separately in localStorage (base64 images are too large for Firestore)
  try {
    localStorage.setItem(`supercoach_gallery_${userId}`, JSON.stringify(profile.gallery || []));
  } catch (e) { console.warn('Gallery save failed:', e); }
};

export const loadProfile = async (userId: string): Promise<UserProfile | null> => {
  // Try Firestore first for non-guest users (use userId param directly to avoid auth.currentUser race condition)
  if (userId && !userId.startsWith('guest_')) {
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
    } catch (e) { console.warn('Firestore profile load failed, falling back to localStorage:', e); }
  }
  // Fallback to localStorage (for both guest and Firestore failures)
  try {
    const data = localStorage.getItem(`supercoach_profile_${userId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return null;
};
