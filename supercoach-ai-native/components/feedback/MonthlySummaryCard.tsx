import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import type { FeedbackCard } from '../../shared/types';
import type { TranslationStrings } from '../../shared/i18n/types';

interface MonthlySummaryCardProps {
  month: number;
  year: number;
  monthCards: FeedbackCard[];
  summaryText: string;
  isGenerating: boolean;
  t: TranslationStrings;
  onGenerate: () => void;
}

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = ({
  month,
  monthCards,
  summaryText,
  isGenerating,
  t,
  onGenerate,
}) => {
  const label = `${t.feedback.monthlyTitle} -- ${month}월`;

  const allCompleted = monthCards.flatMap((card) => card.completedTodos);
  const countMap = new Map<string, number>();
  allCompleted.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  const topItems = [...countMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const hasContent = topItems.length > 0 || Boolean(summaryText);

  // Stats
  const totalCompleted = allCompleted.length;
  const totalIncomplete = monthCards.reduce((sum, c) => sum + c.incompleteTodos.length, 0);
  const totalAll = totalCompleted + totalIncomplete;
  const overallRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;

  return (
    <View className="rounded-2xl p-5 border border-white/10" style={{ backgroundColor: '#1A1F2E' }}>
      <View className="flex-row items-center gap-2 mb-4">
        <Sparkles size={14} color="#71B7FF" />
        <Text className="text-[13px] font-semibold text-white">{label}</Text>
      </View>

      {/* Key metrics */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 items-center py-2 rounded-xl bg-white/5">
          <Text className="text-[18px] font-bold text-accent">{overallRate}%</Text>
          <Text className="text-[10px] text-gray-500">Completion</Text>
        </View>
        <View className="flex-1 items-center py-2 rounded-xl bg-white/5">
          <Text className="text-[18px] font-bold text-white">{totalCompleted}</Text>
          <Text className="text-[10px] text-gray-500">Done</Text>
        </View>
        <View className="flex-1 items-center py-2 rounded-xl bg-white/5">
          <Text className="text-[18px] font-bold text-gray-400">{monthCards.length}</Text>
          <Text className="text-[10px] text-gray-500">Days</Text>
        </View>
      </View>

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
              {isGenerating ? t.feedback.generating : t.feedback.generateMonthly}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text className="text-[11px] text-gray-500 mb-2">
            {t.feedback.monthlyCompleted}
          </Text>
          <View className="gap-1.5 mb-4">
            {topItems.map(([item, count], i) => (
              <View key={i} className="flex-row items-start gap-2">
                <Sparkles size={10} color="#22c55e" />
                <Text className="text-[12px] text-white flex-1">
                  {item}
                  {count > 1 ? ` x${count}` : ''}
                </Text>
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
                {isGenerating ? t.feedback.generating : t.feedback.generateMonthly}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};
