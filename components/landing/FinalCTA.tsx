import React from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface FinalCTAProps {
  onCTAClick: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onCTAClick }) => {
  const { ref, isVisible } = useScrollReveal();
  const { language } = useTranslation();

  return (
    <section
      className="py-8 md:py-24 px-6 relative overflow-hidden"
      style={{ backgroundColor: '#050B14' }}
    >
      {/* Radial neon-lime glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(204,255,0,0.06) 0%, transparent 65%)',
        }}
      />

      {/* Content */}
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={`relative z-10 flex flex-col items-center text-center gap-3 md:gap-6 max-w-3xl mx-auto transition-all duration-700 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Headline */}
        <div className="flex flex-col gap-1">
          <h2
            className="text-xl md:text-5xl font-bold text-white"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {language === 'ko' ? '1년 후에도 같은 자리에 서 있을 건가요?' : 'Will you still be standing in the same spot a year from now?'}
          </h2>
          <h2
            className="text-xl md:text-5xl font-bold"
            style={{ fontFamily: 'Inter, sans-serif', color: '#CCFF00' }}
          >
            {language === 'ko' ? '지금이 가장 빠른 시작입니다' : 'Right now is the fastest start'}
          </h2>
        </div>

        {/* Subtext */}
        <p
          className="text-gray-400 text-sm md:text-base max-w-sm"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {language === 'ko' ? '매일 0.1%씩 성장하면, 1년 뒤 44% 더 나은 당신이 됩니다.' : 'Grow 0.1% every day, and you\'ll be 44% better in a year.'}
        </p>

        {/* CTA Button */}
        <div className="flex flex-col items-center gap-3 mt-1 md:mt-2">
          <button
            onClick={onCTAClick}
            className="uppercase tracking-widest font-black text-base md:text-lg py-4 px-10 md:py-5 md:px-12 rounded-full text-black transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: '#CCFF00',
              fontFamily: 'Inter, sans-serif',
              animation: 'pulseCTAGlow 2.5s ease-in-out infinite',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 48px rgba(204,255,0,0.55)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {language === 'ko' ? '무료로 시작하기' : 'Start Free'}
          </button>

          {/* Below-CTA fine print */}
          <p
            className="text-xs text-gray-500"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {language === 'ko' ? '3일 무료 · 카드 불필요 · 10초 가입' : '3-day free trial · No card required · 10-second signup'}
          </p>
        </div>
      </div>

      {/* Keyframes for CTA glow pulse */}
      <style>{`
        @keyframes pulseCTAGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(204,255,0,0); }
          50%       { box-shadow: 0 0 32px rgba(204,255,0,0.4); }
        }
      `}</style>
    </section>
  );
};
