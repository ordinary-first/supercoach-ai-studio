import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface HeroSectionProps {
  onCTAClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onCTAClick }) => {
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
            'radial-gradient(circle at 50% 40%, rgba(204,255,0,0.08) 0%, transparent 70%)',
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
          background: 'rgba(204,255,0,0.04)',
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
          background: 'rgba(204,255,0,0.03)',
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
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto gap-6">

        {/* Logo */}
        <div
          className="flex items-center gap-0.5 select-none"
          style={{ animation: 'fadeIn 0.8s ease-out both' }}
        >
          <span
            className="text-6xl md:text-8xl tracking-widest uppercase text-white"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            SECRET
          </span>
          <span
            className="text-6xl md:text-8xl tracking-widest uppercase italic font-bold"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#CCFF00' }}
          >
            COACH
          </span>
        </div>

        {/* Sub-label */}
        <div
          className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-widest"
          style={{ animation: 'fadeIn 0.8s ease-out 0.15s both' }}
        >
          <ShieldCheck size={14} className="text-gray-500" />
          <span style={{ fontFamily: 'Inter, sans-serif' }}>
            Neural Goal Setting System
          </span>
        </div>

        {/* Headline */}
        <div
          className="flex flex-col gap-1"
          style={{ animation: 'fadeIn 0.8s ease-out 0.3s both' }}
        >
          <p
            className="text-2xl md:text-4xl text-white font-light"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            잠깐의 동기부여가 아닌
          </p>
          <p
            className="text-2xl md:text-4xl font-bold"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <span style={{ color: '#CCFF00' }}>과학적</span>
            <span className="text-white"> AI 밀착 관리 시스템</span>
          </p>
        </div>

        {/* Sub description */}
        <p
          className="text-sm text-gray-400 max-w-md"
          style={{
            fontFamily: 'Inter, sans-serif',
            animation: 'fadeIn 0.8s ease-out 0.45s both',
          }}
        >
          Structure + AI Coach + Visualization — 목표 달성의 3가지 열쇠
        </p>

        {/* Primary CTA */}
        <div
          className="flex flex-col items-center gap-3 mt-2"
          style={{ animation: 'fadeIn 0.8s ease-out 0.6s both' }}
        >
          <button
            onClick={onCTAClick}
            className="px-10 py-4 rounded-full text-black font-black uppercase tracking-widest text-sm md:text-base transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: '#CCFF00',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 0 0 0 rgba(204,255,0,0)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 32px rgba(204,255,0,0.45)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 0 rgba(204,255,0,0)';
            }}
          >
            Start Free
          </button>

          {/* Pulsing indicator */}
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: '#CCFF00', opacity: 0.8 }}
            />
            <span
              className="text-xs text-gray-400"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              3일간 무료 체험 (인원 한정)
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
