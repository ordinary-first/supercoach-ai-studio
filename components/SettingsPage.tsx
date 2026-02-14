import React from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Crown,
  Globe,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';

type LanguageOption = 'en' | 'ko';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageOption;
  onLanguageChange: (language: LanguageOption) => void;
  userAge?: string;
}

const LABELS = {
  en: {
    title: 'Settings',
    language: 'Language',
    subscription: 'Subscription',
    account: 'Account',
    notifications: 'Notifications',
    comingSoon: 'Coming soon',
    polarPolicyTitle: 'Polar compliance',
    adultReady: 'Checkout ready (18+)',
    ageBlocked: 'Checkout blocked: adults only (18+).',
    ageMissing: 'Add your age in profile to enable checkout review.',
    ruleDigitalOnly: 'Digital SaaS only. No physical goods.',
    ruleNoHumanService: 'No consulting or human-delivered service.',
    ruleNoDonation: 'No donations, tips, or pure money transfers.',
    ruleInstantAccess: 'Paid users must get immediate in-app access.',
  },
  ko: {
    title: '설정',
    language: '언어',
    subscription: '구독',
    account: '계정',
    notifications: '알림',
    comingSoon: '준비 중',
    polarPolicyTitle: 'Polar 규정 체크',
    adultReady: '결제 준비 가능 (18+)',
    ageBlocked: '결제 차단: 성인(18+)만 허용됩니다.',
    ageMissing: '프로필에 나이를 입력하면 결제 검토를 진행할 수 있습니다.',
    ruleDigitalOnly: '디지털 SaaS만 판매. 물리 상품 금지.',
    ruleNoHumanService: '컨설팅/인적 서비스 결제 금지.',
    ruleNoDonation: '후원/기부/순수 송금 형태 결제 금지.',
    ruleInstantAccess: '결제 즉시 앱 내 디지털 접근 제공.',
  },
};

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
}) => {
  if (!isOpen) return null;

  const labels = LABELS[language];
  const age = parseAge(userAge);
  const hasAge = age !== null;
  const isAdult = hasAge && age >= 18;

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
              onChange={(event) => onLanguageChange(event.target.value as LanguageOption)}
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
              <span className="text-[11px] text-gray-400">{labels.comingSoon}</span>
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

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                <ShieldCheck size={14} className="text-neon-lime" />
                <span>{labels.polarPolicyTitle}</span>
              </div>
              <ul className="space-y-1.5 text-[12px] text-gray-400">
                <li>• {labels.ruleDigitalOnly}</li>
                <li>• {labels.ruleNoHumanService}</li>
                <li>• {labels.ruleNoDonation}</li>
                <li>• {labels.ruleInstantAccess}</li>
              </ul>
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
