import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from '../shared/i18n/useTranslation';

export default function CoachChatScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-white text-xl font-bold">{t.coach.title}</Text>
    </View>
  );
}
