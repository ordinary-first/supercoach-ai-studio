import React from 'react';
import { ChevronRight, Crown, Globe, Settings, X } from 'lucide-react';

type LanguageOption = 'en' | 'ko';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageOption;
  onLanguageChange: (language: LanguageOption) => void;
}

const LABELS = {
  en: {
    title: 'Settings',
    language: 'Language',
    subscription: 'Subscription',
    account: 'Account',
    notifications: 'Notifications',
    comingSoon: 'Coming soon',
  },
  ko: {
    title: '설정',
    language: '언어',
    subscription: '구독',
    account: '계정',
    notifications: '알림',
    comingSoon: '준비 중',
  },
};

const SettingsPage: React.FC<SettingsPageProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
}) => {
  if (!isOpen) return null;

  const labels = LABELS[language];

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
              <option value="ko">Korean</option>
            </select>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
              disabled
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-white/10 opacity-80"
            >
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-neon-lime" />
                <span className="text-sm">{labels.subscription}</span>
              </div>
              <span className="text-[11px] text-gray-400">{labels.comingSoon}</span>
            </button>

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
