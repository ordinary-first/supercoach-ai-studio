import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  Trophy,
  Lock,
  AlertCircle,
  CheckCircle2,
  Star,
  ArrowLeft,
} from 'lucide-react-native';
import type { ToDoItem } from '../../shared/types';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useTodoStore } from '../../stores/useTodoStore';

// ---------------------------------------------------------------------------
// Recurrence matching
// ---------------------------------------------------------------------------

const checkRecurrenceMatch = (todo: ToDoItem, targetDate: Date): boolean => {
  if (!todo.repeat) return false;

  const anchorTimestamp = todo.dueDate || todo.createdAt;
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const start = new Date(anchorTimestamp);
  start.setHours(0, 0, 0, 0);

  if (target.getTime() < start.getTime()) return false;

  const day = target.getDay();

  if (todo.repeat === 'daily') return true;
  if (todo.repeat === 'weekdays') return day !== 0 && day !== 6;
  if (todo.repeat === 'weekly') return day === start.getDay();
  if (todo.repeat === 'monthly') return target.getDate() === start.getDate();

  switch (todo.repeat) {
    case 'weekly-2': return day === 1 || day === 4;
    case 'weekly-3': return day === 1 || day === 3 || day === 5;
    case 'weekly-4': return day === 1 || day === 2 || day === 4 || day === 5;
    case 'weekly-5': return day >= 1 && day <= 5;
    case 'weekly-6': return day >= 1 && day <= 6;
    default: return false;
  }
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'month' | 'week' | 'list' | 'day';

interface GhostTodo extends ToDoItem {
  isGhost: boolean;
}

type CalendarTodo = ToDoItem | GhostTodo;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const normalizeDate = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const getStartDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();

const getWeekRange = (date: Date): { start: Date; end: Date } => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isGhostTodo = (todo: CalendarTodo): boolean =>
  'isGhost' in todo && (todo as GhostTodo).isGhost;

const priorityColor = (p?: string) => {
  switch (p) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#3b82f6';
    default: return '#6b7280';
  }
};

// ---------------------------------------------------------------------------
// Shared sub-component: compact todo chip (used in week & list views)
// ---------------------------------------------------------------------------

