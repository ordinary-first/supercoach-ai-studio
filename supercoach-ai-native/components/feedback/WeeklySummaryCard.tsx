import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { RefreshCw, Trophy } from 'lucide-react-native';
import { getWeekLabel } from '../../shared/feedbackDateUtils';
import type { FeedbackCard } from '../../shared/types';
import type { TranslationStrings } from '../../shared/i18n/types';

interface WeeklySummaryCardProps {
  weekStart: Date;
  weekCards: FeedbackCard[];
  summaryText: string;
  isGenerating: boolean;
  t: TranslationStrings;
  onGenerate: () => void;
}

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({
  weekStart,
  weekCards,
  summaryText,
  isGenerating,
  t,
  onGenerate,
}) => {
  const label = `${t.feedback.weeklyTitle} -- ${getWeekLabel(weekStart, t)}`;

  const allCompleted = weekCards.flatMap((card) => card.completedTodos);
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  const topItems = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hasContent = topItems.length > 0 || Boolean(summaryText);

  // Simple bar chart
  const maxCount = topItems.length > 0 ? topItems[0][1] : 1;

  return (
    <View className="rounded-2xl p-5 border border-white/10" style={{ backgroundColor: '#1A1F2E' }}>
      <Text className="text-[13px] font-semibold text-white mb-4">{label}</Text>

      {!hasContent ? (
        <View className="items-center py-4">
          <Text className="text-[12px] text-gray-500 mb-3">
            {t.feedback.emptyRecord}
          </Text>
          <Pressable
            onPress={onGenerate}
            disabled={isGenerating}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-accent/10"
            style={{ opacity: isGenerating ? 0.5 : 1 }}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#71B7FF" />
            ) : (
              <RefreshCw size={12} color="#71B7FF" />
            )}
            <Text className="text-accent text-[12px] font-semibold">
              {isGenerating ? t.feedback.generating : t.feedback.generateWeekly}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text className="text-[11px] text-gray-500 mb-2">
            {t.feedback.weeklyCompleted}
          </Text>

          {/* Bar chart using Views */}
          <View className="gap-2 mb-4">
            {topItems.map(([item, count], i) => (
              <View key={i}>
                <View className="flex-row items-center gap-2 mb-1">
                  <Trophy size={10} color="#22c55e" />
                  <Text className="text-[12px] text-white flex-1" numberOfLines={1}>
                    {item}
                    {count > 1 ? ` x${count}` : ''}
                  </Text>
                </View>
                <View className="h-1.5 rounded-full bg-white/10">
                  <View
                    className="h-1.5 rounded-full bg-accent"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </View>
              </View>
            ))}
          </View>

          {summaryText ? (
            <View className="border-t border-white/10 pt-3">
              <Text className="text-[12px] text-gray-400 italic leading-relaxed">
                "{summaryText}"
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onGenerate}
              disabled={isGenerating}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 self-start"
              style={{ opacity: isGenerating ? 0.5 : 1 }}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#71B7FF" />
              ) : (
                <RefreshCw size={11} color="#71B7FF" />
              )}
              <Text className="text-accent text-[11px] font-semibold">
                {isGenerating ? t.feedback.generating : t.feedback.generateWeekly}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};
