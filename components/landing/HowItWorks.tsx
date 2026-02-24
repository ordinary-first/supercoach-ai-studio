import React from 'react';
import { UserPlus, Target, Zap } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface Step {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const HowItWorks: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const { language } = useTranslation();

  const STEPS_KO: Step[] = [
    { number: 1, icon: <UserPlus size={18} className="text-white" />, title: '가입', description: 'Google 원클릭. 10초면 완료.' },
    { number: 2, icon: <Target size={18} className="text-white" />, title: '목표 설정', description: '마인드맵으로 비전을 구조화.' },
    { number: 3, icon: <Zap size={18} className="text-white" />, title: 'AI와 달성', description: '매일 코치와 함께 성장.' },
  ];
  const STEPS_EN: Step[] = [
    { number: 1, icon: <UserPlus size={18} className="text-white" />, title: 'Sign Up', description: 'One-click Google login. Done in 10 seconds.' },
    { number: 2, icon: <Target size={18} className="text-white" />, title: 'Set Goals', description: 'Structure your vision with a mind map.' },
    { number: 3, icon: <Zap size={18} className="text-white" />, title: 'Achieve with AI', description: 'Grow daily with your coach.' },
  ];
  const STEPS = language === 'ko' ? STEPS_KO : STEPS_EN;

  return (
    <section
      id="how"
      ref={ref}
      className="py-8 md:py-24 px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Headline */}
        <h2
          className={`text-center text-white font-bold text-xl md:text-5xl mb-6 md:mb-20 transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          {language === 'ko' ? '3단계로 시작' : 'Start in 3 Steps'}
        </h2>

        {/* Steps */}
        <div className="flex flex-row items-start gap-2 md:gap-0">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex flex-row items-center flex-1">
              {/* Step card */}
              <div
                className={`flex flex-col items-center text-center px-2 md:px-6 flex-1 transition-all duration-700 ease-out ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 200 + 150}ms` }}
              >
                {/* Number circle */}
                <div
                  className="flex items-center justify-center w-8 h-8 md:w-12 md:h-12 rounded-full text-black font-bold text-sm md:text-lg mb-1 md:mb-4 select-none"
                  style={{
                    background: '#CCFF00',
                    fontFamily: 'Orbitron, sans-serif',
                  }}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-8 h-8 md:w-14 md:h-14 rounded-xl md:rounded-2xl mb-1 md:mb-4"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {step.icon}
                </div>

                {/* Title */}
                <h3
                  className="text-white font-bold text-sm md:text-lg mb-0.5 md:mb-2"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p
                  className="text-gray-400 text-xs md:text-sm leading-snug md:leading-relaxed max-w-[100px] md:max-w-[160px]"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {step.description}
                </p>
              </div>

              {/* Connector line — shown between steps on desktop only */}
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden md:block h-px w-16 border-t border-dashed border-white/20 mt-6 mx-2 flex-shrink-0 transition-all duration-700 ease-out ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transitionDelay: `${i * 200 + 300}ms` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
