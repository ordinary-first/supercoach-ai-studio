import React from 'react';
import { MessageCircle } from 'lucide-react';

interface CoachBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
}

const CoachBubble: React.FC<CoachBubbleProps> = ({ isOpen, onToggle, hasUnread }) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-[100px] right-6 z-[58]">
      <button
        onClick={onToggle}
        className="relative flex flex-col items-center justify-center w-14 h-14 bg-th-elevated backdrop-blur-xl border border-th-accent-border rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-th-accent hover:shadow-[0_0_25px_var(--shadow-glow)] transition-all duration-300"
        aria-label="AI 코치 열기"
      >
        {/* Pulse animation ring */}
        <div className="absolute inset-0 rounded-full border border-th-accent-border animate-pulse"></div>

        {/* Icon */}
        <MessageCircle className="text-th-accent w-6 h-6" />

        {/* Unread indicator */}
        {hasUnread && (
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-th-accent rounded-full shadow-[0_0_5px_var(--shadow-glow)]"></div>
        )}
      </button>

    </div>
  );
};

export default CoachBubble;
