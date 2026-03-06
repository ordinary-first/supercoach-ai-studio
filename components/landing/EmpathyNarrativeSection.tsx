import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { landingContent } from './landingContent';

const ACTIVE_BEAT_BACKGROUNDS = [
  'linear-gradient(145deg, rgba(151, 187, 255, 0.18), rgba(255,255,255,0.04))',
  'linear-gradient(145deg, rgba(255, 200, 143, 0.16), rgba(255,255,255,0.04))',
  'linear-gradient(145deg, rgba(168, 240, 211, 0.15), rgba(255,255,255,0.04))',
];

export const EmpathyNarrativeSection: React.FC = () => {
  const { language } = useTranslation();
  const copy = landingContent[language].empathy;
  const prefersReducedMotion = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const beats = useMemo(() => copy.beats, [copy.beats]);

  useEffect(() => {
    const updateViewport = (): void => {
      setIsMobile(window.innerWidth < 1024);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isMobile) return;

    const updateProgress = (): void => {
      const node = sectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const progress = Math.min(
        0.999,
        Math.max(0, (viewportHeight - rect.top) / (rect.height - viewportHeight)),
      );
      const nextIndex = Math.min(beats.length - 1, Math.floor(progress * beats.length));
      setActiveIndex(nextIndex);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [beats.length, isMobile, prefersReducedMotion]);

  if (prefersReducedMotion || isMobile) {
    return (
      <section className="relative px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl rounded-[36px] border border-white/10 bg-[linear-gradient(145deg,rgba(151,187,255,0.08),rgba(255,255,255,0.03),rgba(168,240,211,0.08))] px-6 py-8 md:px-12 md:py-14">
          <p className="font-body text-[0.72rem] uppercase tracking-[0.32em] text-[#d5e0f7]/52">
            {copy.eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
            {copy.title}
          </h2>
          <div className="mt-8 space-y-5 md:mt-12 md:space-y-6">
            {beats.map((beat) => (
              <article
                key={beat.kicker}
                className="rounded-[28px] border border-white/10 bg-[#0a1320]/75 p-6 shadow-[0_30px_70px_-50px_rgba(0,0,0,0.95)]"
              >
                <p className="font-body text-[0.72rem] uppercase tracking-[0.32em] text-[#cfd9ea]/45">
                  {beat.kicker}
                </p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {beat.title}
                </h3>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/62">
                  {beat.body}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 space-y-3 border-t border-white/10 pt-6 md:mt-12 md:pt-8">
            {copy.closing.map((line) => (
              <p
                key={line}
                className="text-balance font-display text-2xl font-semibold tracking-[-0.04em] text-white md:text-4xl"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative h-[150svh] px-5 md:h-[165svh] md:px-10">
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden py-10 md:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(151,187,255,0.16),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(168,240,211,0.12),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(255,200,143,0.12),transparent_24%),linear-gradient(180deg,#04070d_0%,#07101c_48%,#02050b_100%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[0.42fr_1fr] lg:gap-20">
          <div className="flex flex-col justify-between">
            <div>
              <p className="font-body text-[0.72rem] uppercase tracking-[0.34em] text-[#d5e0f7]/48">
                {copy.eyebrow}
              </p>
              <h2 className="mt-5 max-w-sm text-balance font-display text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                {copy.title}
              </h2>
            </div>

            <div className="mt-10 flex gap-3 lg:mt-0 lg:flex-col">
              {beats.map((beat, index) => (
                <button
                  key={beat.kicker}
                  type="button"
                  className="group flex items-center gap-3 text-left"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={activeIndex === index}
                >
                  <span
                    className={[
                      'block h-[2px] w-10 rounded-full transition-all duration-500',
                      activeIndex === index ? 'bg-[#dbe8ff]' : 'bg-white/20',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'font-body text-[0.72rem] uppercase tracking-[0.32em] transition-colors duration-300',
                      activeIndex === index ? 'text-white/80' : 'text-white/34',
                    ].join(' ')}
                  >
                    {beat.kicker}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-[28rem]">
            {beats.map((beat, index) => {
              const isActive = activeIndex === index;
              return (
                <article
                  key={beat.kicker}
                  className={[
                    'absolute inset-0 rounded-[34px] border px-6 py-8 md:px-10 md:py-12',
                    'transition-all duration-700 ease-out',
                    isActive
                      ? 'translate-y-0 border-white/14 opacity-100'
                      : 'translate-y-10 border-white/8 bg-white/[0.02] opacity-0',
                  ].join(' ')}
                  style={{
                    pointerEvents: isActive ? 'auto' : 'none',
                    filter: isActive ? 'blur(0px)' : 'blur(12px)',
                    background: isActive
                      ? ACTIVE_BEAT_BACKGROUNDS[index]
                      : 'rgba(255,255,255,0.02)',
                    boxShadow: isActive
                      ? '0 50px 120px -70px rgba(0, 0, 0, 0.95)'
                      : 'none',
                  }}
                >
                  <p className="font-body text-[0.72rem] uppercase tracking-[0.32em] text-[#d4deee]/55">
                    {beat.kicker}
                  </p>
                  <h3 className="mt-6 max-w-3xl text-balance font-display text-3xl font-semibold tracking-[-0.05em] text-white md:text-6xl md:leading-[1.02]">
                    {beat.title}
                  </h3>
                  <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/62 md:text-xl">
                    {beat.body}
                  </p>
                </article>
              );
            })}

            <div className="absolute inset-x-0 bottom-0 rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(11,18,32,0.72),rgba(20,29,48,0.48))] px-6 py-6 backdrop-blur-md md:px-8">
              {copy.closing.map((line, index) => (
                <p
                  key={line}
                  className={[
                    'font-display tracking-[-0.04em]',
                    index === copy.closing.length - 1
                      ? 'mt-3 bg-[linear-gradient(120deg,#f9fafb,#d9e7ff,#a8f0d3)] bg-clip-text text-2xl font-semibold text-transparent md:text-4xl'
                      : 'text-lg text-white/74 md:text-2xl',
                  ].join(' ')}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
