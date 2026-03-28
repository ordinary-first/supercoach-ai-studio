import React, { useState } from 'react';
import { GoalNode, GoalLink, NodeType } from '../types';
import { Plus, Compass, Sparkles } from 'lucide-react';
// useTranslation: t is an object (TranslationStrings), not a function

interface VisionBoardProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodeClick: (node: GoalNode) => void;
  onAddSubNode: (parentId: string) => void;
}

/*
 * Instagram Explore–style Bento Vision Board
 * - 풀스크린, 화면 전체를 채우는 몰입형 레이아웃
 * - 4:5 비율 카드 (인스타 2025+ 기준)
 * - 중앙 Identity 카드는 2×2 히어로
 * - 글래스모피즘 + 시네마틱 비네트
 */

const CELL_PALETTES = [
  { from: '#0c1220', via: '#1a3a5f', to: '#2563eb', accent: '56,189,248' },
  { from: '#1a0525', via: '#4c1d95', to: '#8b5cf6', accent: '139,92,246' },
  { from: '#1c0f07', via: '#78350f', to: '#f59e0b', accent: '251,146,60' },
  { from: '#041a1a', via: '#134e4a', to: '#14b8a6', accent: '45,212,191' },
  { from: '#200818', via: '#831843', to: '#ec4899', accent: '236,72,153' },
  { from: '#0f0f1c', via: '#1e3a8a', to: '#3b82f6', accent: '59,130,246' },
  { from: '#1a0a0a', via: '#7f1d1d', to: '#ef4444', accent: '239,68,68' },
  { from: '#0f1a0a', via: '#365314', to: '#84cc16', accent: '132,204,22' },
];

/*
 * Bento grid-template-areas:
 *   Desktop (4 cols):  "a  a  b  c"
 *                      "a  a  d  e"
 *                      "f  g  h  h"
 *
 *   Mobile (3 cols):   "a  a  b"
 *                      "a  a  c"
 *                      "d  e  f"
 *                      "g  h  h"
 */
const GRID_AREAS_DESKTOP = `
  "a a b c"
  "a a d e"
  "f g h h"
`;
const GRID_AREAS_MOBILE = `
  "a a b"
  "a a c"
  "d e f"
  "g h h"
`;

const AREA_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const VisionBoard: React.FC<VisionBoardProps> = ({ nodes, links, onNodeClick, onAddSubNode }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootNode = nodes.find(n => n.type === NodeType.ROOT);
  if (!rootNode) return null;

  const firstLevelNodes = nodes.filter(n =>
    n.parentId === rootNode.id && n.type === NodeType.SUB
  );

  // 슬롯 배열: index 0 = ROOT(2×2 히어로), 나머지 = sub goals
  const slots: (GoalNode | null)[] = Array(8).fill(null);
  slots[0] = rootNode;
  firstLevelNodes.forEach((node, i) => {
    if (i + 1 < slots.length) slots[i + 1] = node;
  });

  return (
    <div className="absolute inset-0 z-10 overflow-hidden bg-[#08090b]">
      {/* Ambient glow layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")` }} />

      {/* Bento Grid — responsive via CSS */}
      <div className="vb-grid relative w-full h-full p-2 md:p-3">
        {slots.map((node, index) => {
          const isHero = index === 0;
          const isEmpty = !node;
          const palette = CELL_PALETTES[index % CELL_PALETTES.length];
          const area = AREA_NAMES[index];
          const isHovered = node ? hoveredId === node.id : false;

          if (isEmpty) {
            return (
              <button
                key={`empty-${index}`}
                onClick={() => onAddSubNode(rootNode.id)}
                className="relative overflow-hidden rounded-2xl md:rounded-3xl
                  border border-dashed border-white/[0.06]
                  flex items-center justify-center
                  hover:border-white/15 hover:bg-white/[0.02]
                  transition-all duration-500 group"
                style={{
                  gridArea: area,
                  animation: `cellFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms both`,
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full border border-white/[0.08] flex items-center justify-center
                    group-hover:border-white/20 group-hover:bg-white/[0.04] transition-all duration-500">
                    <Plus className="w-5 h-5 text-white/20 group-hover:text-white/50 transition-colors duration-500" strokeWidth={1.5} />
                  </div>
                  <span className="text-[11px] text-white/20 group-hover:text-white/40 transition-colors duration-500 tracking-wide">
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
              className={`relative overflow-hidden rounded-2xl md:rounded-3xl
                group transition-all duration-700 ease-out
                ${isHovered ? 'z-20 scale-[1.015]' : 'z-10 scale-100'}
                active:scale-[0.98]`}
              style={{
                gridArea: area,
                animation: `cellFadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms both`,
              }}
            >
              {/* Background: image or cinematic gradient */}
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
                  background: `linear-gradient(145deg, ${palette.from} 0%, ${palette.via} 50%, ${palette.to} 100%)`,
                }}>
                  {/* Subtle inner glow for gradient cards */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: `radial-gradient(circle at 30% 30%, rgba(${palette.accent},0.2) 0%, transparent 60%)` }} />
                </div>
              )}

              {/* Cinematic vignette — heavier on edges */}
              <div className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 20%, rgba(0,0,0,0.55) 100%)' }} />

              {/* Bottom gradient for text readability */}
              <div className={`absolute inset-0 transition-opacity duration-700
                ${isHero
                  ? 'bg-gradient-to-t from-black/70 via-black/20 to-transparent'
                  : 'bg-gradient-to-t from-black/65 via-transparent to-black/5'
                }`} />

              {/* Glass border on hover */}
              <div className="absolute inset-0 rounded-2xl md:rounded-3xl
                border border-white/[0.04] group-hover:border-white/[0.12]
                transition-all duration-700" />

              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
                }} />

              {/* Content */}
              <div className={`absolute inset-0 flex flex-col justify-end
                ${isHero ? 'p-5 md:p-8' : 'p-3 md:p-4'}`}>

                {/* Hero badge */}
                {isHero && (
                  <div className="mb-auto mt-1 self-start">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-white/[0.08] backdrop-blur-md border border-white/[0.08]
                      group-hover:bg-white/[0.12] group-hover:border-white/[0.15]
                      transition-all duration-500">
                      <Sparkles size={11} className="text-purple-300/80" />
                      <span className="text-[10px] font-medium text-purple-200/80 uppercase tracking-[0.18em]">
                        Core Identity
                      </span>
                    </div>
                  </div>
                )}

                {/* Title */}
                <h3 className={`text-white font-semibold leading-tight
                  drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]
                  transition-transform duration-500 group-hover:translate-y-[-2px]
                  ${isHero
                    ? 'text-[20px] md:text-[28px] tracking-tight'
                    : 'text-[13px] md:text-[15px]'
                  }`}
                >
                  {node.text}
                </h3>

                {/* Sub-count indicator for hero */}
                {isHero && firstLevelNodes.length > 0 && (
                  <p className="mt-2 text-[11px] md:text-[12px] text-white/40 tracking-wide">
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
          gap: 4px;
        }
        @media (min-width: 768px) {
          .vb-grid {
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(3, 1fr);
            grid-template-areas:
              "a a b c"
              "a a d e"
              "f g h h";
            gap: 6px;
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
