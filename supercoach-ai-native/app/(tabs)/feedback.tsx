import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import { useTodoStore } from '../../stores/useTodoStore';
import { DayCard } from '../../components/feedback/DayCard';
import type { DayCardState } from '../../components/feedback/DayCard';
import { WeekCoverFlow } from '../../components/feedback/WeekCoverFlow';
import { WeeklySummaryCard } from '../../components/feedback/WeeklySummaryCard';
import { MonthlySummaryCard } from '../../components/feedback/MonthlySummaryCard';
import { DayDetailSheet } from '../../components/feedback/DayDetailSheet';
import { FeedbackSettingsSheet } from '../../components/feedback/FeedbackSettingsSheet';
import {
  toDateKey,
  getMonday,
  addWeeks,
  isLastWeekOfMonth,
  getWeekLabel,
  getDayStart,
  getDayEnd,
} from '../../shared/feedbackDateUtils';
import { STUB_TRANSLATIONS } from '../../shared/stubTranslations';
import type { FeedbackCard, ToDoItem } from '../../shared/types';

const MAX_PAST_WEEKS = 52;

type ViewTab = 'daily' | 'weekly' | 'monthly';

const deriveFeedbackCardFromTodos = (
  todos: ToDoItem[],
  date: Date,
): FeedbackCard | null => {
  const start = getDayStart(date);
  const end = getDayEnd(date);
  const dayTodos = todos.filter((todo) => {
    const ref = todo.dueDate || todo.createdAt;
    return ref >= start && ref <= end;
  });

  if (dayTodos.length === 0) return null;

  return {
    date: toDateKey(date),
    completedTodos: dayTodos.filter((todo) => todo.completed).map((todo) => todo.text),
    incompleteTodos: dayTodos.filter((todo) => !todo.completed).map((todo) => todo.text),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

export default function FeedbackScreen() {
  const t = STUB_TRANSLATIONS;
  const todos = useTodoStore((s) => s.todos);

  const [activeTab, setActiveTab] = useState<ViewTab>('daily');
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [weeklySummaries, setWeeklySummaries] = useState<Map<string, string>>(new Map());
  const [monthlySummaries, setMonthlySummaries] = useState<Map<string, string>>(new Map());
  const [generatingWeek, setGeneratingWeek] = useState<string | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);

  const currentMonday = useMemo(() => getMonday(new Date()), []);

  const weeks = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => addWeeks(currentMonday, -i)),
    [currentMonday],
  );

  const activeWeekStart = useMemo(
    () => weeks[activeWeekIndex] ?? currentMonday,
    [weeks, activeWeekIndex, currentMonday],
  );

  const mergedCards = useMemo(() => {
    const map = new Map<string, FeedbackCard>();
    const oldest = addWeeks(currentMonday, -MAX_PAST_WEEKS);
    const today = new Date();
    const current = new Date(oldest);

    while (current <= today) {
      const key = toDateKey(current);
      if (!map.has(key)) {
        const derived = deriveFeedbackCardFromTodos(todos, new Date(current));
        if (derived) map.set(key, derived);
      }
      current.setDate(current.getDate() + 1);
    }
    return map;
  }, [todos, currentMonday]);

  const getWeekCards = useCallback(
    (weekStart: Date): FeedbackCard[] => {
      const cards: FeedbackCard[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const card = mergedCards.get(toDateKey(date));
        if (card) cards.push(card);
      }
      return cards;
    },
    [mergedCards],
  );

  const getMonthCards = useCallback(
    (weekStart: Date): FeedbackCard[] => {
      const month = weekStart.getMonth();
      const year = weekStart.getFullYear();
      const cards: FeedbackCard[] = [];
      mergedCards.forEach((card) => {
        const [y, m] = card.date.split('-').map(Number);
        if (y === year && m === month + 1) cards.push(card);
      });
      return cards;
    },
    [mergedCards],
  );

  const selectedDayCard = useMemo(() => {
    if (!selectedDay) return null;
    return mergedCards.get(toDateKey(selectedDay)) ?? null;
  }, [selectedDay, mergedCards]);

  const activeWeekLabelText = useMemo(
    () => getWeekLabel(activeWeekStart, t),
    [activeWeekStart, t],
  );

  const activeWeekRange = useMemo(() => {
    const end = new Date(activeWeekStart);
    end.setDate(end.getDate() + 6);
    return `${activeWeekStart.getMonth() + 1}.${activeWeekStart.getDate()} - ${end.getMonth() + 1}.${end.getDate()}`;
  }, [activeWeekStart]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleSaveCard = useCallback((_card: FeedbackCard) => {
    // In production would persist to Firestore
    setSelectedDay(null);
  }, []);

  const handleGenerateWeekly = useCallback(
    (weekStart: Date) => {
      const key = toDateKey(weekStart);
      if (generatingWeek) return;
      setGeneratingWeek(key);
      // Stub: in production this calls aiService.generateFeedback
      setTimeout(() => {
        setWeeklySummaries((prev) =>
          new Map(prev).set(key, 'Great progress this week! Keep building momentum.'),
        );
        setGeneratingWeek(null);
      }, 1500);
    },
    [generatingWeek],
  );

  const handleGenerateMonthly = useCallback(
    (monthKey: string) => {
      if (generatingMonth) return;
      setGeneratingMonth(monthKey);
      setTimeout(() => {
        setMonthlySummaries((prev) =>
          new Map(prev).set(monthKey, 'Consistent effort this month. You are on track!'),
        );
        setGeneratingMonth(null);
      }, 1500);
    },
    [generatingMonth],
  );

  const weekDayCards = useMemo(() => {
    const today = new Date();
    const todayStr = toDateKey(today);
    const result: Array<{ date: Date; state: DayCardState; card: FeedbackCard | null }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(activeWeekStart);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      const card = mergedCards.get(key) ?? null;

      let state: DayCardState;
      if (key === todayStr) {
        state = card && card.completedTodos.length > 0 ? 'completed' : 'today-pending';
      } else if (d > today) {
        state = 'future';
      } else {
        state = card && (card.completedTodos.length > 0 || card.incompleteTodos.length > 0)
          ? 'completed'
          : 'empty-past';
      }

      result.push({ date: d, state, card });
    }
    return result;
  }, [activeWeekStart, mergedCards]);

  // Pre-compute monthly data to avoid creating Dates inside render
  const monthlyItems = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const monthKey = `${year}-${month}`;
      const firstOfMonth = new Date(year, month - 1, 1);
      return { month, year, monthKey, firstOfMonth };
    });
  }, []);

  const tabs: { key: ViewTab; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#0A0E1A' }}>
      {/* Header */}
      <View className="h-14 px-4 flex-row items-center justify-between">
        <Pressable onPress={() => setShowSettings(true)} className="p-2 rounded-full">
          <Settings size={16} color="#888" />
        </Pressable>
        <Text className="text-sm font-semibold text-white flex-1 text-center">
          {t.feedback.title}
        </Text>
        <View className="w-10 h-10" />
      </View>

      {/* Tab bar */}
      <View className="flex-row mx-4 mb-3 rounded-xl bg-surface/50 p-1">
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab.key ? 'bg-accent/20' : ''}`}
          >
            <Text
              className={`text-[12px] font-semibold ${activeTab === tab.key ? 'text-accent' : 'text-gray-500'}`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'daily' ? (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#71B7FF" />
          }
        >
          <View className="px-4 pt-3 pb-2 items-center">
            <Text className="text-[17px] font-semibold text-white">{activeWeekLabelText}</Text>
            <Text className="text-[12px] text-gray-400 mt-0.5">{activeWeekRange}</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 16 }}
          >
            {weekDayCards.map((item) => (
              <DayCard
                key={toDateKey(item.date)}
                date={item.date}
                state={item.state}
                card={item.card}
                t={t}
                onTap={() => setSelectedDay(item.date)}
              />
            ))}
          </ScrollView>

          <View className="px-4 pb-3">
            <WeeklySummaryCard
              weekStart={activeWeekStart}
              weekCards={getWeekCards(activeWeekStart)}
              summaryText={weeklySummaries.get(toDateKey(activeWeekStart)) ?? ''}
              isGenerating={generatingWeek === toDateKey(activeWeekStart)}
              t={t}
              onGenerate={() => handleGenerateWeekly(activeWeekStart)}
            />
          </View>

          {isLastWeekOfMonth(activeWeekStart) && (
            <View className="px-4 pb-8">
              <MonthlySummaryCard
                month={activeWeekStart.getMonth() + 1}
                year={activeWeekStart.getFullYear()}
                monthCards={getMonthCards(activeWeekStart)}
                summaryText={
                  monthlySummaries.get(
                    `${activeWeekStart.getFullYear()}-${activeWeekStart.getMonth() + 1}`,
                  ) ?? ''
                }
                isGenerating={
                  generatingMonth ===
                  `${activeWeekStart.getFullYear()}-${activeWeekStart.getMonth() + 1}`
                }
                t={t}
                onGenerate={() =>
                  handleGenerateMonthly(
                    `${activeWeekStart.getFullYear()}-${activeWeekStart.getMonth() + 1}`,
                  )
                }
              />
            </View>
          )}

          <View className="h-20" />
        </ScrollView>
      ) : activeTab === 'weekly' ? (
        <WeekCoverFlow
          weeks={weeks}
          activeIndex={activeWeekIndex}
          todos={todos}
          feedbackCards={mergedCards}
          t={t}
          onIndexChange={setActiveWeekIndex}
          onDayTap={(date) => setSelectedDay(date)}
          onWeekTap={(idx) => {
            setActiveWeekIndex(idx);
            setActiveTab('daily');
          }}
        />
      ) : (
        <ScrollView
          className="flex-1 px-4"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#71B7FF" />
          }
          contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
        >
          {monthlyItems.map(({ month, year, monthKey, firstOfMonth }) => (
            <MonthlySummaryCard
              key={monthKey}
              month={month}
              year={year}
              monthCards={getMonthCards(firstOfMonth)}
              summaryText={monthlySummaries.get(monthKey) ?? ''}
              isGenerating={generatingMonth === monthKey}
              t={t}
              onGenerate={() => handleGenerateMonthly(monthKey)}
            />
          ))}
        </ScrollView>
      )}

      {selectedDay && (
        <DayDetailSheet
          date={selectedDay}
          card={selectedDayCard}
          t={t}
          onClose={() => setSelectedDay(null)}
          onSave={handleSaveCard}
        />
      )}

      {showSettings && (
        <FeedbackSettingsSheet
          t={t}
          userId={null}
          onClose={() => setShowSettings(false)}
          onSettingsChange={() => {}}
        />
      )}
    </SafeAreaView>
  );
}
