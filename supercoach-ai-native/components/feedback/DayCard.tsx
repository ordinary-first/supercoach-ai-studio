import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, MessageCircle, Sprout } from 'lucide-react-native';
import { formatDayLabel, formatDateShort } from '../../shared/feedbackDateUtils';
import type { FeedbackCard } from '../../shared/types';
import type { TranslationStrings } from '../../shared/i18n/types';

export type DayCardState = 'completed' | 'today-pending' | 'future' | 'empty-past';

interface DayCardProps {
  date: Date;
  state: DayCardState;
  card: FeedbackCard | null;
  t: TranslationStrings;
  onTap: () => void;
}

const getCompletionColor = (rate: number): string => {
  if (rate >= 0.8) return '#22c55e';
  if (rate >= 0.5) return '#eab308';
  return '#ef4444';
};

export const DayCard: React.FC<DayCardProps> = ({ date, state, card, t, onTap }) => {
  const dayLabel = formatDayLabel(date, t);
  const dateShort = formatDateShort(date);

  if (state === 'future') {
    return (
      <Pressable
        onPress={onTap}
        className="w-[146px] h-[186px] rounded-[20px] px-3.5 py-3 bg-surface/30 border border-white/5"
      >
        <Text className="text-[11px] text-gray-400 font-medium">
          {dayLabel} <Text className="text-gray-500">{dateShort}</Text>
        </Text>
      </Pressable>
    );
  }

  if (state === 'today-pending') {
    return (
      <Pressable
        onPress={onTap}
        className="w-[146px] h-[186px] rounded-[20px] px-3.5 py-3 bg-accent/10 border border-accent/20"
      >
        <Text className="text-[11px] text-white font-semibold">
          {t.feedback.today}
        </Text>
        <View className="flex-1 items-center justify-center">
          <Text className="text-[11px] text-gray-400 text-center leading-relaxed">
            {t.feedback.todayPending}
          </Text>
          <View className="flex-row gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent/60"
              />
            ))}
          </View>
        </View>
      </Pressable>
    );
  }

  if (state === 'empty-past') {
    return (
      <Pressable
        onPress={onTap}
        className="w-[146px] h-[186px] rounded-[20px] px-3.5 py-3 bg-surface/30 border border-white/5"
      >
        <Text className="text-[11px] text-gray-400 font-medium">
          {dayLabel} <Text className="text-gray-500">{dateShort}</Text>
        </Text>
        <View className="flex-1 items-center justify-center">
          <Sprout size={16} color="#555" />
          <Text className="text-[10px] text-gray-600 text-center mt-1.5">
            {t.feedback.emptyRecord}
          </Text>
        </View>
      </Pressable>
    );
  }

  // completed state
  const completed = card?.completedTodos ?? [];
  const incomplete = card?.incompleteTodos ?? [];
  const total = completed.length + incomplete.length;
  const rate = total > 0 ? completed.length / total : 0;
  const visibleItems = completed.slice(0, 3);

  return (
    <Pressable
      onPress={onTap}
      className="w-[146px] h-[186px] rounded-[20px] px-3.5 py-3 border border-white/5"
      style={{ backgroundColor: `${getCompletionColor(rate)}10` }}
    >
      <Text className="text-[11px] text-white font-semibold mb-1.5">
        {dayLabel} <Text className="text-gray-400">{dateShort}</Text>
      </Text>

      <View className="flex-1 gap-1">
        {visibleItems.map((item, i) => (
          <View key={i} className="flex-row items-start gap-1.5">
            <Check size={10} color="#22c55e" />
            <Text className="text-[11px] text-white leading-tight flex-1" numberOfLines={1}>
              {item}
            </Text>
          </View>
        ))}
        {completed.length > 3 && (
          <Text className="text-[10px] text-gray-500">
            +{completed.length - 3}
          </Text>
        )}
      </View>

      {card?.coachComment ? (
        <View className="mt-auto pt-1.5 border-t border-white/10">
          <View className="flex-row items-start gap-1">
            <MessageCircle size={10} color="#666" />
            <Text className="text-[10px] text-gray-400 italic leading-tight flex-1" numberOfLines={2}>
              {card.coachComment}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
};
