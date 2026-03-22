import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { getWeekLabel } from '../../shared/feedbackDateUtils';
import { CompletionRing } from './CompletionRing';
import { AnimatedBar } from './AnimatedBar';
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
  const label = `${t.feedback.weeklyTitle} — ${getWeekLabel(weekStart, t)}`;

  // Compute stats
  const allCompleted = weekCards.flatMap((card) => card.completedTodos);
  const allIncomplete = weekCards.flatMap((card) => card.incompleteTodos);
  const totalTasks = allCompleted.length + allIncomplete.length;
  const completionRate = totalTasks > 0 ? Math.round((allCompleted.length / totalTasks) * 100) : 0;

  // Top repeated completions
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });
  const topItems = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCount = topItems.length > 0 ? topItems[0][1] : 1;

  const hasContent = topItems.length > 0 || Boolean(summaryText);

  // Ring color based on rate
  const ringColor = completionRate >= 80 ? '#22c55e' : completionRate >= 50 ? '#eab308' : '#ef4444';

  return (
    <View className="rounded-2xl p-5 border border-white/10" style={{ backgroundColor: '#1A1F2E' }}>
      <Text className="text-[13px] font-semibold text-white mb-4">{label}</Text>

      {!hasContent ? (
        <View className="items-center py-4">
          <Text className="text-[12px] text-neutral-500 mb-3">
            {t.feedback.emptyRecord}
          </Text>
          <Pressable
            onPress={onGenerate}
            disabled={isGenerating}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-[#71B7FF]/10"
            style={{ opacity: isGenerating ? 0.5 : 1 }}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#71B7FF" />
            ) : (
              <RefreshCw size={12} color="#71B7FF" />
            )}
            <Text className="text-[#71B7FF] text-[12px] font-semibold">
              {isGenerating ? t.feedback.generating : t.feedback.generateWeekly}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Stats row: completion ring + numbers */}
          <View className="flex-row items-center gap-5 mb-5">
            <CompletionRing
              percentage={completionRate}
              size={72}
              strokeWidth={5}
              color={ringColor}
              delay={200}
            />
            <View className="flex-1 gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-neutral-400">Completed</Text>
                <Text className="text-[13px] font-bold text-emerald-400">{allCompleted.length}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-neutral-400">Incomplete</Text>
                <Text className="text-[13px] font-bold text-red-400">{allIncomplete.length}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-neutral-400">Days tracked</Text>
                <Text className="text-[13px] font-bold text-white">{weekCards.length}/7</Text>
              </View>
            </View>
          </View>

          {/* Animated bar chart */}
          {topItems.length > 0 && (
            <View className="mb-4">
              <Text className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-3">
                {t.feedback.weeklyCompleted}
              </Text>
              {topItems.map(([item, count], i) => (
                <AnimatedBar
                  key={i}
                  ratio={count / maxCount}
                  label={item}
                  count={count}
                  index={i}
                />
              ))}
            </View>
          )}

          {/* AI Summary */}
          {summaryText ? (
            <View className="border-t border-white/5 pt-3">
              <Text className="text-[12px] text-neutral-400 italic leading-relaxed">
                "{summaryText}"
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={onGenerate}
              disabled={isGenerating}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#71B7FF]/10 self-start"
              style={{ opacity: isGenerating ? 0.5 : 1 }}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#71B7FF" />
              ) : (
                <RefreshCw size={11} color="#71B7FF" />
              )}
              <Text className="text-[#71B7FF] text-[11px] font-semibold">
                {isGenerating ? t.feedback.generating : t.feedback.generateWeekly}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};
