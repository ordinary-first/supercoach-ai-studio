import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import type { ActionType, ActionLogEntry } from '../shared/types';
import { isGuestUser } from '../shared/isGuestUser';

const STORAGE_KEY = 'secretcoach-action-log';
const MAX_LOCAL_ENTRIES = 100;
const CLEANUP_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const appendAction = async (
  userId: string | null,
  action: ActionType,
  detail: string,
  metadata?: Record<string, unknown>,
): Promise<void> => {
  const entry: ActionLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    detail,
    timestamp: Date.now(),
    metadata,
  };

  if (isGuestUser(userId)) {
    await appendToAsyncStorage(entry);
    return;
  }

  await appendToAsyncStorage(entry);
  firestore()
    .collection('users')
    .doc(userId!)
    .collection('actionLog')
    .add({ action: entry.action, detail: entry.detail, timestamp: entry.timestamp, metadata: entry.metadata || null })
    .catch((e) => { console.error('[ActionLog] Write failed:', (e as { code?: string })?.code || e); });
};

export const getRecentActions = async (
  userId: string | null,
  sinceDays: number = 7,
): Promise<ActionLogEntry[]> => {
  const sinceTimestamp = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

  if (isGuestUser(userId)) {
    const local = await getFromAsyncStorage();
    return local.filter(e => e.timestamp >= sinceTimestamp);
  }

  try {
    const snap = await firestore()
      .collection('users')
      .doc(userId!)
      .collection('actionLog')
      .where('timestamp', '>=', sinceTimestamp)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as ActionLogEntry[];
  } catch {
    const local = await getFromAsyncStorage();
    return local.filter(e => e.timestamp >= sinceTimestamp);
  }
};

export const cleanupOldActions = async (
  userId: string | null,
): Promise<void> => {
  await cleanupAsyncStorage();

  if (isGuestUser(userId)) return;

  try {
    const cutoff = Date.now() - CLEANUP_AGE_MS;
    const snap = await firestore()
      .collection('users')
      .doc(userId!)
      .collection('actionLog')
      .where('timestamp', '<', cutoff)
      .limit(100)
      .get();

    if (snap.empty) return;

    const batch = firestore().batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch { /* best effort */ }
};

const appendToAsyncStorage = async (entry: ActionLogEntry): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const entries: ActionLogEntry[] = stored ? JSON.parse(stored) : [];
    entries.push(entry);
    const trimmed = entries.slice(-MAX_LOCAL_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
};

const getFromAsyncStorage = async (): Promise<ActionLogEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const cleanupAsyncStorage = async (): Promise<void> => {
  try {
    const cutoff = Date.now() - CLEANUP_AGE_MS;
    const entries = await getFromAsyncStorage();
    const filtered = entries.filter(e => e.timestamp >= cutoff);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
};
