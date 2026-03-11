import React from 'react';
import { Brain, GitBranch, Eye } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface SolutionPillar {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const PILLARS_KO: SolutionPillar[] = [
  {
    icon: <Brain size={18} color="#5AA9FF" />,
    title: '심리학 기반 AI 코치',
    description:
      '3단 기억 시스템이 당신의 성격·목표·히스토리를 축적합니다. 대화할수록 정교해지는 AI가 "지금 당신에게 필요한 한 마디"를 건넵니다.',
  },
  {
    icon: <GitBranch size={18} color="#5AA9FF" />,
    title: '구조화 (마인드맵)',
    description:
      '10년 비전 → 올해 목표 → 이번 주 할 일. 뇌가 처리할 수 있는 단위로 자동 분해하고, 진행도를 눈에 보이게 만듭니다.',
  },
  {
    icon: <Eye size={18} color="#5AA9FF" />,
    title: '시각화 (잠재의식 각인)',
    description:
      '심리학 연구: 성공 장면을 반복 시각화하면 뇌가 "이미 달성한 것"으로 인식합니다. AI가 텍스트·이미지·음성·영상 4가지로 당신의 성공을 생성합니다.',
  },
];

const PILLARS_EN: SolutionPillar[] = [
  {
    icon: <Brain size={18} color="#5AA9FF" />,
    title: 'Psychology-Based AI Coach',
    description:
      "A 3-layer memory system accumulates your personality, goals, and history. The more you talk, the sharper the AI gets—delivering exactly the words you need right now.",
  },
  {
    icon: <GitBranch size={18} color="#5AA9FF" />,
    title: 'Structuring (Mind Map)',
    description:
      "10-year vision → This year's goals → This week's tasks. Auto-decompose into brain-processable units and make progress visible.",
  },
  {
    icon: <Eye size={18} color="#5AA9FF" />,
    title: 'Visualization (Subconscious Imprinting)',
    description:
      "Psychology research: Repeatedly visualizing success tricks your brain into believing it's already achieved. AI generates your success in text, image, audio, and video.",
  },
];

export const SolutionSection: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const { language } = useTranslation();
  const PILLARS = language === 'ko' ? PILLARS_KO : PILLARS_EN;

  return (
    <section
      id="solution"
      ref={ref}
      className="relative py-8 md:py-24 px-6 overflow-hidden"
      style={{ background: 'rgba(90,169,255,0.04)' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(90,169,255,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Headline */}
        <div
          className={`text-center mb-2 md:mb-4 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p
            className="text-gray-300 text-sm md:text-3xl mb-1"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {language === 'ko' ? 'Secret Coach의' : "Secret Coach's"}
          </p>
          <h2
            className="font-bold text-2xl md:text-6xl"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#5AA9FF' }}
          >
            {language === 'ko' ? '해답' : 'Answer'}
          </h2>
        </div>

        {/* Sub-headline */}
        <p
          className={`text-center text-gray-400 text-sm md:text-lg mb-5 md:mb-16 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{
            fontFamily: 'Inter, sans-serif',
            transitionDelay: '100ms',
          }}
        >
          {language === 'ko' ? '의지력이 아닌, 시스템으로 목표를 달성합니다' : 'Achieve goals with systems, not willpower'}
        </p>

        {/* Solution Pillars */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-8">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className={`flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-8 transition-all duration-700 ease-out ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: `${i * 150 + 200}ms`,
                borderTop: '2px solid #5AA9FF',
              }}
            >
              {/* Icon wrapper */}
              <div
                className="inline-flex items-center justify-center w-8 h-8 md:w-16 md:h-16 rounded-xl md:rounded-2xl mb-2 md:mb-6"
                style={{ background: 'rgba(90,169,255,0.12)' }}
              >
                {pillar.icon}
              </div>

              {/* Title */}
              <h3
                className="text-white font-bold text-sm md:text-lg mb-1 md:mb-3"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {pillar.title}
              </h3>

              {/* Description */}
              <p
                className="text-gray-400 text-xs md:text-sm leading-snug md:leading-relaxed"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
