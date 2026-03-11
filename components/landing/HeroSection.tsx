import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface HeroSectionProps {
  onCTAClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onCTAClick }) => {
  const { language } = useTranslation();
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#050B14' }}
    >
      {/* Background Layer 1: deep space base — handled by backgroundColor above */}

      {/* Background Layer 2: Radial gradient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(90,169,255,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Background Layer 3: CSS grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              rgba(255,255,255,0.03) 0px,
              rgba(255,255,255,0.03) 1px,
              transparent 1px,
              transparent 80px
            ),
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.03) 0px,
              rgba(255,255,255,0.03) 1px,
              transparent 1px,
              transparent 80px
            )
          `,
        }}
      />

      {/* Background Layer 4: Floating orbs */}
      <div
        className="absolute rounded-full blur-3xl animate-pulse pointer-events-none"
        style={{
          width: '256px',
          height: '256px',
          background: 'rgba(90,169,255,0.08)',
          top: '15%',
          left: '10%',
          animationDuration: '6s',
        }}
      />
      <div
        className="absolute rounded-full blur-3xl animate-pulse pointer-events-none"
        style={{
          width: '320px',
          height: '320px',
          background: 'rgba(90,169,255,0.06)',
          bottom: '20%',
          right: '8%',
          animationDuration: '8s',
          animationDelay: '2s',
        }}
      />
      <div
        className="absolute rounded-full blur-3xl animate-pulse pointer-events-none"
        style={{
          width: '200px',
          height: '200px',
          background: 'rgba(255,77,0,0.04)',
          top: '60%',
          left: '60%',
          animationDuration: '10s',
          animationDelay: '4s',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-5 max-w-4xl mx-auto gap-4 md:gap-6">

        {/* Sub-label */}
        <div
          className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-widest"
          style={{ animation: 'fadeIn 0.8s ease-out 0.1s both' }}
        >
          <ShieldCheck size={14} className="text-gray-500" />
          <span style={{ fontFamily: 'Inter, sans-serif' }}>
            Neural Goal Setting System
          </span>
        </div>

        {/* Headline — primary visual element */}
        <div
          className="flex flex-col gap-2"
          style={{ animation: 'fadeIn 0.8s ease-out 0.25s both' }}
        >
          <p
            className="text-xl sm:text-2xl md:text-4xl text-white/70 font-light"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {language === 'ko' ? '잠깐의 동기부여가 아닌' : 'Not fleeting motivation'}
          </p>
          <p
            className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <span style={{ color: '#5AA9FF' }}>{language === 'ko' ? '과학적' : 'Scientific'}</span>
            <span className="text-white">{language === 'ko' ? ' AI 밀착 관리 시스템' : ' AI Close-Management System'}</span>
          </p>
        </div>

        {/* Sub description */}
        <p
          className="text-xs sm:text-sm text-gray-400 max-w-xs sm:max-w-md px-2"
          style={{
            fontFamily: 'Inter, sans-serif',
            animation: 'fadeIn 0.8s ease-out 0.4s both',
          }}
        >
          {language === 'ko'
            ? '구조화 + AI 코치 + 시각화 — 목표 달성의 3가지 열쇠를 하나의 앱에서'
            : 'Structure + AI Coach + Visualization — Three keys to goal achievement, in one app'}
        </p>

        {/* Primary CTA */}
        <div
          className="flex flex-col items-center gap-3 mt-1 md:mt-2"
          style={{ animation: 'fadeIn 0.8s ease-out 0.55s both' }}
        >
          <button
            onClick={onCTAClick}
            className="px-8 py-3 md:px-10 md:py-4 rounded-full text-black font-black uppercase tracking-widest text-sm md:text-base transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: '#5AA9FF',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 0 0 0 rgba(90,169,255,0)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 32px rgba(90,169,255,0.32)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 0 rgba(90,169,255,0)';
            }}
          >
            {language === 'ko' ? '무료로 시작하기' : 'Start Free'}
          </button>

          {/* Pulsing indicator */}
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: '#5AA9FF', opacity: 0.8 }}
            />
            <span
              className="text-xs text-gray-400"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {language === 'ko' ? '베타 기간 무료 체험 · 집중 케어 인원 한정' : 'Free beta trial · Limited spots for focused care'}
            </span>
          </div>
        </div>
      </div>

      {/* Fade-in keyframe injected once */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
};
