import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type {
  ChatMessage,
  FeedbackCard,
  GoalLink,
  GoalNode,
  NotificationSettings,
  ToDoItem,
  TodoGroup,
  TodoList,
  UserPrinciple,
  UserProfile,
} from '../shared/types';

const log = __DEV__ ? console.log : () => {};

const db = firestore();

/** Shorthand for `db.collection('users').doc(uid).collection(sub).doc(docId)` */
const userDoc = (uid: string, sub: string, docId: string) =>
  db.collection('users').doc(uid).collection(sub).doc(docId);

/** Shorthand for `db.collection('users').doc(uid).collection(sub)` */
const userCollection = (uid: string, sub: string) =>
  db.collection('users').doc(uid).collection(sub);

// ── Types ──

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

export interface MonthlyUsage {
  chatMessages: number;
  narrativeCalls: number;
  imageCredits: number;
  audioMinutes: number;
  videoGenerations: number;
}

export type SyncStatus = 'cloud' | 'offline';

// ── Auth ──

export const loginWithGoogle = async (): Promise<{
  user: FirebaseAuthTypes.User;
  isNewUser: boolean;
} | null> => {
  try {
    const currentUser = auth().currentUser;
    if (currentUser) {
      try {
        await auth().signOut();
      } catch {
        // ignore
      }
    }

    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;
    if (!idToken) {
      console.warn('[Auth] Google Sign-In did not return an idToken');
      return null;
    }

    const credential = auth.GoogleAuthProvider.credential(idToken);
    const result = await auth().signInWithCredential(credential);
    if (!result?.user) return null;

    const isNewUser = result.additionalUserInfo?.isNewUser ?? false;
    if (isNewUser) {
      await userDoc(result.user.uid, 'profile', 'main').set(
        { onboardingCompleted: false, createdAt: Date.now() },
        { merge: true },
      );
    }

    return { user: result.user, isNewUser };
  } catch (error: any) {
    console.warn('[Auth] Google Login Error:', error?.code || '', error?.message || error);
    throw error;
  }
};

export const loginAnonymously = async (): Promise<FirebaseAuthTypes.User | null> => {
  try {
    const result = await auth().signInAnonymously();
    log('[Auth] Anonymous login:', result.user.uid);
    return result.user;
  } catch (error) {
    console.warn('[Auth] Anonymous login failed:', error);
    return null;
  }
};

export const completeOnboarding = async (userId: string): Promise<void> => {
  if (!userId) return;
  await userDoc(userId, 'profile', 'main').set(
    { onboardingCompleted: true },
    { merge: true },
  );
};

export const logout = async () => {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google sign-out may fail if user signed in anonymously
  }
  await auth().signOut();
};

export const onAuthUpdate = (callback: (user: UserProfile | null) => void) => {
  return auth().onAuthStateChanged((user) => {
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
  return auth().currentUser?.uid ?? null;
};

// ── Firestore Connection Test ──

export const testFirestoreConnection = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const testRef = userDoc(userId, 'meta', 'connectionTest');
    await testRef.set({ lastTest: Date.now(), ok: true });
    const snap = await testRef.get();
    return snap.exists;
  } catch (error: any) {
    console.warn('[Firestore] connection failed:', error?.code || error?.message || error);
    return false;
  }
};

// ── Serialization Helpers ──

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
    sortOrder: n.sortOrder ?? 0,
  }));
};

const serializeGoalLinks = (links: GoalLink[]) => {
  return links.map((l) => ({
    source: typeof l.source === 'object' ? (l.source as any).id : l.source,
    target: typeof l.target === 'object' ? (l.target as any).id : l.target,
  }));
};

// ── Goal Data ──

export const saveGoalData = async (
  userId: string,
  nodes: GoalNode[],
  links: GoalLink[],
): Promise<void> => {
  if (!userId) return;
  const payload = JSON.parse(
    JSON.stringify({
      nodes: serializeGoalNodes(nodes),
      links: serializeGoalLinks(links),
      updatedAt: Date.now(),
    }),
  );
  await userDoc(userId, 'data', 'goals').set(payload);
};

