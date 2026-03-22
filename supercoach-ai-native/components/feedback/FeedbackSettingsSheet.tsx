import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { X, Sun, Moon, Bell, BellOff } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { getClientTimezone, parseTime, toDisplayTime } from '../../shared/feedbackDateUtils';
import type { TranslationStrings } from '../../shared/i18n/types';
import type { NotificationSettings } from '../../shared/types';

interface FeedbackSettingsSheetProps {
  t: TranslationStrings;
  userId: string | null;
  onClose: () => void;
  onSettingsChange?: (settings: NotificationSettings) => void;
}

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

const TimeSelector: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}> = ({ label, value, options, onChange }) => {
  const currentIdx = options.indexOf(value);

  return (
    <View className="items-center">
      <Text className="text-[10px] text-gray-500 mb-1">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => {
            const prev = currentIdx > 0 ? currentIdx - 1 : options.length - 1;
            onChange(options[prev]);
          }}
          className="w-8 h-8 items-center justify-center rounded-lg bg-white/5"
        >
          <Text className="text-white text-lg">-</Text>
        </Pressable>
        <Text className="text-white text-[18px] font-semibold w-10 text-center">{value}</Text>
        <Pressable
          onPress={() => {
            const next = currentIdx < options.length - 1 ? currentIdx + 1 : 0;
            onChange(options[next]);
          }}
          className="w-8 h-8 items-center justify-center rounded-lg bg-white/5"
        >
          <Text className="text-white text-lg">+</Text>
        </Pressable>
      </View>
    </View>
  );
};

const MINUTES_OPTIONS = ['00', '15', '30', '45'];

