import React, { useState } from 'react';
import { Check, Crown, Loader2, Sparkles, Star } from 'lucide-react';
import { createPolarCheckout, type PlanTier } from '../services/polarService';
import { completeOnboarding, saveProfile } from '../services/firebaseService';
import type { UserProfile } from '../types';
import { useTranslation } from '../i18n/useTranslation';

interface OnboardingScreenProps {
  userProfile: UserProfile;
  userId: string | null;
  onComplete: () => void;
}

const PLANS: {
  plan: PlanTier;
  label: string;
  price: string;
  badge?: string;
  features: string[];
  cta: string;
  highlight: boolean;
}[] = [
  {
    plan: 'explorer',
    label: 'Explorer',
    price: 'Free',
    badge: '3-day trial',
    features: ['300 coaching chats/mo', '5 narratives/mo', '8 images/mo'],
    cta: 'Start free for 3 days',
    highlight: true,
  },
  {
    plan: 'essential',
    label: 'Essential',
    price: '$9.99/mo',
    features: ['2,500 coaching chats/mo', '20 narratives/mo', '80 images/mo', '30 min TTS audio/mo'],
    cta: 'Get started',
    highlight: false,
  },
  {
    plan: 'visionary',
    label: 'Visionary',
    price: '$19.99/mo',
    features: ['6,000 coaching chats/mo', '40 narratives/mo', '180 images/mo', '90 min audio/mo', '4 videos/mo'],
    cta: 'Get started',
    highlight: false,
  },
  {
    plan: 'master',
    label: 'Master',
    price: '$49.99/mo',
    features: ['15,000 coaching chats/mo', '80 narratives/mo', '450 images/mo', '240 min audio/mo', '12 videos/mo'],
    cta: 'Get started',
    highlight: false,
  },
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  userProfile,
  userId,
  onComplete,
}) => {
  const { t, language } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState('');

  const planFeatures: Record<string, string[]> = {
    explorer: t.onboarding.planFeatures.explorer,
    essential: t.onboarding.planFeatures.essential,
    visionary: t.onboarding.planFeatures.visionary,
    master: t.onboarding.planFeatures.master,
  };

  const planCta: Record<string, string> = {
    explorer: t.onboarding.startFree,
    essential: t.onboarding.startNow,
    visionary: t.onboarding.startNow,
    master: t.onboarding.startNow,
  };

  const handleSelect = async (plan: PlanTier) => {
    if (loadingPlan) return;
    setLoadingPlan(plan);
    setError('');

    try {
      if (plan === 'explorer') {
        // Explorer: 프로필 저장 + 온보딩 완료 플래그
        if (userId) {
          await saveProfile(userId, { ...userProfile, onboardingCompleted: true });
          await completeOnboarding(userId);
        }
        onComplete();
      } else {
        // 유료 플랜: 온보딩 완료 처리 후 결제 페이지 이동
        if (userId) {
          await completeOnboarding(userId);
        }
        const { url } = await createPolarCheckout({
          plan,
          customerEmail: userProfile.email,
          customerName: userProfile.name,
          externalCustomerId: userId || undefined,
        });
        window.location.assign(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.onboarding.error);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-space text-white flex flex-col overflow-y-auto">
      {/* 헤더 */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6 text-center">
        {userProfile.avatarUrl ? (
          <img
            src={userProfile.avatarUrl}
            alt="avatar"
            className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-neon-lime/40 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-white/10 border-2 border-neon-lime/40 flex items-center justify-center">
            <Star size={28} className="text-neon-lime" />
          </div>
        )}
        <h1 className="text-2xl font-bold mb-1">
          {t.onboarding.welcome.replace('{name}', userProfile.name.split(' ')[0])}
        </h1>
        <p className="text-sm text-gray-400">
          {t.onboarding.subtitle}
        </p>
      </div>

      {/* 플랜 선택 */}
      <div className="flex-1 px-4 pb-8 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Sparkles size={14} className="text-neon-lime" />
          <p className="text-[13px] text-gray-300 font-medium">
            {t.onboarding.selectPlan}
          </p>
        </div>

        <div className="space-y-3">
          {PLANS.map((item) => {
            const isLoading = loadingPlan === item.plan;
            return (
              <div
                key={item.plan}
                className={`rounded-2xl border p-4 transition-all ${
                  item.highlight
                    ? 'border-neon-lime/50 bg-neon-lime/5 shadow-[0_0_20px_rgba(204,255,0,0.08)]'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.highlight && (
                      <Crown size={15} className="text-neon-lime shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-white">{item.label}</p>
                      <p className="text-[11px] text-gray-400">{item.plan === 'explorer' ? t.onboarding.free : item.price}</p>
                    </div>
                  </div>
                  {item.plan === 'explorer' && (
                    <span className="text-[10px] font-bold bg-neon-lime/20 text-neon-lime border border-neon-lime/30 rounded-full px-2 py-0.5">
                      {t.onboarding.trialBadge}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
                  {(planFeatures[item.plan] || item.features).map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1 text-[11px] text-gray-400"
                    >
                      <Check size={10} className={item.highlight ? 'text-neon-lime' : 'text-gray-600'} />
                      {f}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSelect(item.plan)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.highlight
                      ? 'bg-neon-lime text-black hover:bg-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t.common.processing}
                    </>
                  ) : (
                    planCta[item.plan] || item.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-[11px] text-gray-600 text-center leading-relaxed">
          {t.onboarding.footer}
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
