
import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { GoalNode, NodeType } from '../types';

interface CoachBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
  selectedNode: GoalNode | null;
}

const CoachBubble: React.FC<CoachBubbleProps> = ({ isOpen, onToggle, hasUnread, selectedNode }) => {
  const [shouldPulse, setShouldPulse] = useState(false);
  const hasInitialPulsed = useRef(false);

  // 처음 진입 시 1회 pulse
  useEffect(() => {
    if (!hasInitialPulsed.current && !isOpen) {
      hasInitialPulsed.current = true;
      setShouldPulse(true);
    }
  }, []);

  // ROOT 노드 선택 시 pulse
  useEffect(() => {
    if ((selectedNode?.type === NodeType.ROOT || selectedNode?.type === NodeType.SUB) && !isOpen) {
      setShouldPulse(true);
    }
  }, [selectedNode, isOpen]);

  // 3초 후 자동 소멸
  useEffect(() => {
    if (!shouldPulse) return;
    const timer = setTimeout(() => setShouldPulse(false), 3000);
    return () => clearTimeout(timer);
  }, [shouldPulse]);

  if (isOpen) return null;

  return (
    <div className="fixed bottom-[100px] right-6 z-[58]">
      <button
        onClick={onToggle}
        className={[
          'relative flex flex-col items-center justify-center w-14 h-14',
          'bg-black/80 backdrop-blur-xl rounded-full',
          'border transition-all duration-300',
          shouldPulse
            ? 'border-neon-lime ring-2 ring-neon-lime/60 shadow-[0_0_30px_rgba(204,255,0,0.3)]'
            : 'border-neon-lime/30 shadow-[0_0_20px_rgba(0,0,0,0.5)]',
          'hover:border-neon-lime hover:shadow-[0_0_25px_rgba(204,255,0,0.15)]',
        ].join(' ')}
        aria-label="AI 코치 열기"
      >
        {/* 맥동 링 */}
        <div className={`absolute inset-0 rounded-full border border-neon-lime/30 ${shouldPulse ? 'animate-ping' : 'animate-pulse'}`} />

        <MessageCircle className="w-6 h-6 text-neon-lime transition-all duration-300" />

        {/* 읽지 않은 알림 배지 */}
        {hasUnread && (
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-neon-lime rounded-full shadow-[0_0_5px_#CCFF00]" />
        )}
      </button>
    </div>
  );
};

export default CoachBubble;
