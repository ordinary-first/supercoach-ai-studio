import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, MessageCircle, ChevronRight, X } from 'lucide-react';

interface GhostNode {
  id: string;
  label: string;
  emoji: string;
  angle: number; // degrees around center
}

const GHOST_TEMPLATES: GhostNode[] = [
  { id: 'financial', label: '재정적 자유', emoji: '💰', angle: 0 },
  { id: 'health', label: '신체적 완성', emoji: '💪', angle: 72 },
  { id: 'mental', label: '정신적 성장', emoji: '🧠', angle: 144 },
  { id: 'relationship', label: '인간관계', emoji: '❤️', angle: 216 },
  { id: 'career', label: '커리어 성장', emoji: '🚀', angle: 288 },
];

type OnboardingStep = 'spotlight' | 'ghost' | 'done';

interface MindMapOnboardingProps {
  language: 'en' | 'ko';
  onDismiss: () => void;
  onAddNode: (parentId: string, text: string) => void;
  onOpenChat: () => void;
}

const LABELS = {
  ko: {
    spotlightTitle: '모든 변화는 여기서 시작됩니다',
    spotlightDesc: '당신이 원하는 궁극적인 모습을\n여기에 적어보세요.',
    spotlightCta: '다음',
    ghostTitle: '어떤 목표를 이루고 싶으신가요?',
    ghostDesc: '눌러서 내 목표로 만들기',
    ghostSkip: '직접 만들기',
    ghostDone: '선택 완료',
    coachNudge: '목표 세우기가 막막하신가요?\n저와 대화하며 하나씩 채워볼까요?',
  },
  en: {
    spotlightTitle: 'All change starts here',
    spotlightDesc: 'Write down the ultimate version\nof yourself here.',
    spotlightCta: 'Next',
    ghostTitle: 'What goals do you want to achieve?',
    ghostDesc: 'Tap to make it your goal',
    ghostSkip: 'Create my own',
    ghostDone: 'Done',
    coachNudge: 'Feeling stuck setting goals?\nLet\'s figure it out together!',
  },
};