export const loadGoalData = async (
  userId: string,
): Promise<{ nodes: GoalNode[]; links: GoalLink[] } | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'data', 'goals').get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      links: Array.isArray(data.links) ? data.links : [],
    };
  } catch (error: any) {
    console.warn('[Load:Goals] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

// ── Todos ──

export const saveTodos = async (userId: string, todos: ToDoItem[]): Promise<void> => {
  if (!userId) return;
  const cleanItems = JSON.parse(JSON.stringify(todos));
  const payload = { items: cleanItems, updatedAt: Date.now() };
  await userDoc(userId, 'data', 'todos').set(payload);
};

export const loadTodos = async (userId: string): Promise<ToDoItem[] | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'data', 'todos').get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return Array.isArray(data.items) ? data.items : null;
  } catch (error: any) {
    console.warn('[Load:Todos] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

// ── Todo Lists ──

export const saveTodoLists = async (
  userId: string,
  lists: TodoList[],
  groups: TodoGroup[],
): Promise<void> => {
  if (!userId) return;
  const clean = JSON.parse(JSON.stringify({ lists, groups, updatedAt: Date.now() }));
  await userDoc(userId, 'data', 'todoLists').set(clean);
};

export const loadTodoLists = async (
  userId: string,
): Promise<{ lists: TodoList[]; groups: TodoGroup[] } | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'data', 'todoLists').get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown>;
    return {
      lists: Array.isArray(data.lists) ? (data.lists as TodoList[]) : [],
      groups: Array.isArray(data.groups) ? (data.groups as TodoGroup[]) : [],
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.warn('[Load:TodoLists] Firestore read failed:', err?.code || err?.message);
    return null;
  }
};

// ── Chat History ──

const MAX_CHAT_MESSAGES = 200;

export const saveChatHistory = async (
  userId: string,
  messages: ChatMessage[],
): Promise<void> => {
  if (!userId) return;
  const trimmed = messages.slice(-MAX_CHAT_MESSAGES);
  const clean = JSON.parse(JSON.stringify({ messages: trimmed, updatedAt: Date.now() }));
  await userDoc(userId, 'data', 'chatHistory').set(clean);
};

export const loadChatHistory = async (userId: string): Promise<ChatMessage[]> => {
  if (!userId) return [];
  try {
    const snap = await userDoc(userId, 'data', 'chatHistory').get();
    if (!snap.exists) return [];
    const data = snap.data() as any;
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (error: any) {
    console.warn('[Load:Chat] Firestore read failed:', error?.code || error?.message);
    return [];
  }
};

// ── Profile ──

export const saveProfile = async (userId: string, profile: UserProfile): Promise<void> => {
  if (!userId) return;
  const docRef = userDoc(userId, 'profile', 'main');
  const existing = await docRef.get();
  const profileData: Record<string, unknown> = {
    name: profile.name,
    email: profile.email || null,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl || null,
    gender: profile.gender || 'Other',
    age: profile.age || '',
    location: profile.location || '',
    bio: profile.bio || '',
    gallery: Array.isArray(profile.gallery) ? profile.gallery : [],
    onboardingCompleted: profile.onboardingCompleted ?? true,
    updatedAt: Date.now(),
    createdAt: existing.data()?.createdAt || profile.createdAt || Date.now(),
  };
  await docRef.set(profileData, { merge: true });
};

export const ensureCreatedAt = async (userId: string): Promise<void> => {
  if (!userId) return;
  const docRef = userDoc(userId, 'profile', 'main');
  const snap = await docRef.get();
  if (!snap.exists || !snap.data()?.createdAt) {
    await docRef.set({ createdAt: Date.now() }, { merge: true });
  }
};

export const loadProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'profile', 'main').get();
    if (!snap.exists) return null;
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
      billingSubscriptionId: data.billingSubscriptionId || null,
      billingCancelAtPeriodEnd: data.billingCancelAtPeriodEnd ?? false,
      createdAt: data.createdAt || undefined,
      onboardingCompleted: data.onboardingCompleted ?? true,
    };
  } catch (error: any) {
    console.warn('[Load:Profile] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

// ── User Settings ──

export const saveUserSettings = async (
  userId: string,
  settings: { language: 'en' | 'ko' },
): Promise<void> => {
  if (!userId) return;
  await userDoc(userId, 'settings', 'main').set({
    language: settings.language,
    updatedAt: Date.now(),
  });
};

export const loadUserSettings = async (userId: string): Promise<UserSettings | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'settings', 'main').get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    if (data.language !== 'ko' && data.language !== 'en') return null;
    return {
      language: data.language,
      updatedAt: Number(data.updatedAt || 0),
    };
  } catch (error: any) {
    console.warn('[Load:Settings] Firestore read failed:', error?.code || error?.message);
    return null;
  }
};

