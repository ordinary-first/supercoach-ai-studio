import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { landingContent } from './landingContent';

interface FinalCTAProps {
  onCTAClick: () => void;
  isLoggingIn?: boolean;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({
  onCTAClick,
  isLoggingIn = false,
}) => {
  const { language } = useTranslation();
  const copy = landingContent[language].finalCta;

  return (
    <section className="relative overflow-hidden px-5 py-24 md:px-10 md:py-32">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(151,187,255,0.16) 0%, transparent 34%), radial-gradient(circle at 78% 28%, rgba(255,200,143,0.14) 0%, transparent 24%), radial-gradient(circle at 22% 80%, rgba(168,240,211,0.12) 0%, transparent 24%), linear-gradient(180deg, rgba(7,13,23,0.2) 0%, rgba(3,8,14,0.92) 42%, rgba(2,5,11,1) 100%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl rounded-[40px] border border-[#dce7fb]/14 bg-[linear-gradient(145deg,rgba(151,187,255,0.12),rgba(255,255,255,0.04),rgba(168,240,211,0.1))] px-6 py-10 text-center shadow-[0_50px_140px_-80px_rgba(0,0,0,1)] backdrop-blur-2xl md:px-12 md:py-16">
        <p className="font-body text-[0.72rem] uppercase tracking-[0.34em] text-[#d9e4f9]/54">
          {copy.eyebrow}
        </p>
        <h2 className="mx-auto mt-5 max-w-3xl bg-[linear-gradient(120deg,#f9fafb,#dbe8ff,#a8f0d3)] bg-clip-text text-balance font-display text-4xl font-semibold tracking-[-0.06em] text-transparent md:text-6xl md:leading-[1.02]">
          {copy.title}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-white/60 md:text-[1.2rem]">
          {copy.body}
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={onCTAClick}
            disabled={isLoggingIn}
            className={[
              'group inline-flex items-center gap-3 rounded-full border border-[#d7e5ff]/34 px-6 py-3.5 text-[#05070c]',
              'transition-all duration-200 hover:scale-[1.015]',
              'disabled:cursor-not-allowed disabled:opacity-70',
            ].join(' ')}
            style={{
              background:
                'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(216,231,255,1) 55%, rgba(168,240,211,0.95) 100%)',
            }}
          >
            <span className="text-sm font-semibold tracking-[-0.01em] md:text-base">
              {isLoggingIn ? 'Redirecting...' : copy.cta}
            </span>
            <ArrowRight
              size={18}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </button>

          <p className="text-sm leading-relaxed text-white/46 md:text-base">
            {copy.finePrint}
          </p>
        </div>
      </div>
    </section>
  );
};
