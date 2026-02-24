import React from 'react';
import { GitBranch, Brain, Sparkles, Calendar, ListTodo, BarChart3 } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FEATURES_KO: FeatureCard[] = [
  {
    icon: <GitBranch size={18} style={{ color: '#CCFF00' }} />,
    title: '목표를 눈에 보이게',
    desc: '머릿속 막연한 꿈을 4가지 레이아웃으로 구조화. AI가 목표별 이미지까지 생성합니다.',
  },
  {
    icon: <Brain size={18} style={{ color: '#CCFF00' }} />,
    title: '나만 아는 코치',
    desc: '대화할수록 당신을 깊이 이해하는 AI. 3단 기억으로 맥락을 잊지 않습니다.',
  },
  {
    icon: <Sparkles size={18} style={{ color: '#CCFF00' }} />,
    title: '성공을 미리 체험',
    desc: '텍스트·이미지·음성·영상으로 당신의 성공한 미래를 직접 보고 듣습니다.',
  },
  {
    icon: <Calendar size={18} style={{ color: '#CCFF00' }} />,
    title: '매일이 미션',
    desc: '게임처럼 미션을 클리어하고 트로피를 모으세요. 습관이 자동으로 형성됩니다.',
  },
  {
    icon: <ListTodo size={18} style={{ color: '#CCFF00' }} />,
    title: '목표에 연결된 할 일',
    desc: '할 일이 목표와 직접 연결됩니다. "이걸 왜 하는지" 항상 보이니 동기가 유지됩니다.',
  },
  {
    icon: <BarChart3 size={18} style={{ color: '#CCFF00' }} />,
    title: '데이터로 보는 성장',
    desc: '일·주·월 단위 AI 분석으로 "어디서 막히는지" 정확히 짚어줍니다.',
  },
];

const FEATURES_EN: FeatureCard[] = [
  {
    icon: <GitBranch size={18} style={{ color: '#CCFF00' }} />,
    title: 'Make Goals Visible',
    desc: 'Turn vague dreams into structure with 4 layout modes. AI generates images for each goal.',
  },
  {
    icon: <Brain size={18} style={{ color: '#CCFF00' }} />,
    title: 'A Coach Who Knows You',
    desc: 'The more you talk, the deeper AI understands you. 3-layer memory never forgets context.',
  },
  {
    icon: <Sparkles size={18} style={{ color: '#CCFF00' }} />,
    title: 'Experience Success Early',
    desc: 'See and hear your successful future through text, image, audio, and video.',
  },
  {
    icon: <Calendar size={18} style={{ color: '#CCFF00' }} />,
    title: 'Every Day Is a Mission',
    desc: 'Clear missions like a game and collect trophies. Habits form automatically.',
  },
  {
    icon: <ListTodo size={18} style={{ color: '#CCFF00' }} />,
    title: 'Tasks Linked to Goals',
    desc: "Tasks connect directly to goals. Seeing \"why you're doing this\" keeps motivation alive.",
  },
  {
    icon: <BarChart3 size={18} style={{ color: '#CCFF00' }} />,
    title: 'Growth Through Data',
    desc: "Daily, weekly, and monthly AI analysis pinpoints exactly where you're stuck.",
  },
];

export const FeatureShowcase: React.FC = () => {
  const { ref, isVisible } = useScrollReveal();
  const { language } = useTranslation();
  const FEATURES = language === 'ko' ? FEATURES_KO : FEATURES_EN;

  return (
    <section
      id="features"
      className="py-8 md:py-24 px-6"
      style={{ backgroundColor: '#050B14' }}
    >
      {/* Section header */}
      <div className="flex flex-col items-center text-center mb-5 md:mb-16 gap-3">
        <h2
          className="text-xl md:text-5xl font-bold text-white"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          {language === 'ko' ? '강력한 기능들' : 'Powerful Features'}
        </h2>
        <p
          className="text-gray-400 text-sm md:text-base max-w-md"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {language === 'ko' ? '목표 달성에 필요한 모든 것이 하나의 앱에' : 'Everything you need for goal achievement, in one app'}
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
        className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6 max-w-6xl mx-auto transition-all duration-700 ease-out ${
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
      className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-6 hover:border-neon-lime/30 transition-all duration-300 group"
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
        className="p-1.5 md:p-3 rounded-xl md:rounded-2xl w-fit"
        style={{ backgroundColor: 'rgba(204,255,0,0.1)' }}
      >
        {feature.icon}
      </div>

      {/* Title */}
      <h3
        className="text-sm md:text-lg font-bold text-white mt-2 md:mt-4"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {feature.title}
      </h3>

      {/* Description */}
      <p
        className="text-[11px] md:text-sm text-gray-400 mt-1 md:mt-2 leading-snug md:leading-relaxed"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {feature.desc}
      </p>
    </div>
  );
};
