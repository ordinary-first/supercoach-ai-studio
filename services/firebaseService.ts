import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import type { ChatMessage, GoalLink, GoalNode, ToDoItem, UserProfile } from '../types';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
const log = isDev ? console.log : () => {};

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface SavedVisualization {
  id: string;
  timestamp: number;
  inputText: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  videoStatus?: 'pending' | 'ready' | 'failed';
  videoId?: string;
  updatedAt?: number;
}

export type VisualizationWriteInput = Omit<SavedVisualization, 'id' | 'timestamp' | 'updatedAt'>;

export interface UserSettings {
  language: 'en' | 'ko';
  updatedAt: number;
}

export const loginWithGoogle = async (): Promise<{ user: User; isNewUser: boolean } | null> => {
  try {
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    }
    const result = await signInWithPopup(auth, googleProvider);
    if (!result?.user) return null;
    const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
    if (isNewUser && db) {
      // 신규 유저: onboardingCompleted: false + createdAt 초기화
      await setDoc(
        doc(db, 'users', result.user.uid, 'profile', 'main'),
        { onboardingCompleted: false, createdAt: Date.now() },
        { merge: true },
      );
    }
    return { user: result.user, isNewUser };
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/unauthorized-domain') {
      error.message = 'Firebase 승인 도메인을 확인해주세요.';
    } else if (code === 'auth/popup-blocked') {
      error.message = '브라우저 팝업 차단을 해제한 뒤 다시 시도해주세요.';
    } else if (code === 'auth/popup-closed-by-user') {
      error.message = '로그인 창이 닫혔습니다. 다시 시도해주세요.';
    }
    console.error('[Auth] Google Login Error:', code, error);
    throw error;
  }
};

export const completeOnboarding = async (userId: string): Promise<void> => {
  if (!db || !userId) return;
  await setDoc(
    doc(db, 'users', userId, 'profile', 'main'),
    { onboardingCompleted: true },
    { merge: true },
  );
};

export const logout = async () => {
  await signOut(auth);
};

export const onAuthUpdate = (callback: (user: UserProfile | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null);
      return;
    }
    callback({
      name: user.displayName || 'User',
      email: user.email || undefined,
      googleId: user.uid,
      avatarUrl: user.photoURL || undefined,
      gender: 'Other',
      age: '',
      location: '',
      bio: '',
      gallery: [],
    });
  });
};

export const getUserId = (): string | null => {
  return auth.currentUser?.uid ?? null;
};

export const testFirestoreConnection = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const testRef = doc(db, 'users', userId, 'meta', 'connectionTest');
    await setDoc(testRef, { lastTest: Date.now(), ok: true });
    const snap = await getDoc(testRef);
    return snap.exists();
  } catch (error: any) {
    console.error('[Firestore] connection failed:', error?.code || error?.message || error);
    return false;
  }
};

const serializeGoalNodes = (nodes: GoalNode[]) => {
  return nodes.map((n) => ({
    id: n.id,
    text: n.text,
    type: n.type,
    status: n.status,
    progress: n.progress,
    parentId: n.parentId || null,
    imageUrl: n.imageUrl || null,
    collapsed: n.collapsed || false,
  }));
};

const serializeGoalLinks = (links: GoalLink[]) => {
  return links.map((l) => ({
    source: typeof l.source === 'object' ? (l.source as any).id : l.source,
    target: typeof l.target === 'object' ? (l.target as any).id : l.target,
  }));
};

export const saveGoalData = async (
  userId: string,
  nodes: GoalNode[],
  links: GoalLink[],
): Promise<void> => {
  if (!userId) return;
  const payload = {
    nodes: serializeGoalNodes(nodes),
    links: serializeGoalLinks(links),
    updatedAt: Date.now(),
  };
  const docRef = doc(db, 'users', userId, 'data', 'goals');
  await setDoc(docRef, payload);
};

