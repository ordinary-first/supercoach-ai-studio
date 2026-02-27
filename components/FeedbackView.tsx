import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings } from 'lucide-react';
import type { GoalNode, ToDoItem, UserProfile, FeedbackCard } from '../types';
import { generateFeedback } from '../services/aiService';
import { loadFeedbackCards, saveFeedbackCard } from '../services/firebaseService';
import { useTranslation } from '../i18n/useTranslation';
import { WeekNavigator } from './feedback/WeekNavigator';
import { WeeklyCardScroll } from './feedback/WeeklyCardScroll';
import { DayDetailSheet } from './feedback/DayDetailSheet';
import { WeeklySummaryCard } from './feedback/WeeklySummaryCard';
import { MonthlySummaryCard } from './feedback/MonthlySummaryCard';
import { FeedbackSettingsSheet } from './feedback/FeedbackSettingsSheet';

interface FeedbackViewProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GoalNode[];
  todos: ToDoItem[];
  userProfile: UserProfile | null;
  userId: string | null;
}

// ── Week helpers ──

const getMonday = (d: Date): Date => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addWeeks = (d: Date, n: number): Date => {
  const result = new Date(d);
  result.setDate(result.getDate() + n * 7);
  return result;
};

const isLastWeekOfMonth = (weekStart: Date): boolean => {
  const nextWeek = addWeeks(weekStart, 1);
  return nextWeek.getMonth() !== weekStart.getMonth();
};

const MAX_PAST_WEEKS = 12;

// ── Derive card from todos ──

const getDayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const getDayEnd = (d: Date): number => getDayStart(d) + 86400000 - 1;

