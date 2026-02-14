import React, { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Crown,
  Globe,
  Loader2,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { createPolarCheckout, type PlanTier } from '../services/polarService';

type LanguageOption = 'en' | 'ko';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageOption;
  onLanguageChange: (language: LanguageOption) => void;
  userAge?: string;
  userEmail?: string;
  userName?: string;
  externalCustomerId?: string;
}

const LABELS = {
  en: {
    title: 'Settings',
    language: 'Language',
    subscription: 'Subscription',
    choosePlan: 'Choose your plan',
    checkout: 'Start checkout',
    redirecting: 'Redirecting...',
    account: 'Account',
    notifications: 'Notifications',
    polarPolicyTitle: 'Polar compliance',
    adultReady: 'Checkout ready (18+)',
    ageBlocked: 'Checkout blocked: adults only (18+).',
    ageMissing: 'Add your age in profile to enable checkout.',
    ruleDigitalOnly: 'Digital SaaS only. No physical goods.',
    ruleNoHumanService: 'No consulting or human-delivered service.',
    ruleNoDonation: 'No donations, tips, or pure money transfers.',
    ruleInstantAccess: 'Paid users must get immediate in-app access.',
    legalTitle: 'Legal',
    legalHint:
      'By continuing, you agree to the Terms of Service and acknowledge the Privacy Policy and Refund Policy.',
    terms: 'Terms',
    privacy: 'Privacy',
    refund: 'Refunds',
    checkoutFailed: 'Failed to create checkout session.',
  },
  ko: {
    title: '설정',
    language: '언어',
    subscription: '구독',
    choosePlan: '플랜 선택',
    checkout: '결제 시작',
    redirecting: '이동 중...',
    account: '계정',
    notifications: '알림',
    polarPolicyTitle: 'Polar 규정 체크',
    adultReady: '결제 준비 가능 (18+)',
    ageBlocked: '결제 차단: 성인(18+)만 이용 가능합니다.',
    ageMissing: '프로필에 나이를 입력하면 결제를 진행할 수 있습니다.',
    ruleDigitalOnly: '디지털 SaaS만 판매. 물리 상품 금지.',
    ruleNoHumanService: '컨설팅/인적 서비스 결제 금지.',
    ruleNoDonation: '후원/기부/팁 형태 결제 금지.',
    ruleInstantAccess: '결제 즉시 유료 기능 접근 제공.',
    legalTitle: '약관/정책',
    legalHint:
      '결제를 진행하면 서비스 이용약관에 동의하고, 개인정보 처리방침 및 환불규정을 확인한 것으로 간주합니다.',
    terms: '이용약관',
    privacy: '개인정보',
    refund: '환불규정',
    checkoutFailed: '체크아웃 세션 생성에 실패했습니다.',
  },
};

const PLANS: { plan: PlanTier; title: string; price: string }[] = [
  { plan: 'explorer', title: 'Explorer', price: 'Free' },
  { plan: 'essential', title: 'Essential', price: '$9.99/mo' },
  { plan: 'visionary', title: 'Visionary', price: '$19.99/mo' },
  { plan: 'master', title: 'Master', price: '$49.99/mo' },
];

const parseAge = (rawAge?: string): number | null => {
  if (!rawAge) return null;
  const parsed = Number(rawAge.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  userAge,
  userEmail,
  userName,
  externalCustomerId,
}) => {
  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  if (!isOpen) return null;

  const labels = LABELS[language];
  const age = parseAge(userAge);
  const hasAge = age !== null;
  const isAdult = hasAge && age >= 18;

  const customerId = (() => {
    if (externalCustomerId && externalCustomerId.trim().length > 0) {
      return externalCustomerId.trim();
    }
    if (userEmail && userEmail.trim().length > 0) {
      return `email:${userEmail.trim().toLowerCase()}`;
    }
    return undefined;
  })();

  const handleCheckout = async (plan: PlanTier) => {
    if (!isAdult) return;

    setCheckoutError('');
    setLoadingPlan(plan);

    try {
      const { url } = await createPolarCheckout({
        plan,
        customerEmail: userEmail,
        customerName: userName,
        externalCustomerId: customerId,
      });
      window.location.assign(url);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : labels.checkoutFailed;
      setCheckoutError(message);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-deep-space text-white">
      <div className="h-14 md:h-16 border-b border-white/10 bg-black/30 backdrop-blur-md px-4 md:px-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center text-gray-300"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Settings size={16} className="text-neon-lime" />
          <h1 className="text-sm md:text-base font-semibold tracking-wide">
            {labels.title}
          </h1>
        </div>

        <div className="w-9" />
      </div>

      <div className="h-[calc(100%-56px)] md:h-[calc(100%-64px)] overflow-y-auto px-4 py-6">
        <div className="max-w-xl mx-auto space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400 mb-3">
              <Globe size={14} className="text-neon-lime" />
              <span>{labels.language}</span>
            </div>
            <select
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as LanguageOption)
              }
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-neon-lime"
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-neon-lime" />
                <span className="text-sm">{labels.subscription}</span>
              </div>
              <span className="text-[11px] text-gray-400">{labels.choosePlan}</span>
            </div>

            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-start gap-2 text-xs">
                {isAdult ? (
                  <BadgeCheck size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                )}
                <p className="text-gray-300">
                  {isAdult && labels.adultReady}
                  {!isAdult && hasAge && labels.ageBlocked}
                  {!isAdult && !hasAge && labels.ageMissing}
                </p>
              </div>
            </div>

            <div className="px-4 py-3.5 border-b border-white/10 space-y-2">
              {PLANS.map((item) => {
                const isLoading = loadingPlan === item.plan;
                return (
                  <button
                    key={item.plan}
                    onClick={() => handleCheckout(item.plan)}
                    disabled={!isAdult || loadingPlan !== null}
                    className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left hover:border-neon-lime/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{item.title}</p>
                      <p className="text-[11px] text-gray-400">{item.price}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-neon-lime">
                      {isLoading ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          {labels.redirecting}
                        </>
                      ) : (
                        labels.checkout
                      )}
                    </span>
                  </button>
                );
              })}
              {checkoutError && (
                <p className="text-xs text-red-300 pt-1">{checkoutError}</p>
              )}
            </div>

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <ShieldCheck size={14} className="text-neon-lime" />
                <span>{labels.polarPolicyTitle}</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-gray-400">
                <li>{labels.ruleDigitalOnly}</li>
                <li>{labels.ruleNoHumanService}</li>
                <li>{labels.ruleNoDonation}</li>
                <li>{labels.ruleInstantAccess}</li>
              </ul>
            </div>

            <div className="px-4 py-3.5 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <ShieldCheck size={14} className="text-neon-lime" />
                <span>{labels.legalTitle}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {labels.legalHint}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.terms}
                </a>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.privacy}
                </a>
                <a
                  href="/refund"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-neon-lime hover:border-neon-lime/40"
                >
                  {labels.refund}
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              disabled
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/10 opacity-80"
            >
              <span className="text-sm">{labels.account}</span>
              <ChevronRight size={15} className="text-gray-500" />
            </button>

            <button
              disabled
              className="w-full flex items-center justify-between px-4 py-3.5 opacity-80"
            >
              <span className="text-sm">{labels.notifications}</span>
              <ChevronRight size={15} className="text-gray-500" />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
