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

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  userProfile,
  userId,
  onComplete,
}) => {
  const { t, language } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [error, setError] = useState('');

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
      price: t.onboarding.free,
      badge: t.onboarding.trialBadge,
      features: t.onboarding.planFeatures.explorer,
      cta: t.onboarding.startFree,
      highlight: true,
    },
    {
      plan: 'essential',
      label: 'Essential',
      price: language === 'ko' ? '$9.99/월' : '$9.99/mo',
      features: t.onboarding.planFeatures.essential,
      cta: t.onboarding.startNow,
      highlight: false,
    },
    {
      plan: 'visionary',
      label: 'Visionary',
      price: language === 'ko' ? '$19.99/월' : '$19.99/mo',
      features: t.onboarding.planFeatures.visionary,
      cta: t.onboarding.startNow,
      highlight: false,
    },
    {
      plan: 'master',
      label: 'Master',
      price: language === 'ko' ? '$49.99/월' : '$49.99/mo',
      features: t.onboarding.planFeatures.master,
      cta: t.onboarding.startNow,
      highlight: false,
    },
  ];

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
    <div className="fixed inset-0 bg-th-base text-th-text flex flex-col overflow-y-auto">
      {/* 헤더 */}
      <div className="flex-shrink-0 pt-12 pb-6 px-6 text-center">
        {userProfile.avatarUrl ? (
          <img
            src={userProfile.avatarUrl}
            alt="avatar"
            className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-th-accent-border object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-th-surface-hover border-2 border-th-accent-border flex items-center justify-center">
            <Star size={28} className="text-th-accent" />
          </div>
        )}
        <h1 className="text-2xl font-bold mb-1">
          {t.onboarding.welcome.replace('{name}', userProfile.name.split(' ')[0])}
        </h1>
        <p className="text-sm text-th-text-secondary">
          {t.onboarding.subtitle}
        </p>
      </div>

      {/* 플랜 선택 */}
      <div className="flex-1 px-4 pb-8 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Sparkles size={14} className="text-th-accent" />
          <p className="text-[13px] text-th-text-secondary font-medium">
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
                    ? 'border-th-accent-border bg-th-accent-muted shadow-[0_0_20px_var(--shadow-glow)]'
                    : 'border-th-border bg-th-surface'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.highlight && (
                      <Crown size={15} className="text-th-accent shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-th-text">{item.label}</p>
                      <p className="text-[11px] text-th-text-secondary">{item.price}</p>
                    </div>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-bold bg-th-accent-muted text-th-accent border border-th-accent-border rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
                  {item.features.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1 text-[11px] text-th-text-secondary"
                    >
                      <Check size={10} className={item.highlight ? 'text-th-accent' : 'text-th-text-muted'} />
                      {f}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSelect(item.plan)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.highlight
                      ? 'bg-th-accent text-th-text-inverse hover:bg-white'
                      : 'bg-th-surface-hover text-th-text hover:bg-th-header'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t.common.processing}
                    </>
                  ) : (
                    item.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="mt-6 text-[11px] text-th-text-muted text-center leading-relaxed">
          {t.onboarding.footer}
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
