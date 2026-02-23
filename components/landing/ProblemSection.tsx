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
    icon: <MessageCircleOff size={32} color="#FF4D00" />,
    title: '피드백 부재',
    description:
      '혼자서는 무엇이 잘못됐는지 모릅니다. 방향 없는 노력은 시간 낭비입니다.',
  },
  {
    icon: <LayoutPanelLeft size={32} color="#FF4D00" />,
    title: '구조 부재',
    description:
      '머릿속에만 있는 목표는 증발합니다. 체계 없는 의지력은 3일을 못 버팁니다.',
  },
  {
    icon: <BatteryLow size={32} color="#FF4D00" />,
    title: '동기 소멸',
    description:
      '시작의 열정은 72시간이면 사라집니다. 그리고 다시 제자리로 돌아옵니다.',
  },
];

export const ProblemSection: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      id="problem"
      ref={ref}
      className="relative py-24 px-6 overflow-hidden"
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
          className={`text-center mb-16 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p
            className="text-gray-300 text-2xl md:text-3xl mb-2"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            당신은 정말
          </p>
          <h2
            className="text-white font-bold text-3xl md:text-5xl leading-tight"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            원하는 삶을 살 수 없는 것일까요?
          </h2>
        </div>

        {/* Problem Cards */}
        <div className="flex flex-col md:flex-row gap-6">
          {PROBLEMS.map((problem, i) => (
            <div
              key={problem.title}
              className={`flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 transition-all duration-700 ease-out ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 150 + 200}ms` }}
            >
              {/* Icon */}
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: 'rgba(255,77,0,0.12)' }}
              >
                {problem.icon}
              </div>

              {/* Title */}
              <h3
                className="text-white font-bold text-lg mb-3"
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
