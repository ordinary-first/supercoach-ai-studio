import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { saveFcmToken } from './firebaseService';
import type { NotificationSettings } from '../types';

const SENT_KEY = 'feedback_notif_sent';
const TRIGGER_WINDOW_MS = 5 * 60 * 1000;
export const ALARM_CLICK_EVENT = 'supercoach-alarm-click';
export type AlarmSlot = 'morning' | 'evening';

const dispatchAlarmClick = (slot: AlarmSlot | null, tag?: string): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(ALARM_CLICK_EVENT, {
      detail: { slot, tag },
    }),
  );
};

const getSentRecord = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
  } catch {
    return {};
  }
};

const markSent = (type: string, dateKey: string): void => {
  const record = getSentRecord();
  record[`${type}_${dateKey}`] = new Date().toISOString();
  const cutoff = Date.now() - 3 * 86400000;
  for (const [k, v] of Object.entries(record)) {
    if (new Date(v).getTime() < cutoff) delete record[k];
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(record));
};

const wasSent = (
  type: string,
  dateKey: string,
  settingsUpdatedAt: number = 0,
): boolean => {
  const record = getSentRecord();
  const sentAtIso = record[`${type}_${dateKey}`];
  if (!sentAtIso) return false;
  const sentAt = new Date(sentAtIso).getTime();
  if (!Number.isFinite(sentAt)) return false;
  return sentAt >= settingsUpdatedAt;
};

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isWithinWindow = (targetTime: string, windowMs: number = TRIGGER_WINDOW_MS): boolean => {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff < windowMs;
};

const isPastTime = (targetTime: string): boolean => {
  const now = new Date();
  const [h, m] = targetTime.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= h * 60 + m;
};

export const canShowNotification = (): boolean => {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
};

export const showBrowserNotification = async (
  title: string,
  body: string,
  tag?: string,
  slot: AlarmSlot | null = null,
): Promise<void> => {
  if (!canShowNotification()) return;

  // Mobile browsers require ServiceWorker.showNotification (new Notification() throws)
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        tag,
        icon: '/icon-192.png',
        data: { slot, tag, link: slot ? `/?alarm=${slot}` : '/' },
      });
      return;
    }
  } catch {
    // SW not available — fall through to Notification constructor
  }

  // Desktop fallback
  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: '/icon-192.png',
      data: { slot, tag },
    });
    notification.onclick = () => {
      if (typeof window !== 'undefined') {
        window.focus();
      }
      dispatchAlarmClick(slot, tag);
      notification.close();
    };
  } catch {
    // no-op
  }
};

export interface NotificationCheckResult {
  shouldNotifyMorning: boolean;
  shouldNotifyEvening: boolean;
  shouldGenerateVictory: boolean;
}

export const checkNotificationTriggers = (
  settings: NotificationSettings | null,
): NotificationCheckResult => {
  const result: NotificationCheckResult = {
    shouldNotifyMorning: false,
    shouldNotifyEvening: false,
    shouldGenerateVictory: false,
  };

  if (!settings) return result;
  const today = todayKey();
  const settingsUpdatedAt = Number(settings.updatedAt || 0);

  if (settings.morningEnabled && !wasSent('morning', today, settingsUpdatedAt)) {
    if (isWithinWindow(settings.morningTime)) {
      result.shouldNotifyMorning = true;
    }
  }

  if (settings.eveningEnabled && !wasSent('evening', today, settingsUpdatedAt)) {
    if (isWithinWindow(settings.eveningTime)) {
      result.shouldNotifyEvening = true;
    }
  }

  if (settings.eveningEnabled && isPastTime(settings.eveningTime)) {
    if (!wasSent('victory', today)) {
      result.shouldGenerateVictory = true;
    }
  }

  return result;
};

export const markMorningSent = (): void => markSent('morning', todayKey());
export const markEveningSent = (): void => markSent('evening', todayKey());
export const markVictoryGenerated = (): void => markSent('victory', todayKey());
export const wasVictoryGenerated = (): boolean => wasSent('victory', todayKey());

const getFirebaseSwConfig = (): Record<string, string> => ({
  apiKey: String(process.env.FIREBASE_API_KEY || ''),
  authDomain: String(process.env.FIREBASE_AUTH_DOMAIN || ''),
  projectId: String(process.env.FIREBASE_PROJECT_ID || ''),
  storageBucket: String(process.env.FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: String(process.env.FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: String(process.env.FIREBASE_APP_ID || ''),
});

const getMessagingSwUrl = (): string => {
  const params = new URLSearchParams(getFirebaseSwConfig());
  return `/firebase-messaging-sw.js?${params.toString()}`;
};

const parseAlarmSlot = (value: string | undefined): AlarmSlot | null => {
  if (value === 'morning' || value === 'evening') return value;
  return null;
};

export const registerFcmToken = async (userId: string): Promise<string | null> => {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    const app = getApp();
    const messaging = getMessaging(app);
    const sw = await navigator.serviceWorker.register(getMessagingSwUrl());
    const vapidKey = String(process.env.FIREBASE_VAPID_KEY || '').trim();

    const token = await getToken(
      messaging,
      vapidKey
        ? {
            serviceWorkerRegistration: sw,
            vapidKey,
          }
        : {
            serviceWorkerRegistration: sw,
          },
    );

    if (token) {
      await saveFcmToken(userId, token);
    }

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'SuperCoach AI';
      const body = payload.notification?.body || '';
      const slot = parseAlarmSlot(payload.data?.slot);
      const tag = payload.data?.tag || 'fcm';
      showBrowserNotification(title, body, tag, slot);
    });

    return token;
  } catch {
    return null;
  }
};
