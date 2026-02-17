import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseService';
import type {
  CoachMemoryContext,
  ShortTermMemory,
  MidTermMemory,
  LongTermMemory,
} from '../types';

const STORAGE_PREFIX = 'secretcoach-memory';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const isGuestUser = (uid?: string | null): boolean =>
  !uid || uid === 'guest' || uid.startsWith('guest_');

export const loadMemory = async (
  userId: string | null,
): Promise<CoachMemoryContext> => {
  if (isGuestUser(userId)) return loadFromLocalStorage();

  try {
    const [shortSnap, midSnap, longSnap] = await Promise.all([
      getDoc(doc(db, 'users', userId!, 'coachMemory', 'shortTerm')),
      getDoc(doc(db, 'users', userId!, 'coachMemory', 'midTerm')),
      getDoc(doc(db, 'users', userId!, 'coachMemory', 'longTerm')),
    ]);

    return {
      shortTerm: (shortSnap.data() as ShortTermMemory | undefined)?.summary || null,
      midTerm: (midSnap.data() as MidTermMemory | undefined)?.summary || null,
      longTerm: (longSnap.data() as LongTermMemory | undefined)?.summary || null,
    };
  } catch {
    return loadFromLocalStorage();
  }
};

export const loadMemoryTimestamps = async (
  userId: string | null,
): Promise<{ shortTermUpdatedAt: number; midTermUpdatedAt: number }> => {
  if (isGuestUser(userId)) {
    const local = loadTimestampsFromLocalStorage();
    return local;
  }

  try {
    const [shortSnap, midSnap] = await Promise.all([
      getDoc(doc(db, 'users', userId!, 'coachMemory', 'shortTerm')),
      getDoc(doc(db, 'users', userId!, 'coachMemory', 'midTerm')),
    ]);
    return {
      shortTermUpdatedAt: (shortSnap.data() as ShortTermMemory | undefined)?.updatedAt || 0,
      midTermUpdatedAt: (midSnap.data() as MidTermMemory | undefined)?.updatedAt || 0,
    };
  } catch {
    return loadTimestampsFromLocalStorage();
  }
};

export const saveShortTerm = async (
  userId: string | null,
  summary: string,
  lastActionTimestamp: number,
): Promise<void> => {
  const data: ShortTermMemory = {
    summary,
    lastActionTimestamp,
    updatedAt: Date.now(),
  };

  saveToLocalStorage('shortTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await setDoc(
      doc(db, 'users', userId!, 'coachMemory', 'shortTerm'),
      data,
    );
  } catch { /* best effort */ }
};

export const saveMidTerm = async (
  userId: string | null,
  summary: string,
): Promise<void> => {
  const data: MidTermMemory = { summary, updatedAt: Date.now() };

  saveToLocalStorage('midTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await setDoc(
      doc(db, 'users', userId!, 'coachMemory', 'midTerm'),
      data,
    );
  } catch { /* best effort */ }
};

export const saveLongTerm = async (
  userId: string | null,
  summary: string,
): Promise<void> => {
  const data: LongTermMemory = { summary, updatedAt: Date.now() };

  saveToLocalStorage('longTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await setDoc(
      doc(db, 'users', userId!, 'coachMemory', 'longTerm'),
      data,
    );
  } catch { /* best effort */ }
};

export const isMidTermStale = (midTermUpdatedAt: number): boolean =>
  Date.now() - midTermUpdatedAt > SEVEN_DAYS_MS;

// localStorage fallback

const loadFromLocalStorage = (): CoachMemoryContext => {
  try {
    const short = localStorage.getItem(`${STORAGE_PREFIX}-shortTerm`);
    const mid = localStorage.getItem(`${STORAGE_PREFIX}-midTerm`);
    const long = localStorage.getItem(`${STORAGE_PREFIX}-longTerm`);
    return {
      shortTerm: short ? (JSON.parse(short) as ShortTermMemory).summary : null,
      midTerm: mid ? (JSON.parse(mid) as MidTermMemory).summary : null,
      longTerm: long ? (JSON.parse(long) as LongTermMemory).summary : null,
    };
  } catch {
    return { shortTerm: null, midTerm: null, longTerm: null };
  }
};

const loadTimestampsFromLocalStorage = (): {
  shortTermUpdatedAt: number;
  midTermUpdatedAt: number;
} => {
  try {
    const short = localStorage.getItem(`${STORAGE_PREFIX}-shortTerm`);
    const mid = localStorage.getItem(`${STORAGE_PREFIX}-midTerm`);
    return {
      shortTermUpdatedAt: short ? (JSON.parse(short) as ShortTermMemory).updatedAt : 0,
      midTermUpdatedAt: mid ? (JSON.parse(mid) as MidTermMemory).updatedAt : 0,
    };
  } catch {
    return { shortTermUpdatedAt: 0, midTermUpdatedAt: 0 };
  }
};

const saveToLocalStorage = (
  tier: 'shortTerm' | 'midTerm' | 'longTerm',
  data: ShortTermMemory | MidTermMemory | LongTermMemory,
): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${tier}`, JSON.stringify(data));
  } catch { /* ignore */ }
};
