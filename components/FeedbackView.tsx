import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Menu, Settings } from 'lucide-react';
import type { GoalNode, ToDoItem, UserProfile, FeedbackCard, NotificationSettings, GoalAdjustment } from '../types';
import { generateFeedback } from '../services/aiService';
import { loadFeedbackCards, saveFeedbackCard, loadNotificationSettings } from '../services/firebaseService';
import {
  checkNotificationTriggers,
  showBrowserNotification,
  markMorningSent,
  markEveningSent,
  markVictoryGenerated,
  wasVictoryGenerated,
  canShowNotification,
} from '../services/notificationService';
import { analyzeGoalCompletionRates } from '../services/goalAdjustmentService';
import { useTranslation } from '../i18n/useTranslation';
import { WeekCoverFlow } from './feedback/WeekCoverFlow';
import { WeekDetailSheet } from './feedback/WeekDetailSheet';
import { DayDetailSheet } from './feedback/DayDetailSheet';
import { FeedbackSettingsSheet } from './feedback/FeedbackSettingsSheet';

interface FeedbackViewProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: GoalNode[];
  todos: ToDoItem[];
  userProfile: UserProfile | null;
  userId: string | null;
  onUpdateNode?: (nodeId: string, updates: Partial<GoalNode>) => void;
  onUpdateTodo?: (todoId: string, updates: Partial<ToDoItem>) => void;
}

// Week helpers

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
const TIMER_INTERVAL = 60000;