// ── Visualizations ──

const sanitizeFirestorePayload = <T extends Record<string, any>>(payload: T): Partial<T> => {
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    (acc as any)[key] = value;
    return acc;
  }, {} as Partial<T>);
};

const sanitizeFirestoreString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
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

export const loadVisualizations = async (userId: string): Promise<SavedVisualization[]> => {
  if (!userId) return [];
  try {
    const snap = await userCollection(userId, 'visualizations')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
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
    console.warn('[Load:Visualizations] Firestore read failed:', error?.code || error?.message);
    return [];
  }
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
  await userDoc(userId, 'visualizations', id).set(payload);

  return { id, timestamp: now, updatedAt: now, ...normalizedItem };
};

export const saveVisualizationViaApi = async (
  item: VisualizationWriteInput,
  visualizationId?: string,
): Promise<SavedVisualization> => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw Object.assign(new Error('Login required.'), { code: 'AUTH_REQUIRED' });
  }

  const token = await currentUser.getIdToken();
  const normalizedItem = normalizeVisualizationInput(item);
  const payload = sanitizeFirestorePayload(normalizedItem);

  // In RN, use full URL. Configure API_BASE_URL via env or config.
  const apiBaseUrl = __DEV__ ? 'http://localhost:3000' : 'https://supercoach.ai';
  const response = await fetch(`${apiBaseUrl}/api/save-visualization`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ visualizationId, payload }),
  });

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // ignore parse errors
  }

  if (!response.ok) {
    const code = String(body.errorCode || `SAVE_API_${response.status}`);
    const message = String(body.errorMessage || 'Visualization save API call failed.');
    throw Object.assign(new Error(message), {
      code,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    });
  }

  const savedId =
    typeof body.id === 'string' && (body.id as string).trim()
      ? (body.id as string)
      : visualizationId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const savedAt = Number(body.savedAt || Date.now());

  return { id: savedId, timestamp: savedAt, updatedAt: savedAt, ...normalizedItem };
};

export const updateVisualization = async (
  userId: string,
  visualizationId: string,
  updates: Partial<Omit<SavedVisualization, 'id' | 'timestamp'>>,
): Promise<void> => {
  if (!userId || !visualizationId) return;
  const payload = sanitizeFirestorePayload({ ...updates, updatedAt: Date.now() });
  await userDoc(userId, 'visualizations', visualizationId).set(payload, { merge: true });
};

export const deleteVisualization = async (
  userId: string,
  visualizationId: string,
): Promise<void> => {
  if (!userId || !visualizationId) return;
  await userDoc(userId, 'visualizations', visualizationId).delete();
};

// ── Sync Status ──

export const getSyncStatus = (): SyncStatus => {
  return auth().currentUser ? 'cloud' : 'offline';
};

// ── Generation Recovery ──

