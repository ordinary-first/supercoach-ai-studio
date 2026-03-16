import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import type {
  CoachMemoryContext,
  ShortTermMemory,
  MidTermMemory,
  LongTermMemory,
} from '../shared/types';
import { isGuestUser } from '../shared/isGuestUser';

const STORAGE_PREFIX = 'secretcoach-memory';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const memoryDoc = (userId: string, tier: string) =>
  firestore().collection('users').doc(userId).collection('coachMemory').doc(tier);

export const loadMemory = async (
  userId: string | null,
): Promise<CoachMemoryContext> => {
  if (isGuestUser(userId)) return loadFromAsyncStorage();

  try {
    const [shortSnap, midSnap, longSnap] = await Promise.all([
      memoryDoc(userId!, 'shortTerm').get(),
      memoryDoc(userId!, 'midTerm').get(),
      memoryDoc(userId!, 'longTerm').get(),
    ]);

    return {
      shortTerm: (shortSnap.data() as ShortTermMemory | undefined)?.summary || null,
      midTerm: (midSnap.data() as MidTermMemory | undefined)?.summary || null,
      longTerm: (longSnap.data() as LongTermMemory | undefined)?.summary || null,
    };
  } catch {
    return loadFromAsyncStorage();
  }
};

export const loadMemoryTimestamps = async (
  userId: string | null,
): Promise<{ shortTermUpdatedAt: number; midTermUpdatedAt: number }> => {
  if (isGuestUser(userId)) {
    return loadTimestampsFromAsyncStorage();
  }

  try {
    const [shortSnap, midSnap] = await Promise.all([
      memoryDoc(userId!, 'shortTerm').get(),
      memoryDoc(userId!, 'midTerm').get(),
    ]);
    return {
      shortTermUpdatedAt: (shortSnap.data() as ShortTermMemory | undefined)?.updatedAt || 0,
      midTermUpdatedAt: (midSnap.data() as MidTermMemory | undefined)?.updatedAt || 0,
    };
  } catch {
    return loadTimestampsFromAsyncStorage();
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

  await saveToAsyncStorage('shortTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await memoryDoc(userId!, 'shortTerm').set(data);
  } catch (e) { console.error('[CoachMemory:short] Save failed:', (e as { code?: string })?.code || e); }
};

export const saveMidTerm = async (
  userId: string | null,
  summary: string,
): Promise<void> => {
  const data: MidTermMemory = { summary, updatedAt: Date.now() };

  await saveToAsyncStorage('midTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await memoryDoc(userId!, 'midTerm').set(data);
  } catch (e) { console.error('[CoachMemory:mid] Save failed:', (e as { code?: string })?.code || e); }
};

export const saveLongTerm = async (
  userId: string | null,
  summary: string,
): Promise<void> => {
  const data: LongTermMemory = { summary, updatedAt: Date.now() };

  await saveToAsyncStorage('longTerm', data);
  if (isGuestUser(userId)) return;

  try {
    await memoryDoc(userId!, 'longTerm').set(data);
  } catch (e) { console.error('[CoachMemory:long] Save failed:', (e as { code?: string })?.code || e); }
};

export const isMidTermStale = (midTermUpdatedAt: number): boolean =>
  Date.now() - midTermUpdatedAt > SEVEN_DAYS_MS;

// AsyncStorage fallback

const loadFromAsyncStorage = async (): Promise<CoachMemoryContext> => {
  try {
    const [shortRaw, midRaw, longRaw] = await Promise.all([
      AsyncStorage.getItem(`${STORAGE_PREFIX}-shortTerm`),
      AsyncStorage.getItem(`${STORAGE_PREFIX}-midTerm`),
      AsyncStorage.getItem(`${STORAGE_PREFIX}-longTerm`),
    ]);
    return {
      shortTerm: shortRaw ? (JSON.parse(shortRaw) as ShortTermMemory).summary : null,
      midTerm: midRaw ? (JSON.parse(midRaw) as MidTermMemory).summary : null,
      longTerm: longRaw ? (JSON.parse(longRaw) as LongTermMemory).summary : null,
    };
  } catch {
    return { shortTerm: null, midTerm: null, longTerm: null };
  }
};

const loadTimestampsFromAsyncStorage = async (): Promise<{
  shortTermUpdatedAt: number;
  midTermUpdatedAt: number;
}> => {
  try {
    const [shortRaw, midRaw] = await Promise.all([
      AsyncStorage.getItem(`${STORAGE_PREFIX}-shortTerm`),
      AsyncStorage.getItem(`${STORAGE_PREFIX}-midTerm`),
    ]);
    return {
      shortTermUpdatedAt: shortRaw ? (JSON.parse(shortRaw) as ShortTermMemory).updatedAt : 0,
      midTermUpdatedAt: midRaw ? (JSON.parse(midRaw) as MidTermMemory).updatedAt : 0,
    };
  } catch {
    return { shortTermUpdatedAt: 0, midTermUpdatedAt: 0 };
  }
};

const saveToAsyncStorage = async (
  tier: 'shortTerm' | 'midTerm' | 'longTerm',
  data: ShortTermMemory | MidTermMemory | LongTermMemory,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}-${tier}`, JSON.stringify(data));
  } catch { /* ignore */ }
};
