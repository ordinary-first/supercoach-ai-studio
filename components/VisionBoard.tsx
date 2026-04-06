import React, { useState } from 'react';
import { GoalNode, GoalLink, NodeType } from '../types';
import { Plus } from 'lucide-react';
import { useThemeStore } from '../stores/useThemeStore';

interface VisionBoardProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodeClick: (node: GoalNode) => void;
  onAddSubNode: (parentId: string) => void;
}

/*
 * Bento Vision Board — dual-personality design
 *
 * DARK:  Cinematic immersion — deep blacks, vignettes, glass overlays
 * LIGHT: Soft Mica — frosted depth, warm neutrals, tactile card shadows
 *        Inspired by Apple Vision Pro spatial UI + physical card metaphor
 */

// --- Dark mode: cinematic deep gradients ---
const PALETTES_DARK = [
  { from: '#0c1220', via: '#1a3a5f', to: '#2563eb', accent: '56,189,248' },
  { from: '#1a0525', via: '#4c1d95', to: '#8b5cf6', accent: '139,92,246' },
  { from: '#1c0f07', via: '#78350f', to: '#f59e0b', accent: '251,146,60' },
  { from: '#041a1a', via: '#134e4a', to: '#14b8a6', accent: '45,212,191' },
  { from: '#200818', via: '#831843', to: '#ec4899', accent: '236,72,153' },
  { from: '#0f0f1c', via: '#1e3a8a', to: '#3b82f6', accent: '59,130,246' },
  { from: '#1a0a0a', via: '#7f1d1d', to: '#ef4444', accent: '239,68,68' },
  { from: '#0f1a0a', via: '#365314', to: '#84cc16', accent: '132,204,22' },
];

// --- Light mode: soft watercolor washes, muted & warm ---
const PALETTES_LIGHT = [
  { from: '#dbeafe', via: '#93c5fd', to: '#3b82f6', accent: '59,130,246' },
  { from: '#ede9fe', via: '#c4b5fd', to: '#8b5cf6', accent: '139,92,246' },
  { from: '#fef3c7', via: '#fcd34d', to: '#f59e0b', accent: '245,158,11' },
  { from: '#ccfbf1', via: '#5eead4', to: '#14b8a6', accent: '20,184,166' },
  { from: '#fce7f3', via: '#f9a8d4', to: '#ec4899', accent: '236,72,153' },
  { from: '#dbeafe', via: '#93c5fd', to: '#2563eb', accent: '37,99,235' },
  { from: '#fee2e2', via: '#fca5a5', to: '#ef4444', accent: '239,68,68' },
  { from: '#ecfccb', via: '#bef264', to: '#84cc16', accent: '132,204,22' },
];