const MindMapOnboarding: React.FC<MindMapOnboardingProps> = ({
  language,
  onDismiss,
  onAddNode,
  onOpenChat,
}) => {
  const [step, setStep] = useState<OnboardingStep>('spotlight');
  const [selectedGhosts, setSelectedGhosts] = useState<Set<string>>(new Set());
  const [showCoachNudge, setShowCoachNudge] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labels = LABELS[language] || LABELS.ko;

  // Start coach nudge timer when entering ghost step
  useEffect(() => {
    if (step === 'ghost') {
      nudgeTimerRef.current = setTimeout(() => {
        setShowCoachNudge(true);
      }, 5000);
    }
    return () => {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, [step]);

  const handleGhostToggle = useCallback((id: string) => {
    setSelectedGhosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGhostComplete = useCallback(() => {
    selectedGhosts.forEach(id => {
      const ghost = GHOST_TEMPLATES.find(g => g.id === id);
      if (ghost) onAddNode('root', ghost.label);
    });
    onDismiss();
  }, [selectedGhosts, onAddNode, onDismiss]);

  const handleCoachOpen = useCallback(() => {
    onDismiss();
    // Small delay so the onboarding unmounts before chat opens
    setTimeout(() => onOpenChat(), 100);
  }, [onDismiss, onOpenChat]);

  // -- Step: Spotlight (Dim + center highlight) --
  if (step === 'spotlight') {
    return (
      <div className="fixed inset-0 z-[100] animate-fade-in">
        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Spotlight ring on center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Pulsing glow */}
            <div className="w-48 h-28 rounded-3xl border-2 border-neon-lime/60 shadow-[0_0_40px_rgba(204,255,0,0.3),0_0_80px_rgba(204,255,0,0.15)] animate-pulse" />
            {/* Inner clear zone */}
            <div className="absolute inset-[-20px] rounded-[32px] bg-gradient-to-b from-transparent via-transparent to-transparent"
                 style={{ boxShadow: '0 0 60px 30px rgba(5,11,20,0.9)' }} />
          </div>
        </div>

        {/* Guide message (below center) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
          <div className="mt-52 text-center max-w-xs px-4">
            <div className="inline-flex items-center gap-2 bg-neon-lime/10 border border-neon-lime/30 rounded-full px-4 py-1.5 mb-4">
              <Sparkles size={14} className="text-neon-lime" />
              <span className="text-[11px] font-bold text-neon-lime tracking-wider uppercase">Core Identity</span>
            </div>
            <h2 className="text-xl font-display font-bold text-white leading-snug mb-2">
              {labels.spotlightTitle}
            </h2>
            <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed mb-6">
              {labels.spotlightDesc}
            </p>
            <button
              onClick={() => setStep('ghost')}
              className="inline-flex items-center gap-2 bg-neon-lime text-black font-bold text-sm px-8 py-3 rounded-full hover:bg-white transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              {labels.spotlightCta}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Skip onboarding"
        >
          <X size={20} />
        </button>
      </div>
    );
  }

  // -- Step: Ghost Templates --
  if (step === 'ghost') {
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.28;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2 - 30;

    return (
      <div className="fixed inset-0 z-[100] animate-fade-in">
        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        {/* Title */}
        <div className="absolute top-[max(60px,env(safe-area-inset-top))] left-0 right-0 text-center z-10 px-4">
          <h2 className="text-lg font-display font-bold text-white mb-1">
            {labels.ghostTitle}
          </h2>
          <p className="text-xs text-gray-400">{labels.ghostDesc}</p>
        </div>

        {/* Ghost nodes in a circle around center */}
        {GHOST_TEMPLATES.map((ghost, index) => {
          const angleRad = (ghost.angle - 90) * (Math.PI / 180);
          const x = centerX + radius * Math.cos(angleRad);
          const y = centerY + radius * Math.sin(angleRad);
          const isSelected = selectedGhosts.has(ghost.id);
          const delay = index * 100;

          return (
            <button
              key={ghost.id}
              onClick={() => handleGhostToggle(ghost.id)}
              className={`absolute z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-300 -translate-x-1/2 -translate-y-1/2 ${
                isSelected
                  ? 'bg-neon-lime/20 border-neon-lime text-white shadow-[0_0_20px_rgba(204,255,0,0.3)]'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:border-white/40 hover:bg-white/10'
              }`}
              style={{
                left: x,
                top: y,
                animation: `ghost-appear 0.5s ease-out ${delay}ms both`,
              }}
            >
              <span className="text-lg">{ghost.emoji}</span>
              <span className="text-sm font-semibold whitespace-nowrap">{ghost.label}</span>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-neon-lime flex items-center justify-center ml-1">
                  <span className="text-black text-xs font-bold">&#10003;</span>
                </div>
              )}
            </button>
          );
        })}

        {/* Center node (still visible) */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: centerX, top: centerY }}
        >
          <div className="px-6 py-3 rounded-2xl border-2 border-neon-lime bg-[#0a1a2f] shadow-[0_0_30px_rgba(204,255,0,0.2)]">
            <span className="text-white font-bold text-sm">나의 인생 비전</span>
          </div>
        </div>

        {/* Connecting lines from center to ghost nodes */}
        <svg className="absolute inset-0 z-[5] pointer-events-none" width="100%" height="100%">
          {GHOST_TEMPLATES.map(ghost => {
            const angleRad = (ghost.angle - 90) * (Math.PI / 180);
            const x = centerX + radius * Math.cos(angleRad);
            const y = centerY + radius * Math.sin(angleRad);
            const isSelected = selectedGhosts.has(ghost.id);
            return (
              <line
                key={ghost.id}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={isSelected ? '#CCFF00' : '#ffffff15'}
                strokeWidth={isSelected ? 2 : 1}
                strokeDasharray={isSelected ? 'none' : '6 4'}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>

        {/* Coach nudge bubble */}
        {showCoachNudge && (
          <div
            className="fixed bottom-[170px] right-4 z-20 animate-fade-in"
            style={{ animation: 'ghost-appear 0.4s ease-out both' }}
          >
            <button
              onClick={handleCoachOpen}
              className="relative max-w-[240px] bg-[#0d1b30]/95 border border-neon-lime/30 rounded-2xl rounded-br-sm px-4 py-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-neon-lime/60 transition-all text-left"
            >
              <div className="flex items-start gap-2">
                <MessageCircle size={16} className="text-neon-lime shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                  {labels.coachNudge}
                </p>
              </div>
              <div className="mt-2 text-[10px] text-neon-lime font-bold tracking-wider uppercase">
                AI Coach &rarr;
              </div>
            </button>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-[max(100px,calc(env(safe-area-inset-bottom)+80px))] left-0 right-0 flex justify-center gap-3 z-10 px-4">
          <button
            onClick={onDismiss}
            className="px-6 py-3 rounded-full border border-white/20 text-sm text-gray-400 hover:bg-white/10 transition-all"
          >
            {labels.ghostSkip}
          </button>
          {selectedGhosts.size > 0 && (
            <button
              onClick={handleGhostComplete}
              className="px-8 py-3 rounded-full bg-neon-lime text-black text-sm font-bold hover:bg-white transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)] animate-fade-in"
            >
              {labels.ghostDone} ({selectedGhosts.size})
            </button>
          )}
        </div>

        {/* Skip button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Skip"
        >
          <X size={20} />
        </button>

        {/* Animation keyframes */}
        <style>{`
          @keyframes ghost-appear {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export default MindMapOnboarding;
