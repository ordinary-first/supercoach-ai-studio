import React, { useState, useRef, useEffect } from 'react';
import { Target, ListTodo, Eye, Calendar, BarChart3 } from 'lucide-react';

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
  const [showPopup, setShowPopup] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'GOALS', label: '목표', icon: <Target size={20} /> },
    { id: 'CALENDAR', label: '일정', icon: <Calendar size={20} /> },
    { id: 'TODO', label: '할 일', icon: <ListTodo size={20} /> },
    { id: 'VISUALIZE', label: '시각화', icon: <Eye size={20} /> },
    { id: 'FEEDBACK', label: '피드백', icon: <BarChart3 size={20} /> },
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
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopup]);

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-[55] w-full">
      <div
        className="flex items-center justify-around gap-1 px-2 py-1.5 bg-black/80 backdrop-blur-xl border-t border-x border-white/10 rounded-t-xl shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        role="navigation"
        aria-label="메인 탐색"
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
                onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              })}
              className={`relative group flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-white/10 text-neon-lime shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              <span className={`text-[9px] font-display mt-0.5 tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                {tab.label}
              </span>

              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-neon-lime rounded-full shadow-[0_0_5px_#CCFF00]"></div>
              )}

              {showPopup && isCalendar && (
                <div
                  ref={popupRef}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[120px] z-[60]"
                >
                  {[
                    { mode: 'month' as const, label: '월간' },
                    { mode: 'week' as const, label: '주간' },
                    { mode: 'list' as const, label: '리스트' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCalendarViewModeChange?.(item.mode);
                        onTabChange('CALENDAR');
                        setShowPopup(false);
                      }}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                        calendarViewMode === item.mode
                          ? 'text-neon-lime font-bold bg-white/5'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
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
