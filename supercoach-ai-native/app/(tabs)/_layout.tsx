import React from 'react';
import { Tabs } from 'expo-router';
import {
  Target,
  Calendar,
  CheckSquare,
  Sparkles,
  MessageSquare,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../shared/i18n/useTranslation';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0E1A',
          borderTopColor: '#1A1F2E',
        },
        tabBarActiveTintColor: '#71B7FF',
        tabBarInactiveTintColor: '#6B7280',
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="goals"
        options={{
          title: t.nav.goals,
          tabBarIcon: ({ color, size }) => (
            <Target color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t.nav.calendar,
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: t.nav.todo,
          tabBarIcon: ({ color, size }) => (
            <CheckSquare color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="visualize"
        options={{
          title: t.nav.visualize,
          tabBarIcon: ({ color, size }) => (
            <Sparkles color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: t.nav.feedback,
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
