import { type FC, useEffect, useMemo, useState } from 'react';
import type { GoalNode, UserProfile } from '../../types';
import { NodeType, NodeStatus } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { fetchDreamChips, USER_INPUT_SENTINEL, type DreamChip } from '../../services/aiService';

interface SuggestionBubblesProps {
  nodes: GoalNode[];
  userProfile: UserProfile | null;
  savedTitles: string[];
  onSelectSeed: (seed: string) => void;
  onWriteOwn: () => void;
}

// 민감 도메인 목표는 칩 소재에서 사전 제거 (욕망 대필·정체성 낙인 방지)
const SENSITIVE = /(금주|금연|술|담배|다이어트|체중|살\s*빼|감량|우울|불안|이별|중독|공황)/;

const SuggestionBubbles: FC<SuggestionBubblesProps> = ({
  nodes,
  userProfile,
  savedTitles,
  onSelectSeed,
  onWriteOwn,
}) => {
  const { language, t } = useTranslation();

  // 0ms 결정론 폴백 칩 — 첫 페인트를 막지 않는다. AI 칩 도착 시 교체된다.
  const fallbackChips = useMemo<DreamChip[]>(() => {
    const roots = (nodes ?? [])
      .filter((n) => n.type === NodeType.ROOT && n.status !== NodeStatus.STUCK)
      .map((n) => n.text)
      .filter((text) => text && !SENSITIVE.test(text));

    const chips: DreamChip[] = [];
    if (roots[0]) {
      chips.push({
        label: language === 'ko' ? `💫 ${roots[0]} 이룬 하루` : `💫 A day after ${roots[0]}`,
        seed: language === 'ko'
          ? `${roots[0]}를 이미 이룬 나의 어느 하루`
          : `A day in my life, having already achieved ${roots[0]}`,
        quotedToken: roots[0],
        kind: 'scene',
      });
    }
    if (roots[1]) {
      chips.push({
        label: language === 'ko' ? `🎯 ${roots[1]} 이룬 나` : `🎯 Me, having achieved ${roots[1]}`,
        seed: language === 'ko'
          ? `${roots[1]}를 이미 이룬 미래의 나`
          : `The future me who already achieved ${roots[1]}`,
        quotedToken: roots[1],
        kind: 'scene',
      });
    }
    chips.push({
      label: language === 'ko' ? '🌱 한 뼘 더 자란 나' : '🌱 A step-further me',
      seed: language === 'ko'
        ? '지금보다 한 뼘 더 자란, 1년 뒤의 어느 하루를 사는 나'
        : 'Me, living a day one year from now, grown a little',
      quotedToken: null,
      kind: 'door',
    });
    chips.push({
      label: t.visualization.writeOwnDream,
      seed: USER_INPUT_SENTINEL,
      quotedToken: null,
      kind: 'write',
    });
    return chips.slice(0, 4);
  }, [nodes, language, t.visualization.writeOwnDream]);

  const [chips, setChips] = useState<DreamChip[]>(fallbackChips);

  // 백그라운드로 AI 칩을 받아, 검증 통과분이 3개 이상이면 교체 (fade-swap)
  useEffect(() => {
    let cancelled = false;
    const goals = (nodes ?? [])
      .filter((n) => n.status !== NodeStatus.STUCK)
      .map((n) => n.text)
      .filter((text) => text && !SENSITIVE.test(text));

    const rotationSeed = Number(
      `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(
        new Date().getDate(),
      ).padStart(2, '0')}`,
    );

    fetchDreamChips({
      language,
      rotationSeed,
      goals,
      savedTitles,
      userName: userProfile?.name || null,
    })
      .then((aiChips) => {
        if (!cancelled && aiChips.length >= 3) setChips(aiChips);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // 마운트 시 1회만 — nodes/profile은 탭 진입 시점 스냅샷
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = (chip: DreamChip) => {
    if (chip.kind === 'write' || chip.seed === USER_INPUT_SENTINEL) {
      onWriteOwn();
      return;
    }
    onSelectSeed(chip.seed);
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          type="button"
          onClick={() => handleTap(chip)}
          className={`text-left cursor-pointer self-start max-w-[85%] rounded-2xl rounded-tl-sm
            px-4 py-3 text-sm transition-transform duration-75 active:scale-[0.97]
            animate-[bubbleFadeIn_300ms_ease_forwards] opacity-0 ${
              index === 0 ? 'apple-card border-yellow-500/25' : 'apple-card border-th-border'
            }`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
};

export default SuggestionBubbles;
