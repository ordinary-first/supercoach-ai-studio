import React from 'react';
import { Brain, GitBranch, Eye } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface SolutionPillar {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const PILLARS: SolutionPillar[] = [
  {
    icon: <Brain size={28} color="#CCFF00" />,
    title: '심리학 기반 AI 코치',
    description:
      '3단 기억 시스템이 당신의 성격·목표·히스토리를 축적합니다. 대화할수록 정교해지는 AI가 "지금 당신에게 필요한 한 마디"를 건넵니다.',
  },
  {
    icon: <GitBranch size={28} color="#CCFF00" />,
    title: '구조화 (마인드맵)',
    description:
      '10년 비전 → 올해 목표 → 이번 주 할 일. 뇌가 처리할 수 있는 단위로 자동 분해하고, 진행도를 눈에 보이게 만듭니다.',
  },
  {
    icon: <Eye size={28} color="#CCFF00" />,
    title: '시각화 (잠재의식 각인)',
    description:
      '심리학 연구: 성공 장면을 반복 시각화하면 뇌가 "이미 달성한 것"으로 인식합니다. AI가 텍스트·이미지·음성·영상 4가지로 당신의 성공을 생성합니다.',
  },
];

export const SolutionSection: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      id="solution"
      ref={ref}
      className="relative py-12 md:py-24 px-6 overflow-hidden"
      style={{ background: 'rgba(204,255,0,0.02)' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(204,255,0,0.08) 0%, transparent 70%)',
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
            className="text-gray-300 text-lg md:text-3xl mb-1"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Secret Coach의
          </p>
          <h2
            className="font-bold text-3xl md:text-6xl"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#CCFF00' }}
          >
            해답
          </h2>
        </div>

        {/* Sub-headline */}
        <p
          className={`text-center text-gray-400 text-sm md:text-lg mb-8 md:mb-16 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{
            fontFamily: 'Inter, sans-serif',
            transitionDelay: '100ms',
          }}
        >
          의지력이 아닌, 시스템으로 목표를 달성합니다
        </p>

        {/* Solution Pillars */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-8">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className={`flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-8 transition-all duration-700 ease-out ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{
                transitionDelay: `${i * 150 + 200}ms`,
                borderTop: '2px solid #CCFF00',
              }}
            >
              {/* Icon wrapper */}
              <div
                className="inline-flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl mb-3 md:mb-6"
                style={{ background: 'rgba(204,255,0,0.1)' }}
              >
                {pillar.icon}
              </div>

              {/* Title */}
              <h3
                className="text-white font-bold text-base md:text-lg mb-2 md:mb-3"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {pillar.title}
              </h3>

              {/* Description */}
              <p
                className="text-gray-400 text-sm leading-relaxed"
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
