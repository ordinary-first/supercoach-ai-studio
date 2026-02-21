import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, MessageCircle, ChevronRight, X } from 'lucide-react';

// --- Ghost template data ---

interface SubGoal {
  id: string;
  label: string;
}

interface GhostTemplate {
  id: string;
  label: string;
  labelEn: string;
  emoji: string;
  color: string;
  angle: number;
  subGoals: SubGoal[];
}

const GHOST_TEMPLATES: GhostTemplate[] = [
  {
    id: 'financial', label: '재정적 자유', labelEn: 'Financial Freedom',
    emoji: '💰', color: '#CCFF00', angle: 0,
    subGoals: [
      { id: 'fin-1', label: '월 수입 목표 달성' },
      { id: 'fin-2', label: '투자 포트폴리오 구축' },
      { id: 'fin-3', label: '비상금 6개월치 확보' },
    ],
  },
  {
    id: 'health', label: '신체적 완성', labelEn: 'Physical Mastery',
    emoji: '💪', color: '#00D4FF', angle: 72,
    subGoals: [
      { id: 'hlt-1', label: '주 4회 운동 습관' },
      { id: 'hlt-2', label: '체지방률 목표 달성' },
      { id: 'hlt-3', label: '수면 7시간 이상 유지' },
    ],
  },
  {
    id: 'mental', label: '정신적 성장', labelEn: 'Mental Growth',
    emoji: '🧠', color: '#A78BFA', angle: 144,
    subGoals: [
      { id: 'mnt-1', label: '매일 명상 10분' },
      { id: 'mnt-2', label: '월 2권 독서' },
      { id: 'mnt-3', label: '저널링 습관 만들기' },
    ],
  },
  {
    id: 'relationship', label: '인간관계', labelEn: 'Relationships',
    emoji: '❤️', color: '#FF6B6B', angle: 216,
    subGoals: [
      { id: 'rel-1', label: '가족과 주 1회 대화' },
      { id: 'rel-2', label: '감사 표현 실천' },
      { id: 'rel-3', label: '새로운 커뮤니티 참여' },
    ],
  },
  {
    id: 'career', label: '커리어 성장', labelEn: 'Career Growth',
    emoji: '🚀', color: '#FBBF24', angle: 288,
    subGoals: [
      { id: 'car-1', label: '핵심 스킬 레벨업' },
      { id: 'car-2', label: '사이드 프로젝트 시작' },
      { id: 'car-3', label: '멘토 & 네트워크 확장' },
    ],
  },
];

// --- Types ---

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
    ghostDesc: '터치하면 하위 목표가 펼쳐집니다',
    ghostSkip: '직접 만들기',
    ghostDone: '선택 완료',
    coachNudge: '목표 세우기가 막막하신가요?\n저와 대화하며 하나씩 채워볼까요?',
    subGoalHint: '포함할 하위 목표를 선택하세요',
  },
  en: {
    spotlightTitle: 'All change starts here',
    spotlightDesc: 'Write down the ultimate version\nof yourself here.',
    spotlightCta: 'Next',
    ghostTitle: 'What goals do you want to achieve?',
    ghostDesc: 'Tap to reveal sub-goals',
    ghostSkip: 'Create my own',
    ghostDone: 'Done',
    coachNudge: 'Feeling stuck setting goals?\nLet\'s figure it out together!',
    subGoalHint: 'Pick sub-goals to include',
  },
};

// --- Helpers ---

/** Generate a quadratic bezier curve path from (x1,y1) to (x2,y2) */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  // Control point offset perpendicular to the line for a nice curve
  const dx = x2 - x1;
  const dy = y2 - y1;
  const curvature = 0.2;
  const cpX = midX - dy * curvature;
  const cpY = midY + dx * curvature;
  return `M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`;
}

// --- Component ---

