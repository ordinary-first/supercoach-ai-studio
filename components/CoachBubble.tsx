
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { GoalNode, NodeType } from '../types';
import { useTranslation } from '../i18n/useTranslation';

interface CoachBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
  selectedNode: GoalNode | null;
  nodes: GoalNode[];
  // 하단 입력 바([data-coach-anchor])가 있는 탭에선 그 바로 위에 붙고, 바가 움직이면(키보드 등) 따라간다.
  activeTab: string;
}

const COACH_DEFAULT_BOTTOM = 100; // 하단 독 위 기본 위치
const COACH_GAP = 8;              // 입력 바 위 간격

const CoachBubble: React.FC<CoachBubbleProps> = ({ isOpen, onToggle, hasUnread, selectedNode, nodes, activeTab }) => {
  const { t } = useTranslation();
  const [shouldPulse, setShouldPulse] = useState(false);
  const hasInitialPulsed = useRef(false);
  const [bottomPx, setBottomPx] = useState(COACH_DEFAULT_BOTTOM);

  // 하단 입력 바 위로 비켜서기 — 실제 바 위치를 측정해 그 위 8px에 붙고, 바가 움직이면 따라간다.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const bar = document.querySelector('[data-coach-anchor]') as HTMLElement | null;
      const next = bar
        ? Math.max(
            Math.round(window.innerHeight - bar.getBoundingClientRect().top + COACH_GAP),
            COACH_DEFAULT_BOTTOM,
          )
        : COACH_DEFAULT_BOTTOM;
      setBottomPx((prev) => (prev !== next ? next : prev));
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };

    measure();
    const settle = window.setTimeout(measure, 250); // 탭 전환 직후 바가 늦게 마운트되는 경우 대비
    const poll = window.setInterval(measure, 400);   // 키보드 등 이벤트 없는 위치 변화 대비
    const bar = document.querySelector('[data-coach-anchor]');
    const ro = bar ? new ResizeObserver(schedule) : null;
    if (bar && ro) ro.observe(bar);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      clearInterval(poll);
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [activeTab, isOpen]);

  // 처음 진입 시 1회 pulse
  useEffect(() => {
    if (!hasInitialPulsed.current && !isOpen) {
      hasInitialPulsed.current = true;
      setShouldPulse(true);
    }
  }, []);

  // ROOT 또는 1차 노드 선택 시 pulse (2차/3차 제외)
  useEffect(() => {
    if (!selectedNode || isOpen) return;
    const isRoot = selectedNode.type === NodeType.ROOT;
    const isFirstLevel = selectedNode.type === NodeType.SUB
      && nodes.some(n => n.type === NodeType.ROOT && n.id === selectedNode.parentId);
    if (isRoot || isFirstLevel) {
      setShouldPulse(true);
    }
  }, [selectedNode, isOpen, nodes]);

  // 3초 후 자동 소멸
  useEffect(() => {
    if (!shouldPulse) return;
    const timer = setTimeout(() => setShouldPulse(false), 3000);
    return () => clearTimeout(timer);
  }, [shouldPulse]);

  if (isOpen) return null;

  return (
    <div
      className="fixed right-6 z-[58]"
      style={{ bottom: `${bottomPx}px` }}
    >
      <button
        onClick={onToggle}
        className={[
          'relative flex flex-col items-center justify-center w-14 h-14',
          'bg-th-elevated backdrop-blur-xl rounded-full',
          'border transition-all duration-300',
          shouldPulse
            ? 'border-th-accent-border ring-2 ring-th-accent/60 shadow-[0_0_30px_var(--shadow-glow)]'
            : 'border-th-accent-border shadow-[0_0_20px_rgba(0,0,0,0.5)]',
          'hover:border-th-accent-border hover:shadow-[0_0_25px_var(--shadow-glow)]',
        ].join(' ')}
        aria-label={t.coach.openCoach}
      >
        {/* 맥동 링 */}
        <div className={`absolute inset-0 rounded-full border border-th-accent-border ${shouldPulse ? 'animate-ping' : 'animate-pulse'}`} />

        <MessageCircle className="w-6 h-6 text-th-accent transition-all duration-300" />

        {/* 읽지 않은 알림 배지 */}
        {hasUnread && (
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-th-accent rounded-full shadow-[0_0_5px_var(--shadow-glow)]" />
        )}
      </button>
    </div>
  );
};

export default CoachBubble;
