import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Sun, Moon, Bell, BellOff } from 'lucide-react';
import type { TranslationStrings } from '../../i18n/types';
import type { NotificationSettings } from '../../types';
import {
  loadNotificationSettings,
  saveNotificationSettings,
} from '../../services/firebaseService';
import { registerFcmToken } from '../../services/notificationService';

interface FeedbackSettingsSheetProps {
  t: TranslationStrings;
  userId: string | null;
  onClose: () => void;
  onSettingsChange?: (settings: NotificationSettings) => void;
}

const getClientTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
};

const DEFAULT_SETTINGS: NotificationSettings = {
  morningEnabled: false,
  morningTime: '08:00',
  eveningEnabled: false,
  eveningTime: '21:00',
  timezone: getClientTimezone(),
  notificationPermission: 'default',
  updatedAt: 0,
};

const HOURS = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, '0'));

const parseTime = (value: string, fallback: string): { hh: string; mm: string } => {
  const [rawHh, rawMm] = value.split(':');
  const [fallbackHh, fallbackMm] = fallback.split(':');
  const hh = /^\d{2}$/.test(rawHh || '') && Number(rawHh) >= 0 && Number(rawHh) <= 23
    ? rawHh
    : fallbackHh;
  const mm = /^\d{2}$/.test(rawMm || '') && Number(rawMm) >= 0 && Number(rawMm) <= 59
    ? rawMm
    : fallbackMm;
  return { hh, mm };
};

const toDisplayTime = (time: string, language: 'ko' | 'en'): string => {
  const { hh, mm } = parseTime(time, '00:00');
  const hNum = Number(hh);
  if (language === 'ko') {
    const period = hNum < 12 ? '오전' : '오후';
    const hour12 = hNum % 12 === 0 ? 12 : hNum % 12;
    return `${period} ${hour12}:${mm}`;
  }
  const period = hNum < 12 ? 'AM' : 'PM';
  const hour12 = hNum % 12 === 0 ? 12 : hNum % 12;
  return `${hour12}:${mm} ${period}`;
};

const getPermissionGuide = (language: 'ko' | 'en'): string[] => {
  if (typeof navigator === 'undefined') {
    return language === 'ko'
      ? ['釉뚮씪?곗? ?ㅼ젙?먯꽌 ???ъ씠???뚮┝???덉슜?댁＜?몄슂.']
      : ['Allow notifications for this site in browser settings.'];
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);

  if (language === 'ko') {
    if (isIos) {
      return [
        'iPhone Safari: ?ㅼ젙 > Safari > ?뚮┝ ?덉슜',
        '?먮뒗 二쇱냼李?aA > ?뱀궗?댄듃 ?ㅼ젙 > ?뚮┝ ?덉슜',
        '???붾㈃??異붽?(PWA) ???ㅼ떆 ?쒕룄',
      ];
    }
    return [
      'Android Chrome: 二쇱냼李??먮Ъ???꾩씠肄??곗튂',
      '?ъ씠???ㅼ젙 > ?뚮┝ > ?덉슜',
      '?깆쑝濡??뚯븘? ???踰꾪듉 ?곗튂',
    ];
  }

  if (isIos) {
    return [
      'iPhone Safari: Settings > Safari > Notifications: Allow',
      'or tap aA > Website Settings > Notifications: Allow',
      'Add to Home Screen and retry',
    ];
  }

  return [
    'Android Chrome: tap lock icon in address bar',
    'Site settings > Notifications > Allow',
    'Return to app and tap Save',
  ];
};

