import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { LandingMediaFrame } from './LandingMediaFrame';
import { landingContent, landingMedia } from './landingContent';

interface HeroSectionProps {
  onCTAClick: () => void;
  isLoggingIn?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCTAClick,
  isLoggingIn = false,
}) => {
  const { language } = useTranslation();
  const copy = landingContent[language].hero;
  const media = landingMedia['hero-impact'];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-6 pt-28 md:px-10 md:pb-12 md:pt-32"
      style={{ backgroundColor: '#02050b' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 14% 18%, rgba(151, 187, 255, 0.2) 0%, transparent 30%), radial-gradient(circle at 78% 22%, rgba(255, 202, 153, 0.16) 0%, transparent 22%), radial-gradient(circle at 62% 82%, rgba(153, 241, 208, 0.12) 0%, transparent 26%), linear-gradient(180deg, #05070E 0%, #0A1020 42%, #04070D 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.72), transparent 88%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-[8%] top-[12%] h-36 w-36 rounded-full blur-3xl"
        style={{ background: 'rgba(151, 187, 255, 0.22)' }}
      />
      <div
        className="pointer-events-none absolute bottom-[14%] right-[8%] h-44 w-44 rounded-full blur-3xl"
        style={{ background: 'rgba(168, 240, 211, 0.18)' }}
      />
      <div
        className="pointer-events-none absolute right-[16%] top-[18%] h-28 w-28 rounded-full blur-3xl"
        style={{ background: 'rgba(255, 196, 140, 0.18)' }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="min-w-0 max-w-2xl">
          <div className="space-y-2 md:space-y-3">
            {copy.headline.map((line, index) => (
              <h1
                key={line}
                className={[
                  'text-balance font-display text-[2.65rem] font-semibold tracking-[-0.08em]',
                  'sm:text-[3.15rem] md:text-[4.6rem] lg:text-[5.15rem] lg:leading-[0.96]',
                  index === 0
                    ? 'text-white/96'
                    : 'bg-[linear-gradient(120deg,#f9fafb_8%,#d9e7ff_44%,#a8f0d3_84%)] bg-clip-text text-transparent',
                ].join(' ')}
              >
                {line}
              </h1>
            ))}
          </div>

          <p className="mt-5 max-w-xl text-balance text-[1.02rem] leading-relaxed text-white/60 md:text-[1.18rem]">
            {copy.subline}
          </p>

          <div className="mt-7 flex flex-col items-start gap-4">
            <button
              onClick={onCTAClick}
              disabled={isLoggingIn}
              className={[
                'group inline-flex items-center gap-3 rounded-full px-6 py-3.5 md:px-7 md:py-4',
                'border border-[#d9e7ff]/40 text-[#05070c] transition-all duration-200 hover:scale-[1.015]',
                'disabled:cursor-not-allowed disabled:opacity-70',
              ].join(' ')}
              style={{
                background:
                  'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(216,231,255,1) 55%, rgba(168,240,211,0.95) 100%)',
                boxShadow:
                  '0 28px 70px -34px rgba(151, 187, 255, 0.45), 0 18px 44px -30px rgba(168, 240, 211, 0.3)',
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

            <p className="text-sm leading-relaxed text-[#d9e4f9]/54 md:text-[0.95rem]">
              {copy.meta}
            </p>
          </div>
        </div>

        <div className="min-w-0 w-full lg:justify-self-end">
          <LandingMediaFrame
            asset={media}
            title={copy.headline.join(' ')}
            description={copy.subline}
            priority
            variant="phone"
            className="max-w-[19.5rem] sm:max-w-[21.5rem] lg:max-w-[23rem]"
          />
        </div>
      </div>
    </section>
  );
};
