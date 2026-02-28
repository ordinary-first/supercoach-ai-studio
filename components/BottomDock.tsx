import React, { useState, useRef, useEffect } from 'react';
import { Target, ListTodo, Eye, Calendar, BarChart3 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import type { LayoutMode } from './MindMap';

export type TabType = 'GOALS' | 'TODO' | 'VISUALIZE' | 'CALENDAR' | 'FEEDBACK';
export type CalendarViewMode = 'month' | 'week' | 'list';

interface BottomDockProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  calendarViewMode?: CalendarViewMode;
  onCalendarViewModeChange?: (mode: CalendarViewMode) => void;
  mindmapLayout?: LayoutMode;
  onMindmapLayoutChange?: (layout: LayoutMode) => void;
}

const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  calendarViewMode,
  onCalendarViewModeChange,
  mindmapLayout,
  onMindmapLayoutChange,
}) => {
  const { t, language } = useTranslation();
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [showLayoutPopup, setShowLayoutPopup] = useState(false);
  const calendarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarLongPress = useRef(false);
  const goalsLongPress = useRef(false);
  const calendarPopupRef = useRef<HTMLDivElement>(null);
  const layoutPopupRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'GOALS', label: t.nav.goals, icon: <Target size={20} /> },
    { id: 'CALENDAR', label: t.nav.calendar, icon: <Calendar size={20} /> },
    { id: 'TODO', label: t.nav.todo, icon: <ListTodo size={20} /> },
    { id: 'VISUALIZE', label: t.nav.visualize, icon: <Eye size={20} /> },
    { id: 'FEEDBACK', label: t.nav.feedback, icon: <BarChart3 size={20} /> },
  ];

  const startCalendarPress = () => {
    cancelCalendarPress();
    calendarLongPress.current = false;
    calendarTimer.current = setTimeout(() => {
      calendarLongPress.current = true;
      setShowCalendarPopup(true);
    }, 500);
  };
  const cancelCalendarPress = () => {
    if (calendarTimer.current) {
      clearTimeout(calendarTimer.current);
      calendarTimer.current = null;
    }
  };

  const startGoalsPress = () => {
    cancelGoalsPress();
    goalsLongPress.current = false;
    goalsTimer.current = setTimeout(() => {
      goalsLongPress.current = true;
      setShowLayoutPopup(true);
    }, 500);
  };
  const cancelGoalsPress = () => {
    if (goalsTimer.current) {
      clearTimeout(goalsTimer.current);
      goalsTimer.current = null;
    }
  };

  useEffect(() => {
    if (!showCalendarPopup && !showLayoutPopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (showCalendarPopup && calendarPopupRef.current &&
          !calendarPopupRef.current.contains(event.target as Node)) {
        setShowCalendarPopup(false);
      }
      if (showLayoutPopup && layoutPopupRef.current &&
          !layoutPopupRef.current.contains(event.target as Node)) {
        setShowLayoutPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [showCalendarPopup, showLayoutPopup]);

  const calendarModes = [
    { mode: 'month' as const, label: t.calendar.monthView },
    { mode: 'week' as const, label: t.calendar.weekView },
    { mode: 'list' as const, label: language === 'ko' ? '리스트' : 'List' },
  ];

  const layoutModes: { mode: LayoutMode; label: string }[] = [
    { mode: 'mindMap', label: t.mindmap.layoutModes.mindMap },
    { mode: 'logicalStructure', label: t.mindmap.layoutModes.logicalStructure },
    { mode: 'logicalStructureLeft', label: t.mindmap.layoutModes.logicalStructureLeft },
    { mode: 'organizationStructure', label: t.mindmap.layoutModes.organizationStructure },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-[55] w-full">
      <div
        className="apple-dock-shell flex items-center justify-around gap-1 px-2 py-1.5 rounded-t-2xl mx-2"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        role="navigation"
        aria-label={t.nav.mainNav}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isCalendar = tab.id === 'CALENDAR';
          const isGoals = tab.id === 'GOALS';
          const hasLongPress = isCalendar || isGoals;

          const longPressHandlers = isCalendar ? {
            onTouchStart: startCalendarPress,
            onMouseDown: startCalendarPress,
            onTouchEnd: cancelCalendarPress,
            onMouseUp: cancelCalendarPress,
            onTouchMove: cancelCalendarPress,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          } : isGoals ? {
            onTouchStart: startGoalsPress,
            onMouseDown: startGoalsPress,
            onTouchEnd: cancelGoalsPress,
            onMouseUp: cancelGoalsPress,
            onTouchMove: cancelGoalsPress,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          } : {};

          return (
            <div key={tab.id} className="relative">
              <button
                onClick={() => {
                  if (hasLongPress) {
                    const triggered = isCalendar
                      ? calendarLongPress : goalsLongPress;
                    if (triggered.current) {
                      triggered.current = false;
                      return;
                    }
                  }
                  onTabChange(tab.id);
                }}
                {...longPressHandlers}
                className={`relative group flex flex-col items-center justify-center w-11 h-11 rounded-xl
                  transition-all duration-300 ${
                    isActive
                      ? 'bg-white/12 text-th-accent shadow-[0_0_18px_var(--shadow-glow)]'
                      : 'text-th-text-secondary hover:text-th-text hover:bg-white/8'
                  }`}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {tab.icon}
                </div>
                <span
                  className={`text-[9px] font-display mt-0.5 tracking-wide transition-opacity duration-300 ${
                    isActive ? 'opacity-100 font-bold' : 'opacity-70'
                  }`}
                >
                  {tab.label}
                </span>

                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 bg-th-accent rounded-full shadow-[0_0_5px_var(--shadow-glow)]" />
                )}
              </button>

              {showCalendarPopup && isCalendar && (
                <div
                  ref={calendarPopupRef}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 apple-glass-panel
                    rounded-xl shadow-2xl overflow-hidden min-w-[120px] z-[60]"
                >
                  {calendarModes.map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => {
                        onCalendarViewModeChange?.(item.mode);
                        onTabChange('CALENDAR');
                        setShowCalendarPopup(false);
                      }}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                        calendarViewMode === item.mode
                          ? 'text-th-accent font-bold bg-th-surface'
                          : 'text-gray-300 hover:text-th-text hover:bg-th-surface'
                      }`}
                    >
                      {item.label}
                      {calendarViewMode === item.mode && ' ✓'}
                    </button>
                  ))}
                </div>
              )}

              {showLayoutPopup && isGoals && (
                <div
                  ref={layoutPopupRef}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 apple-glass-panel
                    rounded-xl shadow-2xl overflow-hidden min-w-[120px] z-[60]"
                >
                  {layoutModes.map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => {
                        onMindmapLayoutChange?.(item.mode);
                        onTabChange('GOALS');
                        setShowLayoutPopup(false);
                      }}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                        mindmapLayout === item.mode
                          ? 'text-th-accent font-bold bg-th-surface'
                          : 'text-gray-300 hover:text-th-text hover:bg-th-surface'
                      }`}
                    >
                      {item.label}
                      {mindmapLayout === item.mode && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BottomDock;
