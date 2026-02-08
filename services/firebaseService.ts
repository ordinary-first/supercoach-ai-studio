
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

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Debug: Firebase config 확인
console.log('[Firebase] Config check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  projectId: firebaseConfig.projectId,
});

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

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

export const isGuestUser = (uid?: string): boolean => {
  const id = uid || getUserId();
  return !id || id.startsWith('guest_');
};

/**
 * Firestore 연결 테스트 — 앱 시작 시 호출하여 규칙/설정 문제 진단
 */
export const testFirestoreConnection = async (userId: string): Promise<boolean> => {
  if (isGuestUser(userId)) {
    console.log('[Firestore] Guest user — skipping connection test');
    return false;
  }
  try {
    const testRef = doc(db, 'users', userId, 'meta', 'connectionTest');
    await setDoc(testRef, { lastTest: Date.now(), ok: true });
    const snap = await getDoc(testRef);
    if (snap.exists()) {
      console.log('[Firestore] ✅ Connection OK — read/write working');
      return true;
    }
    console.error('[Firestore] ❌ Write succeeded but read returned empty');
    return false;
  } catch (e: any) {
    console.error('[Firestore] ❌ Connection FAILED:', e?.code || e?.message || e);
    if (e?.code === 'permission-denied') {
      console.error('[Firestore] 🔒 보안 규칙이 접근을 거부합니다. Firebase Console에서 Firestore 규칙을 설정하세요.');
    }
    return false;
  }
};

export const saveGoalData = async (userId: string, nodes: GoalNode[], links: GoalLink[]): Promise<void> => {
  const now = Date.now();
  const serializedNodes = nodes.map(n => ({ id: n.id, text: n.text, type: n.type, status: n.status, progress: n.progress, parentId: n.parentId || null, imageUrl: n.imageUrl || null, collapsed: n.collapsed || false }));
  const serializedLinks = links.map(l => ({ source: typeof l.source === 'object' ? (l.source as any).id : l.source, target: typeof l.target === 'object' ? (l.target as any).id : l.target }));
  const payload = { nodes: serializedNodes, links: serializedLinks, updatedAt: now };

  // Always save to localStorage
  try {
    localStorage.setItem(`supercoach_goals_${userId}`, JSON.stringify(payload));
  } catch (e) { console.error('[Save:Goals] localStorage failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      await setDoc(docRef, payload);
      console.log('[Save:Goals] ✅ Firestore saved', { nodeCount: nodes.length, linkCount: links.length });
    } catch (e: any) {
      console.error('[Save:Goals] ❌ Firestore FAILED:', e?.code || e?.message);
    }
  }
};

export const loadGoalData = async (userId: string): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  let firestoreData: any = null;
  let localData: any = null;

  // Try Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        firestoreData = snap.data();
        console.log('[Load:Goals] Firestore data found, updatedAt:', firestoreData.updatedAt);
      } else {
        console.log('[Load:Goals] Firestore: no document exists yet');
      }
    } catch (e: any) {
      console.error('[Load:Goals] ❌ Firestore read FAILED:', e?.code || e?.message);
    }
  }

  // Always try localStorage
  try {
    const raw = localStorage.getItem(`supercoach_goals_${userId}`);
    if (raw) {
      localData = JSON.parse(raw);
      console.log('[Load:Goals] localStorage data found, updatedAt:', localData.updatedAt);
    }
  } catch (e) {}

  // Use the one with newer timestamp (prefer fresh data)
  if (firestoreData && localData) {
    const fsTime = firestoreData.updatedAt || 0;
    const lsTime = localData.updatedAt || 0;
    const winner = fsTime >= lsTime ? 'Firestore' : 'localStorage';
    console.log(`[Load:Goals] Both sources exist → using ${winner} (fs:${fsTime} vs ls:${lsTime})`);
    return fsTime >= lsTime ? firestoreData : localData;
  }
  if (firestoreData) { console.log('[Load:Goals] Using Firestore (only source)'); return firestoreData; }
  if (localData) { console.log('[Load:Goals] Using localStorage (only source)'); return localData; }

  console.log('[Load:Goals] No data found in either source');
  return null;
};

