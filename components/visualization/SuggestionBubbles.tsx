import { type FC, useMemo } from 'react';
import type { GoalNode } from '../../types';
import { NodeType } from '../../types';

interface SuggestionBubblesProps {
  nodes: GoalNode[];
  onSelect: (text: string) => void;
}

const FADE_IN_KEYFRAMES = `
@keyframes bubbleFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const GENERIC_SUGGESTIONS = [
  { emoji: '🏙', text: '꿈을 이룬 순간의 모습을 상상해보세요' },
  { emoji: '💫', text: '미래의 내가 되어있는 모습' },
];

const INSPIRATION = [
  '🌟 새로운 가능성이 열리는 순간',
  '🌈 모든 것이 조화롭게 맞아들어가는 순간',
  '🔥 한계를 넘어서는 순간',
  '🎯 목표에 도달한 순간의 감동',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const SuggestionBubbles: FC<SuggestionBubblesProps> = ({ nodes, onSelect }) => {
  const bubbles = useMemo(() => {
    const items: string[] = [];

    // Bubble 1: fixed data-driven suggestion
    items.push('✦ 당신의 데이터로 바로 생성');

    // Bubble 2-3: derived from root nodes
    const roots = nodes.filter((n) => n.type === NodeType.ROOT);
    if (roots.length >= 1) {
      items.push(`🏙 ${roots[0].text}를 달성한 순간의 모습`);
    } else {
      items.push(`${GENERIC_SUGGESTIONS[0].emoji} ${GENERIC_SUGGESTIONS[0].text}`);
    }
    if (roots.length >= 2) {
      items.push(`💫 ${roots[1].text}을 이뤄낸 미래의 나`);
    } else {
      items.push(`${GENERIC_SUGGESTIONS[1].emoji} ${GENERIC_SUGGESTIONS[1].text}`);
    }

    // Bubble 4: random inspiration
    items.push(pickRandom(INSPIRATION));

    return items;
  }, [nodes]);

  return (
    <>
      {/* Inject keyframes once */}
      <style>{FADE_IN_KEYFRAMES}</style>

      <div className="flex flex-col gap-2 px-4 py-3">
        {bubbles.map((text, i) => {
          const isFirst = i === 0;
          return (
            <button
              key={text}
              type="button"
              onClick={() => onSelect(text)}
              className="text-left cursor-pointer self-start"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: isFirst
                  ? '1px solid rgba(255,215,0,0.25)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px 18px 18px 18px',
                padding: '12px 16px',
                fontSize: 14,
                color: 'rgba(255,255,255,0.85)',
                opacity: 0,
                animation: 'bubbleFadeIn 300ms ease forwards',
                animationDelay: `${i * 100}ms`,
                transition: 'transform 80ms ease',
                maxWidth: '85%',
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
              onPointerLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              {text}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default SuggestionBubbles;
