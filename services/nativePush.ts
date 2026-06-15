import { Capacitor } from '@capacitor/core';
import { saveFcmToken } from './firebaseService';
import { ALARM_CLICK_EVENT, type AlarmSlot } from './notificationService';

/** True only inside the packaged Capacitor app (Android/iOS), false on web. */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const toSlot = (value: unknown): AlarmSlot | null =>
  value === 'morning' || value === 'evening' ? value : null;

/**
 * Native (Capacitor) push registration. Requests OS permission, registers with
 * FCM, saves the device token, and forwards notification taps to the same
 * ALARM_CLICK_EVENT the web flow uses. No-op on web (web uses registerFcmToken).
 * Resolves to the FCM token, or null if unavailable / denied.
 */
export const registerNativePush = async (userId: string): Promise<string | null> => {
  if (!isNativeApp() || !userId) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return null;

    // High-importance channel → heads-up + sound + vibration (Android O+).
    // Must match the channelId the server sends in the FCM android payload.
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'reminders',
          name: 'Reminders',
          description: 'Daily check-in reminders',
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        });
      } catch {
        // best-effort
      }
    }

    await PushNotifications.removeAllListeners();

    let resolveToken!: (value: string | null) => void;
    const tokenPromise = new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    });
    const timeout = setTimeout(() => resolveToken(null), 10000);

    await PushNotifications.addListener('registration', (token) => {
      clearTimeout(timeout);
      const value = token?.value || null;
      if (value) void saveFcmToken(userId, value);
      resolveToken(value);
    });
    await PushNotifications.addListener('registrationError', () => {
      clearTimeout(timeout);
      resolveToken(null);
    });
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = (action.notification?.data || {}) as Record<string, unknown>;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(ALARM_CLICK_EVENT, {
            detail: { slot: toSlot(data.slot), tag: data.tag },
          }),
        );
      }
    });

    await PushNotifications.register();
    return await tokenPromise;
  } catch {
    return null;
  }
};

/**
 * Re-registers (refreshes the token) only when OS permission was already
 * granted — never prompts. Safe to call on app open.
 */
export const registerNativePushIfGranted = async (userId: string): Promise<string | null> => {
  if (!isNativeApp() || !userId) return null;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') return null;
    return await registerNativePush(userId);
  } catch {
    return null;
  }
};
