import React from 'react';
import { LandingMediaFrame } from './LandingMediaFrame';
import { landingContent, landingMedia } from './landingContent';
import { useTranslation } from '../../i18n/useTranslation';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const FEATURE_BACKGROUNDS = [
  'linear-gradient(145deg, rgba(151, 187, 255, 0.14), rgba(255,255,255,0.03))',
  'linear-gradient(145deg, rgba(255, 200, 143, 0.12), rgba(255,255,255,0.03))',
  'linear-gradient(145deg, rgba(168, 240, 211, 0.12), rgba(255,255,255,0.03))',
  'linear-gradient(145deg, rgba(203, 189, 255, 0.12), rgba(255,255,255,0.03))',
  'linear-gradient(145deg, rgba(255, 170, 190, 0.12), rgba(255,255,255,0.03))',
];

interface FeatureStoryBlockProps {
  index: number;
}

const FeatureStoryBlock: React.FC<FeatureStoryBlockProps> = ({ index }) => {
  const { language } = useTranslation();
  const item = landingContent[language].features.items[index];
  const media = landingMedia[item.mediaKey];
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.16,
    rootMargin: '-10% 0px',
  });
  const reverse = index % 2 === 1;

  return (
    <article
      ref={ref}
      className={[
        'grid gap-8 rounded-[36px] border border-white/10 bg-white/[0.035] p-5 md:p-8 lg:grid-cols-2 lg:gap-14 lg:p-12',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        'transition-all duration-700 ease-out',
      ].join(' ')}
      style={{ background: FEATURE_BACKGROUNDS[index] }}
    >
      <div className={reverse ? 'lg:order-2' : ''}>
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(151,187,255,0.12),rgba(255,255,255,0.04))] px-3 py-1.5 backdrop-blur-md">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.3em] text-white/42">
            {item.indexLabel}
          </span>
          <span className="h-1 w-1 rounded-full bg-white/25" />
          <span className="font-body text-[0.68rem] uppercase tracking-[0.22em] text-white/52">
            Psychology Layer
          </span>
        </div>

        <h3 className="mt-6 max-w-xl text-balance font-display text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl md:leading-[1.02]">
          {item.title}
        </h3>

        <div className="mt-6 space-y-4">
          {item.description.map((paragraph) => (
            <p key={paragraph} className="max-w-xl text-base leading-relaxed text-white/66 md:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,13,25,0.85),rgba(20,28,45,0.72))] px-5 py-4 shadow-[0_25px_70px_-60px_rgba(0,0,0,0.95)]">
          <p className="font-body text-[0.72rem] uppercase tracking-[0.3em] text-[#c9d2e3]/52">
            Psychology
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/76 md:text-base">
            {item.psychology}
          </p>
        </div>
      </div>

      <div className={reverse ? 'lg:order-1' : ''}>
        <LandingMediaFrame
          asset={media}
          title={item.title}
          description={item.psychology}
          className="h-full min-h-[24rem] md:min-h-[34rem]"
        />
      </div>
    </article>
  );
};

export const PsychologyFeaturesSection: React.FC = () => {
  const { language } = useTranslation();
  const copy = landingContent[language].features;

  return (
    <section className="relative px-5 pb-24 pt-2 md:px-10 md:pb-24 md:pt-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(151,187,255,0.08),transparent_28%),radial-gradient(circle_at_80%_32%,rgba(255,200,143,0.08),transparent_22%)]" />
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="font-body text-[0.72rem] uppercase tracking-[0.34em] text-[#d5e0f7]/48">
            {copy.eyebrow}
          </p>
          <div className="mt-5 space-y-2">
            {copy.bridge.map((line) => (
              <h2
                key={line}
                className={[
                  'text-balance font-display text-4xl font-semibold tracking-[-0.06em] md:text-6xl md:leading-[1.02]',
                  line === copy.bridge[1]
                    ? 'bg-[linear-gradient(120deg,#f9fafb,#dbe8ff,#a8f0d3)] bg-clip-text text-transparent'
                    : 'text-white',
                ].join(' ')}
              >
                {line}
              </h2>
            ))}
          </div>
        </div>

        <div className="mt-16 space-y-10">
          {copy.items.map((item, index) => (
            <FeatureStoryBlock key={item.indexLabel} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