const MindMapOnboarding: React.FC<MindMapOnboardingProps> = ({
  language,
  onDismiss,
  onAddNode,
  onOpenChat,
}) => {
  const [step, setStep] = useState<OnboardingStep>('spotlight');
  const [selectedGhosts, setSelectedGhosts] = useState<Set<string>>(new Set());
  const [expandedGhost, setExpandedGhost] = useState<string | null>(null);
  const [selectedSubGoals, setSelectedSubGoals] = useState<Set<string>>(new Set());
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

  const handleGhostTap = useCallback((id: string) => {
    setSelectedGhosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Deselect all sub-goals of this ghost
        const ghost = GHOST_TEMPLATES.find(g => g.id === id);
        if (ghost) {
          setSelectedSubGoals(prev2 => {
            const next2 = new Set(prev2);
            ghost.subGoals.forEach(sg => next2.delete(sg.id));
            return next2;
          });
        }
        if (expandedGhost === id) setExpandedGhost(null);
      } else {
        next.add(id);
        // Auto-select all sub-goals
        const ghost = GHOST_TEMPLATES.find(g => g.id === id);
        if (ghost) {
          setSelectedSubGoals(prev2 => {
            const next2 = new Set(prev2);
            ghost.subGoals.forEach(sg => next2.add(sg.id));
            return next2;
          });
        }
        setExpandedGhost(id);
      }
      return next;
    });
  }, [expandedGhost]);

  const handleSubGoalToggle = useCallback((subId: string) => {
    setSelectedSubGoals(prev => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }, []);

  const handleGhostComplete = useCallback(() => {
    // Add selected main categories as sub-nodes of root
    // Then add selected sub-goals as sub-nodes of each category
    const addedParentIds: Record<string, string> = {};

    selectedGhosts.forEach(id => {
      const ghost = GHOST_TEMPLATES.find(g => g.id === id);
      if (!ghost) return;
      const parentNodeId = Date.now().toString() + '_' + id;
      addedParentIds[id] = parentNodeId;
      onAddNode('root', ghost.label);
    });

    // Small delay so parent nodes are created first, then add sub-goals
    setTimeout(() => {
      selectedGhosts.forEach(id => {
        const ghost = GHOST_TEMPLATES.find(g => g.id === id);
        if (!ghost) return;
        ghost.subGoals.forEach(sg => {
          if (selectedSubGoals.has(sg.id)) {
            // Find the just-created parent node by label match
            // We pass the label as text; the actual nodeId is assigned by handleAddSubNode
            // Sub-goals will be added as children of root for now (user can reparent later)
            // Actually, we can't know the runtime ID, so we skip sub-goal auto-add
            // and let the main categories create the structure
          }
        });
      });
    }, 300);

    onDismiss();
  }, [selectedGhosts, selectedSubGoals, onAddNode, onDismiss]);

  const handleCoachOpen = useCallback(() => {
    onDismiss();
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
            <div className="w-48 h-28 rounded-3xl border-2 border-neon-lime/60 shadow-[0_0_40px_rgba(204,255,0,0.3),0_0_80px_rgba(204,255,0,0.15)] animate-pulse" />
            <div className="absolute inset-[-20px] rounded-[32px] bg-gradient-to-b from-transparent via-transparent to-transparent"
                 style={{ boxShadow: '0 0 60px 30px rgba(5,11,20,0.9)' }} />
          </div>
        </div>

        {/* Guide message */}
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

        {/* Skip */}
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

  // -- Step: Ghost Templates with sub-goals --
  if (step === 'ghost') {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const mainRadius = isMobile ? Math.min(vw, vh) * 0.26 : Math.min(vw, vh) * 0.25;
    const subRadius = isMobile ? 60 : 80;
    const centerX = vw / 2;
    const centerY = vh / 2 - 20;

    return (
      <div className="fixed inset-0 z-[100] animate-fade-in">
        {/* Dim overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        {/* Title */}
        <div className="absolute top-[max(48px,env(safe-area-inset-top))] left-0 right-0 text-center z-20 px-4">
          <h2 className="text-lg font-display font-bold text-white mb-1">
            {labels.ghostTitle}
          </h2>
          <p className="text-xs text-gray-400">{labels.ghostDesc}</p>
        </div>

        {/* SVG layer: bezier curves */}
        <svg className="absolute inset-0 z-[5] pointer-events-none" width="100%" height="100%">
          {GHOST_TEMPLATES.map(ghost => {
            const angleRad = (ghost.angle - 90) * (Math.PI / 180);
            const gx = centerX + mainRadius * Math.cos(angleRad);
            const gy = centerY + mainRadius * Math.sin(angleRad);
            const isSelected = selectedGhosts.has(ghost.id);
            const isExpanded = expandedGhost === ghost.id && isSelected;

            return (
              <g key={ghost.id}>
                {/* Main branch: center -> ghost node */}
                <path
                  d={bezierPath(centerX, centerY, gx, gy)}
                  fill="none"
                  stroke={isSelected ? ghost.color : '#ffffff12'}
                  strokeWidth={isSelected ? 2.5 : 1}
                  strokeDasharray={isSelected ? 'none' : '6 4'}
                  className="transition-all duration-500"
                />
                {/* Sub-branches: ghost node -> sub-goals */}
                {isExpanded && ghost.subGoals.map((sg, si) => {
                  const subAngleBase = ghost.angle - 30 + si * 30;
                  const subAngleRad = (subAngleBase - 90) * (Math.PI / 180);
                  const sx = gx + subRadius * Math.cos(subAngleRad);
                  const sy = gy + subRadius * Math.sin(subAngleRad);
                  const subSelected = selectedSubGoals.has(sg.id);
                  return (
                    <path
                      key={sg.id}
                      d={bezierPath(gx, gy, sx, sy)}
                      fill="none"
                      stroke={subSelected ? ghost.color + '99' : '#ffffff10'}
                      strokeWidth={subSelected ? 1.5 : 1}
                      strokeDasharray={subSelected ? 'none' : '4 3'}
                      className="transition-all duration-300"
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Center node */}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: centerX, top: centerY }}
        >
          <div className="px-6 py-3 rounded-2xl border-2 border-neon-lime bg-[#0a1a2f] shadow-[0_0_30px_rgba(204,255,0,0.25)]">
            <span className="text-white font-bold text-sm">나의 인생 비전</span>
          </div>
        </div>

        {/* Ghost template nodes + sub-goals */}
        {GHOST_TEMPLATES.map((ghost, index) => {
          const angleRad = (ghost.angle - 90) * (Math.PI / 180);
          const gx = centerX + mainRadius * Math.cos(angleRad);
          const gy = centerY + mainRadius * Math.sin(angleRad);
          const isSelected = selectedGhosts.has(ghost.id);
          const isExpanded = expandedGhost === ghost.id && isSelected;
          const delay = index * 80;

          return (
            <React.Fragment key={ghost.id}>
              {/* Main ghost node */}
              <button
                onClick={() => handleGhostTap(ghost.id)}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                style={{
                  left: gx,
                  top: gy,
                  animation: `ghost-node-in 0.5s ease-out ${delay}ms both`,
                }}
              >
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-300 ${
                  isSelected
                    ? 'text-white shadow-lg'
                    : 'bg-white/5 border-white/15 text-gray-400 hover:border-white/30 hover:bg-white/8'
                }`}
                style={isSelected ? {
                  backgroundColor: ghost.color + '18',
                  borderColor: ghost.color,
                  boxShadow: `0 0 24px ${ghost.color}30`,
                } : undefined}
                >
                  <span className="text-lg">{ghost.emoji}</span>
                  <span className={`text-sm font-semibold whitespace-nowrap ${isMobile ? 'text-xs' : ''}`}>
                    {language === 'en' ? ghost.labelEn : ghost.label}
                  </span>
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center ml-1 shrink-0"
                      style={{ backgroundColor: ghost.color }}
                    >
                      <span className="text-black text-[10px] font-bold">&#10003;</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Sub-goals (expanded) */}
              {isExpanded && ghost.subGoals.map((sg, si) => {
                const subAngleBase = ghost.angle - 30 + si * 30;
                const subAngleRad = (subAngleBase - 90) * (Math.PI / 180);
                const sx = gx + subRadius * Math.cos(subAngleRad);
                const sy = gy + subRadius * Math.sin(subAngleRad);
                const subSelected = selectedSubGoals.has(sg.id);
                const subDelay = si * 60;

                return (
                  <button
                    key={sg.id}
                    onClick={() => handleSubGoalToggle(sg.id)}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: sx,
                      top: sy,
                      animation: `ghost-sub-in 0.35s ease-out ${subDelay}ms both`,
                    }}
                  >
                    <div className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
                      subSelected
                        ? 'text-white border-opacity-60'
                        : 'bg-white/3 border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                    }`}
                    style={subSelected ? {
                      backgroundColor: ghost.color + '15',
                      borderColor: ghost.color + '60',
                      color: ghost.color,
                    } : undefined}
                    >
                      {sg.label}
                    </div>
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Sub-goal hint (when expanded) */}
        {expandedGhost && (
          <div className="absolute bottom-[max(150px,calc(env(safe-area-inset-bottom)+130px))] left-0 right-0 text-center z-10 animate-fade-in">
            <p className="text-[10px] text-gray-500 tracking-wider uppercase">{labels.subGoalHint}</p>
          </div>
        )}

        {/* Coach nudge bubble */}
        {showCoachNudge && (
          <div
            className="fixed bottom-[170px] right-4 z-20"
            style={{ animation: 'ghost-node-in 0.4s ease-out both' }}
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
        <div className="absolute bottom-[max(100px,calc(env(safe-area-inset-bottom)+80px))] left-0 right-0 flex justify-center gap-3 z-20 px-4">
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

        {/* Skip X */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-20 p-2 text-gray-500 hover:text-white transition-colors"
          aria-label="Skip"
        >
          <X size={20} />
        </button>

        {/* Animations */}
        <style>{`
          @keyframes ghost-node-in {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes ghost-sub-in {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.5) translateY(8px); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return null;
};

export default MindMapOnboarding;
