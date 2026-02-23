import React from 'react';
import { GitBranch, Brain, Sparkles, Calendar, ListTodo, BarChart3 } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FEATURES: FeatureCard[] = [
  {
    icon: <GitBranch size={24} style={{ color: '#CCFF00' }} />,
    title: 'Goal Mind Map',
    desc: '4가지 레이아웃으로 목표를 시각화. AI 이미지 생성과 진행도 추적.',
  },
  {
    icon: <Brain size={24} style={{ color: '#CCFF00' }} />,
    title: 'AI Coach with Memory',
    desc: '단기·중기·장기 3단 기억 시스템. 당신의 여정을 기억하는 코치.',
  },
  {
    icon: <Sparkles size={24} style={{ color: '#CCFF00' }} />,
    title: 'Visualization Studio',
    desc: '텍스트 + 이미지 + 음성 + 영상. 4중 감각으로 성공을 체험.',
  },
  {
    icon: <Calendar size={24} style={{ color: '#CCFF00' }} />,
    title: 'Mission Calendar',
    desc: '트로피, 잠긴 미션, 진행 바. 게이미피케이션으로 습관 형성.',
  },
  {
    icon: <ListTodo size={24} style={{ color: '#CCFF00' }} />,
    title: 'Smart Todo',
    desc: '목표 노드에 연결된 할 일. 반복 스케줄과 My Day 기능.',
  },
  {
    icon: <BarChart3 size={24} style={{ color: '#CCFF00' }} />,
    title: 'AI Feedback Reports',
    desc: '일간/주간/월간 AI 분석 리포트. 데이터 기반 코칭.',
  },
];

export const FeatureShowcase: React.FC = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="features"
      className="py-24 px-6"
      style={{ backgroundColor: '#050B14' }}
    >
      {/* Section header */}
      <div className="flex flex-col items-center text-center mb-16 gap-3">
        <h2
          className="text-3xl md:text-5xl font-bold text-white"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          강력한 기능들
        </h2>
        <p
          className="text-gray-400 text-sm md:text-base max-w-md"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          목표 달성에 필요한 모든 것이 하나의 앱에
        </p>
        {/* Accent line */}
        <div
          className="w-12 h-0.5 rounded-full mt-2"
          style={{ backgroundColor: '#CCFF00' }}
        />
      </div>

      {/* Feature grid */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.title} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
};

interface FeatureCardProps {
  feature: FeatureCard;
  index: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, index }) => {
  return (
    <div
      className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-neon-lime/30 transition-all duration-300 group"
      style={{
        transitionDelay: `${index * 60}ms`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(204,255,0,0.3)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 24px rgba(204,255,0,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Icon wrapper */}
      <div
        className="p-3 rounded-2xl w-fit"
        style={{ backgroundColor: 'rgba(204,255,0,0.1)' }}
      >
        {feature.icon}
      </div>

      {/* Title */}
      <h3
        className="text-lg font-bold text-white mt-4"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {feature.title}
      </h3>

      {/* Description */}
      <p
        className="text-sm text-gray-400 mt-2 leading-relaxed"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {feature.desc}
      </p>
    </div>
  );
};
