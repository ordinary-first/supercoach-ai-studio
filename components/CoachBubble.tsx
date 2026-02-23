
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { GoalNode } from '../types';
import { TabType } from './BottomDock';
import { CoachingTopicDef, getAvailableTopics } from '../constants/coachingTopics';

interface CoachBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
  nodes: GoalNode[];
  activeTab: TabType;
  onSelectTopic: (topic: CoachingTopicDef) => void;
}

const CoachBubble: React.FC<CoachBubbleProps> = ({
  isOpen,
  onToggle,
  hasUnread,
  nodes,
  activeTab,
  onSelectTopic,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [menuOpen]);

  // CoachChat이 열리면 팝업 메뉴도 닫기
  useEffect(() => {
    if (isOpen) setMenuOpen(false);
  }, [isOpen]);

  if (isOpen) return null;

  const handleBubbleClick = () => {
    if (activeTab === 'GOALS') {
      setMenuOpen((prev) => !prev);
    } else {
      onToggle();
    }
  };

  const handleTopicSelect = (topic: CoachingTopicDef) => {
    setMenuOpen(false);
    if (!topic.topicDirective) {
      onToggle();
    } else {
      onSelectTopic(topic);
    }
  };

  const availableTopics = getAvailableTopics(nodes);

  return (
    <div ref={containerRef} className="fixed bottom-[100px] right-6 z-[58]">
      {/* 팝업 메뉴 */}
      {menuOpen && (
        <div
          className={[
            'absolute bottom-16 right-0 w-64',
            'bg-black/80 backdrop-blur-xl',
            'border border-neon-lime/20 rounded-2xl shadow-2xl',
            'overflow-hidden',
            'animate-slide-up',
          ].join(' ')}
          role="menu"
          aria-label="코칭 주제 선택"
        >
          {/* 카테고리 헤더 */}
          <div className="px-4 pt-3 pb-1.5">
            <span className="text-[10px] font-display tracking-widest text-gray-500 uppercase">
              코칭 가이드
            </span>
          </div>

          {/* 구분선 */}
          <div className="mx-4 h-px bg-neon-lime/10" />

          {/* 항목 목록 */}
          <div className="py-1">
            {availableTopics.map((topic, index) => (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic)}
                className={[
                  'w-full flex items-start gap-3 px-4 py-3',
                  'text-left transition-colors duration-150',
                  'hover:bg-neon-lime/10 active:bg-neon-lime/20',
                  // 마지막 항목 아닌 경우 구분선
                  index < availableTopics.length - 1
                    ? 'border-b border-white/5'
                    : '',
                ].join(' ')}
                role="menuitem"
              >
                {/* 이모지 아이콘 */}
                <span className="text-lg leading-none mt-0.5 shrink-0">
                  {topic.icon}
                </span>

                {/* 텍스트 */}
                <div className="min-w-0">
                  <p className="text-sm font-display text-white leading-tight">
                    {topic.label}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">
                    {topic.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* 하단 꼬리 장식 — 팝업이 FAB 위에서 열림을 시각적으로 연결 */}
          <div className="absolute -bottom-2 right-5 w-4 h-4 rotate-45 bg-black/80 border-r border-b border-neon-lime/20" />
        </div>
      )}

      {/* FAB 버튼 */}
      <button
        onClick={handleBubbleClick}
        className={[
          'relative flex flex-col items-center justify-center w-14 h-14',
          'bg-black/80 backdrop-blur-xl rounded-full',
          'border transition-all duration-300',
          menuOpen
            ? 'border-neon-lime shadow-[0_0_25px_rgba(204,255,0,0.25)] scale-110'
            : 'border-neon-lime/30 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-neon-lime hover:shadow-[0_0_25px_rgba(204,255,0,0.15)]',
        ].join(' ')}
        aria-label={menuOpen ? '메뉴 닫기' : 'AI 코치 열기'}
        aria-expanded={menuOpen}
        aria-haspopup={activeTab === 'GOALS' ? 'menu' : undefined}
      >
        {/* 맥동 링 */}
        <div className="absolute inset-0 rounded-full border border-neon-lime/30 animate-pulse" />

        <MessageCircle
          className={[
            'w-6 h-6 transition-all duration-300',
            menuOpen ? 'text-neon-lime scale-110' : 'text-neon-lime',
          ].join(' ')}
        />

        {/* 읽지 않은 알림 배지 */}
        {hasUnread && !menuOpen && (
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-neon-lime rounded-full shadow-[0_0_5px_#CCFF00]" />
        )}
      </button>
    </div>
  );
};

export default CoachBubble;
