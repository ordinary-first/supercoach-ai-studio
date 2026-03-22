import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  Extrapolation,
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import { Check } from 'lucide-react-native';
import { toDateKey, getWeekLabel } from '../../shared/feedbackDateUtils';
import type { FeedbackCard, ToDoItem } from '../../shared/types';
import type { TranslationStrings } from '../../shared/i18n/types';

interface WeekCoverFlowProps {
  weeks: Date[];
  activeIndex: number;
  todos: ToDoItem[];
  feedbackCards: Map<string, FeedbackCard>;
  t: TranslationStrings;
  onIndexChange: (index: number) => void;
  onDayTap: (date: Date) => void;
  onWeekTap: (weekIndex: number) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = 200;

interface WeekCardData {
  weekStart: Date;
  originalIndex: number;
  label: string;
  range: string;
  completedCount: number;
  totalCount: number;
  topItems: string[];
}

const AnimatedCard: React.FC<{
  data: WeekCardData;
  animationValue: Animated.SharedValue<number>;
  onPress: () => void;
}> = ({ data, animationValue, onPress }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [0.85, 1, 0.85],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [0.5, 1, 0.5],
      Extrapolation.CLAMP,
    );
    const rotateY = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [15, 0, -15],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      animationValue.value,
      [-1, 0, 1],
      [20, 0, 20],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { perspective: 800 },
        { scale },
        { rotateY: `${rotateY}deg` },
        { translateY },
      ],
      opacity,
    };
  });

  const rate = data.totalCount > 0 ? data.completedCount / data.totalCount : 0;
  const barWidth = Math.round(rate * 100);

  return (
    <Animated.View style={[{ width: CARD_WIDTH, height: CARD_HEIGHT }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        className="flex-1 rounded-2xl p-5 border border-white/10"
        style={{ backgroundColor: '#1A1F2E' }}
      >
        <Text className="text-[15px] font-semibold text-white mb-1">
          {data.label}
        </Text>
        <Text className="text-[11px] text-gray-400 mb-3">{data.range}</Text>

        {/* Completion bar */}
        <View className="h-2 rounded-full bg-white/10 mb-3">
          <View
            className="h-2 rounded-full"
            style={{
              width: `${barWidth}%`,
              backgroundColor: rate >= 0.8 ? '#22c55e' : rate >= 0.5 ? '#eab308' : '#ef4444',
            }}
          />
        </View>
        <Text className="text-[10px] text-gray-500 mb-2">
          {data.completedCount}/{data.totalCount} completed
        </Text>

        <View className="flex-1 gap-1">
          {data.topItems.slice(0, 3).map((item, i) => (
            <View key={i} className="flex-row items-center gap-1.5">
              <Check size={10} color="#22c55e" />
              <Text className="text-[11px] text-gray-300 flex-1" numberOfLines={1}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export const WeekCoverFlow: React.FC<WeekCoverFlowProps> = ({
  weeks,
  activeIndex,
  todos,
  feedbackCards,
  t,
  onIndexChange,
  onDayTap,
  onWeekTap,
}) => {
  const cardData: WeekCardData[] = useMemo(() => {
    return weeks.map((weekStart, idx) => {
      const label = getWeekLabel(weekStart, t);

      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      const range = `${weekStart.getMonth() + 1}.${weekStart.getDate()} - ${endDate.getMonth() + 1}.${endDate.getDate()}`;

      let completedCount = 0;
      let totalCount = 0;
      const topItems: string[] = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const card = feedbackCards.get(toDateKey(d));
        if (card) {
          completedCount += card.completedTodos.length;
          totalCount += card.completedTodos.length + card.incompleteTodos.length;
          topItems.push(...card.completedTodos);
        }
      }

      return {
        weekStart,
        originalIndex: idx,
        label,
        range,
        completedCount,
        totalCount,
        topItems: topItems.slice(0, 5),
      };
    });
  }, [weeks, feedbackCards, t]);

  const handleSnapToItem = useCallback(
    (index: number) => {
      onIndexChange(index);
    },
    [onIndexChange],
  );

  return (
    <View className="flex-1 items-center justify-center">
      <Carousel
        data={cardData}
        width={CARD_WIDTH + 16}
        height={CARD_HEIGHT + 20}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.6 }}
        mode="parallax"
        modeConfig={{
          parallaxScrollingScale: 0.85,
          parallaxScrollingOffset: 60,
          parallaxAdjacentItemScale: 0.75,
        }}
        defaultIndex={activeIndex}
        onSnapToItem={handleSnapToItem}
        renderItem={({ item, animationValue }) => (
          <AnimatedCard
            data={item}
            animationValue={animationValue}
            onPress={() => onWeekTap(item.originalIndex)}
          />
        )}
      />
    </View>
  );
};
