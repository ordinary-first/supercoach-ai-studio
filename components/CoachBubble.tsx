import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface CoachBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  hasUnread?: boolean;
}

const CoachBubble: React.FC<CoachBubbleProps> = ({ isOpen, onToggle, hasUnread }) => {
  const { t } = useTranslation();
  if (isOpen) return null;

  return (
    <div className="fixed bottom-[100px] right-6 z-[58]">
      <button
        onClick={onToggle}
        className="relative flex flex-col items-center justify-center w-14 h-14 bg-black/80 backdrop-blur-xl border border-neon-lime/30 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-neon-lime hover:shadow-[0_0_25px_rgba(204,255,0,0.15)] transition-all duration-300"
        aria-label={t.coach.openCoach}
      >
        {/* Pulse animation ring */}
        <div className="absolute inset-0 rounded-full border border-neon-lime/30 animate-pulse"></div>

        {/* Icon */}
        <MessageCircle className="text-neon-lime w-6 h-6" />

        {/* Unread indicator */}
        {hasUnread && (
          <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-neon-lime rounded-full shadow-[0_0_5px_#CCFF00]"></div>
        )}
      </button>

    </div>
  );
};

export default CoachBubble;
