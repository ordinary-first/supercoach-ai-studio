import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { saveFcmToken } from './firebaseService';
import type { NotificationSettings } from '../types';

const SENT_KEY = 'feedback_notif_sent';
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
  // Clean entries older than 3 days
  const cutoff = Date.now() - 3 * 86400000;
  for (const [k, v] of Object.entries(record)) {
    if (new Date(v).getTime() < cutoff) delete record[k];
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(record));
};

const wasSent = (type: string, dateKey: string): boolean => {
  const record = getSentRecord();
  return Boolean(record[`${type}_${dateKey}`]);
};

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isWithinWindow = (targetTime: string, windowMs: number = 60000): boolean => {
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

export const showBrowserNotification = (
  title: string,
  body: string,
  tag?: string,
  slot: AlarmSlot | null = null,
): void => {
  if (!canShowNotification()) return;
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
    // SW fallback not available yet
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

  // Morning check
  if (settings.morningEnabled && !wasSent('morning', today)) {
    if (isWithinWindow(settings.morningTime)) {
      result.shouldNotifyMorning = true;
    }
  }

  // Evening check
  if (settings.eveningEnabled && !wasSent('evening', today)) {
    if (isWithinWindow(settings.eveningTime)) {
      result.shouldNotifyEvening = true;
    }
  }

  // Victory generation (independent of notification — triggers when past evening time)
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

// ── FCM Token Registration ──

export const registerFcmToken = async (userId: string): Promise<string | null> => {
  try {
    const app = getApp();
    const messaging = getMessaging(app);

    // Register service worker
    const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      serviceWorkerRegistration: sw,
    });

    if (token) {
      await saveFcmToken(userId, token);
    }

    // Foreground message handler
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'SuperCoach AI';
      const body = payload.notification?.body || '';
      showBrowserNotification(title, body, 'fcm');
    });

    return token;
  } catch {
    // FCM not supported or permission denied — silent fail
    return null;
  }
};
