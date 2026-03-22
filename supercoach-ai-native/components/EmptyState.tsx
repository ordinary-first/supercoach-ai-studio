import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import {
  Inbox,
  Target,
  CalendarX,
  MessageCircle,
  ListTodo,
  AlertTriangle,
  WifiOff,
  RefreshCw,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type EmptyVariant = 'goals' | 'todo' | 'calendar' | 'feedback' | 'chat' | 'generic';
type ErrorVariant = 'network' | 'server' | 'generic';

interface EmptyStateProps {
  variant?: EmptyVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ErrorStateProps {
  variant?: ErrorVariant;
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const VARIANT_ICONS: Record<EmptyVariant, LucideIcon> = {
  goals: Target,
  todo: ListTodo,
  calendar: CalendarX,
  feedback: MessageCircle,
  chat: MessageCircle,
  generic: Inbox,
};

const ERROR_ICONS: Record<ErrorVariant, LucideIcon> = {
  network: WifiOff,
  server: AlertTriangle,
  generic: AlertTriangle,
};

const ACCENT = '#71B7FF';

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'generic',
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const iconProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);

  useEffect(() => {
    iconProgress.value = withSpring(1, { damping: 12, stiffness: 80 });
    textProgress.value = withDelay(200, withSpring(1, { damping: 14, stiffness: 90 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(iconProgress.value, [0, 1], [0, 1]),
    transform: [
      { scale: interpolate(iconProgress.value, [0, 1], [0.5, 1]) },
      { translateY: interpolate(iconProgress.value, [0, 1], [10, 0]) },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(textProgress.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [8, 0]) }],
  }));

  const Icon = VARIANT_ICONS[variant];

  return (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <Animated.View style={iconStyle}>
        <View
          className="w-20 h-20 rounded-2xl items-center justify-center mb-5"
          style={{ backgroundColor: 'rgba(113,183,255,0.08)' }}
        >
          <Icon size={32} color={ACCENT} />
        </View>
      </Animated.View>

      <Animated.View style={textStyle} className="items-center">
        <Text className="text-white text-base font-semibold text-center mb-2">
          {title}
        </Text>
        {description && (
          <Text className="text-neutral-400 text-sm text-center leading-5 max-w-[280px]">
            {description}
          </Text>
        )}
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            activeOpacity={0.8}
            className="mt-5 px-6 py-2.5 rounded-full bg-[#71B7FF]/15 border border-[#71B7FF]/30"
          >
            <Text className="text-[#71B7FF] text-sm font-semibold">{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  variant = 'generic',
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, { damping: 14, stiffness: 90 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1]) }],
  }));

  const Icon = ERROR_ICONS[variant];
  const iconColor = variant === 'network' ? '#F59E0B' : '#EF4444';

  return (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <Animated.View style={animStyle} className="items-center">
        <View
          className="w-20 h-20 rounded-2xl items-center justify-center mb-5"
          style={{ backgroundColor: variant === 'network' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)' }}
        >
          <Icon size={32} color={iconColor} />
        </View>

        <Text className="text-white text-base font-semibold text-center mb-2">
          {title}
        </Text>
        {description && (
          <Text className="text-neutral-400 text-sm text-center leading-5 max-w-[280px]">
            {description}
          </Text>
        )}
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            activeOpacity={0.8}
            className="mt-5 flex-row items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 border border-white/10"
          >
            <RefreshCw size={14} color="#fff" />
            <Text className="text-white text-sm font-semibold">{retryLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};