// Derive card from todos

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
  onUpdateNode,
  onUpdateTodo,
}) => {
  const { t } = useTranslation();

  // CoverFlow state
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  // Firestore feedback cards
  const [firestoreCards, setFirestoreCards] = useState<Map<string, FeedbackCard>>(new Map());

  // Sheets
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Weekly/monthly summary
  const [weeklySummaries, setWeeklySummaries] = useState<Map<string, string>>(new Map());
  const [monthlySummaries, setMonthlySummaries] = useState<Map<string, string>>(new Map());
  const [generatingWeek, setGeneratingWeek] = useState<string | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);

  // Notification settings
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);

  // Victory generation
  const [generatingVictory, setGeneratingVictory] = useState(false);

  // Goal adjustments
  const [adjustments, setAdjustments] = useState<GoalAdjustment[]>([]);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [undoData, setUndoData] = useState<{ goalId: string; oldText: string; todoUpdates: { id: string; oldText: string }[] } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const currentMonday = useMemo(() => getMonday(new Date()), []);

  // Weeks array: [currentMonday, -1w, -2w, ..., -12w]
  const weeks = useMemo(() =>
    Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) =>
      addWeeks(currentMonday, -i)),
    [currentMonday],
  );

  // Load Firestore cards
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

  // Load notification settings regardless of active tab
  useEffect(() => {
    if (!userId) {
      setNotifSettings(null);
      return;
    }
    loadNotificationSettings(userId).then((s) => {
      if (s) setNotifSettings(s);
    });
  }, [userId]);

  // Merged cards: Firestore first, then derive from todos
  const mergedCards = useMemo(() => {
    const map = new Map<string, FeedbackCard>(firestoreCards);
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

  // Victory auto-generation
  const generateDailyVictory = useCallback(async () => {
    if (generatingVictory || wasVictoryGenerated()) return;
    const todayCard = deriveFeedbackCardFromTodos(todos, new Date());
    if (!todayCard || todayCard.completedTodos.length === 0) return;

    setGeneratingVictory(true);
    try {
      const todoContext = todayCard.completedTodos.map((item) => `- [O] ${item}`).join('\n');
      const coachComment = await generateFeedback(
        'daily', userProfile, '', todoContext, '', userId,
      );

      const card: FeedbackCard = {
        ...todayCard,
        coachComment: coachComment || undefined,
        updatedAt: Date.now(),
      };

      setFirestoreCards((prev) => {
        const next = new Map(prev);
        next.set(card.date, card);
        return next;
      });

      if (userId) await saveFeedbackCard(userId, card);
      markVictoryGenerated();

      if (canShowNotification()) {
        showBrowserNotification(
          t.feedback.eveningNotifTitle,
          t.feedback.eveningNotifBody.replace(
            '{count}',
            String(todayCard.completedTodos.length),
          ),
          'evening-victory',
        );
        markEveningSent();
      }

      setSelectedDay(new Date());
    } finally {
      setGeneratingVictory(false);
    }
  }, [todos, userProfile, userId, generatingVictory, t]);

  // Notification timer
  useEffect(() => {
    if (!userId || !notifSettings) return;

    const tick = () => {
      const triggers = checkNotificationTriggers(notifSettings);

      if (triggers.shouldNotifyMorning && canShowNotification()) {
        showBrowserNotification(t.feedback.morningNotifTitle, t.feedback.morningNotifBody, 'morning');
        markMorningSent();
      }

      if (triggers.shouldGenerateVictory) {
        generateDailyVictory();
      } else if (triggers.shouldNotifyEvening && canShowNotification()) {
        const todayCard = deriveFeedbackCardFromTodos(todos, new Date());
        const count = todayCard?.completedTodos.length ?? 0;
        showBrowserNotification(
          t.feedback.eveningNotifTitle,
          t.feedback.eveningNotifBody.replace('{count}', String(count)),
          'evening',
        );
        markEveningSent();
      }
    };

    tick();
    timerRef.current = setInterval(tick, TIMER_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [userId, notifSettings, generateDailyVictory, todos, t]);

  // Goal adjustment analysis
  useEffect(() => {
    if (!isOpen || mergedCards.size === 0 || nodes.length === 0) return;
    const results = analyzeGoalCompletionRates(todos, nodes, mergedCards, 3);
    setAdjustments(results);
  }, [isOpen, mergedCards, todos, nodes]);

  // Handle goal adjustment
  const handleAcceptAdjustment = useCallback(async (adj: GoalAdjustment) => {
    if (!onUpdateNode) return;
    setAdjustingId(adj.goalId);

    const node = nodes.find((n) => n.id === adj.goalId);
    const oldText = node?.text || '';
    const newText = oldText.replace(adj.currentMetric, adj.suggestedMetric);

    const todoUpdates: { id: string; oldText: string }[] = [];
    todos.forEach((td) => {
      if (td.linkedNodeId === adj.goalId && td.text.includes(adj.currentMetric)) {
        todoUpdates.push({ id: td.id, oldText: td.text });
      }
    });
    setUndoData({ goalId: adj.goalId, oldText, todoUpdates });

    onUpdateNode(adj.goalId, { text: newText, progress: 0 });
    todoUpdates.forEach(({ id }) => {
      onUpdateTodo?.(id, { text: todos.find((t) => t.id === id)!.text.replace(adj.currentMetric, adj.suggestedMetric) });
    });

    setAdjustments((prev) =>
      prev.map((a) => a.goalId === adj.goalId ? { ...a, status: 'accepted' } : a),
    );

    setTimeout(() => setAdjustingId(null), 2000);
    setTimeout(() => setUndoData(null), 5000);
  }, [nodes, todos, onUpdateNode, onUpdateTodo]);

  // Undo adjustment
  const handleUndo = useCallback(() => {
    if (!undoData || !onUpdateNode) return;
    onUpdateNode(undoData.goalId, { text: undoData.oldText });
    undoData.todoUpdates.forEach(({ id, oldText }) => {
      onUpdateTodo?.(id, { text: oldText });
    });
    setAdjustments((prev) =>
      prev.map((a) => a.goalId === undoData.goalId ? { ...a, status: 'pending' } : a),
    );
    setUndoData(null);
  }, [undoData, onUpdateNode, onUpdateTodo]);

  const handleDismissAdjustment = useCallback((goalId: string) => {
    setAdjustments((prev) =>
      prev.map((a) => a.goalId === goalId ? { ...a, status: 'dismissed' } : a),
    );
  }, []);

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

  // Pending adjustments
  const pendingAdjustments = useMemo(
    () => adjustments.filter((a) => a.status === 'pending'),
    [adjustments],
  );
  const recentAccepted = useMemo(
    () => adjustments.find((a) => a.status === 'accepted' && a.goalId === undoData?.goalId),
    [adjustments, undoData],
  );

  // WeekDetailSheet data for selected week
  const selectedWeekStart = selectedWeek !== null ? weeks[selectedWeek] : null;

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
          className="p-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <Menu size={16} className="text-white/40" />
        </button>
      </div>

      {/* Victory generating banner */}
      {generatingVictory && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-th-accent/10 text-th-accent text-[12px] font-medium text-center animate-fade-in">
          {t.feedback.generatingVictory}
        </div>
      )}

      {/* CoverFlow */}
      <WeekCoverFlow
        weeks={weeks}
        activeIndex={activeWeekIndex}
        todos={todos}
        feedbackCards={mergedCards}
        t={t}
        onIndexChange={setActiveWeekIndex}
        onDayTap={(date) => setSelectedDay(date)}
        onWeekTap={(idx) => setSelectedWeek(idx)}
      />

      {/* WeekDetailSheet */}
      {selectedWeekStart && selectedWeek !== null && (
        <WeekDetailSheet
          weekStart={selectedWeekStart}
          todos={todos}
          feedbackCards={mergedCards}
          t={t}
          onClose={() => setSelectedWeek(null)}
          onDayTap={(date) => setSelectedDay(date)}
          weekCards={getWeekCards(selectedWeekStart)}
          weeklySummary={weeklySummaries.get(toDateKey(selectedWeekStart)) ?? ''}
          isGeneratingWeekly={generatingWeek === toDateKey(selectedWeekStart)}
          onGenerateWeekly={() => handleGenerateWeekly(selectedWeekStart)}
          isLastWeekOfMonth={isLastWeekOfMonth(selectedWeekStart)}
          month={selectedWeekStart.getMonth() + 1}
          year={selectedWeekStart.getFullYear()}
          monthCards={getMonthCards(selectedWeekStart)}
          monthlySummary={
            monthlySummaries.get(
              `${selectedWeekStart.getFullYear()}-${selectedWeekStart.getMonth() + 1}`,
            ) ?? ''
          }
          isGeneratingMonthly={
            generatingMonth ===
            `${selectedWeekStart.getFullYear()}-${selectedWeekStart.getMonth() + 1}`
          }
          onGenerateMonthly={() => handleGenerateMonthly(selectedWeekStart)}
          pendingAdjustments={pendingAdjustments}
          adjustingId={adjustingId}
          onAcceptAdjustment={handleAcceptAdjustment}
          onDismissAdjustment={handleDismissAdjustment}
          undoData={undoData}
          recentAccepted={recentAccepted}
          onUndo={handleUndo}
        />
      )}

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
          userId={userId}
          onClose={() => setShowSettings(false)}
          onSettingsChange={setNotifSettings}
        />
      )}
    </div>
  );
};

export default FeedbackView;