export const recoverGenerationResult = async (
  userId: string,
  generationId: string,
  type: 'image' | 'audio',
): Promise<Record<string, unknown> | null> => {
  try {
    const docId = type === 'audio' ? `${generationId}_audio` : generationId;
    const ref = userDoc(userId, 'generationResults', docId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const data = snap.data() ?? null;
    try {
      await ref.delete();
    } catch {
      // ignore cleanup failure
    }
    return data;
  } catch {
    return null;
  }
};

// ── Monthly Usage ──

export const loadUsage = async (userId: string): Promise<MonthlyUsage> => {
  const defaults: MonthlyUsage = {
    chatMessages: 0,
    narrativeCalls: 0,
    imageCredits: 0,
    audioMinutes: 0,
    videoGenerations: 0,
  };
  if (!userId) return defaults;
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const snap = await userDoc(userId, 'usage', monthKey).get();
    const d = (snap.data() || {}) as Record<string, number>;
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

// ── Feedback Cards ──

export const loadFeedbackCards = async (
  userId: string,
  startDate: string,
  endDate: string,
): Promise<FeedbackCard[]> => {
  if (!userId) return [];
  try {
    const snap = await userCollection(userId, 'feedbackCards')
      .orderBy('date')
      .limit(100)
      .get();
    const cards: FeedbackCard[] = [];
    snap.forEach((d) => {
      const card = d.data() as FeedbackCard;
      if (card.date >= startDate && card.date <= endDate) {
        cards.push(card);
      }
    });
    return cards;
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    log('[Load:FeedbackCards] failed:', e?.code || e?.message);
    return [];
  }
};

export const saveFeedbackCard = async (userId: string, card: FeedbackCard): Promise<void> => {
  if (!userId) return;
  const clean = JSON.parse(JSON.stringify(card));
  await userDoc(userId, 'feedbackCards', card.date).set({
    ...clean,
    updatedAt: Date.now(),
  });
};

// ── Notification Settings ──

export const loadNotificationSettings = async (
  userId: string,
): Promise<NotificationSettings | null> => {
  if (!userId) return null;
  try {
    const snap = await userDoc(userId, 'settings', 'notifications').get();
    if (!snap.exists) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      morningEnabled: Boolean(d.morningEnabled),
      morningTime: String(d.morningTime || '08:00'),
      eveningEnabled: Boolean(d.eveningEnabled),
      eveningTime: String(d.eveningTime || '21:00'),
      timezone: typeof d.timezone === 'string' ? d.timezone : undefined,
      notificationPermission:
        (d.notificationPermission as 'granted' | 'denied' | 'default') || 'default',
      fcmToken: typeof d.fcmToken === 'string' ? d.fcmToken : undefined,
      lastMorningSentDate:
        typeof d.lastMorningSentDate === 'string' ? d.lastMorningSentDate : undefined,
      lastEveningSentDate:
        typeof d.lastEveningSentDate === 'string' ? d.lastEveningSentDate : undefined,
      updatedAt: Number(d.updatedAt || 0),
    };
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    log('[Load:NotificationSettings] failed:', e?.code || e?.message);
    return null;
  }
};

export const saveNotificationSettings = async (
  userId: string,
  settings: NotificationSettings,
): Promise<void> => {
  if (!userId) return;
  const clean = JSON.parse(JSON.stringify(settings));
  await userDoc(userId, 'settings', 'notifications').set({
    ...clean,
    updatedAt: Date.now(),
  });
};

export const saveFcmToken = async (userId: string, token: string): Promise<void> => {
  if (!userId || !token) return;
  try {
    await userDoc(userId, 'settings', 'notifications').set(
      { fcmToken: token, updatedAt: Date.now() },
      { merge: true },
    );
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    log('[Save:FcmToken] failed:', e?.code || e?.message);
  }
};

// ── Principles ──

export const savePrinciples = async (
  userId: string,
  principles: UserPrinciple[],
): Promise<void> => {
  if (!userId) return;
  await userDoc(userId, 'data', 'principles').set(
    { items: JSON.parse(JSON.stringify(principles)), updatedAt: Date.now() },
    { merge: true },
  );
};

export const loadPrinciples = async (userId: string): Promise<UserPrinciple[]> => {
  if (!userId) return [];
  try {
    const snap = await userDoc(userId, 'data', 'principles').get();
    if (!snap.exists) return [];
    return (snap.data()?.items ?? []) as UserPrinciple[];
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    log('[Load:Principles] failed:', e?.code || e?.message);
    return [];
  }
};
