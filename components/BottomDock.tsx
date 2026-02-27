import React, { useState, useRef, useEffect } from 'react';
import { Target, ListTodo, Eye, Calendar, BarChart3 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export type TabType = 'GOALS' | 'TODO' | 'VISUALIZE' | 'CALENDAR' | 'FEEDBACK';
export type CalendarViewMode = 'month' | 'week' | 'list';

interface BottomDockProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  calendarViewMode?: CalendarViewMode;
  onCalendarViewModeChange?: (mode: CalendarViewMode) => void;
}

const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  onTabChange,
  calendarViewMode,
  onCalendarViewModeChange,
}) => {
  const { t, language } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'GOALS', label: t.nav.goals, icon: <Target size={20} /> },
    { id: 'CALENDAR', label: t.nav.calendar, icon: <Calendar size={20} /> },
    { id: 'TODO', label: t.nav.todo, icon: <ListTodo size={20} /> },
    { id: 'VISUALIZE', label: t.nav.visualize, icon: <Eye size={20} /> },
    { id: 'FEEDBACK', label: t.nav.feedback, icon: <BarChart3 size={20} /> },
  ];

  const startPress = () => {
    cancelPress();
    longPressTriggered.current = false;
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowPopup(true);
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!showPopup) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup]);

  const calendarModes = [
    { mode: 'month' as const, label: t.calendar.monthView },
    { mode: 'week' as const, label: t.calendar.weekView },
    { mode: 'list' as const, label: language === 'ko' ? '리스트' : 'List' },
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

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isCalendar) {
                  if (longPressTriggered.current) {
                    longPressTriggered.current = false;
                    return;
                  }
                  onTabChange('CALENDAR');
                } else {
                  onTabChange(tab.id);
                }
              }}
              {...(isCalendar && {
                onTouchStart: startPress,
                onMouseDown: startPress,
                onTouchEnd: cancelPress,
                onMouseUp: cancelPress,
                onTouchMove: cancelPress,
                onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
              })}
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

              {showPopup && isCalendar && (
                <div
                  ref={popupRef}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 apple-glass-panel
                    rounded-xl shadow-2xl overflow-hidden min-w-[120px] z-[60]"
                >
                  {calendarModes.map((item) => (
                    <button
                      key={item.mode}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCalendarViewModeChange?.(item.mode);
                        onTabChange('CALENDAR');
                        setShowPopup(false);
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
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomDock;
