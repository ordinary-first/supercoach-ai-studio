import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sun, Moon, Bell, BellOff } from 'lucide-react';
import type { TranslationStrings } from '../../i18n/types';
import type { NotificationSettings } from '../../types';
import { loadNotificationSettings, saveNotificationSettings } from '../../services/firebaseService';
import { registerFcmToken } from '../../services/notificationService';

interface FeedbackSettingsSheetProps {
  t: TranslationStrings;
  userId: string | null;
  onClose: () => void;
  onSettingsChange?: (settings: NotificationSettings) => void;
}

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00',
];

const EVENING_OPTIONS = [
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

const formatTime = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(m).padStart(2, '0')}`;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  morningEnabled: false,
  morningTime: '08:00',
  eveningEnabled: false,
  eveningTime: '21:00',
  notificationPermission: 'default',
  updatedAt: 0,
};

export const FeedbackSettingsSheet: React.FC<FeedbackSettingsSheetProps> = ({
  t,
  userId,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load from Firestore
  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    loadNotificationSettings(userId).then((saved) => {
      if (saved) setSettings(saved);
      setLoaded(true);
    });
  }, [userId]);

  // Sync browser permission state
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setSettings((prev) => ({
        ...prev,
        notificationPermission: Notification.permission as 'granted' | 'denied' | 'default',
      }));
    }
  }, []);

  // Debounced save to Firestore
  const persistSettings = useCallback((next: NotificationSettings) => {
    setSettings(next);
    onSettingsChange?.(next);
    if (!userId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotificationSettings(userId, next);
    }, 800);
  }, [userId, onSettingsChange]);

  const updateField = useCallback(<K extends keyof NotificationSettings>(
    key: K, value: NotificationSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value, updatedAt: Date.now() };
      persistSettings(next);
      return next;
    });
  }, [persistSettings]);

  // Request notification permission + FCM token
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    updateField('notificationPermission', result as 'granted' | 'denied' | 'default');
    // FCM 토큰 등록 (granted일 때)
    if (result === 'granted' && userId) {
      registerFcmToken(userId);
    }
  }, [updateField, userId]);

  if (!loaded) return null;

  const permStatus = settings.notificationPermission;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-th-overlay/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-th-elevated rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up shadow-2xl border-t border-th-border">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-th-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-bottom border-th-border/50">
          <h2 className="text-base font-bold text-th-text">{t.feedback.settings}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-th-surface-hover">
            <X size={16} className="text-th-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
          {/* Notification Permission */}
          {permStatus !== 'granted' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {permStatus === 'denied' ? (
                  <BellOff size={14} className="text-red-400" />
                ) : (
                  <Bell size={14} className="text-th-accent" />
                )}
                <span className="text-[13px] font-semibold text-th-text-secondary">
                  {t.feedback.notificationPermission}
                </span>
              </div>
              {permStatus === 'denied' ? (
                <p className="text-[11px] text-red-400/70">{t.feedback.notificationDenied}</p>
              ) : (
                <button
                  onClick={requestPermission}
                  className="w-full py-2.5 rounded-xl bg-th-accent/10 text-th-accent text-[13px] font-semibold hover:bg-th-accent/20 transition-colors"
                >
                  {t.feedback.notificationRequest}
                </button>
              )}
              <div className="border-t border-th-border/50 mt-2" />
            </div>
          )}

          {/* Morning */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun size={14} className="text-amber-500" />
              <span className="text-[13px] font-semibold text-th-text-secondary">{t.feedback.morningAlarm}</span>
            </div>
            <p className="text-[11px] text-th-text-tertiary">{t.feedback.morningDesc}</p>

            <select
              value={settings.morningTime}
              onChange={(e) => updateField('morningTime', e.target.value)}
              className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
            >
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[12px] text-th-text-tertiary">
                {settings.morningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
              </span>
              <div
                onClick={() => updateField('morningEnabled', !settings.morningEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings.morningEnabled ? 'bg-th-accent' : 'bg-th-border'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.morningEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
            </label>
          </div>

          <div className="border-t border-th-border/50" />

          {/* Evening */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-500" />
              <span className="text-[13px] font-semibold text-th-text-secondary">{t.feedback.eveningAlarm}</span>
            </div>
            <p className="text-[11px] text-th-text-tertiary">{t.feedback.eveningDesc}</p>

            <select
              value={settings.eveningTime}
              onChange={(e) => updateField('eveningTime', e.target.value)}
              className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
            >
              {EVENING_OPTIONS.map((time) => (
                <option key={time} value={time}>{formatTime(time)}</option>
              ))}
            </select>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[12px] text-th-text-tertiary">
                {settings.eveningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
              </span>
              <div
                onClick={() => updateField('eveningEnabled', !settings.eveningEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${settings.eveningEnabled ? 'bg-th-accent' : 'bg-th-border'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.eveningEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
