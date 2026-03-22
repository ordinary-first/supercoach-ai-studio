import React from 'react';
import { GoalNode, GoalLink, NodeType } from '../types';
import { Plus, Compass } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface VisionBoardProps {
  nodes: GoalNode[];
  links: GoalLink[];
  onNodeClick: (node: GoalNode) => void;
  onAddSubNode: (parentId: string) => void;
}

/* 각 셀에 개성을 주는 팔레트 — 이미지가 없을 때 사용 */
const CELL_STYLES = [
  { bg: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)', glow: 'rgba(56,189,248,0.12)' },
  { bg: 'linear-gradient(160deg, #1a1025 0%, #4c1d95 100%)', glow: 'rgba(139,92,246,0.12)' },
  { bg: 'linear-gradient(160deg, #1c1917 0%, #78350f 100%)', glow: 'rgba(251,146,60,0.10)' },
  { bg: 'linear-gradient(160deg, #0c1a1a 0%, #134e4a 100%)', glow: 'rgba(45,212,191,0.10)' },
  { bg: 'linear-gradient(160deg, #1a0b2e 0%, #581c87 100%)', glow: 'rgba(192,132,252,0.12)' },
  { bg: 'linear-gradient(160deg, #1c0f0f 0%, #7f1d1d 100%)', glow: 'rgba(248,113,113,0.10)' },
  { bg: 'linear-gradient(160deg, #0f1629 0%, #1e40af 100%)', glow: 'rgba(96,165,250,0.12)' },
  { bg: 'linear-gradient(160deg, #1a1a0e 0%, #713f12 100%)', glow: 'rgba(250,204,21,0.10)' },
];

const VisionBoard: React.FC<VisionBoardProps> = ({ nodes, links, onNodeClick, onAddSubNode }) => {
  const { t } = useTranslation();
  const rootNode = nodes.find(n => n.type === NodeType.ROOT);
  if (!rootNode) return null;

  const firstLevelNodes = nodes.filter(n =>
    n.parentId === rootNode.id && n.type === NodeType.SUB
  );

  // 3x3 그리드: 가운데(index 4) = ROOT, 나머지 = 1차 노드
  const gridSlots: (GoalNode | null)[] = Array(9).fill(null);
  gridSlots[4] = rootNode;
  const positions = [0, 1, 2, 3, 5, 6, 7, 8];
  firstLevelNodes.forEach((node, i) => {
    if (i < positions.length) gridSlots[positions[i]] = node;
  });

  return (
    <div className="absolute inset-0 z-10 overflow-auto">
      {/* 배경 분위기 — 미세한 방사형 글로우 */}
      <div className="absolute inset-0 bg-th-base" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(113,183,255,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
        <div className="grid grid-cols-3 gap-1.5 md:gap-2.5 w-full max-w-[520px] aspect-square">
          {gridSlots.map((node, index) => {
            const isCenter = index === 4;
            const isEmpty = !node;
            const style = CELL_STYLES[index % CELL_STYLES.length];
            const delay = index * 60;

            if (isEmpty) {
              return (
                <button
                  key={`empty-${index}`}
                  onClick={() => onAddSubNode(rootNode.id)}
                  className="relative aspect-square rounded-[18px] md:rounded-[22px] border border-dashed border-white/[0.08]
                    flex items-center justify-center
                    hover:border-white/20 hover:bg-white/[0.03]
                    transition-all duration-300 group
                    animate-[cellReveal_0.5s_ease-out_both]"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <Plus
                    className="w-6 h-6 text-white/15 group-hover:text-white/40 group-hover:scale-110 transition-all duration-300"
                    strokeWidth={1.5}
                  />
                </button>
              );
            }

            return (
              <button
                key={node.id}
                onClick={() => onNodeClick(node)}
                className="relative aspect-square rounded-[18px] md:rounded-[22px] overflow-hidden
                  group transition-all duration-500
                  hover:scale-[1.03] hover:z-10
                  active:scale-[0.97]
                  animate-[cellReveal_0.5s_ease-out_both]
                  shadow-[0_2px_20px_-4px_rgba(0,0,0,0.4)]
                  hover:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)]"
                style={{
                  animationDelay: `${delay}ms`,
                  ...(isCenter ? { boxShadow: '0 0 60px -12px rgba(139,92,246,0.25)' } : {}),
                }}
              >
                {/* 배경 */}
                {node.imageUrl ? (
                  <img
                    src={node.imageUrl}
                    alt={node.text}
                    className="absolute inset-0 w-full h-full object-cover
                      transition-transform duration-700 ease-out
                      group-hover:scale-110"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: isCenter
                      ? 'linear-gradient(135deg, #312e81 0%, #5b21b6 40%, #7c3aed 100%)'
                      : style.bg
                    }}
                  />
                )}

                {/* 비네트 오버레이 — 영화 포스터 느낌 */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.5)_100%)]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10
                  group-hover:from-black/40 transition-colors duration-500" />

                {/* 호버 시 미세한 글로우 테두리 */}
                <div className="absolute inset-0 rounded-[18px] md:rounded-[22px] border border-white/[0.06]
                  group-hover:border-white/[0.15] transition-colors duration-500" />

                {/* 텍스트 */}
                <div className="absolute inset-0 flex flex-col items-center justify-end p-3 pb-4">
                  {isCenter && (
                    <div className="mb-auto mt-3 flex items-center gap-1">
                      <Compass size={10} className="text-purple-300/60" />
                      <span className="text-[9px] font-medium text-purple-300/60 uppercase tracking-[0.2em]">
                        Identity
                      </span>
                    </div>
                  )}
                  <span className="text-white font-semibold text-[13px] md:text-[15px] text-center leading-snug
                    drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]
                    group-hover:drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]
                    transition-all duration-300">
                    {node.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes cellReveal {
          from {
            opacity: 0;
            transform: scale(0.88) translateY(12px);
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
