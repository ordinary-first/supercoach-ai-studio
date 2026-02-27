import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Settings } from 'lucide-react';
import type {
  FeedbackCard,
  GoalAdjustment,
  GoalNode,
  NotificationSettings,
  ToDoItem,
  UserProfile,
} from '../types';
import { generateFeedback } from '../services/aiService';
import {
  loadFeedbackCards,
  loadNotificationSettings,
  saveFeedbackCard,
} from '../services/firebaseService';
import {
  canShowNotification,
  checkNotificationTriggers,
  markEveningSent,
  markMorningSent,
  markVictoryGenerated,
  showBrowserNotification,
  wasVictoryGenerated,
} from '../services/notificationService';
import { analyzeGoalCompletionRates } from '../services/goalAdjustmentService';
import { useTranslation } from '../i18n/useTranslation';
import { DayDetailSheet } from './feedback/DayDetailSheet';
import { FeedbackSettingsSheet } from './feedback/FeedbackSettingsSheet';
import { GoalAdjustmentCard } from './feedback/GoalAdjustmentCard';
import { MonthlySummaryCard } from './feedback/MonthlySummaryCard';
import { WeekCoverFlow } from './feedback/WeekCoverFlow';
import { WeeklyCardScroll } from './feedback/WeeklyCardScroll';
import { WeeklySummaryCard } from './feedback/WeeklySummaryCard';
import './feedback/feedbackApple.css';

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

const getMonthWeekNumber = (date: Date): number => {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstMonday = new Date(firstOfMonth);
  const dayOfWeek = firstOfMonth.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  firstMonday.setDate(firstOfMonth.getDate() + daysUntilMonday);
  if (date < firstMonday) return 1;
  const diff = Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 86400000));
  return diff + (daysUntilMonday === 0 ? 1 : 2);
};

const MAX_PAST_WEEKS = 52;
const TIMER_INTERVAL = 60000;
const COLLAPSE_THRESHOLD = 72;
const COLLAPSE_MAX_DRAG = 120;
type FeedbackViewMode = 'week-detail' | 'coverflow';

const getDayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const getDayEnd = (d: Date): number => getDayStart(d) + 86400000 - 1;

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

  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [firestoreCards, setFirestoreCards] = useState<Map<string, FeedbackCard>>(new Map());

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [viewMode, setViewMode] = useState<FeedbackViewMode>('week-detail');
  const [collapseDragY, setCollapseDragY] = useState(0);
  const [isCollapsingDrag, setIsCollapsingDrag] = useState(false);
  const [isLowPerf, setIsLowPerf] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const [weeklySummaries, setWeeklySummaries] = useState<Map<string, string>>(new Map());
  const [monthlySummaries, setMonthlySummaries] = useState<Map<string, string>>(new Map());
  const [generatingWeek, setGeneratingWeek] = useState<string | null>(null);
  const [generatingMonth, setGeneratingMonth] = useState<string | null>(null);

  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [generatingVictory, setGeneratingVictory] = useState(false);

  const [adjustments, setAdjustments] = useState<GoalAdjustment[]>([]);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [undoData, setUndoData] = useState<{
    goalId: string;
    oldText: string;
    todoUpdates: { id: string; oldText: string }[];
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const collapseStartYRef = useRef(0);

  const currentMonday = useMemo(() => getMonday(new Date()), []);

  useEffect(() => {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
    setIsLowPerf(cores <= 4);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setIsReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setViewMode('week-detail');
    setCollapseDragY(0);
    setIsCollapsingDrag(false);
  }, [isOpen]);

  const weeks = useMemo(
    () => Array.from({ length: MAX_PAST_WEEKS + 1 }, (_, i) => addWeeks(currentMonday, -i)),
    [currentMonday],
  );

  const activeWeekStart = useMemo(
    () => weeks[activeWeekIndex] ?? currentMonday,
    [weeks, activeWeekIndex, currentMonday],
  );

  useEffect(() => {
    if (!isOpen || !userId) return;

    const oldest = addWeeks(currentMonday, -MAX_PAST_WEEKS);
    const startKey = toDateKey(oldest);
    const endKey = toDateKey(addWeeks(currentMonday, 1));

    loadFeedbackCards(userId, startKey, endKey).then((cards) => {
      const map = new Map<string, FeedbackCard>();
      cards.forEach((card) => map.set(card.date, card));
      setFirestoreCards(map);
    });
  }, [isOpen, userId, currentMonday]);

  useEffect(() => {
    if (!userId) {
      setNotifSettings(null);
      return;
    }

    loadNotificationSettings(userId).then((settings) => {
      if (settings) setNotifSettings(settings);
    });
  }, [userId]);

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

  const activeWeekLabel = useMemo(() => {
    const month = activeWeekStart.getMonth() + 1;
    const week = getMonthWeekNumber(activeWeekStart);
    return t.feedback.weekLabel.replace('{month}', String(month)).replace('{week}', String(week));
  }, [activeWeekStart, t]);

  const activeWeekRange = useMemo(() => {
    const end = new Date(activeWeekStart);
    end.setDate(end.getDate() + 6);
    return `${activeWeekStart.getMonth() + 1}.${activeWeekStart.getDate()} - ${end.getMonth() + 1}.${end.getDate()}`;
  }, [activeWeekStart]);

  const collapseProgress = useMemo(
    () => Math.min(1, collapseDragY / COLLAPSE_MAX_DRAG),
    [collapseDragY],
  );

  const handleCollapseStart = useCallback(
    (clientY: number) => {
      if (viewMode === 'coverflow') return;
      collapseStartYRef.current = clientY;
      setIsCollapsingDrag(true);
      setCollapseDragY(0);
    },
    [viewMode],
  );

  const handleCollapseMove = useCallback(
    (clientY: number) => {
      if (!isCollapsingDrag || viewMode === 'coverflow') return;
      const delta = Math.max(0, clientY - collapseStartYRef.current);
      setCollapseDragY(Math.min(delta, COLLAPSE_MAX_DRAG));
    },
    [isCollapsingDrag, viewMode],
  );

  const handleCollapseEnd = useCallback(() => {
    if (!isCollapsingDrag || viewMode === 'coverflow') return;

    setIsCollapsingDrag(false);
    if (collapseDragY >= COLLAPSE_THRESHOLD) {
      setViewMode('coverflow');
    }
    setCollapseDragY(0);
  }, [isCollapsingDrag, viewMode, collapseDragY]);

  const handleSaveCard = useCallback(
    async (card: FeedbackCard) => {
      setFirestoreCards((prev) => {
        const next = new Map(prev);
        next.set(card.date, card);
        return next;
      });

      if (userId) await saveFeedbackCard(userId, card);
      setSelectedDay(null);
    },
    [userId],
  );

  const generateDailyVictory = useCallback(async () => {
    if (generatingVictory || wasVictoryGenerated()) return;

    const todayCard = deriveFeedbackCardFromTodos(todos, new Date());
    if (!todayCard || todayCard.completedTodos.length === 0) return;

    setGeneratingVictory(true);
    try {
      const todoContext = todayCard.completedTodos.map((item) => `- [O] ${item}`).join('\n');
      const coachComment = await generateFeedback('daily', userProfile, '', todoContext, '', userId);

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
          t.feedback.eveningNotifBody.replace('{count}', String(todayCard.completedTodos.length)),
          'evening-victory',
        );
        markEveningSent();
      }

      setSelectedDay(new Date());
    } finally {
      setGeneratingVictory(false);
    }
  }, [todos, userProfile, userId, generatingVictory, t]);

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

  useEffect(() => {
    if (!isOpen || mergedCards.size === 0 || nodes.length === 0) return;
    const results = analyzeGoalCompletionRates(todos, nodes, mergedCards, 3);
    setAdjustments(results);
  }, [isOpen, mergedCards, todos, nodes]);

  const handleAcceptAdjustment = useCallback(
    async (adj: GoalAdjustment) => {
      if (!onUpdateNode) return;
      setAdjustingId(adj.goalId);

      const node = nodes.find((n) => n.id === adj.goalId);
      const oldText = node?.text || '';
      const newText = oldText.replace(adj.currentMetric, adj.suggestedMetric);

      const todoUpdates: { id: string; oldText: string }[] = [];
      todos.forEach((todo) => {
        if (todo.linkedNodeId === adj.goalId && todo.text.includes(adj.currentMetric)) {
          todoUpdates.push({ id: todo.id, oldText: todo.text });
        }
      });

      setUndoData({ goalId: adj.goalId, oldText, todoUpdates });

      onUpdateNode(adj.goalId, { text: newText, progress: 0 });
      todoUpdates.forEach(({ id }) => {
        const source = todos.find((todo) => todo.id === id);
        if (!source) return;
        onUpdateTodo?.(id, {
          text: source.text.replace(adj.currentMetric, adj.suggestedMetric),
        });
      });

      setAdjustments((prev) =>
        prev.map((item) =>
          item.goalId === adj.goalId ? { ...item, status: 'accepted' } : item,
        ),
      );

      setTimeout(() => setAdjustingId(null), 2000);
      setTimeout(() => setUndoData(null), 5000);
    },
    [nodes, todos, onUpdateNode, onUpdateTodo],
  );

  const handleUndo = useCallback(() => {
    if (!undoData || !onUpdateNode) return;

    onUpdateNode(undoData.goalId, { text: undoData.oldText });
    undoData.todoUpdates.forEach(({ id, oldText }) => {
      onUpdateTodo?.(id, { text: oldText });
    });

    setAdjustments((prev) =>
      prev.map((item) =>
        item.goalId === undoData.goalId ? { ...item, status: 'pending' } : item,
      ),
    );

    setUndoData(null);
  }, [undoData, onUpdateNode, onUpdateTodo]);

  const handleDismissAdjustment = useCallback((goalId: string) => {
    setAdjustments((prev) =>
      prev.map((item) =>
        item.goalId === goalId ? { ...item, status: 'dismissed' } : item,
      ),
    );
  }, []);

  const handleGenerateWeekly = useCallback(
    async (weekStart: Date) => {
      const key = toDateKey(weekStart);
      if (generatingWeek) return;

      setGeneratingWeek(key);
      const weekCards = getWeekCards(weekStart);
      const todoContext = weekCards.length > 0
        ? weekCards.flatMap((card) => card.completedTodos.map((item) => `- [O] ${item}`)).join('\n')
        : '해당 주 완료 항목 없음';

      const text = await generateFeedback('weekly', userProfile, '', todoContext, '', userId);
      if (text) {
        setWeeklySummaries((prev) => new Map(prev).set(key, text));
      }
      setGeneratingWeek(null);
    },
    [getWeekCards, userProfile, userId, generatingWeek],
  );

  const handleGenerateMonthly = useCallback(
    async (weekStart: Date) => {
      const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}`;
      if (generatingMonth) return;

      setGeneratingMonth(monthKey);
      const monthCards = getMonthCards(weekStart);
      const todoContext = monthCards.length > 0
        ? monthCards.flatMap((card) => card.completedTodos.map((item) => `- [O] ${item}`)).join('\n')
        : '해당 월 완료 항목 없음';

      const text = await generateFeedback('monthly', userProfile, '', todoContext, '', userId);
      if (text) {
        setMonthlySummaries((prev) => new Map(prev).set(monthKey, text));
      }
      setGeneratingMonth(null);
    },
    [getMonthCards, userProfile, userId, generatingMonth],
  );

  const pendingAdjustments = useMemo(
    () => adjustments.filter((item) => item.status === 'pending'),
    [adjustments],
  );

  const recentAccepted = useMemo(
    () => adjustments.find((item) => item.status === 'accepted' && item.goalId === undoData?.goalId),
    [adjustments, undoData],
  );

  if (!isOpen) return null;

  return (
    <div
      className={`fb-feedback-root fixed inset-0 z-50 flex flex-col overflow-hidden font-body text-white ${
        isLowPerf ? 'fb-coverflow-lowperf' : ''
      }`}
    >
      <div className="fb-feedback-header h-14 px-4 flex items-center justify-between shrink-0">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Settings size={16} className="text-white/65" />
        </button>

        <h1 className="fb-feedback-header-title text-sm font-semibold text-white/92">
          {t.feedback.title}
        </h1>

        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Menu size={16} className="text-white/55" />
        </button>
      </div>

      {generatingVictory && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-th-accent/10 text-th-accent text-[12px] font-medium text-center animate-fade-in">
          {t.feedback.generatingVictory}
        </div>
      )}

      {viewMode === 'coverflow' ? (
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
            setViewMode('week-detail');
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-2 text-center">
            <p className="fb-week-label text-[17px] font-semibold text-white/93">{activeWeekLabel}</p>
            <p className="fb-week-range text-[12px] text-white/52 mt-0.5">{activeWeekRange}</p>
          </div>

          <div className="px-4 pb-3">
            <div
              className="fb-week-detail-panel fb-card-press"
              style={{
                transform: `translateY(${collapseDragY * 0.45}px) scale(${
                  1 - collapseProgress * (isLowPerf ? 0.1 : 0.15)
                })`,
                opacity: 1 - collapseProgress * (isLowPerf ? 0.26 : 0.35),
                transition: isCollapsingDrag
                  ? 'none'
                  : `transform ${isReducedMotion ? 220 : 360}ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease`,
              }}
              onTouchStart={(e) => handleCollapseStart(e.touches[0].clientY)}
              onTouchMove={(e) => {
                const delta = e.touches[0].clientY - collapseStartYRef.current;
                if (delta > 0 && e.cancelable) e.preventDefault();
                handleCollapseMove(e.touches[0].clientY);
              }}
              onTouchEnd={handleCollapseEnd}
              onTouchCancel={handleCollapseEnd}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') return;
                handleCollapseStart(e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'touch') return;
                handleCollapseMove(e.clientY);
              }}
              onPointerUp={(e) => {
                if (e.pointerType === 'touch') return;
                handleCollapseEnd();
              }}
            >
              <WeeklyCardScroll
                weekStart={activeWeekStart}
                todos={todos}
                feedbackCards={mergedCards}
                t={t}
                onDayTap={(date) => setSelectedDay(date)}
              />
            </div>
          </div>

          <div className="space-y-5 pb-8">
            {pendingAdjustments.map((adj) => (
              <div key={adj.goalId} className="px-4">
                <GoalAdjustmentCard
                  adjustment={adj}
                  isAdjusting={adjustingId === adj.goalId}
                  t={t}
                  onAccept={() => handleAcceptAdjustment(adj)}
                  onDismiss={() => handleDismissAdjustment(adj.goalId)}
                />
              </div>
            ))}

            {recentAccepted && undoData && (
              <div className="mx-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between animate-fade-in fb-card-press">
                <span className="text-[12px] text-green-400">{t.feedback.adjustComplete}</span>
                <button
                  onClick={handleUndo}
                  className="text-[11px] font-semibold text-white/70 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
                >
                  {t.feedback.undo}
                </button>
              </div>
            )}

            <div className="px-4">
              <div className="fb-summary-wrap">
                <WeeklySummaryCard
                  weekStart={activeWeekStart}
                  weekCards={getWeekCards(activeWeekStart)}
                  summaryText={weeklySummaries.get(toDateKey(activeWeekStart)) ?? ''}
                  isGenerating={generatingWeek === toDateKey(activeWeekStart)}
                  t={t}
                  onGenerate={() => handleGenerateWeekly(activeWeekStart)}
                  onTap={() => {}}
                />
              </div>
            </div>

            {isLastWeekOfMonth(activeWeekStart) && (
              <div className="px-4">
                <div className="fb-summary-wrap">
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
                </div>
              </div>
            )}
          </div>
        </div>
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
          userId={userId}
          onClose={() => setShowSettings(false)}
          onSettingsChange={setNotifSettings}
        />
      )}
    </div>
  );
};

export default FeedbackView;