export const FeedbackSettingsSheet: React.FC<FeedbackSettingsSheetProps> = ({
  t,
  userId,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const scheduleSave = useCallback((next: NotificationSettings) => {
    onSettingsChange?.(next);
    if (!userId) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotificationSettings(userId, next);
    }, 500);
  }, [userId, onSettingsChange]);

  useEffect(() => {
    if (!userId) {
      setLoaded(true);
      return;
    }

    loadNotificationSettings(userId).then((saved) => {
      if (saved) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...saved,
          timezone: saved.timezone || getClientTimezone(),
        };

        setSettings(merged);

        if (!saved.timezone) {
          saveNotificationSettings(userId, merged);
          onSettingsChange?.(merged);
        }
      } else {
        setSettings({
          ...DEFAULT_SETTINGS,
          timezone: getClientTimezone(),
        });
      }
      setLoaded(true);
    });
  }, [userId]);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;

    const browserPermission = Notification.permission as 'granted' | 'denied' | 'default';
    setSettings((prev) => {
      if (prev.notificationPermission === browserPermission) return prev;
      const next = {
        ...prev,
        notificationPermission: browserPermission,
        timezone: prev.timezone || getClientTimezone(),
        updatedAt: Date.now(),
      };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  useEffect(() => {
    if (!userId) return;
    if (settings.notificationPermission !== 'granted') return;
    registerFcmToken(userId);
  }, [settings.notificationPermission, userId]);

  const updateField = useCallback(<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value, updatedAt: Date.now() };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const handleManualSave = useCallback(async () => {
    if (!userId) return;
    const next = {
      ...settings,
      timezone: settings.timezone || getClientTimezone(),
      updatedAt: Date.now(),
    };
    setSettings(next);
    onSettingsChange?.(next);
    setIsSaving(true);
    clearTimeout(saveTimer.current);
    try {
      await saveNotificationSettings(userId, next);
    } finally {
      setIsSaving(false);
    }
  }, [onSettingsChange, settings, userId]);

  const updateTimePart = useCallback((
    key: 'morningTime' | 'eveningTime',
    part: 'hh' | 'mm',
    value: string,
  ) => {
    const current = settings[key];
    const parsed = parseTime(current, key === 'morningTime' ? '08:00' : '21:00');
    const next = part === 'hh'
      ? `${value}:${parsed.mm}`
      : `${parsed.hh}:${value}`;
    updateField(key, next);
  }, [settings, updateField]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;

    const result = await Notification.requestPermission();
    updateField('notificationPermission', result as 'granted' | 'denied' | 'default');
    updateField('timezone', getClientTimezone());
    if (result === 'granted' && userId) {
      registerFcmToken(userId);
    }
  }, [updateField, userId]);

  const morningTime = useMemo(
    () => parseTime(settings.morningTime, DEFAULT_SETTINGS.morningTime),
    [settings.morningTime],
  );
  const eveningTime = useMemo(
    () => parseTime(settings.eveningTime, DEFAULT_SETTINGS.eveningTime),
    [settings.eveningTime],
  );

  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
    },
    [],
  );

  if (!loaded) return null;

  const permStatus = settings.notificationPermission;
  const language = t.common.today === '오늘' ? 'ko' : 'en';
  const permissionGuide = getPermissionGuide(language);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-th-overlay/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-th-elevated rounded-t-3xl max-h-[70vh] flex flex-col animate-slide-up shadow-2xl border-t border-th-border">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-th-border" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-bottom border-th-border/50">
          <h2 className="text-base font-bold text-th-text">{t.feedback.settings}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-th-surface-hover">
            <X size={16} className="text-th-text-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
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
                <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2 space-y-2">
                  <p className="text-[11px] text-red-300">{t.feedback.notificationDenied}</p>
                  <ul className="space-y-1">
                    {permissionGuide.map((line) => (
                      <li key={line} className="text-[11px] text-red-200/85">{`- ${line}`}</li>
                    ))}
                  </ul>
                  <button
                    onClick={requestPermission}
                    className="w-full py-2 rounded-lg bg-red-500/15 text-red-200 text-[12px] font-semibold hover:bg-red-500/25 transition-colors"
                  >
                    {language === 'ko' ? '권한 다시 요청' : 'Request permission again'}
                  </button>
                </div>
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

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun size={14} className="text-amber-500" />
              <span className="text-[13px] font-semibold text-th-text-secondary">
                {t.feedback.morningAlarm}
              </span>
            </div>
            <p className="text-[11px] text-th-text-tertiary">{t.feedback.morningDesc}</p>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <select
                value={morningTime.hh}
                onChange={(e) => updateTimePart('morningTime', 'hh', e.target.value)}
                className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
              >
                {HOURS.map((hour) => (
                  <option key={`morning-hh-${hour}`} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="text-th-text-secondary font-semibold">:</span>
              <select
                value={morningTime.mm}
                onChange={(e) => updateTimePart('morningTime', 'mm', e.target.value)}
                className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
              >
                {MINUTES.map((minute) => (
                  <option key={`morning-mm-${minute}`} value={minute}>{minute}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-th-text-tertiary">
              {toDisplayTime(settings.morningTime, language)}
            </p>

            <label className="flex items-center justify-between cursor-pointer rounded-xl border border-th-border px-3 py-2.5">
              <span className="text-[12px] text-th-text-secondary font-medium">
                {language === 'ko' ? '알림 활성화' : 'Enable reminder'}
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
            <p className="text-[11px] text-th-text-tertiary">
              {settings.morningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
            </p>
          </div>

          <div className="border-t border-th-border/50" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-indigo-500" />
              <span className="text-[13px] font-semibold text-th-text-secondary">
                {t.feedback.eveningAlarm}
              </span>
            </div>
            <p className="text-[11px] text-th-text-tertiary">{t.feedback.eveningDesc}</p>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <select
                value={eveningTime.hh}
                onChange={(e) => updateTimePart('eveningTime', 'hh', e.target.value)}
                className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
              >
                {HOURS.map((hour) => (
                  <option key={`evening-hh-${hour}`} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="text-th-text-secondary font-semibold">:</span>
              <select
                value={eveningTime.mm}
                onChange={(e) => updateTimePart('eveningTime', 'mm', e.target.value)}
                className="w-full bg-th-surface border border-th-border rounded-xl px-3 py-2.5 text-[13px] text-th-text-secondary focus:outline-none focus:border-th-accent/50 appearance-none"
              >
                {MINUTES.map((minute) => (
                  <option key={`evening-mm-${minute}`} value={minute}>{minute}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-th-text-tertiary">
              {toDisplayTime(settings.eveningTime, language)}
            </p>

            <label className="flex items-center justify-between cursor-pointer rounded-xl border border-th-border px-3 py-2.5">
              <span className="text-[12px] text-th-text-secondary font-medium">
                {language === 'ko' ? '알림 활성화' : 'Enable reminder'}
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
            <p className="text-[11px] text-th-text-tertiary">
              {settings.eveningEnabled ? t.feedback.alarmOn : t.feedback.alarmOff}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleManualSave}
              disabled={isSaving || !userId}
              className="w-full py-2.5 rounded-xl bg-th-accent text-th-text-inverse text-[13px] font-semibold disabled:opacity-60"
            >
              {isSaving
                ? (language === 'ko' ? '저장 중...' : 'Saving...')
                : t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