export const saveTodos = async (userId: string, todos: ToDoItem[]): Promise<void> => {
  const now = Date.now();
  const payload = { items: todos, updatedAt: now };

  // Always save to localStorage
  try {
    localStorage.setItem(`supercoach_todos_${userId}`, JSON.stringify(payload));
  } catch (e) { console.error('[Save:Todos] localStorage failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'todos');
      await setDoc(docRef, payload);
      console.log('[Save:Todos] ✅ Firestore saved', { count: todos.length });
    } catch (e: any) {
      console.error('[Save:Todos] ❌ Firestore FAILED:', e?.code || e?.message);
    }
  }
};

export const loadTodos = async (userId: string): Promise<ToDoItem[] | null> => {
  let firestoreData: any = null;
  let localData: any = null;

  // Try Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'todos');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        firestoreData = snap.data();
        console.log('[Load:Todos] Firestore data found, updatedAt:', firestoreData.updatedAt);
      }
    } catch (e: any) {
      console.error('[Load:Todos] ❌ Firestore read FAILED:', e?.code || e?.message);
    }
  }

  // Always try localStorage (handle both old format: raw array, new format: { items, updatedAt })
  try {
    const raw = localStorage.getItem(`supercoach_todos_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Old format: raw array — migrate
        localData = { items: parsed, updatedAt: 0 };
        console.log('[Load:Todos] localStorage data found (old format, migrated)');
      } else {
        localData = parsed;
        console.log('[Load:Todos] localStorage data found, updatedAt:', localData.updatedAt);
      }
    }
  } catch (e) {}

  // Use the one with newer timestamp
  if (firestoreData && localData) {
    const fsTime = firestoreData.updatedAt || 0;
    const lsTime = localData.updatedAt || 0;
    const winner = fsTime >= lsTime ? 'Firestore' : 'localStorage';
    console.log(`[Load:Todos] Both sources → using ${winner}`);
    const items = fsTime >= lsTime ? firestoreData.items : localData.items;
    return items || null;
  }
  if (firestoreData) return firestoreData.items || null;
  if (localData) return localData.items || null;

  return null;
};

export const saveProfile = async (userId: string, profile: UserProfile): Promise<void> => {
  // Always save to localStorage
  try {
    localStorage.setItem(`supercoach_profile_${userId}`, JSON.stringify(profile));
  } catch (e) { console.error('[Save:Profile] localStorage failed:', e); }

  // Also save to Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const profileData = { ...profile };
      delete (profileData as any).gallery; // Gallery images too large for Firestore
      const docRef = doc(db, 'users', userId, 'profile', 'main');
      await setDoc(docRef, { ...profileData, updatedAt: Date.now() });
      console.log('[Save:Profile] ✅ Firestore saved');
    } catch (e: any) {
      console.error('[Save:Profile] ❌ Firestore FAILED:', e?.code || e?.message);
    }
  }

  // Gallery separately in localStorage
  try {
    localStorage.setItem(`supercoach_gallery_${userId}`, JSON.stringify(profile.gallery || []));
  } catch (e) {}
};

export const loadProfile = async (userId: string): Promise<UserProfile | null> => {
  let profile: UserProfile | null = null;

  // Try Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'profile', 'main');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        profile = snap.data() as UserProfile;
        console.log('[Load:Profile] Firestore data found');
      }
    } catch (e: any) {
      console.error('[Load:Profile] ❌ Firestore read FAILED:', e?.code || e?.message);
    }
  }

  // Fallback to localStorage
  if (!profile) {
    try {
      const data = localStorage.getItem(`supercoach_profile_${userId}`);
      if (data) {
        profile = JSON.parse(data);
        console.log('[Load:Profile] localStorage data found');
      }
    } catch (e) {}
  }

  // Restore gallery from localStorage (always, since Firestore doesn't store it)
  if (profile) {
    try {
      const gallery = localStorage.getItem(`supercoach_gallery_${userId}`);
      if (gallery) profile.gallery = JSON.parse(gallery);
    } catch (e) {}
  }

  return profile;
};
