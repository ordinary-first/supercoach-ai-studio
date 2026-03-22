import React, { useState, useMemo, useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases from 'react-native-purchases';
import { LanguageContext } from '../shared/i18n/useTranslation';
import { getTranslations } from '../shared/i18n';
import type { AppLanguage } from '../shared/i18n';
import { REVENUECAT_API_KEY_IOS, REVENUECAT_API_KEY_ANDROID } from '../services/config';
import '../global.css';

export default function RootLayout() {
  const [language, setLanguage] = useState<AppLanguage>('ko');

  useEffect(() => {
    const apiKey = Platform.OS === 'ios'
      ? REVENUECAT_API_KEY_IOS
      : REVENUECAT_API_KEY_ANDROID;
    if (apiKey) {
      Purchases.configure({ apiKey });
    }
  }, []);

  const languageValue = useMemo(
    () => ({
      language,
      t: getTranslations(language),
      setLanguage,
    }),
    [language],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageContext.Provider value={languageValue}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0E1A' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(onboarding)/plan-selection" />
          <Stack.Screen
            name="coach-chat"
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="goal-detail"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </LanguageContext.Provider>
    </GestureHandlerRootView>
  );
}
