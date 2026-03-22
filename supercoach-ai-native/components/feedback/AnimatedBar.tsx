import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

interface AnimatedBarProps {
  /** 0-1 ratio of max */
  ratio: number;
  label: string;
  count: number;
  index: number;
  color?: string;
}

export const AnimatedBar: React.FC<AnimatedBarProps> = ({
  ratio,
  label,
  count,
  index,
  color = '#71B7FF',
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      200 + index * 80,
      withSpring(1, { damping: 14, stiffness: 80 }),
    );
  }, [index]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, ratio * 100])}%`,
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 1, 1]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
  }));

  return (
    <View className="mb-2.5">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-[11px] text-neutral-300 flex-1 mr-2" numberOfLines={1}>
          {label}
        </Text>
        <Animated.View style={textStyle}>
          <Text className="text-[10px] text-neutral-500 font-mono">
            x{count}
          </Text>
        </Animated.View>
      </View>
      <View className="h-2 rounded-full bg-white/5">
        <Animated.View
          style={[
            barStyle,
            {
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
};
