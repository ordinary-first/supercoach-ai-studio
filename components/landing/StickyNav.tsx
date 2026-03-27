import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { landingContent } from './landingContent';

interface StickyNavProps {
  onCTAClick: () => void;
  isLoggingIn?: boolean;
}

export const StickyNav: React.FC<StickyNavProps> = ({
  onCTAClick,
  isLoggingIn = false,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const { language, setLanguage } = useTranslation();
  const copy = landingContent[language];

  useEffect(() => {
    const handleScroll = (): void => {
      setScrolled(window.scrollY > 24);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={[
        'fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-5 py-4 md:px-10 md:py-5',
        'transition-all duration-500 ease-out',
        scrolled
          ? 'bg-[linear-gradient(180deg,rgba(7,12,22,0.82),rgba(7,12,22,0.68))] backdrop-blur-2xl'
          : 'bg-transparent',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="select-none">
          <span className="font-display text-lg font-semibold tracking-[-0.06em] text-white md:text-2xl">
            Secret Coach
          </span>
        </div>
        <p className="hidden text-xs tracking-[-0.01em] text-[#d6e2fb]/44 md:block">
          {copy.navLabel}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <div className="inline-flex items-center rounded-full border border-[#d7e5ff]/12 bg-[linear-gradient(135deg,rgba(151,187,255,0.08),rgba(255,255,255,0.04))] p-0.5 backdrop-blur-md">
          <button
            onClick={() => setLanguage('en')}
            className={[
              'min-w-[34px] rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.14em] transition-all md:text-xs',
              language === 'en'
                ? 'bg-[linear-gradient(135deg,#f8fafc,#dbe8ff)] text-[#06080d]'
                : 'text-white/42 hover:text-white',
            ].join(' ')}
            aria-label="Switch language to English"
            aria-pressed={language === 'en'}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('ko')}
            className={[
              'min-w-[34px] rounded-full px-2 py-1 text-[10px] font-semibold tracking-[0.14em] transition-all md:text-xs',
              language === 'ko'
                ? 'bg-[linear-gradient(135deg,#f8fafc,#dbe8ff)] text-[#06080d]'
                : 'text-white/42 hover:text-white',
            ].join(' ')}
            aria-label="한국어로 전환"
            aria-pressed={language === 'ko'}
          >
            KO
          </button>
        </div>

        <button
          onClick={onCTAClick}
          disabled={isLoggingIn}
          className={[
            'rounded-full border border-[#d7e5ff]/18 px-4 py-2 text-[10px] font-semibold tracking-[0.14em] text-white',
            'whitespace-nowrap transition-all duration-200 hover:scale-[1.015] md:px-5 md:text-sm',
            'disabled:cursor-not-allowed disabled:opacity-70',
          ].join(' ')}
          style={{
            background:
              'linear-gradient(135deg, rgba(151,187,255,0.16), rgba(168,240,211,0.12))',
            boxShadow: '0 20px 40px -28px rgba(151, 187, 255, 0.45)',
          }}
        >
          {isLoggingIn ? 'Loading' : copy.navCta}
        </button>
      </div>
    </nav>
  );
};
