import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react';
import { X, Sun, Moon, Bell, BellOff } from 'lucide-react';
import type { TranslationStrings } from '../../i18n/types';
import type { NotificationSettings } from '../../types';
import {
  loadNotificationSettings,
  saveNotificationSettings,
} from '../../services/firebaseService';
import { registerFcmToken } from '../../services/notificationService';
import {
  isNativeApp,
  registerNativePush,
  registerNativePushIfGranted,
} from '../../services/nativePush';

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

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const parseTime = (value: string, fallback: string): { hh: string; mm: string } => {
  const [rawHh, rawMm] = value.split(':');
  const [fallbackHh, fallbackMm] = fallback.split(':');
  const hh =
    /^\d{2}$/.test(rawHh || '') && Number(rawHh) >= 0 && Number(rawHh) <= 23
      ? rawHh
      : fallbackHh;
  const mm =
    /^\d{2}$/.test(rawMm || '') && Number(rawMm) >= 0 && Number(rawMm) <= 59
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
      ? ['브라우저 설정에서 이 사이트의 알림을 허용해주세요.']
      : ['Allow notifications for this site in browser settings.'];
  }
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (language === 'ko') {
    if (isIos) {
      return [
        'iPhone Safari: 설정 > Safari > 알림 허용',
        '또는 주소창 aA > 웹사이트 설정 > 알림 허용',
        '홈 화면에 추가(PWA) 후 다시 시도',
      ];
    }
    return [
      'Android Chrome: 주소창 자물쇠 아이콘 터치',
      '사이트 설정 > 알림 > 허용',
      '앱으로 돌아와서 저장 버튼 터치',
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

// ─── Wheel Picker ─────────────────────────────────────────────────────────────
//
// iOS drum-roll style scroll picker. Uses CSS scroll-snap for snapping.
// Selection indicator (pill) is always centered at index PAD.
// Opacity fades non-selected items to create the drum-roll depth illusion.

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 padding rows on each side

interface WheelPickerProps {
  items: string[];
  value: string;
  onChange: (val: string) => void;
}

const WheelPicker: React.FC<WheelPickerProps> = ({ items, value, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instant (no animation) scroll on mount so it never flashes from top
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // Smooth scroll when value is changed from outside (e.g. parent reset)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || settling.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) {
      settling.current = true;
      el.scrollTo({ top: target, behavior: 'smooth' });
      setTimeout(() => {
        settling.current = false;
      }, 350);
    }
  }, [value, items]);

  const commit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] !== value) onChange(items[clamped]);
  }, [items, value, onChange]);

  const handleScroll = useCallback(() => {
    if (settling.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(commit, 80);
  }, [commit]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const selIdx = items.indexOf(value);

  return (
    <div className="relative" style={{ width: 58, height: ITEM_H * VISIBLE }}>
      {/* Selection pill */}
      <div
        className="absolute left-0 right-0 rounded-xl bg-th-surface border border-th-border/80 pointer-events-none z-10"
        style={{ top: PAD * ITEM_H, height: ITEM_H }}
      />
      {/* Scrollable list */}
      <div
        ref={scrollRef}
        className="fb-wheel-scroll absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={handleScroll}
      >
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`pt${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
        {items.map((item, idx) => {
          const dist = Math.abs(idx - selIdx);
          let cls =
            'flex items-center justify-center font-mono font-bold transition-all duration-100 ';
          if (dist === 0) cls += 'text-th-text text-[22px]';
          else if (dist === 1) cls += 'text-th-text-secondary text-[17px] opacity-40';
          else cls += 'text-th-text-tertiary text-[13px] opacity-15';
          return (
            <div
              key={item}
              style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
              className={cls}
            >
              {item}
            </div>
          );
        })}
        {Array.from({ length: PAD }).map((_, i) => (
          <div key={`pb${i}`} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} />
        ))}
      </div>
    </div>
  );
};

// ─── Alarm Card ───────────────────────────────────────────────────────────────

interface AlarmCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  timeHh: string;
  timeMm: string;
  displayTime: string;
  onChangeHh: (v: string) => void;
  onChangeMm: (v: string) => void;
  accentTextClass: string;
  accentBorderClass: string;
  accentBgClass: string;
  accentIconBgClass: string;
  toggleBgClass: string;
  language: 'ko' | 'en';
}

const AlarmCard: React.FC<AlarmCardProps> = ({
  icon,
  title,
  desc,
  enabled,
  onToggle,
  timeHh,
  timeMm,
  displayTime,
  onChangeHh,
  onChangeMm,
  accentTextClass,
  accentBorderClass,
  accentBgClass,
  accentIconBgClass,
  toggleBgClass,
  language,
}) => (
  <div
    className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
      enabled ? `${accentBorderClass} ${accentBgClass}` : 'border-th-border bg-th-surface/20'
    }`}
  >
    {/* Card header: icon + title/desc + toggle */}
    <div className="flex items-start justify-between px-4 pt-4 pb-3">
      <div className="flex items-start gap-2.5">
        <div
          className={`p-1.5 rounded-lg mt-0.5 transition-colors ${
            enabled ? accentIconBgClass : 'bg-th-border/30'
          }`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-th-text leading-tight">{title}</p>
          <p className="text-[10px] text-th-text-tertiary leading-snug mt-0.5 max-w-[160px]">
            {desc}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 relative mt-0.5 ${
          enabled ? toggleBgClass : 'bg-th-border'
        }`}
        aria-label={enabled ? 'Disable reminder' : 'Enable reminder'}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>

    {/* Divider */}
    <div
      className={`mx-4 h-px transition-colors ${
        enabled ? `opacity-40 ${accentBorderClass}` : 'bg-th-border/40'
      }`}
    />

    {/* Wheel picker — always visible, dimmed when disabled */}
    <div
      className={`flex items-center justify-center gap-4 py-5 transition-opacity duration-300 ${
        enabled ? 'opacity-100' : 'opacity-35'
      }`}
      style={{ pointerEvents: enabled ? undefined : 'none' }}
    >
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] font-semibold text-th-text-tertiary uppercase tracking-widest">
          {language === 'ko' ? '시' : 'HR'}
        </span>
        <WheelPicker items={HOURS} value={timeHh} onChange={onChangeHh} />
      </div>
      <span
        className="text-[30px] font-bold text-th-text-secondary select-none"
        style={{ marginTop: 18 }}
      >
        :
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] font-semibold text-th-text-tertiary uppercase tracking-widest">
          {language === 'ko' ? '분' : 'MIN'}
        </span>
        <WheelPicker items={MINUTES} value={timeMm} onChange={onChangeMm} />
      </div>
    </div>

    {/* Friendly time display */}
    <p
      className={`text-center text-[12px] pb-4 font-medium transition-colors ${
        enabled ? accentTextClass : 'text-th-text-tertiary'
      }`}
    >
      {displayTime}
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const FeedbackSettingsSheet: React.FC<FeedbackSettingsSheetProps> = ({
  t,
  userId,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (next: NotificationSettings) => {
      onSettingsChange?.(next);
      if (!userId) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveNotificationSettings(userId, next);
      }, 500);
    },
    [userId, onSettingsChange],
  );

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
        setSettings({ ...DEFAULT_SETTINGS, timezone: getClientTimezone() });
      }
      setLoaded(true);
    });
  }, [userId]);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const syncPermission = () => {
      const browserPermission = Notification.permission as 'granted' | 'denied' | 'default';
      setSettings((prev) => {
        if (prev.notificationPermission === browserPermission) return prev;
        return {
          ...prev,
          notificationPermission: browserPermission,
          timezone: prev.timezone || getClientTimezone(),
          updatedAt: Date.now(),
        };
      });
    };
    syncPermission();
    document.addEventListener('visibilitychange', syncPermission);
    return () => document.removeEventListener('visibilitychange', syncPermission);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (isNativeApp()) {
      void registerNativePushIfGranted(userId);
      return;
    }
    if (settings.notificationPermission !== 'granted') return;
    registerFcmToken(userId);
  }, [settings.notificationPermission, userId]);

  const updateField = useCallback(
    <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value, updatedAt: Date.now() };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const handleManualSave = useCallback(async () => {
    if (!userId) return;
    const lang = t.common.today === '오늘' ? 'ko' : 'en';
    const next = {
      ...settings,
      timezone: settings.timezone || getClientTimezone(),
      updatedAt: Date.now(),
    };
    setSettings(next);
    onSettingsChange?.(next);
    setIsSaving(true);
    setSaveResult(null);
    clearTimeout(saveTimer.current);
    clearTimeout(confirmTimer.current);

    try {
      await saveNotificationSettings(userId, next);
    } catch {
      setSaveResult({
        ok: false,
        msg: lang === 'ko' ? '저장 실패. 다시 시도해주세요.' : 'Save failed. Please retry.',
      });
      setIsSaving(false);
      return;
    }

    if (!next.morningEnabled && !next.eveningEnabled) {
      setSaveResult({
        ok: true,
        msg: lang === 'ko' ? '✓ 설정이 저장되었습니다.' : '✓ Settings saved.',
      });
      confirmTimer.current = setTimeout(() => setSaveResult(null), 5000);
      setIsSaving(false);
      return;
    }

    if (isNativeApp()) {
      const nativeToken = await registerNativePush(userId);
      if (!nativeToken) {
        setSaveResult({
          ok: false,
          msg:
            lang === 'ko'
              ? '⚠ 앱 알림 권한이 허용되지 않았습니다. 휴대폰 설정 > 알림에서 허용해주세요.'
              : '⚠ App notifications not allowed. Enable them in your phone Settings > Notifications.',
        });
        setIsSaving(false);
        return;
      }
      const grantedSettings = {
        ...next,
        notificationPermission: 'granted' as const,
        updatedAt: Date.now(),
      };
      setSettings(grantedSettings);
      onSettingsChange?.(grantedSettings);
      await saveNotificationSettings(userId, grantedSettings);
    } else {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        updateField('notificationPermission', result as 'granted' | 'denied' | 'default');
        if (result !== 'granted') {
          setSaveResult({
            ok: false,
            msg:
              lang === 'ko'
                ? '⚠ 알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해주세요.'
                : '⚠ Notification permission not granted. Please allow in browser settings.',
          });
          setIsSaving(false);
          return;
        }
      }
      if (typeof Notification === 'undefined') {
        setSaveResult({
          ok: false,
          msg:
            lang === 'ko'
              ? '⚠ 이 브라우저에서는 알림이 지원되지 않습니다.'
              : '⚠ Notifications not supported in this browser.',
        });
        setIsSaving(false);
        return;
      }
      const token = await registerFcmToken(userId);
      if (!token) {
        setSaveResult({
          ok: false,
          msg:
            lang === 'ko'
              ? '⚠ 푸시 알림 등록에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.'
              : '⚠ Push registration failed. Please reload and retry.',
        });
        setIsSaving(false);
        return;
      }
    }

    const times: string[] = [];
    if (next.morningEnabled) times.push(toDisplayTime(next.morningTime, lang));
    if (next.eveningEnabled) times.push(toDisplayTime(next.eveningTime, lang));
    const timeStr = times.join(', ');
    const msg =
      lang === 'ko'
        ? `✓ 알림 설정 완료! ${timeStr}에 알림이 갑니다.`
        : `✓ Alarm set! You'll be notified at ${timeStr}.`;
    setSaveResult({ ok: true, msg });
    confirmTimer.current = setTimeout(() => setSaveResult(null), 8000);
    setIsSaving(false);
  }, [onSettingsChange, settings, userId, t, updateField]);

  const updateTimePart = useCallback(
    (key: 'morningTime' | 'eveningTime', part: 'hh' | 'mm', value: string) => {
      const current = settings[key];
      const parsed = parseTime(current, key === 'morningTime' ? '08:00' : '21:00');
      const next = part === 'hh' ? `${value}:${parsed.mm}` : `${parsed.hh}:${value}`;
      updateField(key, next);
    },
    [settings, updateField],
  );

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
      clearTimeout(confirmTimer.current);
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

      <div className="relative w-full max-w-lg bg-th-elevated rounded-t-3xl max-h-[82vh] flex flex-col animate-slide-up shadow-2xl border-t border-th-border mb-[60px]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-th-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-th-border/40">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-th-accent" />
            <h2 className="text-base font-bold text-th-text">{t.feedback.settings}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-th-surface-hover">
            <X size={16} className="text-th-text-tertiary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-4 space-y-4">
          {/* Permission banner */}
          {permStatus !== 'granted' && (
            <div className="space-y-2">
              {permStatus === 'denied' ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <BellOff size={13} className="text-red-400 flex-shrink-0" />
                    <p className="text-[11px] text-red-300">{t.feedback.notificationDenied}</p>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    {permissionGuide.map((line) => (
                      <li key={line} className="text-[11px] text-red-200/80 list-disc">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <button
                  onClick={requestPermission}
                  className="w-full py-2.5 rounded-xl bg-th-accent/10 text-th-accent text-[13px] font-semibold hover:bg-th-accent/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Bell size={13} />
                  {t.feedback.notificationRequest}
                </button>
              )}
            </div>
          )}

          {/* Morning alarm card */}
          <AlarmCard
            icon={
              <Sun
                size={14}
                className={settings.morningEnabled ? 'text-amber-400' : 'text-th-text-tertiary'}
              />
            }
            title={t.feedback.morningAlarm}
            desc={t.feedback.morningDesc}
            enabled={settings.morningEnabled}
            onToggle={() => updateField('morningEnabled', !settings.morningEnabled)}
            timeHh={morningTime.hh}
            timeMm={morningTime.mm}
            displayTime={toDisplayTime(settings.morningTime, language)}
            onChangeHh={(v) => updateTimePart('morningTime', 'hh', v)}
            onChangeMm={(v) => updateTimePart('morningTime', 'mm', v)}
            accentTextClass="text-amber-400/90"
            accentBorderClass="border-amber-500/25"
            accentBgClass="bg-amber-500/5"
            accentIconBgClass="bg-amber-500/15"
            toggleBgClass="bg-amber-500"
            language={language}
          />

          {/* Evening alarm card */}
          <AlarmCard
            icon={
              <Moon
                size={14}
                className={settings.eveningEnabled ? 'text-indigo-400' : 'text-th-text-tertiary'}
              />
            }
            title={t.feedback.eveningAlarm}
            desc={t.feedback.eveningDesc}
            enabled={settings.eveningEnabled}
            onToggle={() => updateField('eveningEnabled', !settings.eveningEnabled)}
            timeHh={eveningTime.hh}
            timeMm={eveningTime.mm}
            displayTime={toDisplayTime(settings.eveningTime, language)}
            onChangeHh={(v) => updateTimePart('eveningTime', 'hh', v)}
            onChangeMm={(v) => updateTimePart('eveningTime', 'mm', v)}
            accentTextClass="text-indigo-400/90"
            accentBorderClass="border-indigo-500/25"
            accentBgClass="bg-indigo-500/5"
            accentIconBgClass="bg-indigo-500/15"
            toggleBgClass="bg-indigo-500"
            language={language}
          />

          {/* Save button */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleManualSave}
              disabled={isSaving || !userId}
              className="w-full py-3 rounded-xl bg-th-accent text-th-text-inverse text-[13px] font-semibold disabled:opacity-60 transition-opacity"
            >
              {isSaving ? (language === 'ko' ? '저장 중...' : 'Saving...') : t.common.save}
            </button>
            {saveResult && (
              <p
                className={`text-[11px] text-center animate-fade-in ${
                  saveResult.ok ? 'text-th-accent' : 'text-red-400'
                }`}
              >
                {saveResult.msg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
