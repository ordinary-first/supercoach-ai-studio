import React from 'react';
import { MessageCircleOff, LayoutPanelLeft, BatteryLow } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface ProblemCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const PROBLEMS: ProblemCard[] = [
  {
    icon: <MessageCircleOff size={24} color="#FF4D00" />,
    title: '피드백 부재',
    description:
      '새벽에 세운 계획, 퇴근 후엔 이미 흐릿합니다. 누가 "지금 이거부터 해"라고 말해주는 사람이 없으니까요.',
  },
  {
    icon: <LayoutPanelLeft size={24} color="#FF4D00" />,
    title: '구조 부재',
    description:
      '"올해는 다르겠지" — 매년 같은 다짐, 같은 결과. 목표가 머릿속에만 있으면 3일이면 사라집니다.',
  },
  {
    icon: <BatteryLow size={24} color="#FF4D00" />,
    title: '동기 소멸',
    description:
      '작심삼일은 의지력의 문제가 아닙니다. 뇌가 원래 그렇게 설계되어 있습니다. 시스템 없이는 누구나 돌아옵니다.',
  },
];

export const ProblemSection: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      id="problem"
      ref={ref}
      className="relative py-12 md:py-24 px-6 overflow-hidden"
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,77,0,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Headline */}
        <div
          className={`text-center mb-8 md:mb-16 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p
            className="text-gray-300 text-lg md:text-3xl mb-1 md:mb-2"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            당신은 정말
          </p>
          <h2
            className="text-white font-bold text-2xl md:text-5xl leading-tight"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            원하는 삶을 살 수 없는 것일까요?
          </h2>
        </div>

        {/* Problem Cards */}
        <div className="flex flex-col md:flex-row gap-3 md:gap-6">
          {PROBLEMS.map((problem, i) => (
            <div
              key={problem.title}
              className={`flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-6 transition-all duration-700 ease-out ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150 + 200}ms` }}
            >
              {/* Icon */}
              <div
                className="inline-flex items-center justify-center w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl mb-3 md:mb-4"
                style={{ background: 'rgba(255,77,0,0.12)' }}
              >
                {problem.icon}
              </div>

              {/* Title */}
              <h3
                className="text-white font-bold text-base md:text-lg mb-2 md:mb-3"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {problem.title}
              </h3>

              {/* Description */}
              <p
                className="text-gray-400 text-sm leading-relaxed"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
