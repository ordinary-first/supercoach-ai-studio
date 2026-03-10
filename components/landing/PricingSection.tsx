import React from 'react';
import { Check } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useTranslation } from '../../i18n/useTranslation';

interface PricingSectionProps {
  onPlanSelect: (plan: string) => void;
}

interface PlanConfig {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  priceSub: string;
  features: string[];
  cta: string;
  recommended?: boolean;
}

const PlanCard: React.FC<{ plan: PlanConfig; onSelect: (id: string) => void; delay: number; language: string }> = ({
  plan,
  onSelect,
  delay,
  language,
}) => {
  const { ref, isVisible } = useScrollReveal();

  const cardBorder = plan.recommended
    ? 'border-2 border-[#5AA9FF]'
    : 'border border-white/10';

  const priceColor = plan.recommended ? 'text-[#5AA9FF]' : 'text-white';

  const ctaClass = plan.recommended
    ? 'w-full py-3 rounded-xl bg-[#5AA9FF] text-black font-bold text-sm tracking-wide hover:opacity-90 transition-opacity'
    : 'w-full py-3 rounded-xl border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors';

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`bg-white/5 ${cardBorder} rounded-2xl md:rounded-3xl p-3 md:p-6 flex flex-col relative transition-all duration-700`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(32px)',
        transitionDelay: `${delay}ms`,
      }}
    >
      {plan.recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#5AA9FF] text-black text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
          {language === 'ko' ? '추천' : 'Best'}
        </span>
      )}

      {/* Plan name */}
      <p className="font-display uppercase tracking-wider text-sm text-gray-400 mb-4">
        {plan.name}
      </p>

      {/* Price */}
      <div className="mb-4 flex flex-col items-start">
        {plan.originalPrice && (
          <span className="text-gray-500 line-through text-sm">{plan.originalPrice}{plan.priceSub}</span>
        )}
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl md:text-4xl font-bold ${priceColor}`}>{plan.price}</span>
          <span className="text-gray-400 text-sm">{plan.priceSub}</span>
        </div>
        {plan.originalPrice && (
          <span
            className="text-xs mt-1 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(90,169,255,0.14)', color: '#5AA9FF' }}
          >
            {language === 'ko' ? '베타 특가' : 'Beta Deal'}
          </span>
        )}
      </div>

      {/* Divider */}
      <hr className="border-white/10 mb-4" />

      {/* Features */}
      <ul className="flex flex-col gap-2 md:gap-3 flex-1 mb-4 md:mb-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-xs md:text-sm text-gray-300">
            <Check
              size={16}
              className={plan.recommended ? 'text-[#5AA9FF] shrink-0' : 'text-gray-400 shrink-0'}
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button className={`mt-auto ${ctaClass}`} onClick={() => onSelect(plan.id)}>
        {plan.cta}
      </button>
    </div>
  );
};

export const PricingSection: React.FC<PricingSectionProps> = ({ onPlanSelect }) => {
  const { ref: headingRef, isVisible: headingVisible } = useScrollReveal();
  const { language } = useTranslation();

  const PLANS_KO: PlanConfig[] = [
    { id: 'explorer', name: 'Explorer', price: '무료', priceSub: '3일 체험', features: ['AI 코치 300회', '이미지 8장'], cta: '무료 시작' },
    { id: 'essential', name: 'Essential', price: '$9.99', originalPrice: '$19.99', priceSub: '/월', features: ['AI 코치 2,500회', '이미지 80장', '음성 30분'], cta: '시작하기' },
    { id: 'visionary', name: 'Visionary', price: '$19.99', originalPrice: '$39.99', priceSub: '/월', features: ['AI 코치 6,000회', 'HQ 이미지 180장', '음성 90분', '영상 4편'], cta: '시작하기', recommended: true },
    { id: 'master', name: 'Master', price: '$49.99', originalPrice: '$99.99', priceSub: '/월', features: ['AI 코치 15,000회', 'HQ 이미지 450장', '음성 240분', '영상 12편'], cta: '시작하기' },
  ];
  const PLANS_EN: PlanConfig[] = [
    { id: 'explorer', name: 'Explorer', price: 'Free', priceSub: '3-day trial', features: ['300 AI coaching chats', '8 images'], cta: 'Start Free' },
    { id: 'essential', name: 'Essential', price: '$9.99', originalPrice: '$19.99', priceSub: '/mo', features: ['2,500 AI coaching chats', '80 images', '30 min audio'], cta: 'Get Started' },
    { id: 'visionary', name: 'Visionary', price: '$19.99', originalPrice: '$39.99', priceSub: '/mo', features: ['6,000 AI coaching chats', '180 HQ images', '90 min audio', '4 videos'], cta: 'Get Started', recommended: true },
    { id: 'master', name: 'Master', price: '$49.99', originalPrice: '$99.99', priceSub: '/mo', features: ['15,000 AI coaching chats', '450 HQ images', '240 min audio', '12 videos'], cta: 'Get Started' },
  ];
  const PLANS = language === 'ko' ? PLANS_KO : PLANS_EN;

  return (
    <section id="pricing" className="py-8 md:py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div
          ref={headingRef as React.RefObject<HTMLDivElement>}
          className="text-center mb-4 md:mb-16 transition-all duration-700"
          style={{
            opacity: headingVisible ? 1 : 0,
            transform: headingVisible ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          <h2 className="text-2xl md:text-5xl font-bold text-white mb-3 md:mb-4">
            {language === 'ko' ? '당신에게 맞는 플랜' : 'Find Your Perfect Plan'}
          </h2>
          <p className="text-gray-400 text-sm md:text-lg">
            {language === 'ko' ? '3일 무료 체험으로 시작 · 언제든 해지 가능' : 'Start with a 3-day free trial · Cancel anytime'}
          </p>
        </div>

        {/* Anchoring */}
        <div className="text-center mb-4 md:mb-8">
          <p className="text-gray-500 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            {language === 'ko' ? '전문 라이프 코칭 비용: ' : 'Professional life coaching cost: '}<span className="line-through">{language === 'ko' ? '월 200~300만원' : '$2,000~3,000/mo'}</span>
          </p>
          <p className="text-lg font-semibold mt-1" style={{ fontFamily: 'Inter, sans-serif', color: '#5AA9FF' }}>
            {language === 'ko' ? 'Secret Coach: AI가 24시간 밀착 관리 — 베타 특가' : 'Secret Coach: 24/7 AI close management — Beta pricing'}
          </p>
        </div>

        {/* Plan cards grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
          {PLANS.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSelect={onPlanSelect}
              delay={index * 100}
              language={language}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