export const FeedbackSettingsSheet: React.FC<FeedbackSettingsSheetProps> = ({
  t,
  userId,
  onClose,
  onSettingsChange,
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const language = t.common.today === '오늘' ? 'ko' : 'en';

  const morningTime = useMemo(
    () => parseTime(settings.morningTime, DEFAULT_SETTINGS.morningTime),
    [settings.morningTime],
  );
  const eveningTime = useMemo(
    () => parseTime(settings.eveningTime, DEFAULT_SETTINGS.eveningTime),
    [settings.eveningTime],
  );

  const updateField = useCallback(<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value, updatedAt: Date.now() };
      onSettingsChange?.(next);
      return next;
    });
  }, [onSettingsChange]);

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
    const { status } = await Notifications.requestPermissionsAsync();
    const mapped = status === 'granted' ? 'granted' : 'denied';
    updateField('notificationPermission', mapped);
  }, [updateField]);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setIsSaving(true);
    setSaveResult(null);

    const next = {
      ...settings,
      timezone: settings.timezone || getClientTimezone(),
      updatedAt: Date.now(),
    };
    setSettings(next);
    onSettingsChange?.(next);

    // Check notification permission for enabled alarms
    if (next.morningEnabled || next.eveningEnabled) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          setSaveResult({
            ok: false,
            msg: language === 'ko'
              ? '알림 권한이 허용되지 않았습니다.'
              : 'Notification permission not granted.',
          });
          setIsSaving(false);
          return;
        }
      }
    }

    const times: string[] = [];
    if (next.morningEnabled) times.push(toDisplayTime(next.morningTime, language));
    if (next.eveningEnabled) times.push(toDisplayTime(next.eveningTime, language));
    const timeStr = times.join(', ');

    const msg = times.length > 0
      ? (language === 'ko'
        ? `설정 완료! ${timeStr}에 알림이 갑니다.`
        : `Settings saved! Notifications at ${timeStr}.`)
      : (language === 'ko' ? '설정이 저장되었습니다.' : 'Settings saved.');

    setSaveResult({ ok: true, msg });
    setIsSaving(false);
  }, [settings, userId, language, onSettingsChange]);

  const permStatus = settings.notificationPermission;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#1A1F2E' }}
      handleIndicatorStyle={{ backgroundColor: '#555', width: 40 }}
    >
      <BottomSheetView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/10">
          <Text className="text-base font-bold text-white">{t.feedback.settings}</Text>
          <Pressable onPress={onClose} className="p-2 rounded-full">
            <X size={16} color="#888" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40, gap: 24, paddingTop: 16 }}>
          {/* Permission banner */}
          {permStatus !== 'granted' && (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                {permStatus === 'denied' ? (
                  <BellOff size={14} color="#f87171" />
                ) : (
                  <Bell size={14} color="#71B7FF" />
                )}
                <Text className="text-[13px] font-semibold text-gray-400">
                  {t.feedback.notificationPermission}
                </Text>
              </View>
              {permStatus === 'denied' ? (
                <View className="rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2">
                  <Text className="text-[11px] text-red-300">
                    {t.feedback.notificationDenied}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={requestPermission}
                  className="w-full py-2.5 rounded-xl bg-accent/10 items-center"
                >
                  <Text className="text-accent text-[13px] font-semibold">
                    {t.feedback.notificationRequest}
                  </Text>
                </Pressable>
              )}
              <View className="border-t border-white/10 mt-2" />
            </View>
          )}

          {/* Morning */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Sun size={14} color="#f59e0b" />
              <Text className="text-[13px] font-semibold text-gray-400">
                {t.feedback.morningAlarm}
              </Text>
            </View>
            <Text className="text-[11px] text-gray-500">{t.feedback.morningDesc}</Text>

            <View className="flex-row justify-center gap-4">
              <TimeSelector
                label="Hour"
                value={morningTime.hh}
                options={HOURS}
                onChange={(v) => updateTimePart('morningTime', 'hh', v)}
              />
              <Text className="text-white text-[18px] font-semibold self-end mb-1">:</Text>
              <TimeSelector
                label="Min"
                value={morningTime.mm}
                options={MINUTES_OPTIONS}
                onChange={(v) => updateTimePart('morningTime', 'mm', v)}
              />
            </View>

            <Text className="text-[11px] text-gray-500 text-center">
              {toDisplayTime(settings.morningTime, language)}
            </Text>

            {/* Toggle */}
            <Pressable
              onPress={() => updateField('morningEnabled', !settings.morningEnabled)}
              className="flex-row items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"
            >
              <Text className="text-[12px] text-gray-400 font-medium">
                {language === 'ko' ? '알림 활성화' : 'Enable reminder'}
              </Text>
              <View
                className={`w-10 h-5 rounded-full ${settings.morningEnabled ? 'bg-accent' : 'bg-gray-600'}`}
              >
                <View
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                  style={{ left: settings.morningEnabled ? 22 : 2 }}
                />
              </View>
            </Pressable>
          </View>

          <View className="border-t border-white/10" />

          {/* Evening */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Moon size={14} color="#818cf8" />
              <Text className="text-[13px] font-semibold text-gray-400">
                {t.feedback.eveningAlarm}
              </Text>
            </View>
            <Text className="text-[11px] text-gray-500">{t.feedback.eveningDesc}</Text>

            <View className="flex-row justify-center gap-4">
              <TimeSelector
                label="Hour"
                value={eveningTime.hh}
                options={HOURS}
                onChange={(v) => updateTimePart('eveningTime', 'hh', v)}
              />
              <Text className="text-white text-[18px] font-semibold self-end mb-1">:</Text>
              <TimeSelector
                label="Min"
                value={eveningTime.mm}
                options={MINUTES_OPTIONS}
                onChange={(v) => updateTimePart('eveningTime', 'mm', v)}
              />
            </View>

            <Text className="text-[11px] text-gray-500 text-center">
              {toDisplayTime(settings.eveningTime, language)}
            </Text>

            <Pressable
              onPress={() => updateField('eveningEnabled', !settings.eveningEnabled)}
              className="flex-row items-center justify-between rounded-xl border border-white/10 px-3 py-2.5"
            >
              <Text className="text-[12px] text-gray-400 font-medium">
                {language === 'ko' ? '알림 활성화' : 'Enable reminder'}
              </Text>
              <View
                className={`w-10 h-5 rounded-full ${settings.eveningEnabled ? 'bg-accent' : 'bg-gray-600'}`}
              >
                <View
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                  style={{ left: settings.eveningEnabled ? 22 : 2 }}
                />
              </View>
            </Pressable>
          </View>

          {/* Save */}
          <View className="gap-2 pt-2">
            <Pressable
              onPress={handleSave}
              disabled={isSaving || !userId}
              className="w-full py-2.5 rounded-xl bg-accent items-center"
              style={{ opacity: isSaving || !userId ? 0.6 : 1 }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-[13px] font-semibold">
                  {t.common.save}
                </Text>
              )}
            </Pressable>
            {saveResult && (
              <Text
                className={`text-[11px] text-center ${saveResult.ok ? 'text-accent' : 'text-red-400'}`}
              >
                {saveResult.msg}
              </Text>
            )}
          </View>
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
};
