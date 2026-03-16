import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationSettings } from '../shared/types';

// ---------- Constants ----------

const SENT_KEY = 'feedback_notif_sent';
const TRIGGER_WINDOW_MS = 5 * 60 * 1000;
const ANDROID_CHANNEL_ID = 'supercoach-default';

export type AlarmSlot = 'morning' | 'evening';

// ---------- Notification channel setup (Android) ----------

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'SuperCoach Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

// ---------- Foreground notification handler ----------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------- Permission & registration ----------

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const granted = await requestPermissions();
    if (!granted) return null;

    await setupNotificationChannel();

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

// ---------- Local notification helpers ----------

export async function scheduleLocalNotification(
  title: string,
  body: string,
  options?: {
    trigger?: Notifications.NotificationTriggerInput;
    data?: Record<string, unknown>;
  },
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: options?.data,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
    },
    trigger: options?.trigger ?? null,
  });
}

export async function showNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await scheduleLocalNotification(title, body, { data });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ---------- Response listener ----------

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

// ---------- Sent-record persistence (AsyncStorage) ----------

async function getSentRecord(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SENT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function markSent(type: string, dateKey: string): Promise<void> {
  const record = await getSentRecord();
  record[`${type}_${dateKey}`] = new Date().toISOString();

  // Prune entries older than 3 days
  const cutoff = Date.now() - 3 * 86_400_000;
  for (const [k, v] of Object.entries(record)) {
    if (new Date(v).getTime() < cutoff) delete record[k];
  }
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify(record));
}

function checkSent(
  record: Record<string, string>,
  type: string,
  dateKey: string,
  settingsUpdatedAt = 0,
): boolean {
  const sentAtIso = record[`${type}_${dateKey}`];
  if (!sentAtIso) return false;
  const sentAt = new Date(sentAtIso).getTime();
  if (!Number.isFinite(sentAt)) return false;
  return sentAt >= settingsUpdatedAt;
}

// ---------- Time utilities ----------

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWithinWindow(targetTime: string, windowMs = TRIGGER_WINDOW_MS): boolean {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff < windowMs;
}

function isPastTime(targetTime: string): boolean {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= h * 60 + m;
}

// ---------- Trigger check result ----------

export interface NotificationCheckResult {
  shouldNotifyMorning: boolean;
  shouldNotifyEvening: boolean;
  shouldGenerateVictory: boolean;
}

export async function checkNotificationTriggers(
  settings: NotificationSettings | null,
): Promise<NotificationCheckResult> {
  const result: NotificationCheckResult = {
    shouldNotifyMorning: false,
    shouldNotifyEvening: false,
    shouldGenerateVictory: false,
  };

  if (!settings) return result;
  const today = todayKey();
  const settingsUpdatedAt = Number(settings.updatedAt || 0);
  const record = await getSentRecord();

  if (settings.morningEnabled && !checkSent(record, 'morning', today, settingsUpdatedAt)) {
    if (isWithinWindow(settings.morningTime)) {
      result.shouldNotifyMorning = true;
    }
  }

  if (settings.eveningEnabled && !checkSent(record, 'evening', today, settingsUpdatedAt)) {
    if (isWithinWindow(settings.eveningTime)) {
      result.shouldNotifyEvening = true;
    }
  }

  if (settings.eveningEnabled && isPastTime(settings.eveningTime)) {
    if (!checkSent(record, 'victory', today)) {
      result.shouldGenerateVictory = true;
    }
  }

  return result;
}

// ---------- Mark helpers ----------

export async function markMorningSent(): Promise<void> {
  await markSent('morning', todayKey());
}

export async function markEveningSent(): Promise<void> {
  await markSent('evening', todayKey());
}

export async function markVictoryGenerated(): Promise<void> {
  await markSent('victory', todayKey());
}

export async function wasVictoryGenerated(): Promise<boolean> {
  const record = await getSentRecord();
  return checkSent(record, 'victory', todayKey());
}
