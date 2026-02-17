import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseService';
import type { ActionType, ActionLogEntry } from '../types';

const STORAGE_KEY = 'secretcoach-action-log';
const MAX_LOCAL_ENTRIES = 100;
const CLEANUP_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isGuestUser = (uid?: string | null): boolean =>
  !uid || uid === 'guest' || uid.startsWith('guest_');

export const appendAction = (
  userId: string | null,
  action: ActionType,
  detail: string,
  metadata?: Record<string, unknown>,
): void => {
  const entry: ActionLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    action,
    detail,
    timestamp: Date.now(),
    metadata,
  };

  if (isGuestUser(userId)) {
    appendToLocalStorage(entry);
    return;
  }

  appendToLocalStorage(entry);
  addDoc(
    collection(db, 'users', userId!, 'actionLog'),
    { action: entry.action, detail: entry.detail, timestamp: entry.timestamp, metadata: entry.metadata || null },
  ).catch(() => { /* fire-and-forget */ });
};

export const getRecentActions = async (
  userId: string | null,
  sinceDays: number = 7,
): Promise<ActionLogEntry[]> => {
  const sinceTimestamp = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

  if (isGuestUser(userId)) {
    return getFromLocalStorage().filter(e => e.timestamp >= sinceTimestamp);
  }

  try {
    const q = query(
      collection(db, 'users', userId!, 'actionLog'),
      where('timestamp', '>=', sinceTimestamp),
      orderBy('timestamp', 'desc'),
      limit(200),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as ActionLogEntry[];
  } catch {
    return getFromLocalStorage().filter(e => e.timestamp >= sinceTimestamp);
  }
};

export const cleanupOldActions = async (
  userId: string | null,
): Promise<void> => {
  cleanupLocalStorage();

  if (isGuestUser(userId)) return;

  try {
    const cutoff = Date.now() - CLEANUP_AGE_MS;
    const q = query(
      collection(db, 'users', userId!, 'actionLog'),
      where('timestamp', '<', cutoff),
      limit(100),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch { /* best effort */ }
};

const appendToLocalStorage = (entry: ActionLogEntry): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const entries: ActionLogEntry[] = stored ? JSON.parse(stored) : [];
    entries.push(entry);
    const trimmed = entries.slice(-MAX_LOCAL_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
};

const getFromLocalStorage = (): ActionLogEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const cleanupLocalStorage = (): void => {
  try {
    const cutoff = Date.now() - CLEANUP_AGE_MS;
    const entries = getFromLocalStorage().filter(e => e.timestamp >= cutoff);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
};
