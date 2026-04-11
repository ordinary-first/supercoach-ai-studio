import React from 'react';
import { Check } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface PricingSectionProps {
  onPlanSelect: (plan: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onPlanSelect }) => {
  const { ref: headingRef, isVisible: headingVisible } = useScrollReveal();
  const { ref: cardRef, isVisible: cardVisible } = useScrollReveal();
  const { language } = useTranslation();

  const ko = language === 'ko';

  const trialFeatures = ko
    ? ['AI 코치 채팅', '마인드맵 & 할일', '비전보드 & 캘린더', '3일간 무료 체험']
    : ['AI Coach Chat', 'Mind Map & Todo', 'Vision Board & Calendar', '3-day free trial'];

  const proFeatures = ko
    ? ['모든 기능 무제한 이용', 'AI 코치 밀착 관리', '이미지 · 음성 · 영상 생성', '피드백 시스템', '우선 지원']
    : ['Unlimited access to all features', 'AI Coach close management', 'Image · Audio · Video generation', 'Feedback system', 'Priority support'];

  return (
    <section id="pricing" className="py-8 md:py-24 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <div
          ref={headingRef as React.RefObject<HTMLDivElement>}
          className="text-center mb-4 md:mb-12 transition-all duration-700"
          style={{
            opacity: headingVisible ? 1 : 0,
            transform: headingVisible ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          <h2 className="text-2xl md:text-5xl font-bold text-white mb-3 md:mb-4">
            {ko ? '당신의 목표, AI가 끝까지 관리합니다' : 'Your Goals, Managed by AI to the End'}
          </h2>
          <p className="text-gray-400 text-sm md:text-lg">
            {ko ? '전문 라이프 코칭 비용 ' : 'Professional life coaching: '}
            <span className="line-through">{ko ? '월 200~300만원' : '$2,000~3,000/mo'}</span>
          </p>
        </div>

        {/* Cards */}
        <div
          ref={cardRef as React.RefObject<HTMLDivElement>}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 transition-all duration-700"
          style={{
            opacity: cardVisible ? 1 : 0,
            transform: cardVisible ? 'translateY(0)' : 'translateY(32px)',
          }}
        >
          {/* Free Trial */}
          <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col">
            <p className="font-display uppercase tracking-wider text-sm text-gray-400 mb-4">
              {ko ? '무료 체험' : 'Free Trial'}
            </p>
            <div className="mb-4">
              <span className="text-3xl md:text-4xl font-bold text-white">{ko ? '무료' : 'Free'}</span>
              <span className="text-gray-400 text-sm ml-2">{ko ? '3일' : '3 days'}</span>
            </div>
            <hr className="border-white/10 mb-4" />
            <ul className="flex flex-col gap-3 flex-1 mb-6">
              {trialFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check size={16} className="text-gray-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto w-full py-3 rounded-xl border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
              onClick={() => onPlanSelect('explorer')}
            >
              {ko ? '무료로 시작하기' : 'Start Free'}
            </button>
          </div>

          {/* Pro */}
          <div className="bg-white/5 border-2 border-[#5AA9FF] rounded-2xl md:rounded-3xl p-5 md:p-8 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#5AA9FF] text-black text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              {ko ? '베타 50% 할인' : 'Beta 50% Off'}
            </span>
            <p className="font-display uppercase tracking-wider text-sm text-gray-400 mb-4">Pro</p>
            <div className="mb-1 flex flex-col items-start">
              <span className="text-gray-500 line-through text-sm">$99.99/{ ko ? '월' : 'mo'}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl md:text-4xl font-bold text-[#5AA9FF]">$49.99</span>
                <span className="text-gray-400 text-sm">/{ko ? '월' : 'mo'}</span>
              </div>
              <span
                className="text-xs mt-1 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(90,169,255,0.14)', color: '#5AA9FF' }}
              >
                {ko ? '베타 기간 한정' : 'Limited beta pricing'}
              </span>
            </div>
            <div className="mb-4 mt-2">
              <p className="text-xs text-gray-500">
                {ko ? '코칭 1회 비용으로 한 달 24/7 AI 관리' : 'One coaching session price for a month of 24/7 AI management'}
              </p>
            </div>
            <hr className="border-white/10 mb-4" />
            <ul className="flex flex-col gap-3 flex-1 mb-6">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check size={16} className="text-[#5AA9FF] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto w-full py-3 rounded-xl bg-[#5AA9FF] text-black font-bold text-sm tracking-wide hover:opacity-90 transition-opacity"
              onClick={() => onPlanSelect('pro')}
            >
              {ko ? 'Pro 시작하기' : 'Get Pro'}
            </button>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-gray-500 text-xs mt-6">
          {ko ? '언제든 해지 가능 · 결제는 Polar를 통해 안전하게 처리됩니다' : 'Cancel anytime · Payments processed securely via Polar'}
        </p>
      </div>
    </section>
  );
};
