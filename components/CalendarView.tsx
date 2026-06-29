import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Lock, Trophy, Star, ArrowLeft, Plus, X, Clock, Sparkles, Pencil, Trash2, Check } from 'lucide-react';
import { ToDoItem, RepeatFrequency } from '../types';
import { matchesOn } from '../lib/recurrence';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useTranslation } from '../i18n/useTranslation';

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  onToggleToDo: (id: string) => void;
  onAddToDo: (text: string, extras?: Partial<ToDoItem>) => void;
  viewMode?: 'month' | 'week' | 'list';
  onViewModeChange?: (mode: 'month' | 'week' | 'list') => void;
  addTriggerRef?: React.MutableRefObject<(() => void) | null>;
  onDeleteToDo?: (id: string) => void;
  onUpdateToDo?: (id: string, updates: Partial<ToDoItem>) => void;
}

const REPEAT_CHIPS = ['none', 'daily', 'weekdays', 'weekly', 'weekly-3'] as const;
const LAST_REPEAT_KEY = 'sc_cal_last_repeat';

// Quick-pick times for the capsule (4 keeps the chip row thumb-scrollable on 380px)
const TIME_PRESETS = [
  { key: 'm7', h: 7, m: 0 },
  { key: 'm9', h: 9, m: 0 },
  { key: 'noon', h: 12, m: 0 },
  { key: 'e18', h: 18, m: 0 },
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

// Locale-aware wall-clock formatting (ko → "오전 7:00", en → "7:00 AM")
const fmtTime = (h: number, m: number, lang: string) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: 'numeric', minute: '2-digit' });
};