function TodoChip({
  todo,
  isPastDate,
  onToggle,
}: {
  todo: CalendarTodo;
  isPastDate: boolean;
  onToggle: (id: string) => void;
}) {
  const ghost = isGhostTodo(todo);

  const bgClass = todo.completed
    ? 'bg-amber-900/20 border-amber-600/40'
    : ghost
      ? 'bg-gray-800/30 border-gray-600 border-dashed'
      : isPastDate
        ? 'bg-gray-800 border-red-900/30 opacity-60'
        : 'bg-gray-800/60 border-gray-600';

  const textClass = todo.completed
    ? 'text-amber-400 font-bold'
    : ghost
      ? 'text-gray-500'
      : 'text-gray-300';

  const icon = todo.completed
    ? <Trophy size={10} color="#d97706" />
    : ghost
      ? <Lock size={10} color="#6b7280" />
      : isPastDate
        ? <AlertCircle size={10} color="#ef4444" />
        : <Lock size={10} color="#9ca3af" />;

  return (
    <Pressable
      onPress={() => !ghost && onToggle(todo.id)}
      className={`flex-row items-center gap-1 px-2 py-1 rounded-md border ${bgClass}`}
    >
      {icon}
      <Text className={`text-[10px] flex-1 ${textClass}`} numberOfLines={1}>
        {todo.text}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const { t, language } = useTranslation();
  const todos = useTodoStore((s) => s.todos);
  const toggleComplete = useTodoStore((s) => s.toggleComplete);

  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor(screenWidth / 7);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('month');
  const [refreshing, setRefreshing] = useState(false);
  const handleCalendarRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh delay — real implementation would reload from Firestore
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  // Cache "today" once per render to avoid repeated Date allocations
  const todayNorm = useMemo(() => normalizeDate(new Date()), []);

  // ----- Todo helpers -----

  const getTodosForDateGeneric = useCallback(
    (targetDate: Date): CalendarTodo[] => {
      const tYear = targetDate.getFullYear();
      const tMonth = targetDate.getMonth();
      const tDay = targetDate.getDate();
      const targetStart = new Date(tYear, tMonth, tDay, 0, 0, 0).getTime();
      const targetEnd = new Date(tYear, tMonth, tDay, 23, 59, 59).getTime();

      const realTodos = todos.filter((item) => {
        if (item.dueDate) {
          return item.dueDate >= targetStart && item.dueDate <= targetEnd;
        }
        if (item.isMyDay) {
          const now = new Date();
          const isTodayCell =
            now.getDate() === tDay && now.getMonth() === tMonth && now.getFullYear() === tYear;
          if (isTodayCell && !item.completed) return true;
        }
        return false;
      });

      const ghosts: GhostTodo[] = todos
        .filter((item) => {
          if (item.completed || !item.repeat) return false;
          if (!checkRecurrenceMatch(item, targetDate)) return false;
          return !realTodos.some((r) => r.id === item.id);
        })
        .map((item) => ({
          ...item,
          id: `ghost_${item.id}_${tDay}_${tMonth}`,
          isGhost: true,
          completed: false,
        }));

      return [...realTodos, ...ghosts];
    },
    [todos],
  );

  const getTodosForDate = (day: number) => getTodosForDateGeneric(new Date(year, month, day));

  // ----- Navigation -----

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const goToNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const goToPrevDay = () => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d);
    }
  };
  const goToNextDay = () => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d);
    }
  };

  const handleDayPress = (date: Date) => {
    setPreviousViewMode(viewMode);
    setSelectedDate(date);
    setViewMode('day');
  };

  const handleBackFromDay = () => {
    setViewMode(previousViewMode);
    setSelectedDate(null);
  };

  const switchViewMode = (mode: ViewMode) => {
    if (mode === 'day') return;
    setViewMode(mode);
    setSelectedDate(null);
  };

  const handlePrev = () => {
    if (viewMode === 'month' || viewMode === 'list') goToPrevMonth();
    else if (viewMode === 'week') goToPrevWeek();
    else if (viewMode === 'day') goToPrevDay();
  };

  const handleNext = () => {
    if (viewMode === 'month' || viewMode === 'list') goToNextMonth();
    else if (viewMode === 'week') goToNextWeek();
    else if (viewMode === 'day') goToNextDay();
  };

  // ----- Header title -----

  const formatWeekRange = () => {
    const { start, end } = getWeekRange(currentDate);
    const sm = String(start.getMonth() + 1).padStart(2, '0');
    const sd = String(start.getDate()).padStart(2, '0');
    const em = String(end.getMonth() + 1).padStart(2, '0');
    const ed = String(end.getDate()).padStart(2, '0');
    const sy = start.getFullYear();
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${sy}.${sm}.${sd} - ${ed}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${sy}.${sm}.${sd} - ${em}.${ed}`;
    }
    return `${sy}.${sm}.${sd} - ${end.getFullYear()}.${em}.${ed}`;
  };

  const formatDayHeader = () => {
    if (!selectedDate) return '';
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const d = selectedDate.getDate();
    const dayOfWeek = t.calendar.dayNamesFull[selectedDate.getDay()];
    if (language === 'ko') {
      return `${y}${t.calendar.yearSuffix} ${m}${t.calendar.monthSuffix} ${d}${t.calendar.daySuffix} ${dayOfWeek}`;
    }
    return `${dayOfWeek}, ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month' || viewMode === 'list') {
      return `${year}. ${String(month + 1).padStart(2, '0')}`;
    }
    if (viewMode === 'week') return formatWeekRange();
    if (viewMode === 'day') return formatDayHeader();
    return '';
  };

  // ====================================================================
  // Render helpers
  // ====================================================================

  const renderPriorityDots = (dayTodos: CalendarTodo[]) => {
    if (dayTodos.length === 0) return null;
    return (
      <View className="flex-row items-center justify-center gap-0.5 mt-0.5">
        {dayTodos.slice(0, 4).map((item, idx) => (
          <View
            key={idx}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: priorityColor(item.priority) }}
          />
        ))}
        {dayTodos.length > 4 && (
          <Text className="text-[8px] text-gray-500 ml-0.5">+{dayTodos.length - 4}</Text>
        )}
      </View>
    );
  };

  // ==================== MONTH VIEW ====================

  const renderMonthView = () => {
    const totalCells = startDay + daysInMonth;
    const totalRows = Math.ceil(totalCells / 7);
    const totalSlots = totalRows * 7;

    const cells: React.ReactNode[] = [];

    for (let i = startDay - 1; i >= 0; i--) {
      cells.push(
        <View
          key={`prev-${i}`}
          className="items-center justify-start pt-1 border-b border-r border-gray-800/30 opacity-30"
          style={{ width: cellWidth, height: 64 }}
        >
          <Text className="text-xs text-gray-600 font-mono">{prevMonthDays - i}</Text>
        </View>,
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateNorm = normalizeDate(dateObj);
      const isToday = todayNorm === dateNorm;
      const dayTodos = getTodosForDate(day);
      const completedCount = dayTodos.filter((item) => item.completed).length;

      cells.push(
        <Pressable
          key={`curr-${day}`}
          onPress={() => handleDayPress(dateObj)}
          className={`items-center justify-start pt-1 border-b border-r border-gray-800/30 ${isToday ? 'bg-blue-500/10' : ''}`}
          style={{ width: cellWidth, height: 64 }}
        >
          <View className={`w-6 h-6 rounded-full items-center justify-center ${isToday ? 'bg-blue-500' : ''}`}>
            <Text className={`text-xs font-bold ${isToday ? 'text-white' : 'text-gray-300'}`}>
              {day}
            </Text>
          </View>
          {dayTodos.length > 0 && (
            <Text className="text-[9px] text-gray-400 mt-0.5">
              {completedCount}/{dayTodos.length}
            </Text>
          )}
          {renderPriorityDots(dayTodos)}
          {dayTodos.length === 0 && isToday && (
            <View className="mt-1 opacity-30">
              <Star size={8} color="#9ca3af" />
            </View>
          )}
        </Pressable>,
      );
    }

    const remaining = totalSlots - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push(
        <View
          key={`next-${i}`}
          className="items-center justify-start pt-1 border-b border-r border-gray-800/30 opacity-30"
          style={{ width: cellWidth, height: 64 }}
        >
          <Text className="text-xs text-gray-600 font-mono">{i}</Text>
        </View>,
      );
    }

    return (
      <View className="flex-1">
        <View className="flex-row border-b border-gray-700">
          {t.calendar.dayNames.map((name: string, idx: number) => (
            <View key={name} className="items-center py-2" style={{ width: cellWidth }}>
              <Text
                className={`text-[10px] font-bold tracking-wider ${idx === 0 ? 'text-red-400' : idx === 6 ? 'text-blue-400' : 'text-gray-400'}`}
              >
                {name}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap border-l border-gray-800/30">{cells}</View>
      </View>
    );
  };

  // ==================== WEEK VIEW ====================

  const renderWeekView = () => {
    const { start } = getWeekRange(currentDate);
    const days: React.ReactNode[] = [];

    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);
      const dateNorm = normalizeDate(dateObj);
      const isToday = todayNorm === dateNorm;
      const isPastDate = dateNorm < todayNorm;
      const dayTodos = getTodosForDateGeneric(dateObj);
      const dayOfWeek = dateObj.getDay();

      days.push(
        <Pressable
          key={`week-${i}`}
          onPress={() => handleDayPress(dateObj)}
          className={`flex-row items-stretch border-b border-gray-700 min-h-[56px] ${isToday ? 'bg-gray-800/40' : ''}`}
        >
          <View className="w-16 items-center justify-center py-2 border-r border-gray-700">
            <View className={`items-center justify-center ${isToday ? 'w-8 h-8 rounded-full bg-blue-500' : ''}`}>
              <Text
                className={`text-lg font-bold ${isToday ? 'text-white' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-300'}`}
              >
                {dateObj.getDate()}
              </Text>
            </View>
            <Text className={`text-[10px] mt-0.5 ${isToday ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>
              {t.calendar.dayNamesFull[dayOfWeek]}
            </Text>
          </View>

          <View className="flex-1 flex-row flex-wrap items-center gap-1.5 p-2">
            {dayTodos.length > 0 ? (
              dayTodos.map((todo) => (
                <TodoChip key={todo.id} todo={todo} isPastDate={isPastDate} onToggle={toggleComplete} />
              ))
            ) : (
              <Text className="text-xs text-gray-600 italic">{t.calendar.noMission}</Text>
            )}
          </View>
        </Pressable>,
      );
    }

    return (
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleCalendarRefresh}
            tintColor="#71B7FF" colors={['#71B7FF']} progressBackgroundColor="#1A1F2E" />
        }
      >
        {days}
      </ScrollView>
    );
  };

  // ==================== LIST VIEW ====================

  const renderListView = () => {
    const daysWithTodos: { date: Date; todos: CalendarTodo[] }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      daysWithTodos.push({ date: dateObj, todos: getTodosForDate(day) });
    }

    return (
      <ScrollView className="flex-1 px-2 py-2"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleCalendarRefresh}
            tintColor="#71B7FF" colors={['#71B7FF']} progressBackgroundColor="#1A1F2E" />
        }>
        {daysWithTodos.map(({ date, todos: dayTodos }) => {
          const dateNorm = normalizeDate(date);
          const isToday = todayNorm === dateNorm;
          const isPastDate = dateNorm < todayNorm;
          const dayOfWeek = date.getDay();

          return (
            <View key={date.getTime()}>
              <Pressable
                onPress={() => handleDayPress(date)}
                className={`flex-row items-center gap-3 px-3 py-2 rounded-lg ${isToday ? 'bg-blue-500/10 border border-blue-500/30' : ''}`}
              >
                <Text
                  className={`text-lg font-bold ${isToday ? 'text-blue-400' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-300'}`}
                >
                  {date.getDate()}
                </Text>
                <Text className={`text-xs ${isToday ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>
                  {t.calendar.dayNamesFull[dayOfWeek]}
                </Text>
                {isToday && (
                  <View className="px-2 py-0.5 rounded-full bg-blue-500/20">
                    <Text className="text-[10px] text-blue-400 font-bold">{t.common.today}</Text>
                  </View>
                )}
                {dayTodos.length > 0 && (
                  <Text className="ml-auto text-[10px] text-gray-500">
                    {dayTodos.filter((item) => item.completed).length}/{dayTodos.length}
                  </Text>
                )}
              </Pressable>

              {dayTodos.length > 0 && (
                <View className="pl-8 pr-2 py-1 gap-1">
                  {dayTodos.map((todo) => (
                    <TodoChip key={todo.id} todo={todo} isPastDate={isPastDate} onToggle={toggleComplete} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ==================== DAY VIEW ====================

  const renderDayView = () => {
    if (!selectedDate) return null;

    const dayTodos = getTodosForDateGeneric(selectedDate);
    const selectedNorm = normalizeDate(selectedDate);
    const isPastDate = selectedNorm < todayNorm;
    const isToday = selectedNorm === todayNorm;

    const completedTodos = dayTodos.filter((item) => item.completed);
    const incompleteTodos = dayTodos.filter((item) => !item.completed);
    const totalCount = dayTodos.length;
    const completedCount = completedTodos.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const renderDayTodoCard = (todo: CalendarTodo) => {
      const ghost = isGhostTodo(todo);

      let bgClass = 'bg-gray-800/60 border-gray-600';
      let iconEl = <CheckCircle2 size={18} color="#9ca3af" />;
      let statusLabel = isToday ? t.calendar.status.inProgress : t.calendar.status.scheduled;
      let statusBgClass = 'bg-gray-700/50';
      let statusTextClass = 'text-gray-400';
      let textClass = 'text-gray-200';

      if (todo.completed) {
        bgClass = 'bg-amber-900/20 border-amber-600/40';
        iconEl = <Trophy size={18} color="#d97706" />;
        statusLabel = t.calendar.status.completed;
        statusBgClass = 'bg-amber-900/30';
        statusTextClass = 'text-amber-400';
        textClass = 'text-amber-300 font-bold';
      } else if (ghost) {
        bgClass = 'bg-gray-800/30 border-gray-600 border-dashed';
        iconEl = <Lock size={18} color="#6b7280" />;
        statusLabel = t.calendar.status.locked;
        statusBgClass = 'bg-gray-700/30';
        statusTextClass = 'text-gray-500';
        textClass = 'text-gray-500';
      } else if (isPastDate) {
        bgClass = 'bg-gray-800 border-red-900/30 opacity-60';
        iconEl = <AlertCircle size={18} color="#ef4444" />;
        statusLabel = t.calendar.status.missed;
        statusBgClass = 'bg-red-900/20';
        statusTextClass = 'text-red-400';
        textClass = 'text-gray-400';
      }

      return (
        <Pressable
          key={todo.id}
          onPress={() => !ghost && toggleComplete(todo.id)}
          className={`flex-row items-center gap-3 p-4 rounded-xl border ${bgClass}`}
        >
          <View className="w-10 h-10 rounded-lg border border-gray-600 items-center justify-center bg-gray-800">
            {iconEl}
          </View>
          <View className="flex-1 min-w-0">
            <Text className={`text-sm leading-relaxed ${textClass}`} numberOfLines={2}>
              {todo.text}
            </Text>
            {todo.note ? (
              <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>
                {todo.note}
              </Text>
            ) : null}
          </View>
          <View className={`px-2 py-1 rounded-full ${statusBgClass}`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${statusTextClass}`}>
              {statusLabel}
            </Text>
          </View>
        </Pressable>
      );
    };

    return (
      <ScrollView className="flex-1 px-4 py-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleCalendarRefresh}
            tintColor="#71B7FF" colors={['#71B7FF']} progressBackgroundColor="#1A1F2E" />
        }>
        {/* Stats summary */}
        <View className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-900/30 border border-amber-600/40 items-center justify-center">
                <Trophy size={18} color="#d97706" />
              </View>
              <View>
                <Text className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                  {t.calendar.missionStatus}
                </Text>
                <Text className="text-lg font-bold text-gray-100">
                  {completedCount}/{totalCount}{' '}
                  <Text className="text-sm text-gray-400">{t.calendar.status.completed}</Text>
                </Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-amber-400">
              {totalCount > 0 ? Math.round(progressPercent) : 0}%
            </Text>
          </View>
          <View className="w-full h-2 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
            <View
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${progressPercent}%` }}
            />
          </View>
        </View>

        {completedTodos.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-2 h-2 rounded-full bg-amber-500" />
              <Text className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                {t.calendar.completedMissions}
              </Text>
              <Text className="text-xs text-gray-500">{completedTodos.length}</Text>
              <View className="flex-1 h-px bg-amber-900/30" />
            </View>
            <View className="gap-2.5">
              {completedTodos.map(renderDayTodoCard)}
            </View>
          </View>
        )}

        {incompleteTodos.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center gap-3 mb-3">
              <View className={`w-2 h-2 rounded-full ${isPastDate ? 'bg-red-500/60' : 'bg-gray-500/30'}`} />
              <Text className={`text-sm font-bold uppercase tracking-wider ${isPastDate ? 'text-red-400' : 'text-gray-400'}`}>
                {t.calendar.incompleteMissions}
              </Text>
              <Text className="text-xs text-gray-500">{incompleteTodos.length}</Text>
              <View className={`flex-1 h-px ${isPastDate ? 'bg-red-900/20' : 'bg-gray-700'}`} />
            </View>
            <View className="gap-2.5">
              {incompleteTodos.map(renderDayTodoCard)}
            </View>
          </View>
        )}

        {dayTodos.length === 0 && (
          <View className="items-center py-16">
            <View className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 items-center justify-center mb-4">
              <Star size={24} color="#6b7280" />
            </View>
            <Text className="text-gray-500 text-sm font-medium">{t.calendar.emptyDay}</Text>
            <Text className="text-gray-600 text-xs mt-1">{t.calendar.emptyDayHint}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ====================================================================
  // Main render
  // ====================================================================

  const showViewControls = viewMode !== 'day';

  // Swipe gesture for month/week/day navigation
  const contentTranslateX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);

  const navigateWithAnimation = useCallback((direction: 'prev' | 'next') => {
    Haptics.selectionAsync();
    const exitX = direction === 'next' ? -60 : 60;
    const enterX = direction === 'next' ? 60 : -60;

    contentTranslateX.value = withTiming(exitX, { duration: 120, easing: Easing.in(Easing.cubic) }, () => {
      if (direction === 'next') {
        runOnJS(handleNext)();
      } else {
        runOnJS(handlePrev)();
      }
      contentTranslateX.value = enterX;
      contentOpacity.value = 0.3;
      contentTranslateX.value = withSpring(0, { damping: 18, stiffness: 120 });
      contentOpacity.value = withTiming(1, { duration: 200 });
    });
  }, [handlePrev, handleNext]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX < -50 && Math.abs(e.velocityX) > 100) {
        runOnJS(navigateWithAnimation)('next');
      } else if (e.translationX > 50 && Math.abs(e.velocityX) > 100) {
        runOnJS(navigateWithAnimation)('prev');
      }
    });

  const contentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTranslateX.value }],
    opacity: contentOpacity.value,
  }));

  return (
    <View className="flex-1 bg-[#0A0E1A]">
      {/* Header */}
      <View className="bg-[#0A0E1A] px-3 py-2 flex-row items-center justify-between border-b border-white/5">
        <View className="flex-row items-center gap-3">
          {viewMode === 'day' && (
            <Pressable onPress={handleBackFromDay} className="p-1.5 rounded-full" accessibilityLabel={t.common.back}>
              <ArrowLeft size={20} color="#9ca3af" />
            </Pressable>
          )}

          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => { Haptics.selectionAsync(); handlePrev(); }} className="p-1.5 rounded-full" accessibilityLabel={t.calendar.prev}>
              <ChevronLeft size={18} color="#9ca3af" />
            </Pressable>
            <Text
              className={`font-bold text-gray-100 text-center tracking-wide ${viewMode === 'day' ? 'text-sm min-w-[180px]' : 'text-base min-w-[100px]'}`}
            >
              {getHeaderTitle()}
            </Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); handleNext(); }} className="p-1.5 rounded-full" accessibilityLabel={t.calendar.next}>
              <ChevronRight size={18} color="#9ca3af" />
            </Pressable>
          </View>
        </View>

        {showViewControls && (
          <View className="flex-row items-center gap-1">
            <Pressable onPress={goToToday} className="px-2.5 py-1 rounded-full bg-gray-800 mr-1">
              <Text className="text-[10px] text-blue-400 font-bold">{t.common.today}</Text>
            </Pressable>
            <Pressable
              onPress={() => switchViewMode('month')}
              className={`p-1.5 rounded-md ${viewMode === 'month' ? 'bg-blue-500/20' : ''}`}
            >
              <LayoutGrid size={16} color={viewMode === 'month' ? '#3b82f6' : '#6b7280'} />
            </Pressable>
            <Pressable
              onPress={() => switchViewMode('week')}
              className={`p-1.5 rounded-md ${viewMode === 'week' ? 'bg-blue-500/20' : ''}`}
            >
              <CalendarIcon size={16} color={viewMode === 'week' ? '#3b82f6' : '#6b7280'} />
            </Pressable>
            <Pressable
              onPress={() => switchViewMode('list')}
              className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-blue-500/20' : ''}`}
            >
              <List size={16} color={viewMode === 'list' ? '#3b82f6' : '#6b7280'} />
            </Pressable>
          </View>
        )}
      </View>

      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'list' && renderListView()}
          {viewMode === 'day' && renderDayView()}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