export const loadGoalData = async (
  userId: string,
): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'data', 'goals');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      links: Array.isArray(data.links) ? data.links : [],
    };
  } catch (error: any) {
    console.error('[Load:Goals] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

export const saveTodos = async (userId: string, todos: ToDoItem[]): Promise<void> => {
  if (!userId) return;
  const payload = { items: todos, updatedAt: Date.now() };
  const docRef = doc(db, 'users', userId, 'data', 'todos');
  await setDoc(docRef, payload);
};

export const loadTodos = async (userId: string): Promise<ToDoItem[] | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return Array.isArray(data.items) ? data.items : null;
  } catch (error: any) {
    console.error('[Load:Todos] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

const MAX_CHAT_MESSAGES = 200;

export const saveChatHistory = async (
  userId: string,
  messages: ChatMessage[],
): Promise<void> => {
  if (!userId) return;
  const trimmed = messages.slice(-MAX_CHAT_MESSAGES);
  const docRef = doc(db, 'users', userId, 'data', 'chatHistory');
  await setDoc(docRef, { messages: trimmed, updatedAt: Date.now() });
};

export const loadChatHistory = async (
  userId: string,
): Promise<ChatMessage[]> => {
  if (!userId) return [];
  try {
    const docRef = doc(db, 'users', userId, 'data', 'chatHistory');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return [];
    const data = snap.data() as any;
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (error: any) {
    console.error('[Load:Chat] Firestore read failed:', error?.code || error?.message);
    return [];
  }
};

export const saveProfile = async (userId: string, profile: UserProfile): Promise<void> => {
  if (!userId) return;
  const docRef = doc(db, 'users', userId, 'profile', 'main');
  const existing = await getDoc(docRef);
  const profileData = {
    ...profile,
    gallery: Array.isArray(profile.gallery) ? profile.gallery : [],
    updatedAt: Date.now(),
    createdAt: existing.data()?.createdAt || profile.createdAt || Date.now(),
  };
  await setDoc(docRef, profileData);
};

export const ensureCreatedAt = async (userId: string): Promise<void> => {
  if (!db || !userId) return;
  const docRef = doc(db, 'users', userId, 'profile', 'main');
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await setDoc(docRef, { createdAt: Date.now() }, { merge: true });
  } else if (!snap.data()?.createdAt) {
    await setDoc(docRef, { createdAt: Date.now() }, { merge: true });
  }
};

export const loadProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'profile', 'main');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      name: data.name || 'User',
      email: data.email || undefined,
      googleId: data.googleId || userId,
      avatarUrl: data.avatarUrl || undefined,
      gender: data.gender || 'Other',
      age: data.age || '',
      location: data.location || '',
      bio: data.bio || '',
      gallery: Array.isArray(data.gallery) ? data.gallery : [],
      billingPlan: data.billingPlan || null,
      billingIsActive: data.billingIsActive ?? false,
      createdAt: data.createdAt || undefined,
      onboardingCompleted: data.onboardingCompleted ?? true,
    };
  } catch (error: any) {
    console.error('[Load:Profile] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

export const saveUserSettings = async (
  userId: string,
  settings: { language: 'en' | 'ko' },
): Promise<void> => {
  if (!userId) return;
  const docRef = doc(db, 'users', userId, 'settings', 'main');
  await setDoc(docRef, {
    language: settings.language,
    updatedAt: Date.now(),
  });
};

export const loadUserSettings = async (userId: string): Promise<UserSettings | null> => {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'main');
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    if (data.language !== 'ko' && data.language !== 'en') return null;
    return {
      language: data.language,
      updatedAt: Number(data.updatedAt || 0),
    };
  } catch (error: any) {
    console.error('[Load:Settings] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

export const loadVisualizations = async (userId: string): Promise<SavedVisualization[]> => {
  if (!userId) return [];
  try {
    const baseRef = collection(db, 'users', userId, 'visualizations');
    const q = query(baseRef, orderBy('timestamp', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        timestamp: Number(data.timestamp || 0),
        inputText: String(data.inputText || ''),
        text: data.text || undefined,
        imageUrl: data.imageUrl || undefined,
        audioUrl: data.audioUrl || undefined,
        videoUrl: data.videoUrl || undefined,
        videoStatus: data.videoStatus || undefined,
        videoId: data.videoId || undefined,
        updatedAt: Number(data.updatedAt || 0),
      };
    });
  } catch (error: any) {
    console.error('[Load:Visualizations] Firestore read failed:', error?.code || error?.message);
    return [];
  }
};

const sanitizeFirestorePayload = <T extends Record<string, any>>(payload: T): Partial<T> => {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    (acc as any)[key] = value;
    return acc;
  }, {} as Partial<T>);
};

const sanitizeFirestoreString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  let normalized = value;
  try {
    normalized = new TextDecoder().decode(new TextEncoder().encode(value));
  } catch {
    normalized = value;
  }
  const cleaned = normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .trim();
  return cleaned || undefined;
};

const sanitizeStorageUrl = (value: unknown): string | undefined => {
  const clean = sanitizeFirestoreString(value);
  if (!clean) return undefined;
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return undefined;
  return clean.slice(0, 4000);
};

const sanitizeVideoId = (value: unknown): string | undefined => {
  const clean = sanitizeFirestoreString(value);
  if (!clean) return undefined;
  return clean.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
};

const normalizeVisualizationInput = (item: VisualizationWriteInput): VisualizationWriteInput => {
  const normalized: VisualizationWriteInput = {
    inputText: (sanitizeFirestoreString(item.inputText) || 'Visualization').slice(0, 50000),
  };

  const text = sanitizeFirestoreString(item.text)?.slice(0, 50000);
  const imageUrl = sanitizeStorageUrl(item.imageUrl);
  const audioUrl = sanitizeStorageUrl(item.audioUrl);
  const videoUrl = sanitizeStorageUrl(item.videoUrl);
  const videoId = sanitizeVideoId(item.videoId);
  const videoStatus = sanitizeFirestoreString(item.videoStatus);

  if (text) normalized.text = text;
  if (imageUrl) normalized.imageUrl = imageUrl;
  if (audioUrl) normalized.audioUrl = audioUrl;
  if (videoUrl) normalized.videoUrl = videoUrl;
  if (videoId) normalized.videoId = videoId;
  if (videoStatus === 'pending' || videoStatus === 'ready' || videoStatus === 'failed') {
    normalized.videoStatus = videoStatus;
  }

  return normalized;
};

