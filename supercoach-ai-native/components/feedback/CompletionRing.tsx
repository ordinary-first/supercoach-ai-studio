import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CompletionRingProps {
  /** 0-100 */
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  delay?: number;
  label?: string;
  sublabel?: string;
}

export const CompletionRing: React.FC<CompletionRingProps> = ({
  percentage,
  size = 80,
  strokeWidth = 6,
  color = '#71B7FF',
  bgColor = 'rgba(255,255,255,0.08)',
  delay = 0,
  label,
  sublabel,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(percentage / 100, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [percentage, delay]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View className="items-center">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress arc */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        {/* Center text */}
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-white font-bold" style={{ fontSize: size * 0.22 }}>
            {Math.round(percentage)}%
          </Text>
        </View>
      </View>
      {label && (
        <Text className="text-[10px] text-neutral-400 font-medium mt-1.5">{label}</Text>
      )}
      {sublabel && (
        <Text className="text-[9px] text-neutral-500 mt-0.5">{sublabel}</Text>
      )}
    </View>
  );
};
