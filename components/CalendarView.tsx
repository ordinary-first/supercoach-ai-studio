import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sun, CheckCircle2, Lock, AlertCircle, Trophy, Star, ArrowLeft } from 'lucide-react';
import { ToDoItem, RepeatFrequency } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface CalendarViewProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  onToggleToDo: (id: string) => void;
}

type ViewMode = 'month' | 'week' | 'day';

// Logic to check if the targetDate falls on the recurrence pattern of the task.
// Since we have complex patterns (Weekly-2, Weekly-3), we need to simulate the sequence.
const checkRecurrenceMatch = (todo: ToDoItem, targetDate: Date): boolean => {
    if (!todo.repeat) return false;

    // Use DueDate or CreatedAt as the anchor
    const anchorTimestamp = todo.dueDate || todo.createdAt;

    // Normalize dates to start of day
    const target = new Date(targetDate);
    target.setHours(0,0,0,0);
    const start = new Date(anchorTimestamp);
    start.setHours(0,0,0,0);

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

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, todos, onToggleToDo }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previousViewMode, setPreviousViewMode] = useState<ViewMode>('month');
  const focusTrapRef = useFocusTrap(isOpen);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getStartDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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
    if (mode === 'day') return; // Day mode is only entered by clicking a date
    setViewMode(mode);
    setSelectedDate(null);
  };

  // Day name helpers
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayNamesFull = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

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
    return `${y}년 ${m}월 ${d}일 ${dayOfWeek}`;
  };

  // Navigation title
  const getHeaderTitle = () => {
    if (viewMode === 'month') {
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
    if (viewMode === 'month') prevMonth();
    else if (viewMode === 'week') prevWeek();
    else if (viewMode === 'day') prevDay();
  };

  const handleNext = () => {
    if (viewMode === 'month') nextMonth();
    else if (viewMode === 'week') nextWeek();
    else if (viewMode === 'day') nextDay();
  };

  // Render a single todo item in the calendar cell (shared between month and week views)
  const renderTodoCell = (todo: any, isPastDate: boolean, isGhost: boolean) => {
    let itemStyle = "";
    let icon = null;
    let glowEffect = "";

    if (todo.completed) {
      itemStyle = "bg-gradient-to-r from-neon-lime/80 to-green-400/80 text-black border border-white/50";
      glowEffect = "shadow-[0_0_12px_rgba(204,255,0,0.6)] z-10 scale-[1.02]";
      icon = <Trophy size={10} className="fill-black text-black" />;
    } else if (isGhost) {
      itemStyle = "bg-white/5 text-gray-500 border border-white/5 border-dashed backdrop-blur-[2px] cursor-not-allowed";
      icon = <Lock size={10} className="text-gray-600" />;
    } else if (isPastDate && !todo.completed) {
      itemStyle = "bg-[#1a1a1a] text-gray-500 border border-white/10 opacity-60 grayscale";
      icon = <AlertCircle size={10} className="text-red-900" />;
    } else {
      itemStyle = "bg-white/5 text-gray-300 border border-white/20 backdrop-blur-sm";
      icon = <Lock size={10} className="text-gray-400" />;
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
        title={isGhost ? "잠긴 미션 (미래 반복)" : todo.text}
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
      const totalSlots = 42;

      // Prev Month (Placeholder)
      for (let i = startDay - 1; i >= 0; i--) {
          days.push(
              <div key={`prev-${i}`} className="min-h-[60px] md:min-h-[120px] bg-black/40 border-b border-r border-white/5 opacity-20 p-2 text-gray-600 font-mono text-xs">
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
                className={`min-h-[60px] md:min-h-[120px] border-b border-r border-white/10 p-2 relative group transition-all duration-300 cursor-pointer ${isToday ? 'bg-white/5 shadow-[inset_0_0_20px_rgba(204,255,0,0.05)]' : 'bg-transparent hover:bg-white/[0.07]'}`}
              >
                  {/* Date Header */}
                  <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${isToday ? 'bg-neon-lime text-black shadow-[0_0_10px_#CCFF00]' : 'text-gray-400 group-hover:text-white'}`}>
                          {day}
                      </span>
                  </div>

                  {/* Tasks Container */}
                  <div className="space-y-1.5 overflow-y-auto max-h-[40px] md:max-h-[90px] scrollbar-hide">
                      {dayTodos.map((todo: any) => renderTodoCell(todo, isPastDate, todo.isGhost))}

                      {/* Empty State placeholder for Today */}
                      {dayTodos.length === 0 && isToday && (
                          <div className="h-full flex items-center justify-center pt-2 opacity-30">
                              <div className="border border-dashed border-white/30 rounded px-2 py-1 text-[9px] text-gray-500 flex items-center gap-1">
                                  <Star size={8} /> 미션 없음
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
              <div key={`next-${i}`} className="min-h-[60px] md:min-h-[120px] bg-black/40 border-b border-r border-white/5 opacity-20 p-2 text-gray-600 font-mono text-xs">
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

      days.push(
        <div
          key={`week-${i}`}
          onClick={() => handleDayClick(dateObj)}
          className={`border-r border-white/10 p-3 relative group transition-all duration-300 cursor-pointer flex flex-col ${isToday ? 'bg-white/5 shadow-[inset_0_0_30px_rgba(204,255,0,0.05)]' : 'bg-transparent hover:bg-white/[0.07]'}`}
        >
          {/* Date Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
            <span className={`text-lg font-bold w-9 h-9 flex items-center justify-center rounded-full transition-all font-display ${isToday ? 'bg-neon-lime text-black shadow-[0_0_10px_#CCFF00]' : 'text-gray-400 group-hover:text-white'}`}>
              {dateObj.getDate()}
            </span>
            <span className={`text-xs font-medium ${isToday ? 'text-neon-lime' : 'text-gray-500'}`}>
              {dayNames[dateObj.getDay()]}
            </span>
            {dayTodos.length > 0 && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
                {dayTodos.filter((t: any) => t.completed).length}/{dayTodos.length}
              </span>
            )}
          </div>

          {/* Tasks Container - scrollable, takes remaining height */}
          <div className="space-y-2 overflow-y-auto flex-1 scrollbar-hide pr-1">
            {dayTodos.map((todo: any) => {
              const isGhost = todo.isGhost;
              let itemStyle = "";
              let icon = null;
              let glowEffect = "";

              if (todo.completed) {
                itemStyle = "bg-gradient-to-r from-neon-lime/80 to-green-400/80 text-black border border-white/50";
                glowEffect = "shadow-[0_0_12px_rgba(204,255,0,0.6)] z-10 scale-[1.01]";
                icon = <Trophy size={12} className="fill-black text-black" />;
              } else if (isGhost) {
                itemStyle = "bg-white/5 text-gray-500 border border-white/5 border-dashed backdrop-blur-[2px] cursor-not-allowed";
                icon = <Lock size={12} className="text-gray-600" />;
              } else if (isPastDate && !todo.completed) {
                itemStyle = "bg-[#1a1a1a] text-gray-500 border border-white/10 opacity-60 grayscale";
                icon = <AlertCircle size={12} className="text-red-900" />;
              } else {
                itemStyle = "bg-white/5 text-gray-300 border border-white/20 backdrop-blur-sm";
                icon = <Lock size={12} className="text-gray-400" />;
              }

              return (
                <div
                  key={todo.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isGhost) onToggleToDo(todo.id);
                  }}
                  className={`
                    relative flex items-center gap-2.5 p-2 rounded-lg text-xs font-medium
                    transition-all duration-300 transform
                    ${!isGhost ? 'hover:scale-[1.03] hover:z-20 cursor-pointer' : ''}
                    ${itemStyle} ${glowEffect}
                  `}
                  title={isGhost ? "잠긴 미션 (미래 반복)" : todo.text}
                >
                  {todo.completed && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50 rounded-lg pointer-events-none"></div>
                  )}
                  <div className="shrink-0">{icon}</div>
                  <span className={`line-clamp-2 ${todo.completed ? 'font-bold' : ''}`}>
                    {todo.text}
                  </span>
                </div>
              );
            })}

            {dayTodos.length === 0 && (
              <div className="h-full flex items-center justify-center pt-4 opacity-30">
                <div className="border border-dashed border-white/30 rounded-lg px-3 py-2 text-[10px] text-gray-500 flex items-center gap-1.5">
                  <Star size={10} /> 미션 없음
                </div>
              </div>
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
        cardStyle = "bg-gradient-to-r from-neon-lime/20 to-green-400/10 border-neon-lime/30 shadow-[0_0_20px_rgba(204,255,0,0.1)]";
        icon = <Trophy size={18} className="text-neon-lime fill-neon-lime/50" />;
        statusLabel = "완료";
        labelStyle = "text-neon-lime bg-neon-lime/10";
      } else if (isGhost) {
        cardStyle = "bg-white/[0.03] border-white/5 border-dashed";
        icon = <Lock size={18} className="text-gray-600" />;
        statusLabel = "잠긴 미션";
        labelStyle = "text-gray-600 bg-white/5";
      } else if (isPastDate) {
        cardStyle = "bg-[#1a1a1a]/80 border-white/10 opacity-70 grayscale";
        icon = <AlertCircle size={18} className="text-red-500/60" />;
        statusLabel = "놓침";
        labelStyle = "text-red-400/80 bg-red-500/10";
      } else {
        cardStyle = "bg-white/5 border-white/15 hover:border-white/30 hover:bg-white/[0.08]";
        icon = <CheckCircle2 size={18} className="text-gray-400" />;
        statusLabel = isToday ? "진행 중" : "예정";
        labelStyle = isToday ? "text-blue-400 bg-blue-500/10" : "text-gray-400 bg-white/5";
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
          <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-relaxed ${todo.completed ? 'text-white font-bold' : isGhost ? 'text-gray-600' : isPastDate ? 'text-gray-500' : 'text-gray-200'}`}>
              {todo.text}
            </p>
            {todo.note && (
              <p className="text-xs text-gray-500 mt-1 truncate">{todo.note}</p>
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
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-[100px] md:pb-[110px] relative z-0">
        {/* Stats Summary */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neon-lime/10 border border-neon-lime/20 flex items-center justify-center">
                  <Trophy size={18} className="text-neon-lime" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">미션 현황</p>
                  <p className="text-lg font-display font-bold text-white">
                    {completedCount}/{totalCount} <span className="text-sm text-gray-400 font-body">완료</span>
                  </p>
                </div>
              </div>
              <span className="text-2xl font-display font-bold text-neon-lime">
                {totalCount > 0 ? Math.round(progressPercent) : 0}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-neon-lime to-green-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(204,255,0,0.4)]"
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
                <div className="w-2 h-2 rounded-full bg-neon-lime shadow-[0_0_6px_#CCFF00]"></div>
                <h3 className="text-sm font-bold text-neon-lime uppercase tracking-wider font-display">
                  완료한 미션
                </h3>
                <span className="text-xs text-gray-600 font-mono">{completedTodos.length}</span>
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
                <h3 className={`text-sm font-bold uppercase tracking-wider font-display ${isPastDate ? 'text-red-400/80' : 'text-gray-400'}`}>
                  미완료 미션
                </h3>
                <span className="text-xs text-gray-600 font-mono">{incompleteTodos.length}</span>
                <div className={`flex-1 h-px ${isPastDate ? 'bg-red-500/10' : 'bg-white/5'}`}></div>
              </div>
              <div className="space-y-2.5">
                {incompleteTodos.map(renderDayTodoCard)}
              </div>
            </div>
          )}

          {/* Empty state */}
          {dayTodos.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Star size={24} className="text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm font-medium">이 날에는 미션이 없습니다</p>
              <p className="text-gray-700 text-xs mt-1">미션을 추가하여 하루를 시작해 보세요</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-col font-body text-white">

        {/* Ambient Background Glow */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-neon-lime/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Header */}
        <div className="px-3 md:px-8 py-2 md:py-4 border-b border-white/10 flex flex-wrap gap-2 md:gap-3 justify-between items-center bg-black/60 backdrop-blur-xl z-10">
            <div className="flex items-center gap-3 md:gap-6 flex-wrap">
                {/* Back button in day view */}
                {viewMode === 'day' ? (
                  <button
                    onClick={handleBackFromDay}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
                    aria-label="뒤로 가기"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 text-neon-lime drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]">
                    <Trophy className="w-5 h-5 md:w-7 md:h-7" />
                    <span className="font-display font-bold text-sm md:text-xl tracking-wider hidden sm:inline">미션 달력</span>
                  </div>
                )}

                <div className="h-8 w-px bg-white/10"></div>

                {/* Navigation */}
                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                    <button onClick={handlePrev} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="이전">
                      <ChevronLeft size={18}/>
                    </button>
                    <h2 className={`font-bold text-white text-center font-display tracking-wide ${viewMode === 'day' ? 'text-sm md:text-base min-w-[180px]' : 'text-lg min-w-[120px]'}`}>
                        {getHeaderTitle()}
                    </h2>
                    <button onClick={handleNext} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors" aria-label="다음">
                      <ChevronRight size={18}/>
                    </button>
                </div>

                {/* Today button */}

                {/* View Mode Toggle Pills */}
                {viewMode !== 'day' && (
                  <div className="flex items-center bg-white/5 rounded-full border border-white/10 p-0.5">
                    <button
                      onClick={() => switchViewMode('month')}
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all duration-300 ${
                        viewMode === 'month'
                          ? 'bg-neon-lime text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      월
                    </button>
                    <button
                      onClick={() => switchViewMode('week')}
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all duration-300 ${
                        viewMode === 'week'
                          ? 'bg-neon-lime text-black shadow-[0_0_10px_rgba(204,255,0,0.3)]'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      주
                    </button>
                  </div>
                )}
            </div>

        </div>

        {/* Legend / Status Bar (hidden in day view for cleaner look) */}
        {viewMode !== 'day' && (
          <div className="px-3 md:px-8 py-1.5 md:py-2 bg-black/40 border-b border-white/5 flex gap-2 md:gap-6 overflow-x-auto text-[8px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold z-10">
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-lime shadow-[0_0_5px_#CCFF00]"></div>
                  <span>달성 (히스토리)</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full border border-white/40 bg-white/10"></div>
                  <span>진행 중 (현재)</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full border border-white/10 border-dashed bg-white/5"></div>
                  <span>예정 (미래)</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white/10 opacity-50"></div>
                  <span>미달성 (놓침)</span>
              </div>
          </div>
        )}

        {/* ==================== CONTENT AREA ==================== */}

        {/* Month View */}
        {viewMode === 'month' && (
          <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-4 lg:p-8 pb-[100px] md:pb-[110px] relative z-0 animate-in fade-in duration-300">
              {/* Week Headers */}
              <div className="grid grid-cols-7 border-b border-white/10 mb-0 bg-white/5 rounded-t-lg">
                  {dayNames.map((day, idx) => (
                      <div key={day} className={`text-center py-3 font-display font-bold text-xs tracking-wider ${idx === 0 ? 'text-red-400' : (idx === 6 ? 'text-blue-400' : 'text-gray-400')}`}>
                          {day}
                      </div>
                  ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 flex-1 border-l border-white/10 auto-rows-fr bg-black/20 backdrop-blur-sm rounded-b-lg overflow-y-auto">
                   {renderCalendarDays()}
              </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="flex-1 overflow-hidden flex flex-col p-2 md:p-4 lg:p-8 pb-[100px] md:pb-[110px] relative z-0 animate-in fade-in duration-300">
              {/* Week Day Headers */}
              <div className="grid grid-cols-7 border-b border-white/10 mb-0 bg-white/5 rounded-t-lg">
                  {dayNames.map((day, idx) => (
                      <div key={`wh-${day}`} className={`text-center py-3 font-display font-bold text-xs tracking-wider ${idx === 0 ? 'text-red-400' : (idx === 6 ? 'text-blue-400' : 'text-gray-400')}`}>
                          {day}
                      </div>
                  ))}
              </div>

              {/* Single Row of 7 Days */}
              <div className="grid grid-cols-7 flex-1 border-l border-white/10 bg-black/20 backdrop-blur-sm rounded-b-lg overflow-hidden">
                  {renderWeekDays()}
              </div>
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
