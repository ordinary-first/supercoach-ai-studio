import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import type { NotificationSettings } from '../shared/types';
import type { AlarmSlot } from '../services/notificationService';
import {
  registerForPushNotifications,
  checkNotificationTriggers,
  showNotification,
  markMorningSent,
  markEveningSent,
  addNotificationResponseListener,
} from '../services/notificationService';

const CHECK_INTERVAL_MS = 60_000; // 1 minute

// Re-export AlarmSlot from the service so consumers can import from either place
export type { AlarmSlot } from '../services/notificationService';

interface UseNotificationsOptions {
  /** Current notification settings from user profile / store. */
  settings: NotificationSettings | null;
  /** Called when the user taps a notification. */
  onNotificationTap?: (slot: AlarmSlot | null, data?: Record<string, unknown>) => void;
  /** Called after a push token is obtained. */
  onTokenReceived?: (token: string) => void;
}

export function useNotifications({
  settings,
  onNotificationTap,
  onTokenReceived,
}: UseNotificationsOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Trigger check callback ---
  const runTriggerCheck = useCallback(async () => {
    if (!settings) return;

    const result = await checkNotificationTriggers(settings);

    if (result.shouldNotifyMorning) {
      await showNotification(
        'Good morning!',
        "Check today's goals and get started.",
        { slot: 'morning' },
      );
      await markMorningSent();
    }

    if (result.shouldNotifyEvening) {
      await showNotification(
        'Evening check-in',
        'How did today go? Review your progress.',
        { slot: 'evening' },
      );
      await markEveningSent();
    }
  }, [settings]);

  // --- Initialise on mount ---
  useEffect(() => {
    let mounted = true;

    async function init() {
      // registerForPushNotifications handles permissions + channel setup internally
      const token = await registerForPushNotifications();
      if (token && mounted) {
        onTokenReceived?.(token);
      }
    }

    init();

    return () => {
      mounted = false;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Notification tap handler ---
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const slot = (data?.slot as AlarmSlot) ?? null;
      onNotificationTap?.(slot, data);
    });

    return () => sub.remove();
  }, [onNotificationTap]);

  // --- Periodic trigger checking ---
  useEffect(() => {
    // Run immediately on settings change
    runTriggerCheck();

    intervalRef.current = setInterval(runTriggerCheck, CHECK_INTERVAL_MS);

    // Pause when app is backgrounded, resume on foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runTriggerCheck();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(runTriggerCheck, CHECK_INTERVAL_MS);
        }
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      appStateSub.remove();
    };
  }, [runTriggerCheck]);
}