export const saveVisualization = async (
  userId: string,
  item: VisualizationWriteInput,
): Promise<SavedVisualization> => {
  if (!userId) throw new Error('userId required');

  const normalizedItem = normalizeVisualizationInput(item);
  const now = Date.now();
  const id = `${now}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = sanitizeFirestorePayload({
    ...normalizedItem,
    timestamp: now,
    updatedAt: now,
  });
  const docRef = doc(db, 'users', userId, 'visualizations', id);
  await setDoc(docRef, payload);

  return {
    id,
    timestamp: now,
    updatedAt: now,
    ...normalizedItem,
  };
};

const parseApiJson = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const createApiError = (
  code: string,
  message: string,
  requestId?: string,
): Error & { code: string; requestId?: string } => {
  const error = new Error(message) as Error & { code: string; requestId?: string };
  error.code = code;
  error.requestId = requestId;
  return error;
};

export const saveVisualizationViaApi = async (
  item: VisualizationWriteInput,
  visualizationId?: string,
): Promise<SavedVisualization> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw createApiError('AUTH_REQUIRED', '로그인이 필요합니다.');
  }

  const token = await currentUser.getIdToken();
  const normalizedItem = normalizeVisualizationInput(item);
  const payload = sanitizeFirestorePayload(normalizedItem);
  const response = await fetch('/api/save-visualization', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ visualizationId, payload }),
  });

  const body = await parseApiJson(response);
  if (!response.ok) {
    const code = String(body.errorCode || `SAVE_API_${response.status}`);
    const message = String(body.errorMessage || '시각화 저장 API 호출에 실패했습니다.');
    const requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
    throw createApiError(code, message, requestId);
  }

  const savedId =
    typeof body.id === 'string' && body.id.trim()
      ? body.id
      : visualizationId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const savedAt = Number(body.savedAt || Date.now());

  return {
    id: savedId,
    timestamp: savedAt,
    updatedAt: savedAt,
    ...normalizedItem,
  };
};

export const updateVisualization = async (
  userId: string,
  visualizationId: string,
  updates: Partial<Omit<SavedVisualization, 'id' | 'timestamp'>>,
): Promise<void> => {
  if (!userId || !visualizationId) return;
  const payload = sanitizeFirestorePayload({
    ...updates,
    updatedAt: Date.now(),
  });
  const docRef = doc(db, 'users', userId, 'visualizations', visualizationId);
  await setDoc(docRef, payload, { merge: true });
};

export const deleteVisualization = async (userId: string, visualizationId: string): Promise<void> => {
  if (!userId || !visualizationId) return;
  const docRef = doc(db, 'users', userId, 'visualizations', visualizationId);
  await deleteDoc(docRef);
};

export type SyncStatus = 'cloud' | 'offline';

export const getSyncStatus = (): SyncStatus => {
  return auth.currentUser ? 'cloud' : 'offline';
};

export const recoverGenerationResult = async (
  userId: string,
  generationId: string,
  type: 'image' | 'audio',
): Promise<Record<string, unknown> | null> => {
  if (!db) return null;
  try {
    const docId = type === 'audio' ? `${generationId}_audio` : generationId;
    const docRef = doc(db, 'users', userId, 'generationResults', docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    // 복구 후 임시 데이터 삭제
    try { await deleteDoc(docRef); } catch { /* ignore */ }
    return data;
  } catch {
    return null;
  }
};

/* ── 월간 사용량 조회 ── */

export interface MonthlyUsage {
  chatMessages: number;
  narrativeCalls: number;
  imageCredits: number;
  audioMinutes: number;
  videoGenerations: number;
}

export const loadUsage = async (
  userId: string,
): Promise<MonthlyUsage> => {
  const defaults: MonthlyUsage = {
    chatMessages: 0,
    narrativeCalls: 0,
    imageCredits: 0,
    audioMinutes: 0,
    videoGenerations: 0,
  };
  if (!db || !userId) return defaults;
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const snap = await getDoc(
      doc(db, 'users', userId, 'usage', monthKey),
    );
    const d = snap.data() || {};
    return {
      chatMessages: d.chatMessages ?? 0,
      narrativeCalls: d.narrativeCalls ?? 0,
      imageCredits: d.imageCredits ?? 0,
      audioMinutes: d.audioMinutes ?? 0,
      videoGenerations: d.videoGenerations ?? 0,
    };
  } catch {
    return defaults;
  }
};