type ViewMode = 'month' | 'week' | 'list' | 'day';

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, todos, onToggleToDo, onAddToDo, viewMode: externalViewMode, onViewModeChange, addTriggerRef, onDeleteToDo, onUpdateToDo }) => {
  const { t, language } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  // Capsule state (quick-add from any cell without navigating away)
  const [capsuleDate, setCapsuleDate] = useState<Date | null>(null);
  const [capsuleText, setCapsuleText] = useState('');
  const [capsuleRepeat, setCapsuleRepeat] = useState<RepeatFrequency>(() => {
    try { return (localStorage.getItem(LAST_REPEAT_KEY) as RepeatFrequency) ?? null; } catch { return null; }
  });
  // Optional time-of-day for the capsule (default: all-day, no time shown)
  const [capsuleHasTime, setCapsuleHasTime] = useState(false);
  const [capsuleTime, setCapsuleTime] = useState<{ h: number; m: number }>({ h: 9, m: 0 });
  const [timeOpen, setTimeOpen] = useState(false);
  const capsuleInputRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('month');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Mobile keyboard height via VirtualKeyboard API (overlays-content 모드).
  // ToDoList와 동일한 방식 — 키보드가 열리면 퀵추가 캡슐을 키보드 위로 올린다.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const nav = navigator as unknown as { virtualKeyboard?: { overlaysContent: boolean; boundingRect: DOMRect; addEventListener: (e: string, fn: () => void) => void; removeEventListener: (e: string, fn: () => void) => void } };
    if (!nav.virtualKeyboard) return;
    nav.virtualKeyboard.overlaysContent = true;
    const onChange = () => setKeyboardHeight(Math.round(nav.virtualKeyboard!.boundingRect.height));
    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () => nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

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
      const isRecurrenceDate = matchesOn(t, targetDate);
      if (!isRecurrenceDate) return false;
      const isAlreadyShownAsReal = realTodos.some(real => real.id === t.id);
      if (isAlreadyShownAsReal) return false;
      return true;
    }).map(t => ({
      ...t,
      id: `ghost_${t.id}_${tYear}_${tMonth}_${tDay}`,
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
  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDate(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDate(null); };
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

  // Tap the date-number badge → drill into day detail view
  const handleDateDrill = (date: Date) => {
    setCapsuleDate(null);
    setPreviousViewMode(viewMode);
    setSelectedDate(date);
    setViewMode('day');
  };

  // Tap blank area of a cell → open quick-add capsule in-place
  const handleCellAdd = (date: Date) => {
    setCapsuleDate(date);
    window.setTimeout(() => capsuleInputRef.current?.focus(), 50);
  };

  // Month cell click: first tap selects, second tap on same date drills to day view
  const handleCellClick = (date: Date) => {
    if (selectedDate && normalizeDate(selectedDate) === normalizeDate(date)) {
      handleDateDrill(date);
    } else {
      setSelectedDate(date);
    }
  };

  // Back from day view
  const handleBackFromDay = () => {
    closeCapsule();
    setViewMode(previousViewMode);
    setSelectedDate(null);
  };

  // Seal (confirm) the capsule — adds the mission and saves last-used repeat
  const handleSealCapsule = useCallback(() => {
    const text = capsuleText.trim();
    if (!text || !capsuleDate) return;
    const due = new Date(capsuleDate);
    // Timed → encode the chosen wall-clock; all-day → noon anchor (guards DST/day-shift)
    if (capsuleHasTime) due.setHours(capsuleTime.h, capsuleTime.m, 0, 0);
    else due.setHours(12, 0, 0, 0);
    const extras: Partial<ToDoItem> = { dueDate: due.getTime() };
    if (capsuleHasTime) extras.hasTime = true;
    if (capsuleRepeat) extras.repeat = capsuleRepeat;
    onAddToDo(text, extras);
    try { localStorage.setItem(LAST_REPEAT_KEY, capsuleRepeat ?? ''); } catch {}
    setCapsuleText('');
    setCapsuleDate(null);
    setCapsuleHasTime(false);
    setTimeOpen(false);
    setCapsuleTime({ h: 9, m: 0 });
  }, [capsuleText, capsuleRepeat, capsuleHasTime, capsuleTime, capsuleDate, onAddToDo]);

  const handleSaveEdit = useCallback((id: string) => {
    const text = editingText.trim();
    if (text) onUpdateToDo?.(id, { text });
    setEditingTodoId(null);
    setEditingText('');
  }, [editingText, onUpdateToDo]);

  const closeCapsule = () => {
    setCapsuleDate(null);
    setCapsuleText('');
    setCapsuleHasTime(false);
    setTimeOpen(false);
    setCapsuleTime({ h: 9, m: 0 });
  };

  // Header + button: if any date is selected opens capsule for it; otherwise goes to today's day view
  const handleHeaderAdd = useCallback(() => {
    if (selectedDate) {
      setCapsuleDate(selectedDate);
      window.setTimeout(() => capsuleInputRef.current?.focus(), 50);
    } else {
      handleDateDrill(new Date());
    }
  }, [selectedDate]);

  // Expose add trigger to parent (App.tsx header button)
  useEffect(() => {
    if (addTriggerRef) addTriggerRef.current = handleHeaderAdd;
  }, [addTriggerRef, handleHeaderAdd]);

  // View mode switch
  const switchViewMode = (mode: ViewMode) => {
    if (mode === 'day') return;
    setViewMode(mode);
    setSelectedDate(null);
    onViewModeChange?.(mode);
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

  // Render a single todo item in the calendar cell (shared between month and week views).
  // `stacked` = full-width vertical list (week/list views): drop the scale "pop" so bars stay
  // edge-aligned. Tiny month cells keep the scale since chips are content-width and never overflow.
  const renderTodoCell = (todo: any, isGhost: boolean, stacked = false) => {
    let itemStyle = "";
    let icon = null;
    let glowEffect = "";

    if (todo.completed) {
      itemStyle = "bg-th-sacred-muted text-th-text border border-th-sacred";
      glowEffect = `shadow-[0_0_16px_-4px_var(--shadow-sacred)] z-10${stacked ? '' : ' scale-[1.02]'}`;
      icon = <Trophy size={10} className="text-th-sacred fill-current" />;
    } else if (isGhost) {
      itemStyle = "bg-th-surface/30 text-th-text-tertiary border border-th-border border-dashed backdrop-blur-[2px] cursor-not-allowed";
      icon = <Lock size={10} className="text-th-text-muted" />;
    } else {
      // Not-yet-done (past / today / future) all render neutral — never red "missed".
      itemStyle = "bg-th-surface text-th-text-secondary border border-th-border backdrop-blur-sm";
      icon = <Lock size={10} className="text-th-text-tertiary" />;
    }

    const cellTime = todo.hasTime && todo.dueDate
      ? fmtTime(new Date(todo.dueDate).getHours(), new Date(todo.dueDate).getMinutes(), language)
      : null;

    return (
      <div
        key={todo.id}
        onClick={(e) => {
          e.stopPropagation();
          if (!isGhost) onToggleToDo(todo.id);
        }}
        className={`
          relative flex items-center gap-1 py-[2px] px-1 rounded-md text-[10px] leading-none font-medium
          transition-all duration-300 transform
          ${!isGhost ? (stacked ? 'active:scale-[0.99] cursor-pointer' : 'hover:scale-105 hover:z-20 cursor-pointer') : ''}
          ${itemStyle} ${glowEffect}
        `}
        title={isGhost ? t.calendar.lockedMission : todo.text}
      >
        {todo.completed && (
          <div className="absolute inset-0 rounded-md pointer-events-none bg-[radial-gradient(circle_at_12%_50%,var(--sacred-muted)_0%,transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%)]"></div>
        )}
        <div className="shrink-0">{icon}</div>
        {cellTime && (
          <span className="shrink-0 tabular-nums opacity-70 text-[9px]">{cellTime}</span>
        )}
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
      const isSelected = !!(selectedDate && normalizeDate(selectedDate) === normalizeDate(dateObj));

      const dayTodos = getTodosForDate(day);

      days.push(
        <div
          key={`curr-${day}`}
          onClick={() => handleCellClick(dateObj)}
          className={`min-h-0 md:min-h-0 border-b border-r p-1 relative group transition-all duration-300 cursor-pointer flex flex-col ${isToday ? 'bg-th-accent-muted shadow-[inset_0_0_20px_var(--shadow-glow)] border-th-border' : isSelected ? 'bg-th-surface/60 border-th-accent/60 ring-1 ring-inset ring-th-accent/40' : 'bg-transparent hover:bg-th-surface border-th-border'}`}
        >
          {/* Date Header */}
          <div className="flex justify-between items-start mb-0.5">
            <span
              onClick={(e) => { e.stopPropagation(); handleCellClick(dateObj); }}
              className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full transition-all cursor-pointer ${isToday ? 'bg-th-accent text-th-text-inverse shadow-[0_0_10px_var(--shadow-glow)]' : isSelected ? 'bg-th-accent/30 text-th-accent' : 'text-th-text-secondary group-hover:text-th-text hover:bg-th-surface-hover'}`}
            >
              {day}
            </span>
          </div>

          {/* Tasks Container — fills remaining cell height, clips overflow with fade */}
          {(() => {
            const VISIBLE = 8;
            const overflow = dayTodos.length - VISIBLE;
            const visible = dayTodos.slice(0, VISIBLE);
            const hasFade = dayTodos.length >= 2;
            return (
              <div className="relative overflow-hidden flex-1">
                <div
                  className="space-y-0.5"
                  style={hasFade ? {
                    maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  } : undefined}
                >
                  {visible.map((todo: any) => renderTodoCell(todo, todo.isGhost))}

                  {dayTodos.length === 0 && isToday && (
                    <div className="h-full flex items-center justify-center pt-2 opacity-30">
                      <div className="border border-dashed border-th-border rounded px-2 py-1 text-[9px] text-th-text-tertiary flex items-center gap-1">
                        <Star size={8} /> {t.calendar.noMission}
                      </div>
                    </div>
                  )}
                </div>

                {overflow > 0 && (
                  <div
                    onClick={(e) => { e.stopPropagation(); handleDateDrill(dateObj); }}
                    className="absolute bottom-0 right-0 text-[8px] font-semibold text-th-text-tertiary bg-th-surface/80 backdrop-blur-sm rounded px-1 leading-4 cursor-pointer hover:text-th-text transition-colors"
                  >
                    +{overflow}
                  </div>
                )}
              </div>
            );
          })()}
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
      const dayTodos = getTodosForDateGeneric(dateObj);
      const dayOfWeek = dateObj.getDay();

      days.push(
        <div
          key={`week-${i}`}
          onClick={() => handleCellAdd(dateObj)}
          className={`flex-1 flex items-stretch border-b border-th-border cursor-pointer transition-all duration-200 min-h-[56px] ${isToday
              ? 'bg-th-surface'
              : 'hover:bg-white/[0.03]'
            }`}
        >
          {/* Date column — tap number to drill, tap elsewhere to add */}
          <div
            onClick={(e) => { e.stopPropagation(); handleDateDrill(dateObj); }}
            className={`w-16 shrink-0 flex flex-col items-center justify-center py-2 border-r border-th-border ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : ''
            }`}
          >
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

          {/* Todos column — stacked vertically so each mission reads on its own line */}
          <div className="flex-1 flex flex-col justify-center gap-1 p-2 min-h-[56px]">
            {dayTodos.length > 0 ? (
              dayTodos.map((todo: any) => renderTodoCell(todo, todo.isGhost, true))
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

    const completedTodos = dayTodos.filter((t: any) => t.completed);
    const incompleteTodos = dayTodos.filter((t: any) => !t.completed);
    const totalCount = dayTodos.length;
    const completedCount = completedTodos.length;

    const renderDayTodoCard = (todo: any) => {
      const isGhost = todo.isGhost;
      const isEditing = editingTodoId === todo.id;

      // Determine style
      let cardStyle = "";
      let icon = null;
      let statusLabel = "";
      let labelStyle = "";

      if (todo.completed) {
        cardStyle = "bg-th-card border-th-sacred shadow-[0_0_24px_-8px_var(--shadow-sacred)]";
        icon = <Trophy size={18} className="text-th-sacred fill-current" />;
        statusLabel = t.calendar.status.completed;
        labelStyle = "text-th-sacred bg-th-sacred-muted";
      } else if (isGhost) {
        cardStyle = "bg-white/[0.03] border-th-border-subtle border-dashed";
        icon = <Lock size={18} className="text-th-text-muted" />;
        statusLabel = t.calendar.status.locked;
        labelStyle = "text-th-text-muted bg-th-surface";
      } else {
        cardStyle = "bg-th-surface border-th-border hover:border-th-accent/50 hover:bg-th-surface-hover";
        icon = <CheckCircle2 size={18} className="text-th-text-secondary" />;
        statusLabel = t.calendar.status.tryIt;
        labelStyle = "text-th-accent bg-th-accent-muted";
      }

      const todoTime = todo.hasTime && todo.dueDate
        ? fmtTime(new Date(todo.dueDate).getHours(), new Date(todo.dueDate).getMinutes(), language)
        : null;

      return (
        <div
          key={todo.id}
          onClick={() => !isGhost && !isEditing && onToggleToDo(todo.id)}
          className={`
            group relative flex items-center gap-4 p-4 rounded-xl border
            transition-all duration-300 transform
            ${!isGhost && !isEditing ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : isEditing ? 'cursor-default' : 'cursor-not-allowed'}
            ${cardStyle}
          `}
        >
          {/* Completed sheen */}
          {todo.completed && (
            <div className="absolute inset-0 rounded-xl pointer-events-none bg-[radial-gradient(circle_at_10%_18%,var(--sacred-muted)_0%,transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%)]"></div>
          )}

          {/* Icon */}
          <div className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center ${todo.completed ? 'bg-th-sacred-muted border-th-sacred/60 shadow-[0_0_18px_-8px_var(--shadow-sacred)]' : 'bg-th-surface border-th-border'}`}>
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
            {isEditing ? (
              <input
                autoFocus
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(todo.id);
                  if (e.key === 'Escape') { setEditingTodoId(null); setEditingText(''); }
                }}
                maxLength={500}
                className="w-full bg-transparent border-b border-th-accent/60 outline-none text-sm text-th-text font-medium py-0.5"
              />
            ) : (
              <>
                <p className={`text-sm font-medium leading-relaxed ${todo.completed ? 'text-th-text font-bold' : isGhost ? 'text-th-text-muted' : 'text-gray-200'}`}>
                  {todo.text}
                </p>
                {todoTime && (
                  <p className="flex items-center gap-1 text-xs text-th-text-tertiary mt-1">
                    <Clock size={11} />{todoTime}
                  </p>
                )}
                {todo.note && (
                  <p className="text-xs text-th-text-tertiary mt-1 truncate">{todo.note}</p>
                )}
              </>
            )}
          </div>

          {/* Right side actions */}
          {isEditing ? (
            <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleSaveEdit(todo.id)}
                className="p-1.5 rounded-full bg-th-accent/20 hover:bg-th-accent/40 text-th-accent transition-colors"
                aria-label={t.common.save}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => { setEditingTodoId(null); setEditingText(''); }}
                className="p-1.5 rounded-full hover:bg-white/10 text-th-text-muted transition-colors"
                aria-label={t.common.cancel}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="shrink-0 flex items-center gap-1.5">
              {!isGhost && !todo.completed && onUpdateToDo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingTodoId(todo.id); setEditingText(todo.text); }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-th-text-tertiary hover:text-th-text transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={t.calendar.editMission}
                >
                  <Pencil size={13} />
                </button>
              )}
              {!isGhost && onDeleteToDo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteToDo(todo.id); }}
                  className="p-1.5 rounded-full hover:bg-red-500/10 text-th-text-tertiary hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={t.calendar.deleteMission}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${labelStyle}`}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
      );
    };

    const hasWins = completedCount > 0;
    const weekdayLabel = t.calendar.dayNamesFull[selectedDate.getDay()];

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-[56px] md:pb-[64px] relative z-0">
        {/* Wins header — celebrates what was DONE. No %, no N/M, no progress bar. */}
        {totalCount > 0 && (
          <div className="max-w-2xl mx-auto mb-10">
            {hasWins ? (
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-th-card border border-th-sacred/60 flex items-center justify-center shadow-[0_0_22px_-8px_var(--shadow-sacred)]">
                  <Trophy size={20} className="text-th-sacred fill-current" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-th-text leading-none">
                    <span className="text-4xl text-th-sacred">{completedCount}</span>
                    <span className="ml-2 text-base text-th-text-secondary font-body">{t.calendar.winsUnit}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-th-text-tertiary font-body">
                    {t.calendar.winsSubline.replace('{weekday}', weekdayLabel)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-th-accent-muted border border-th-accent flex items-center justify-center">
                  <Sparkles size={20} className="text-th-accent" />
                </div>
                <p className="text-base text-th-text-secondary font-body whitespace-pre-line leading-relaxed">
                  {t.calendar.winsArriving}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Todo Sections */}
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Wins (completed) */}
          {completedTodos.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-th-sacred shadow-[0_0_8px_var(--shadow-sacred)]"></div>
                <h3 className="text-sm font-bold text-th-sacred uppercase tracking-wider font-display">
                  {t.calendar.winsSection}
                </h3>
                <div className="flex-1 h-px bg-th-sacred-muted"></div>
              </div>
              <div className="space-y-2.5">
                {completedTodos.map(renderDayTodoCard)}
              </div>
            </div>
          )}

          {/* Up next — forward-looking, claimable. Never framed as failure. */}
          {incompleteTodos.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-th-accent"></div>
                <h3 className="text-sm font-bold text-th-text-secondary uppercase tracking-wider font-display">
                  {t.calendar.upNextSection}
                </h3>
                <div className="flex-1 h-px bg-th-accent-muted"></div>
              </div>
              <p className="text-xs text-th-text-tertiary mb-4 ml-5 font-body">{t.calendar.upNextHint}</p>
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
              <p className="text-gray-700 text-xs mt-1 mb-6">{t.calendar.emptyDayHint}</p>
              <button
                type="button"
                onClick={() => selectedDate && handleCellAdd(selectedDate)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-th-accent text-white text-sm font-bold active:scale-95 transition-transform shadow-sm"
              >
                <Plus size={16} />
                {t.calendar.addMission}
              </button>
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
      <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-[56px] md:pb-[64px] relative z-0">
        <div className="space-y-1">
          {daysWithTodos.map(({ date, todos: dayTodos }) => {
            const isToday = normalizeDate(new Date()) === normalizeDate(date);
            const dayOfWeek = date.getDay();

            return (
              <div key={date.getTime()}>
                {/* Date header */}
                <div
                  data-today={isToday ? "true" : undefined}
                  onClick={() => handleDateDrill(date)}
                  className={`sticky top-0 z-10 flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${isToday
                      ? 'bg-th-accent-muted border border-th-accent-border'
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-th-accent-muted text-th-accent font-bold">{t.common.today}</span>
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
                    {dayTodos.map((todo: any) => renderTodoCell(todo, todo.isGhost, true))}
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
      <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-th-accent-muted rounded-full blur-[150px] pointer-events-none opacity-60"></div>

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
        <div className="flex-1 overflow-hidden flex flex-col p-1 md:p-3 lg:p-6 pb-[56px] md:pb-[64px] relative z-0 animate-in fade-in duration-300">
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
        <div className="flex-1 overflow-y-auto flex flex-col p-1 md:p-3 pb-[56px] md:pb-[64px] relative z-0 animate-in fade-in duration-300">
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

      {/* Quick-add capsule — slides up from bottom when any cell is tapped */}
      {capsuleDate && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-40"
            onClick={closeCapsule}
          />
          {/* Sheet — sits above BottomDock (z-[55]) by positioning above its ~66px height.
              키보드가 열리면 fixed + bottom=키보드높이로 올려 입력창이 가리지 않게 한다. */}
          <div
            className="absolute bottom-[66px] left-0 right-0 z-50 animate-in slide-in-from-bottom duration-200"
            style={keyboardHeight > 0 ? { position: 'fixed', bottom: `${keyboardHeight}px`, zIndex: 60 } : undefined}
          >
            <div className="mx-2 mb-2 bg-th-card border border-th-border-strong rounded-2xl shadow-2xl p-4 backdrop-blur-xl">
              {/* Date label */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-th-text-tertiary font-bold uppercase tracking-wider">
                  {capsuleDate.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
                    month: 'long', day: 'numeric', weekday: 'short'
                  })}
                </span>
                <button
                  type="button"
                  onClick={closeCapsule}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-th-surface-hover text-th-text-muted transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Input row */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  ref={capsuleInputRef}
                  type="text"
                  value={capsuleText}
                  onChange={(e) => setCapsuleText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSealCapsule(); if (e.key === 'Escape') closeCapsule(); }}
                  placeholder={t.calendar.addMissionPlaceholder}
                  maxLength={500}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-th-text placeholder:text-th-text-muted"
                />
                <button
                  type="button"
                  onClick={handleSealCapsule}
                  disabled={!capsuleText.trim()}
                  className="shrink-0 flex items-center gap-1 h-8 px-4 rounded-full bg-th-accent text-white text-[13px] font-bold
                    disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
                >
                  <Lock size={13} />
                  {t.calendar.addMission}
                </button>
              </div>

              {/* Time presets + manual stepper — revealed when the time chip is tapped */}
              {timeOpen && (
                <div className="mb-3 flex items-center gap-1.5 overflow-x-auto scrollbar-hide animate-in fade-in slide-in-from-top-1 duration-150">
                  {TIME_PRESETS.map((p) => {
                    const active = capsuleHasTime && capsuleTime.h === p.h && capsuleTime.m === p.m;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => { setCapsuleTime({ h: p.h, m: p.m }); setCapsuleHasTime(true); }}
                        className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active
                            ? 'bg-th-accent-muted border-th-accent text-th-accent font-bold'
                            : 'border-th-border text-th-text-tertiary hover:text-th-text hover:border-th-border-strong'
                          }`}
                      >
                        {fmtTime(p.h, p.m, language)}
                      </button>
                    );
                  })}
                  {/* Compact cycle-on-tap stepper for arbitrary times */}
                  <div className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-th-border text-th-text-secondary text-[11px] tabular-nums">
                    <button
                      type="button"
                      aria-label={t.calendar.time.hour}
                      onClick={() => { setCapsuleTime((s) => ({ ...s, h: (s.h + 1) % 24 })); setCapsuleHasTime(true); }}
                    >
                      {pad2(capsuleTime.h)}
                    </button>
                    <span className="text-th-text-muted">:</span>
                    <button
                      type="button"
                      aria-label={t.calendar.time.minute}
                      onClick={() => { setCapsuleTime((s) => ({ ...s, m: (s.m + 5) % 60 })); setCapsuleHasTime(true); }}
                    >
                      {pad2(capsuleTime.m)}
                    </button>
                  </div>
                </div>
              )}

              {/* Time chip + repeat chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <button
                  type="button"
                  aria-pressed={capsuleHasTime}
                  onClick={() => setTimeOpen((o) => !o)}
                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${capsuleHasTime
                      ? 'bg-th-accent-muted border-th-accent text-th-accent font-bold'
                      : 'border-th-border text-th-text-tertiary hover:text-th-text hover:border-th-border-strong'
                    }`}
                >
                  <Clock size={12} />
                  {capsuleHasTime ? fmtTime(capsuleTime.h, capsuleTime.m, language) : t.calendar.time.allDay}
                  {capsuleHasTime && (
                    <span
                      role="button"
                      aria-label={t.calendar.time.clear}
                      onClick={(e) => { e.stopPropagation(); setCapsuleHasTime(false); setTimeOpen(false); setCapsuleTime({ h: 9, m: 0 }); }}
                      className="ml-0.5 -mr-1 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-th-surface-hover"
                    >
                      <X size={10} />
                    </span>
                  )}
                </button>
                <span className="shrink-0 w-px h-4 bg-th-border" aria-hidden="true"></span>
                {REPEAT_CHIPS.map((opt) => {
                  const active = (capsuleRepeat ?? 'none') === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCapsuleRepeat(opt === 'none' ? null : (opt as RepeatFrequency))}
                      className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors ${active
                          ? 'bg-th-accent-muted border-th-accent text-th-accent font-bold'
                          : 'border-th-border text-th-text-tertiary hover:text-th-text hover:border-th-border-strong'
                        }`}
                    >
                      {t.todo.repeat[opt]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CalendarView;
