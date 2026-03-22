import React, { useEffect } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shimmer skeleton placeholder with pulse animation */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        animStyle,
        style,
      ]}
    />
  );
};

/** Skeleton for a todo item row */
export const TodoSkeleton: React.FC = () => (
  <View className="flex-row items-center gap-3 px-4 py-3 mx-3 mb-2 rounded-2xl border border-white/5"
    style={{ backgroundColor: 'rgba(26,31,46,0.5)' }}>
    <Skeleton width={24} height={24} borderRadius={12} />
    <View className="flex-1 gap-2">
      <Skeleton width="75%" height={14} />
      <View className="flex-row gap-2">
        <Skeleton width={60} height={10} borderRadius={10} />
        <Skeleton width={40} height={10} borderRadius={10} />
      </View>
    </View>
  </View>
);

/** Skeleton for vision board grid */
export const VisionBoardSkeleton: React.FC<{ cellSize: number }> = ({ cellSize }) => (
  <View className="flex-row flex-wrap px-4 pt-4" style={{ gap: 8 }}>
    {Array.from({ length: 9 }).map((_, i) => (
      <Skeleton key={i} width={cellSize} height={cellSize} borderRadius={16} />
    ))}
  </View>
);

/** Skeleton for calendar month grid */
export const CalendarSkeleton: React.FC = () => (
  <View className="px-2 pt-2">
    {/* Day names row */}
    <View className="flex-row justify-around mb-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} width={28} height={12} />
      ))}
    </View>
    {/* Grid rows */}
    {Array.from({ length: 5 }).map((_, row) => (
      <View key={row} className="flex-row justify-around mb-3">
        {Array.from({ length: 7 }).map((_, col) => (
          <Skeleton key={col} width={36} height={48} borderRadius={8} />
        ))}
      </View>
    ))}
  </View>
);

/** Skeleton for feedback day cards */
export const FeedbackSkeleton: React.FC = () => (
  <View className="px-4 gap-3 pt-4">
    <View className="flex-row gap-3">
      <Skeleton width={146} height={186} borderRadius={20} />
      <Skeleton width={146} height={186} borderRadius={20} />
    </View>
    <Skeleton width="100%" height={120} borderRadius={16} />
    <Skeleton width="100%" height={80} borderRadius={16} />
  </View>
);

/** Skeleton for settings page */
export const SettingsSkeleton: React.FC = () => (
  <View className="px-4 pt-6 gap-4">
    {/* Avatar */}
    <View className="items-center mb-4">
      <Skeleton width={72} height={72} borderRadius={36} />
      <Skeleton width={120} height={16} borderRadius={8} style={{ marginTop: 12 }} />
    </View>
    {/* Sections */}
    {Array.from({ length: 4 }).map((_, i) => (
      <View key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(26,31,46,0.5)' }}>
        <View className="px-4 py-3 gap-3">
          <Skeleton width="40%" height={12} />
          <Skeleton width="100%" height={40} borderRadius={10} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </View>
      </View>
    ))}
  </View>
);

/** Full-screen loading skeleton with app branding */
export const AppLoadingSkeleton: React.FC = () => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.4, 1]),
  }));

  return (
    <View className="flex-1 bg-[#0A0E1A] items-center justify-center">
      <Animated.View style={logoStyle}>
        <View className="items-center">
          <View className="w-16 h-16 rounded-full border-2 border-[#71B7FF]/30 items-center justify-center"
            style={{ backgroundColor: 'rgba(113,183,255,0.06)' }}>
            <Skeleton width={28} height={28} borderRadius={6} />
          </View>
          <Skeleton width={160} height={20} borderRadius={8} style={{ marginTop: 16 }} />
          <Skeleton width={100} height={10} borderRadius={6} style={{ marginTop: 8 }} />
        </View>
      </Animated.View>
    </View>
  );
};
