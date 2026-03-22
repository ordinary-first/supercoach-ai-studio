import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTranslation } from '../../shared/i18n/useTranslation';

export default function VisualizeScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-[#0A0E1A] items-center justify-center px-8">
      <Sparkles color="#71B7FF" size={48} />
      <Text className="text-white text-xl font-bold mt-4">
        {t.visualization.title}
      </Text>
      <Text className="text-neutral-400 text-sm text-center mt-2">
        Coming Soon
      </Text>
    </View>
  );
}