const deriveFeedbackCardFromTodos = (
  todos: ToDoItem[],
  date: Date,
): FeedbackCard | null => {
  const start = getDayStart(date);
  const end = getDayEnd(date);
  const dayTodos = todos.filter((td) => {
    const ref = td.dueDate || td.createdAt;
    return ref >= start && ref <= end;
  });
  if (dayTodos.length === 0) return null;
  return {
    date: toDateKey(date),
    completedTodos: dayTodos.filter((td) => td.completed).map((td) => td.text),
    incompleteTodos: dayTodos.filter((td) => !td.completed).map((td) => td.text),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

const FeedbackView: React.FC<FeedbackViewProps> = ({
  isOpen,
  onClose,
  nodes,
  todos,
  userProfile,
  userId,
}) => {
  const { t } = useTranslation();

  // Current week offset (0 = current week, -1 = last week, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  // Firestore feedback cards
  const [firestoreCards, setFirestoreCards] = useState<Map<string, FeedbackCard>>(new Map());

  // Sheets
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Weekly/monthly summary
  const [weeklySummaries, setWeeklySummaries] = useState<Map<string, string>>(new Map());
  const [monthlySummaries, setMonthlySummaries] = useState<Map<string, string>>(new Map());
  const [generatingWeek, setGeneratingWeek] = useState<string | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);

  const currentMonday = useMemo(() => getMonday(new Date()), []);

  // Generate weeks to render (current + past weeks)
  const weeks = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i >= -MAX_PAST_WEEKS; i--) {
      result.push(addWeeks(currentMonday, i));
    }
    return result;
  }, [currentMonday]);

  const activeWeekStart = useMemo(
    () => addWeeks(currentMonday, weekOffset),
    [currentMonday, weekOffset],
  );

  // Load Firestore cards when opening
  useEffect(() => {
    if (!isOpen || !userId) return;
    const oldest = addWeeks(currentMonday, -MAX_PAST_WEEKS);
    const startKey = toDateKey(oldest);
    const endKey = toDateKey(addWeeks(currentMonday, 1));

    loadFeedbackCards(userId, startKey, endKey).then((cards) => {
      const map = new Map<string, FeedbackCard>();
      cards.forEach((c) => map.set(c.date, c));
      setFirestoreCards(map);
    });
  }, [isOpen, userId, currentMonday]);

  // Merged cards: Firestore first, then derive from todos
  const mergedCards = useMemo(() => {
    const map = new Map<string, FeedbackCard>(firestoreCards);
    // Fill in days that don't have Firestore cards
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
  }, [firestoreCards, todos, currentMonday]);

  // Get cards for a specific week
  const getWeekCards = useCallback((weekStart: Date): FeedbackCard[] => {
    const cards: FeedbackCard[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      const card = mergedCards.get(key);
      if (card) cards.push(card);
    }
    return cards;
  }, [mergedCards]);

  // Get cards for a specific month
  const getMonthCards = useCallback((weekStart: Date): FeedbackCard[] => {
    const month = weekStart.getMonth();
    const year = weekStart.getFullYear();
    const cards: FeedbackCard[] = [];
    mergedCards.forEach((card) => {
      const [y, m] = card.date.split('-').map(Number);
      if (y === year && m === month + 1) cards.push(card);
    });
    return cards;
  }, [mergedCards]);

  // Selected day card (for detail sheet)
  const selectedDayCard = useMemo(() => {
    if (!selectedDay) return null;
    const key = toDateKey(selectedDay);
    return mergedCards.get(key) ?? null;
  }, [selectedDay, mergedCards]);

  // Save edited card
  const handleSaveCard = useCallback(async (card: FeedbackCard) => {
    setFirestoreCards((prev) => {
      const next = new Map(prev);
      next.set(card.date, card);
      return next;
    });
    if (userId) {
      await saveFeedbackCard(userId, card);
    }
    setSelectedDay(null);
  }, [userId]);

  // Generate weekly summary
  const handleGenerateWeekly = useCallback(async (weekStart: Date) => {
    const key = toDateKey(weekStart);
    if (generatingWeek) return;
    setGeneratingWeek(key);

    const weekCards = getWeekCards(weekStart);
    const todoContext = weekCards.length > 0
      ? weekCards.flatMap((c) => c.completedTodos.map((t) => `- [O] ${t}`)).join('\n')
      : '해당 주 완료 항목 없음';

    const text = await generateFeedback(
      'weekly', userProfile, '', todoContext, '', userId,
    );
    if (text) {
      setWeeklySummaries((prev) => new Map(prev).set(key, text));
    }
    setGeneratingWeek(null);
  }, [getWeekCards, userProfile, userId, generatingWeek]);

  // Generate monthly summary
  const handleGenerateMonthly = useCallback(async (weekStart: Date) => {
    const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}`;
    if (generatingMonth) return;
    setGeneratingMonth(monthKey);

    const monthCards = getMonthCards(weekStart);
    const todoContext = monthCards.length > 0
      ? monthCards.flatMap((c) => c.completedTodos.map((t) => `- [O] ${t}`)).join('\n')
      : '해당 월 완료 항목 없음';

    const text = await generateFeedback(
      'monthly', userProfile, '', todoContext, '', userId,
    );
    if (text) {
      setMonthlySummaries((prev) => new Map(prev).set(monthKey, text));
    }
    setGeneratingMonth(null);
  }, [getMonthCards, userProfile, userId, generatingMonth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-hidden font-body text-white">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.06] bg-[#0A0A0A]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <Settings size={16} className="text-white/50" />
        </button>
        <h1 className="text-sm font-semibold tracking-wide text-white/90">
          {t.feedback.title}
        </h1>
        <button
          onClick={onClose}
          className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1"
        >
          {t.common.close}
        </button>
      </div>

      {/* Week Navigator */}
      <WeekNavigator
        weekStart={activeWeekStart}
        t={t}
        onPrev={() => setWeekOffset((o) => Math.max(o - 1, -MAX_PAST_WEEKS))}
        onNext={() => setWeekOffset((o) => Math.min(o + 1, 0))}
        canNext={weekOffset < 0}
      />

      {/* Scrollable Feed */}
      <div className="flex-1 overflow-y-auto pb-[120px]">
        <div className="max-w-lg mx-auto space-y-5 pt-4">
          {/* Weekly Card Scroll */}
          <WeeklyCardScroll
            weekStart={activeWeekStart}
            todos={todos}
            feedbackCards={mergedCards}
            t={t}
            onDayTap={(date) => setSelectedDay(date)}
          />

          {/* Weekly Summary Card */}
          <WeeklySummaryCard
            weekStart={activeWeekStart}
            weekCards={getWeekCards(activeWeekStart)}
            summaryText={weeklySummaries.get(toDateKey(activeWeekStart)) ?? ''}
            isGenerating={generatingWeek === toDateKey(activeWeekStart)}
            t={t}
            onGenerate={() => handleGenerateWeekly(activeWeekStart)}
            onTap={() => {}}
          />

          {/* Monthly Summary Card (only on last week of month) */}
          {isLastWeekOfMonth(activeWeekStart) && (
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
              onGenerate={() => handleGenerateMonthly(activeWeekStart)}
              onTap={() => {}}
            />
          )}
        </div>
      </div>

      {/* Day Detail Sheet */}
      {selectedDay && (
        <DayDetailSheet
          date={selectedDay}
          card={selectedDayCard}
          t={t}
          onClose={() => setSelectedDay(null)}
          onSave={handleSaveCard}
        />
      )}

      {/* Settings Sheet */}
      {showSettings && (
        <FeedbackSettingsSheet
          t={t}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default FeedbackView;
