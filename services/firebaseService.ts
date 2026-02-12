
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
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { GoalNode, GoalLink, UserProfile, ToDoItem } from '../types';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
const log = isDev ? console.log : () => {};

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
export const db = getFirestore(app);
export const storage = getStorage(app);

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
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/unauthorized-domain') {
      console.error('[Auth] Unauthorized domain');
      error.message = '이 도메인이 Firebase 승인 도메인에 등록되지 않았습니다. Firebase Console → Authentication → Settings → Authorized domains에서 확인하세요.';
    } else if (code === 'auth/popup-blocked') {
      error.message = '팝업이 차단되었습니다. 브라우저 팝업 설정을 확인해주세요.';
    } else if (code === 'auth/popup-closed-by-user') {
      error.message = '로그인 창이 닫혔습니다. 다시 시도해주세요.';
    }
    console.error("[Auth] Google Login Error:", code, error);
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
    uid: 'guest_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
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
  window.dispatchEvent(new Event('guest-login-change'));
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
    log('[Firestore] Guest user — skipping connection test');
    return false;
  }
  try {
    const testRef = doc(db, 'users', userId, 'meta', 'connectionTest');
    await setDoc(testRef, { lastTest: Date.now(), ok: true });
    const snap = await getDoc(testRef);
    if (snap.exists()) {
      log('[Firestore] ✅ Connection OK — read/write working');
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

/** base64 data URL → Firebase Storage 업로드 → 다운로드 URL 반환 */
export const uploadNodeImage = async (
  userId: string, nodeId: string, dataUrl: string
): Promise<string> => {
  const base64 = dataUrl.split(',')[1];
  const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const storageRef = ref(storage, `users/${userId}/goal-images/${nodeId}.jpg`);
  await uploadBytes(storageRef, buffer, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
};

/** Firebase Storage에서 노드 이미지 삭제 */
export const deleteNodeImage = async (
  userId: string, nodeId: string
): Promise<void> => {
  const storageRef = ref(storage, `users/${userId}/goal-images/${nodeId}.jpg`);
  await deleteObject(storageRef).catch(() => {});
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
      log('[Save:Goals] ✅ Firestore saved', { nodeCount: nodes.length, linkCount: links.length });
    } catch (e: any) {
      console.error('[Save:Goals] ❌ Firestore FAILED:', e?.code || e?.message);
    }
  }
};

/** 구형 인라인 base64 이미지 제거 (Firebase Storage URL만 보존) */
const sanitizeGoalData = (data: { nodes: any[]; links: any[]; updatedAt?: number }) => {
  let stripped = 0;
  data.nodes = data.nodes.map((n: any) => {
    if (n.imageUrl && n.imageUrl.startsWith('data:') && n.imageUrl.length > 100_000) {
      stripped++;
      return { ...n, imageUrl: null };
    }
    return n;
  });
  if (stripped > 0) {
    log(`[Load:Goals] Stripped ${stripped} legacy base64 image(s)`);
  }
  return data;
};

export const loadGoalData = async (userId: string): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  let firestoreData: any = null;
  let localData: any = null;

  log('[Load:Goals] Starting load for userId:', userId, 'isGuest:', isGuestUser(userId), 'authUser:', auth.currentUser?.uid || 'null');

  // Try Firestore for non-guest users
  if (!isGuestUser(userId)) {
    try {
      const docRef = doc(db, 'users', userId, 'data', 'goals');
      log('[Load:Goals] Fetching from Firestore path:', `users/${userId}/data/goals`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        firestoreData = snap.data();
        log('[Load:Goals] ✅ Firestore data found, nodes:', firestoreData.nodes?.length, 'links:', firestoreData.links?.length, 'updatedAt:', firestoreData.updatedAt);
      } else {
        log('[Load:Goals] ⚠️ Firestore: no document exists yet');
      }
    } catch (e: any) {
      console.error('[Load:Goals] ❌ Firestore read FAILED:', e?.code || e?.message, e);
    }
  } else {
    log('[Load:Goals] ⏭️ Skipping Firestore (guest user)');
  }

  // Always try localStorage
  try {
    const raw = localStorage.getItem(`supercoach_goals_${userId}`);
    if (raw) {
      localData = JSON.parse(raw);
      log('[Load:Goals] localStorage data found, updatedAt:', localData.updatedAt);
    }
  } catch (e) {}

  // Use the one with newer timestamp (prefer fresh data)
  let result: any = null;
  if (firestoreData && localData) {
    const fsTime = firestoreData.updatedAt || 0;
    const lsTime = localData.updatedAt || 0;
    const winner = fsTime >= lsTime ? 'Firestore' : 'localStorage';
    log(`[Load:Goals] Both sources exist → using ${winner} (fs:${fsTime} vs ls:${lsTime})`);
    result = fsTime >= lsTime ? firestoreData : localData;
  } else if (firestoreData) {
    log('[Load:Goals] Using Firestore (only source)');
    result = firestoreData;
  } else if (localData) {
    log('[Load:Goals] Using localStorage (only source)');
    result = localData;
  }

  if (!result) {
    log('[Load:Goals] No data found in either source');
    return null;
  }

  const sanitized = sanitizeGoalData(result);

  // Force-sync: write sanitized winner back to BOTH stores immediately.
  // This eliminates discrepancies that cause image flip-flop on refresh.
  const syncPayload = { nodes: sanitized.nodes, links: sanitized.links, updatedAt: Date.now() };
  try {
    localStorage.setItem(`supercoach_goals_${userId}`, JSON.stringify(syncPayload));
  } catch (e) {}
  if (!isGuestUser(userId)) {
    const docRef = doc(db, 'users', userId, 'data', 'goals');
    setDoc(docRef, syncPayload).catch(() => {});
  }

  return sanitized;
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
      log('[Save:Todos] ✅ Firestore saved', { count: todos.length });
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
        log('[Load:Todos] Firestore data found, updatedAt:', firestoreData.updatedAt);
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
        log('[Load:Todos] localStorage data found (old format, migrated)');
      } else {
        localData = parsed;
        log('[Load:Todos] localStorage data found, updatedAt:', localData.updatedAt);
      }
    }
  } catch (e) {}

  // Use the one with newer timestamp
  if (firestoreData && localData) {
    const fsTime = firestoreData.updatedAt || 0;
    const lsTime = localData.updatedAt || 0;
    const winner = fsTime >= lsTime ? 'Firestore' : 'localStorage';
    log(`[Load:Todos] Both sources → using ${winner}`);
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
      log('[Save:Profile] ✅ Firestore saved');
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
        log('[Load:Profile] Firestore data found');
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
        log('[Load:Profile] localStorage data found');
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

export type SyncStatus = 'cloud' | 'local-only' | 'offline';

export const getSyncStatus = (): SyncStatus => {
  const user = auth.currentUser;
  if (user) return 'cloud'; // Google 로그인 — Firestore 동기화
  try {
    const guest = localStorage.getItem(GUEST_KEY);
    if (guest) return 'local-only'; // 게스트 모드 — localStorage만
  } catch (e) {}
  return 'offline';
};