const AREA_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const VisionBoard: React.FC<VisionBoardProps> = ({ nodes, links, onNodeClick, onAddSubNode }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const isLight = useThemeStore((s) => s.resolved === 'light');
  const rootNode = nodes.find(n => n.type === NodeType.ROOT);
  if (!rootNode) return null;

  const firstLevelNodes = nodes.filter(n =>
    n.parentId === rootNode.id && n.type === NodeType.SUB
  );

  const slots: (GoalNode | null)[] = Array(8).fill(null);
  slots[0] = rootNode;
  firstLevelNodes.forEach((node, i) => {
    if (i + 1 < slots.length) slots[i + 1] = node;
  });

  const palettes = isLight ? PALETTES_LIGHT : PALETTES_DARK;

  return (
    <div className={`absolute inset-0 z-10 overflow-hidden ${isLight ? 'bg-[#f5f5f0]' : 'bg-[#08090b]'}`}>
      {/* Ambient atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        {isLight ? (
          <>
            {/* Warm cream wash — top-left */}
            <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 65%)' }} />
            {/* Cool blue wash — bottom-right */}
            <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 65%)' }} />
          </>
        ) : (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-25"
              style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)' }} />
          </>
        )}
      </div>

      {/* Subtle noise texture */}
      <div className={`absolute inset-0 pointer-events-none ${isLight ? 'opacity-[0.02]' : 'opacity-[0.03]'}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")` }} />

      {/* Bento Grid */}
      <div className={`vb-grid relative w-full h-full ${isLight ? 'p-2.5 md:p-4' : 'p-2 md:p-3'}`}>
        {slots.map((node, index) => {
          const isHero = index === 0;
          const isEmpty = !node;
          const palette = palettes[index % palettes.length];
          const area = AREA_NAMES[index];
          const isHovered = node ? hoveredId === node.id : false;

          if (isEmpty) {
            return (
              <button
                key={`empty-${index}`}
                onClick={() => onAddSubNode(rootNode.id)}
                className={`relative overflow-hidden rounded-2xl md:rounded-3xl
                  border border-dashed flex items-center justify-center
                  transition-all duration-500 group
                  ${isLight
                    ? 'border-stone-300/60 hover:border-stone-400 hover:bg-stone-100/50 hover:shadow-sm'
                    : 'border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]'
                  }`}
                style={{
                  gridArea: area,
                  animation: `cellFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms both`,
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-500
                    ${isLight
                      ? 'border-stone-300/50 group-hover:border-stone-400 group-hover:bg-stone-200/40'
                      : 'border-white/[0.08] group-hover:border-white/20 group-hover:bg-white/[0.04]'
                    }`}>
                    <Plus className={`w-5 h-5 transition-colors duration-500
                      ${isLight ? 'text-stone-400 group-hover:text-stone-600' : 'text-white/20 group-hover:text-white/50'}`}
                      strokeWidth={1.5} />
                  </div>
                  <span className={`text-[11px] transition-colors duration-500 tracking-wide
                    ${isLight ? 'text-stone-400 group-hover:text-stone-500' : 'text-white/20 group-hover:text-white/40'}`}>
                    Add Goal
                  </span>
                </div>
              </button>
            );
          }

          return (
            <button
              key={node.id}
              onClick={() => onNodeClick(node)}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative overflow-hidden group transition-all duration-700 ease-out active:scale-[0.98]
                ${isLight
                  ? `rounded-[20px] md:rounded-[24px] ${isHovered ? 'z-20 scale-[1.02] shadow-xl shadow-black/10' : 'z-10 scale-100 shadow-md shadow-black/[0.06]'}`
                  : `rounded-2xl md:rounded-3xl ${isHovered ? 'z-20 scale-[1.015]' : 'z-10 scale-100'}`
                }`}
              style={{
                gridArea: area,
                animation: `cellFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms both`,
              }}
            >
              {/* Background: image or gradient */}
              {node.imageUrl ? (
                <img
                  src={node.imageUrl}
                  alt={node.text}
                  className="absolute inset-0 w-full h-full object-cover
                    transition-transform duration-[1.2s] ease-out
                    group-hover:scale-[1.08]"
                />
              ) : (
                <div className="absolute inset-0" style={{
                  background: isLight
                    ? `linear-gradient(155deg, ${palette.from} 0%, ${palette.via} 55%, ${palette.to} 100%)`
                    : `linear-gradient(145deg, ${palette.from} 0%, ${palette.via} 50%, ${palette.to} 100%)`,
                }}>
                  {/* Glow on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: isLight
                      ? `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.35) 0%, transparent 55%)`
                      : `radial-gradient(circle at 30% 30%, rgba(${palette.accent},0.2) 0%, transparent 60%)`
                    }} />
                </div>
              )}

              {/* Overlays — completely different per theme */}
              {isLight ? (
                <>
                  {/* Light: soft white veil on top for depth, dark scrim at bottom for text */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 40%, rgba(0,0,0,0.25) 100%)' }} />
                  {isHero && (
                    <div className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 40%, transparent 70%)' }} />
                  )}
                  {/* Frosted border */}
                  <div className="absolute inset-0 rounded-[20px] md:rounded-[24px]
                    border border-white/30 group-hover:border-white/50
                    transition-all duration-500" />
                </>
              ) : (
                <>
                  {/* Dark: cinematic vignette */}
                  <div className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 20%, rgba(0,0,0,0.55) 100%)' }} />
                  <div className={`absolute inset-0 transition-opacity duration-700
                    ${isHero
                      ? 'bg-gradient-to-t from-black/70 via-black/20 to-transparent'
                      : 'bg-gradient-to-t from-black/65 via-transparent to-black/5'
                    }`} />
                  <div className="absolute inset-0 rounded-2xl md:rounded-3xl
                    border border-white/[0.04] group-hover:border-white/[0.12]
                    transition-all duration-700" />
                </>
              )}

              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background: isLight
                    ? 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.15) 44%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 56%, transparent 62%)'
                    : 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
                }} />

              {/* Content */}
              <div className={`absolute inset-0 flex flex-col justify-end
                ${isHero ? 'p-5 md:p-8' : 'p-3 md:p-4'}`}>

                {/* Title */}
                <h3 className={`font-semibold leading-tight
                  transition-transform duration-500 group-hover:translate-y-[-2px]
                  ${isHero
                    ? 'text-[20px] md:text-[28px] tracking-tight'
                    : 'text-[13px] md:text-[15px]'
                  }
                  ${isLight
                    ? 'text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)]'
                    : 'text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]'
                  }`}
                >
                  {node.text}
                </h3>

                {/* Sub-count indicator */}
                {isHero && firstLevelNodes.length > 0 && (
                  <p className={`mt-2 text-[11px] md:text-[12px] tracking-wide
                    ${isLight ? 'text-white/70' : 'text-white/50'}`}>
                    {firstLevelNodes.length} goals connected
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .vb-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(4, 1fr);
          grid-template-areas:
            "a a b"
            "a a c"
            "d e f"
            "g h h";
          gap: ${isLight ? '6px' : '4px'};
        }
        @media (min-width: 768px) {
          .vb-grid {
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(3, 1fr);
            grid-template-areas:
              "a a b c"
              "a a d e"
              "f g h h";
            gap: ${isLight ? '8px' : '6px'};
          }
        }
        @keyframes cellFadeIn {
          from {
            opacity: 0;
            transform: scale(0.92) translateY(16px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default VisionBoard;
