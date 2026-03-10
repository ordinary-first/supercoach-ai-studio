import React, { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sun, CheckCircle2, Lock, AlertCircle, Trophy, Star, ArrowLeft } from 'lucide-react';
import { ToDoItem, RepeatFrequency } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useTranslation } from '../i18n/useTranslation';

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  onToggleToDo: (id: string) => void;
  viewMode?: 'month' | 'week' | 'list';
  onViewModeChange?: (mode: 'month' | 'week' | 'list') => void;
}

type ViewMode = 'month' | 'week' | 'list' | 'day';

// Logic to check if the targetDate falls on the recurrence pattern of the task.
// Since we have complex patterns (Weekly-2, Weekly-3), we need to simulate the sequence.
const checkRecurrenceMatch = (todo: ToDoItem, targetDate: Date): boolean => {
  if (!todo.repeat) return false;

  // Use DueDate or CreatedAt as the anchor
  const anchorTimestamp = todo.dueDate || todo.createdAt;

  // Normalize dates to start of day
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const start = new Date(anchorTimestamp);
  start.setHours(0, 0, 0, 0);

  // If target is before start, it's not a match
  if (target.getTime() < start.getTime()) return false;

  // --- OPTIMIZED CHECKS ---
  const day = target.getDay();

  if (todo.repeat === 'daily') return true;

  if (todo.repeat === 'weekdays') {
    return day !== 0 && day !== 6; // Mon-Fri
  }

  if (todo.repeat === 'weekly') {
    return day === start.getDay();
  }

  if (todo.repeat === 'monthly') {
    return target.getDate() === start.getDate();
  }

  // --- COMPLEX PATTERN SIMULATION ---
  /*
     Pattern Logic based on App.tsx calculateNextDate:
     Weekly-2: Mon(1), Thu(4)  (If started on other days, it snaps to this pattern)
     Weekly-3: Mon(1), Wed(3), Fri(5)
     Weekly-4: Mon(1), Tue(2), Thu(4), Fri(5)
     Weekly-5: Weekdays (Mon-Fri)
     Weekly-6: Mon-Sat
  */

  switch (todo.repeat) {
    case 'weekly-2':
      return day === 1 || day === 4;
    case 'weekly-3':
      return day === 1 || day === 3 || day === 5;
    case 'weekly-4':
      return day === 1 || day === 2 || day === 4 || day === 5;
    case 'weekly-5':
      return day >= 1 && day <= 5;
    case 'weekly-6':
      return day >= 1 && day <= 6;
    default:
      return false;
  }
}

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, todos, onToggleToDo, viewMode: externalViewMode, onViewModeChange }) => {
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('month');

  // Sync with external viewMode. External selection should always win.
  useEffect(() => {
    if (externalViewMode && isOpen) {
      setViewMode(externalViewMode);
      setSelectedDate(null);
    }
  }, [externalViewMode, isOpen]);

  const focusTrapRef = useFocusTrap(isOpen);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getStartDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Auto-scroll to today when entering list view
  useEffect(() => {
    if (viewMode === 'list') {
      requestAnimationFrame(() => {
        const todayEl = document.querySelector('[data-today="true"]');
        todayEl?.scrollIntoView({ block: 'start' });
      });
    }
  }, [viewMode, month, year]);

  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  // Helper to normalize date for comparison (strip time)
  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  // Week range helper
  const getWeekRange = (date: Date): { start: Date; end: Date } => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  // Generic getTodosForDate that works with any Date object (not just current month)
  const getTodosForDateGeneric = useCallback((targetDate: Date) => {
    const tYear = targetDate.getFullYear();
    const tMonth = targetDate.getMonth();
    const tDay = targetDate.getDate();
    const targetStart = new Date(tYear, tMonth, tDay, 0, 0, 0).getTime();
    const targetEnd = new Date(tYear, tMonth, tDay, 23, 59, 59).getTime();

    // 1. Real Active Tasks
    const realTodos = todos.filter(t => {
      if (t.dueDate) {
        return t.dueDate >= targetStart && t.dueDate <= targetEnd;
      }
      if (t.isMyDay) {
        const today = new Date();
        const isTodayCell = today.getDate() === tDay && today.getMonth() === tMonth && today.getFullYear() === tYear;
        if (isTodayCell && !t.completed) return true;
      }
      return false;
    });

    // 2. Ghost tasks
    const ghosts = todos.filter(t => {
      if (t.completed) return false;
      if (!t.repeat) return false;
      const isRecurrenceDate = checkRecurrenceMatch(t, targetDate);
      if (!isRecurrenceDate) return false;
      const isAlreadyShownAsReal = realTodos.some(real => real.id === t.id);
      if (isAlreadyShownAsReal) return false;
      return true;
    }).map(t => ({
      ...t,
      id: `ghost_${t.id}_${tDay}_${tMonth}`,
      isGhost: true,
      completed: false
    }));

    return [...realTodos, ...ghosts];
  }, [todos]);

  // Original getTodosForDate for month view (uses year/month from currentDate)
  const getTodosForDate = (day: number) => {
    const targetDate = new Date(year, month, day);
    return getTodosForDateGeneric(targetDate);
  };

  // Navigation handlers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date());
  };

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const prevDay = () => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d);
    }
  };
  const nextDay = () => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d);
    }
  };

  // Click handler for day cells
  const handleDayClick = (date: Date) => {
    setPreviousViewMode(viewMode);
    setSelectedDate(date);
    setViewMode('day');
  };

  // Back from day view
  const handleBackFromDay = () => {
    setViewMode(previousViewMode);
    setSelectedDate(null);
  };

  // View mode switch
  const switchViewMode = (mode: ViewMode) => {
    if (mode === 'day') return;
    setViewMode(mode);
    setSelectedDate(null);
    if (mode !== 'day') {
      onViewModeChange?.(mode as 'month' | 'week' | 'list');
    }
  };

  // Day name helpers
  const dayNames = t.calendar.dayNames;
  const dayNamesFull = t.calendar.dayNamesFull;

  // Format week range for header
  const formatWeekRange = () => {
    const { start, end } = getWeekRange(currentDate);
    const sy = start.getFullYear();
    const sm = String(start.getMonth() + 1).padStart(2, '0');
    const sd = String(start.getDate()).padStart(2, '0');
    const em = String(end.getMonth() + 1).padStart(2, '0');
    const ed = String(end.getDate()).padStart(2, '0');
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${sy}.${sm}.${sd} - ${ed}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${sy}.${sm}.${sd} - ${em}.${ed}`;
    }
    const ey = end.getFullYear();
    return `${sy}.${sm}.${sd} - ${ey}.${em}.${ed}`;
  };

  // Format day for header
  const formatDayHeader = () => {
    if (!selectedDate) return '';
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth() + 1;
    const d = selectedDate.getDate();
    const dayOfWeek = dayNamesFull[selectedDate.getDay()];
    if (language === 'ko') {
      return `${y}${t.calendar.yearSuffix} ${m}${t.calendar.monthSuffix} ${d}${t.calendar.daySuffix} ${dayOfWeek}`;
    }
    return `${dayOfWeek}, ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  // Navigation title
  const getHeaderTitle = () => {
    if (viewMode === 'month' || viewMode === 'list') {
      return `${year}. ${String(month + 1).padStart(2, '0')}`;
    }
    if (viewMode === 'week') {
      return formatWeekRange();
    }
    if (viewMode === 'day') {
      return formatDayHeader();
    }
    return '';
  };

  // Navigation actions based on view mode
  const handlePrev = () => {
    if (viewMode === 'month' || viewMode === 'list') prevMonth();
    else if (viewMode === 'week') prevWeek();
    else if (viewMode === 'day') prevDay();
  };

  const handleNext = () => {
    if (viewMode === 'month' || viewMode === 'list') nextMonth();
    else if (viewMode === 'week') nextWeek();
    else if (viewMode === 'day') nextDay();
  };

  // Render a single todo item in the calendar cell (shared between month and week views)
  const renderTodoCell = (todo: any, isPastDate: boolean, isGhost: boolean) => {
    let itemStyle = "";
    let icon = null;
    let glowEffect = "";

    if (todo.completed) {
      itemStyle = "bg-gradient-to-r from-th-accent to-blue-400 text-th-text-inverse border border-th-accent/20";
      glowEffect = "shadow-[0_0_12px_var(--shadow-glow)] z-10 scale-[1.02]";
      icon = <Trophy size={10} className="fill-current" />;
    } else if (isGhost) {
      itemStyle = "bg-th-surface/30 text-th-text-tertiary border border-th-border border-dashed backdrop-blur-[2px] cursor-not-allowed";
      icon = <Lock size={10} className="text-th-text-muted" />;
    } else if (isPastDate && !todo.completed) {
      itemStyle = "bg-th-surface text-red-500/80 border border-red-500/10 opacity-60 grayscale";
      icon = <AlertCircle size={10} className="text-current" />;
    } else {
      itemStyle = "bg-th-surface text-th-text-secondary border border-th-border backdrop-blur-sm";
      icon = <Lock size={10} className="text-th-text-tertiary" />;
    }

    return (
      <div
        key={todo.id}
        onClick={(e) => {
          e.stopPropagation();
          if (!isGhost) onToggleToDo(todo.id);
        }}
        className={`
          relative flex items-center gap-2 p-1.5 rounded-md text-[10px] font-medium
          transition-all duration-300 transform
          ${!isGhost ? 'hover:scale-105 hover:z-20 cursor-pointer' : ''}
          ${itemStyle} ${glowEffect}
        `}
        title={isGhost ? t.calendar.lockedMission : todo.text}
      >
        {todo.completed && (
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50 rounded-md pointer-events-none"></div>
        )}
        <div className="shrink-0">{icon}</div>
        <span className={`truncate ${todo.completed ? 'font-bold' : ''}`}>
          {todo.text}
        </span>
      </div>
    );
  };

  // ==================== MONTH VIEW ====================
  const renderCalendarDays = () => {
    const days = [];
    const totalCellsNeeded = startDay + daysInMonth;
    const totalRows = Math.ceil(totalCellsNeeded / 7);
    const totalSlots = totalRows * 7;

    // Prev Month (Placeholder)
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(
        <div key={`prev-${i}`} className="min-h-0 md:min-h-0 bg-th-header border-b border-r border-th-border-subtle opacity-20 p-1 text-th-text-muted font-mono text-xs">
          {prevMonthDays - i}
        </div>
      );
    }

    // Current Month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const isToday = normalizeDate(new Date()) === normalizeDate(dateObj);
      const isPastDate = normalizeDate(dateObj) < normalizeDate(new Date());

      const dayTodos = getTodosForDate(day);

      days.push(
        <div
          key={`curr-${day}`}
          onClick={() => handleDayClick(dateObj)}
          className={`min-h-0 md:min-h-0 border-b border-r border-th-border p-1 relative group transition-all duration-300 cursor-pointer ${isToday ? 'bg-th-accent-muted shadow-[inset_0_0_20px_var(--shadow-glow)]' : 'bg-transparent hover:bg-th-surface'}`}
        >
          {/* Date Header */}
          <div className="flex justify-between items-start mb-0.5">
            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-th-accent text-th-text-inverse shadow-[0_0_10px_var(--shadow-glow)]' : 'text-th-text-secondary group-hover:text-th-text'}`}>
              {day}
            </span>
          </div>

          {/* Tasks Container */}
          <div className="space-y-1.5 overflow-y-auto max-h-[28px] md:max-h-[80px] scrollbar-hide">
            {dayTodos.map((todo: any) => renderTodoCell(todo, isPastDate, todo.isGhost))}

            {/* Empty State placeholder for Today */}
            {dayTodos.length === 0 && isToday && (
              <div className="h-full flex items-center justify-center pt-2 opacity-30">
                <div className="border border-dashed border-th-border rounded px-2 py-1 text-[9px] text-th-text-tertiary flex items-center gap-1">
                  <Star size={8} /> {t.calendar.noMission}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Next Month Padding
    const remainingSlots = totalSlots - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      days.push(
        <div key={`next-${i}`} className="min-h-0 md:min-h-0 bg-th-header border-b border-r border-th-border-subtle opacity-20 p-1 text-th-text-muted font-mono text-xs">
          {i}
        </div>
      );
    }

    return days;
  };

  // ==================== WEEK VIEW ====================
  const renderWeekDays = () => {
    const { start } = getWeekRange(currentDate);
    const days = [];

    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);
      const isToday = normalizeDate(new Date()) === normalizeDate(dateObj);
      const isPastDate = normalizeDate(dateObj) < normalizeDate(new Date());
      const dayTodos = getTodosForDateGeneric(dateObj);
      const dayOfWeek = dateObj.getDay();

      days.push(
        <div
          key={`week-${i}`}
          onClick={() => handleDayClick(dateObj)}
          className={`flex-1 flex items-stretch border-b border-th-border cursor-pointer transition-all duration-200 min-h-[56px] ${isToday
              ? 'bg-th-surface'
              : 'hover:bg-white/[0.03]'
            }`}
        >
          {/* Date column */}
          <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-2 border-r border-th-border ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : ''
            }`}>
            <span className={`text-lg font-bold font-display ${isToday
                ? 'w-8 h-8 flex items-center justify-center rounded-full bg-th-accent text-th-text-inverse shadow-[0_0_10px_var(--shadow-glow)]'
                : 'text-gray-300'
              }`}>
              {dateObj.getDate()}
            </span>
            <span className={`text-[10px] mt-0.5 ${isToday ? 'text-th-accent font-bold' : 'text-th-text-tertiary'}`}>
              {dayNamesFull[dayOfWeek]}
            </span>
          </div>

          {/* Todos column */}
          <div className="flex-1 flex flex-wrap items-center gap-1.5 p-2 min-h-[56px]">
            {dayTodos.length > 0 ? (
              dayTodos.map((todo: any) => renderTodoCell(todo, isPastDate, todo.isGhost))
            ) : (
              <span className="text-xs text-th-text-muted italic">{t.calendar.noMission}</span>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  // ==================== DAY DETAIL VIEW ====================
  const renderDayView = () => {
    if (!selectedDate) return null;

    const dayTodos = getTodosForDateGeneric(selectedDate);
    const isPastDate = normalizeDate(selectedDate) < normalizeDate(new Date());
    const isToday = normalizeDate(selectedDate) === normalizeDate(new Date());

    const completedTodos = dayTodos.filter((t: any) => t.completed);
    const incompleteTodos = dayTodos.filter((t: any) => !t.completed);
    const totalCount = dayTodos.length;
    const completedCount = completedTodos.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const renderDayTodoCard = (todo: any) => {
      const isGhost = todo.isGhost;

      // Determine style
      let cardStyle = "";
      let icon = null;
      let statusLabel = "";
      let labelStyle = "";

      if (todo.completed) {
        cardStyle = "bg-gradient-to-r from-neon-lime/20 to-green-400/10 border-th-accent-border shadow-[0_0_20px_var(--shadow-glow)]";
        icon = <Trophy size={18} className="text-th-accent fill-neon-lime/50" />;
        statusLabel = t.calendar.status.completed;
        labelStyle = "text-th-accent bg-neon-lime/10";
      } else if (isGhost) {
        cardStyle = "bg-white/[0.03] border-th-border-subtle border-dashed";
        icon = <Lock size={18} className="text-th-text-muted" />;
        statusLabel = t.calendar.status.locked;
        labelStyle = "text-th-text-muted bg-th-surface";
      } else if (isPastDate) {
        cardStyle = "bg-th-elevated border-th-border opacity-70 grayscale";
        icon = <AlertCircle size={18} className="text-red-500/60" />;
        statusLabel = t.calendar.status.missed;
        labelStyle = "text-red-400/80 bg-red-500/10";
      } else {
        cardStyle = "bg-th-surface border-th-border hover:border-th-accent/50 hover:bg-th-surface-hover";
        icon = <CheckCircle2 size={18} className="text-th-text-secondary" />;
        statusLabel = isToday ? t.calendar.status.inProgress : t.calendar.status.scheduled;
        labelStyle = isToday ? "text-th-accent bg-th-accent-muted" : "text-th-text-secondary bg-th-surface";
      }

      return (
        <div
          key={todo.id}
          onClick={() => !isGhost && onToggleToDo(todo.id)}
          className={`
            relative flex items-center gap-4 p-4 rounded-xl border
            transition-all duration-300 transform
            ${!isGhost ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : 'cursor-not-allowed'}
            ${cardStyle}
          `}
        >
          {/* Completed sheen */}
          {todo.completed && (
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50 rounded-xl pointer-events-none"></div>
          )}

          {/* Icon */}
          <div className="shrink-0 w-10 h-10 rounded-lg bg-th-surface border border-th-border flex items-center justify-center">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-relaxed ${todo.completed ? 'text-th-text font-bold' : isGhost ? 'text-th-text-muted' : isPastDate ? 'text-th-text-tertiary' : 'text-gray-200'}`}>
              {todo.text}
            </p>
            {todo.note && (
              <p className="text-xs text-th-text-tertiary mt-1 truncate">{todo.note}</p>
            )}
          </div>

          {/* Status Badge */}
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${labelStyle}`}>
            {statusLabel}
          </span>
        </div>
      );
    };

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-[var(--dock-h)] relative z-0">
        {/* Stats Summary */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-th-surface border border-th-border rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-lime/10 border border-neon-lime/20 flex items-center justify-center">
                  <Trophy size={18} className="text-th-accent" />
                </div>
                <div>
                  <p className="text-xs text-th-text-tertiary uppercase tracking-wider font-bold">{t.calendar.missionStatus}</p>
                  <p className="text-lg font-display font-bold text-th-text">
                    {completedCount}/{totalCount} <span className="text-sm text-th-text-secondary font-body">{t.calendar.status.completed}</span>
                  </p>
                </div>
              </div>
              <span className="text-2xl font-display font-bold text-th-accent">
                {totalCount > 0 ? Math.round(progressPercent) : 0}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-th-surface rounded-full overflow-hidden border border-th-border">
              <div
                className="h-full bg-gradient-to-r from-neon-lime to-green-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_var(--shadow-glow)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Todo Sections */}
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Completed Section */}
          {completedTodos.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-th-accent shadow-[0_0_6px_var(--shadow-glow)]"></div>
                <h3 className="text-sm font-bold text-th-accent uppercase tracking-wider font-display">
                  {t.calendar.completedMissions}
                </h3>
                <span className="text-xs text-th-text-muted font-mono">{completedTodos.length}</span>
                <div className="flex-1 h-px bg-neon-lime/10"></div>
              </div>
              <div className="space-y-2.5">
                {completedTodos.map(renderDayTodoCard)}
              </div>
            </div>
          )}

          {/* Incomplete Section */}
          {incompleteTodos.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2 h-2 rounded-full ${isPastDate ? 'bg-red-500/60' : 'bg-white/30'}`}></div>
                <h3 className={`text-sm font-bold uppercase tracking-wider font-display ${isPastDate ? 'text-red-400/80' : 'text-th-text-secondary'}`}>
                  {t.calendar.incompleteMissions}
                </h3>
                <span className="text-xs text-th-text-muted font-mono">{incompleteTodos.length}</span>
                <div className={`flex-1 h-px ${isPastDate ? 'bg-red-500/10' : 'bg-th-surface'}`}></div>
              </div>
              <div className="space-y-2.5">
                {incompleteTodos.map(renderDayTodoCard)}
              </div>
            </div>
          )}

          {/* Empty state */}
          {dayTodos.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-th-surface border border-th-border flex items-center justify-center mx-auto mb-4">
                <Star size={24} className="text-th-text-muted" />
              </div>
              <p className="text-th-text-tertiary text-sm font-medium">{t.calendar.emptyDay}</p>
              <p className="text-gray-700 text-xs mt-1">{t.calendar.emptyDayHint}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== LIST VIEW ====================
  const renderListView = () => {
    const daysWithTodos: { date: Date; todos: any[] }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dayTodos = getTodosForDate(day);
      daysWithTodos.push({ date: dateObj, todos: dayTodos });
    }

    return (
      <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-[var(--dock-h)] relative z-0">
        <div className="space-y-1">
          {daysWithTodos.map(({ date, todos: dayTodos }) => {
            const isToday = normalizeDate(new Date()) === normalizeDate(date);
            const isPastDate = normalizeDate(date) < normalizeDate(new Date());
            const dayOfWeek = date.getDay();

            return (
              <div key={date.getTime()}>
                {/* Date header */}
                <div
                  data-today={isToday ? "true" : undefined}
                  onClick={() => handleDayClick(date)}
                  className={`sticky top-0 z-10 flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${isToday
                      ? 'bg-neon-lime/10 border border-neon-lime/20'
                      : 'bg-th-overlay backdrop-blur-sm hover:bg-th-surface'
                    }`}
                >
                  <span className={`text-lg font-bold font-display ${isToday ? 'text-th-accent' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-300'
                    }`}>
                    {date.getDate()}
                  </span>
                  <span className={`text-xs ${isToday ? 'text-th-accent font-bold' : 'text-th-text-tertiary'}`}>
                    {dayNamesFull[dayOfWeek]}
                  </span>
                  {isToday && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neon-lime/20 text-th-accent font-bold">{t.common.today}</span>
                  )}
                  {dayTodos.length > 0 && (
                    <span className="ml-auto text-[10px] text-th-text-tertiary">
                      {dayTodos.filter((t: any) => t.completed).length}/{dayTodos.length}
                    </span>
                  )}
                </div>

                {/* Todos */}
                {dayTodos.length > 0 && (
                  <div className="pl-8 pr-2 py-1.5 space-y-1">
                    {dayTodos.map((todo: any) => renderTodoCell(todo, isPastDate, todo.isGhost))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="apple-tab-shell fixed inset-0 z-50 flex flex-col font-body text-th-text">

      {/* Ambient Background Glow */}
      <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-neon-lime/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <div className="apple-glass-header px-3 md:px-8 py-1.5 md:py-2 flex gap-2 md:gap-3 justify-between items-center z-10">
        <div className="flex items-center gap-3 md:gap-6">
          {/* Back button in day view */}
          {viewMode === 'day' && (
            <button
              onClick={handleBackFromDay}
              className="flex items-center gap-2 text-th-text-secondary hover:text-th-text transition-colors p-1.5 rounded-full hover:bg-th-surface-hover"
              aria-label={t.common.back}
            >
              <ArrowLeft size={20} />
            </button>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-colors" aria-label={t.calendar.prev}>
              <ChevronLeft size={18} />
            </button>
            <h2 className={`apple-tab-title font-bold text-th-text text-center font-display tracking-wide ${viewMode === 'day' ? 'text-sm md:text-base min-w-[180px]' : 'text-base min-w-[120px]'}`}>
              {getHeaderTitle()}
            </h2>
            <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-colors" aria-label={t.calendar.next}>
              <ChevronRight size={18} />
            </button>
          </div>

        </div>

      </div>

      {/* ==================== CONTENT AREA ==================== */}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="flex-1 overflow-hidden flex flex-col p-1 md:p-3 lg:p-6 pb-[var(--dock-h)] relative z-0 animate-in fade-in duration-300">
          {/* Week Headers */}
          <div className="apple-glass-panel grid grid-cols-7 border-b border-th-border mb-0 rounded-t-lg">
            {dayNames.map((day, idx) => (
              <div key={day} className={`text-center py-1.5 font-display font-bold text-[10px] tracking-wider ${idx === 0 ? 'text-red-400' : (idx === 6 ? 'text-blue-400' : 'text-th-text-secondary')}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="apple-glass-panel grid grid-cols-7 flex-1 border-l border-th-border auto-rows-fr rounded-b-lg overflow-hidden">
            {renderCalendarDays()}
          </div>
        </div>
      )}

      {/* Week View (Vertical) */}
      {viewMode === 'week' && (
        <div className="flex-1 overflow-y-auto flex flex-col p-1 md:p-3 pb-[var(--dock-h)] relative z-0 animate-in fade-in duration-300">
          <div className="apple-glass-panel flex-1 flex flex-col rounded-lg overflow-hidden">
            {renderWeekDays()}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in duration-300">
          {renderListView()}
        </div>
      )}

      {/* Day Detail View */}
      {viewMode === 'day' && (
        <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in duration-300">
          {renderDayView()}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
