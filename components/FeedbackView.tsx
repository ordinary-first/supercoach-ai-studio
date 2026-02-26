import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';
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
import { WeekNavigator } from './feedback/WeekNavigator';
import { WeeklyCardScroll } from './feedback/WeeklyCardScroll';
import { DayDetailSheet } from './feedback/DayDetailSheet';
import { WeeklySummaryCard } from './feedback/WeeklySummaryCard';
import { MonthlySummaryCard } from './feedback/MonthlySummaryCard';
import { FeedbackSettingsSheet } from './feedback/FeedbackSettingsSheet';
import { GoalAdjustmentCard } from './feedback/GoalAdjustmentCard';

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
const TIMER_INTERVAL = 60000; // 1 minute

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
  onUpdateNode,
  onUpdateTodo,
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

  const activeWeekStart = useMemo(
    () => addWeeks(currentMonday, weekOffset),
    [currentMonday, weekOffset],
  );

  // Load Firestore cards + notification settings when opening
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

    loadNotificationSettings(userId).then((s) => {
      if (s) setNotifSettings(s);
    });
  }, [isOpen, userId, currentMonday]);

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

  // ── 오늘의 승리 자동 생성 ──
  const generateDailyVictory = useCallback(async () => {
    if (generatingVictory || wasVictoryGenerated()) return;
    const todayCard = deriveFeedbackCardFromTodos(todos, new Date());
    if (!todayCard || todayCard.completedTodos.length === 0) return;

    setGeneratingVictory(true);
    markVictoryGenerated();

    const todoContext = todayCard.completedTodos.map((t) => `- [O] ${t}`).join('\n');
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
    setGeneratingVictory(false);

    // Show evening notification
    if (canShowNotification()) {
      showBrowserNotification(
        t.feedback.eveningNotifTitle,
        t.feedback.eveningNotifBody.replace('{count}', String(todayCard.completedTodos.length)),
        'evening-victory',
      );
      markEveningSent();
    }

    // Auto-open today's card
    setSelectedDay(new Date());
  }, [todos, userProfile, userId, generatingVictory, t]);

  // ── Notification timer ──
  useEffect(() => {
    if (!isOpen || !notifSettings) return;

    const tick = () => {
      const triggers = checkNotificationTriggers(notifSettings);

      if (triggers.shouldNotifyMorning && canShowNotification()) {
        showBrowserNotification(t.feedback.morningNotifTitle, t.feedback.morningNotifBody, 'morning');
        markMorningSent();
      }

      if (triggers.shouldGenerateVictory) {
        generateDailyVictory();
      } else if (triggers.shouldNotifyEvening && canShowNotification()) {
        // Evening notif without victory generation (already generated)
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

    // Check immediately on mount
    tick();
    timerRef.current = setInterval(tick, TIMER_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [isOpen, notifSettings, generateDailyVictory, todos, t]);

  // ── Goal adjustment analysis ──
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

    // Save undo data
    const todoUpdates: { id: string; oldText: string }[] = [];
    todos.forEach((td) => {
      if (td.linkedNodeId === adj.goalId && td.text.includes(adj.currentMetric)) {
        todoUpdates.push({ id: td.id, oldText: td.text });
      }
    });
    setUndoData({ goalId: adj.goalId, oldText, todoUpdates });

    // Apply changes
    onUpdateNode(adj.goalId, { text: newText, progress: 0 });
    todoUpdates.forEach(({ id }) => {
      onUpdateTodo?.(id, { text: todos.find((t) => t.id === id)!.text.replace(adj.currentMetric, adj.suggestedMetric) });
    });

    // Update adjustment status
    setAdjustments((prev) =>
      prev.map((a) => a.goalId === adj.goalId ? { ...a, status: 'accepted' } : a),
    );

    // Clear adjusting state after animation
    setTimeout(() => setAdjustingId(null), 2000);

    // Auto-clear undo after 5 seconds
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

  // Pending adjustments to show
  const pendingAdjustments = useMemo(
    () => adjustments.filter((a) => a.status === 'pending'),
    [adjustments],
  );
  const recentAccepted = useMemo(
    () => adjustments.find((a) => a.status === 'accepted' && a.goalId === undoData?.goalId),
    [adjustments, undoData],
  );

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

      {/* Victory generating banner */}
      {generatingVictory && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-th-accent/10 text-th-accent text-[12px] font-medium text-center animate-fade-in">
          {t.feedback.generatingVictory}
        </div>
      )}

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

          {/* Goal Adjustment Cards */}
          {pendingAdjustments.map((adj) => (
            <GoalAdjustmentCard
              key={adj.goalId}
              adjustment={adj}
              isAdjusting={adjustingId === adj.goalId}
              t={t}
              onAccept={() => handleAcceptAdjustment(adj)}
              onDismiss={() => handleDismissAdjustment(adj.goalId)}
            />
          ))}

          {/* Undo toast for recently accepted adjustment */}
          {recentAccepted && undoData && (
            <div className="mx-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between animate-fade-in">
              <span className="text-[12px] text-green-400">{t.feedback.adjustComplete}</span>
              <button
                onClick={handleUndo}
                className="text-[11px] font-semibold text-white/70 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
              >
                {t.feedback.undo}
              </button>
            </div>
          )}

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
          userId={userId}
          onClose={() => setShowSettings(false)}
          onSettingsChange={setNotifSettings}
        />
      )}
    </div>
  );
};

export default FeedbackView;
