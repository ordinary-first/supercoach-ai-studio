import { type FC, useMemo } from 'react';
import type { GoalNode } from '../../types';
import { NodeType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';

interface SuggestionBubblesProps {
  nodes: GoalNode[];
  onSelect: (text: string) => void;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const SuggestionBubbles: FC<SuggestionBubblesProps> = ({ nodes, onSelect }) => {
  const { language, t } = useTranslation();

  const bubbles = useMemo(() => {
    const roots = (nodes ?? []).filter((node) => node.type === NodeType.ROOT);

    if (language === 'ko') {
      const inspiration = [
        '🌙 오늘의 이상적인 하루를 이미 살아낸 장면',
        '✨ 모든 것이 조화롭게 맞아떨어지는 순간',
        '🏆 목표를 이룬 뒤 느끼는 감정의 디테일',
      ];

      return [
        t.visualization.suggestFromData,
        roots[0]?.text
          ? `💫 ${roots[0].text}를 달성한 나의 하루`
          : '💫 목표를 이룬 나의 하루',
        roots[1]?.text
          ? `🎯 ${roots[1].text}를 이미 이룬 미래의 나`
          : '🎯 내가 되고 싶은 미래의 모습',
        pickRandom(inspiration),
      ];
    }

    const inspiration = [
      '🌙 A day where everything already worked out',
      '✨ The exact moment your routine clicks',
      '🏆 The feeling right after a major win',
    ];

    return [
      t.visualization.suggestFromData,
      roots[0]?.text ? `💫 A day after achieving ${roots[0].text}` : '💫 My ideal productive day',
      roots[1]?.text ? `🎯 Future me who already achieved ${roots[1].text}` : '🎯 The future version of me',
      pickRandom(inspiration),
    ];
  }, [language, nodes, t]);

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {bubbles.map((text, index) => {
        const isPrimary = index === 0;
        return (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className={`text-left cursor-pointer self-start max-w-[85%] rounded-2xl rounded-tl-sm
              px-4 py-3 text-sm transition-transform duration-75 active:scale-[0.97]
              animate-[bubbleFadeIn_300ms_ease_forwards] opacity-0 ${
                isPrimary
                  ? 'apple-card border-yellow-500/25'
                  : 'apple-card border-th-border'
              }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
};

export default SuggestionBubbles;
