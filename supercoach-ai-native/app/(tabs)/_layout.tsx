import { Tabs } from 'expo-router';
import {
  BarChart3,
  Calendar,
  Eye,
  ListChecks,
  Target,
} from 'lucide-react-native';
import React from 'react';

import { useTheme } from '../../shared/state/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 86,
          paddingTop: 8,
          paddingBottom: 18,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderColor: colors.border,
          borderWidth: 1,
          shadowColor: colors.accent,
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16,
        },
        tabBarItemStyle: {
          borderRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.subtle,
      }}
    >
      <Tabs.Screen
        name="goals"
        options={{
          title: '목표',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '일정',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: '할 일',
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="visualize"
        options={{
          title: '시각화',
          tabBarIcon: ({ color, size }) => <Eye color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: '피드백',
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
