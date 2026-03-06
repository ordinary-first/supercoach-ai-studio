import React, { useEffect, useRef, useState } from 'react';
import type { LandingMediaAsset } from './landingContent';

interface LandingMediaFrameProps {
  asset: LandingMediaAsset;
  title: string;
  description: string;
  priority?: boolean;
  className?: string;
  variant?: 'ambient' | 'phone';
}

const joinClassNames = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(' ');

export const LandingMediaFrame: React.FC<LandingMediaFrameProps> = ({
  asset,
  title,
  description,
  priority = false,
  className,
  variant = 'ambient',
}) => {
  const [isVisible, setIsVisible] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const showVideo = !hasError && isVisible && Boolean(asset.srcMp4 || asset.srcWebm);

  useEffect(() => {
    if (priority) return;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { rootMargin: '180px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [priority]);

  if (variant === 'phone') {
    return (
      <div
        ref={containerRef}
        className={joinClassNames(
          'relative mx-auto w-full max-w-[21.5rem] rounded-[2.1rem] p-[0.55rem]',
          'border border-[#253551] bg-[linear-gradient(180deg,#1f2d45_0%,#1a273d_52%,#1b2740_100%)]',
          'shadow-[0_28px_80px_-44px_rgba(0,0,0,0.92)]',
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-[1px] rounded-[2rem] border border-white/[0.045]" />
        <div className="pointer-events-none absolute inset-x-[14%] top-[0.58rem] z-20 h-[0.18rem] rounded-full bg-[#121b2b]" />
        <div className="pointer-events-none absolute left-1/2 top-[0.52rem] z-20 h-[0.42rem] w-[0.42rem] -translate-x-1/2 rounded-full border border-white/5 bg-[#0f1725]" />

        <div
          className="relative overflow-hidden rounded-[1.55rem] border border-[#0f1826] bg-[#060b12]"
          style={{ aspectRatio: asset.aspectRatio }}
        >
          <div className="pointer-events-none absolute inset-0 z-10 rounded-[1.55rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)]" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_15%,transparent_84%,rgba(0,0,0,0.12))]" />

          {showVideo ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload={priority ? 'auto' : 'metadata'}
              poster={asset.poster}
              aria-label={asset.alt}
              onError={() => setHasError(true)}
            >
              {asset.srcWebm ? <source src={asset.srcWebm} type="video/webm" /> : null}
              {asset.srcMp4 ? <source src={asset.srcMp4} type="video/mp4" /> : null}
            </video>
          ) : asset.poster ? (
            <img
              className="h-full w-full object-cover"
              src={asset.poster}
              alt={asset.alt}
              loading={priority ? 'eager' : 'lazy'}
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,#0b1120_0%,#121d30_44%,#0b111b_100%)]">
              <div className="absolute inset-5 rounded-[1.6rem] border border-dashed border-[#d9e7ff]/14" />
              <div className="relative z-10 max-w-[78%] text-center">
                <p className="font-display text-[0.68rem] uppercase tracking-[0.32em] text-[#dce7fb]/52">
                  {asset.fallbackLabel}
                </p>
                <p className="mt-4 text-balance text-xl font-semibold tracking-[-0.03em] text-white/92">
                  {title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#d9e4f9]/66">{description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={joinClassNames(
        'relative w-full min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.035]',
        'shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl',
        className,
      )}
      style={{ aspectRatio: asset.aspectRatio }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(151,187,255,0.18),transparent_28%,transparent_68%,rgba(168,240,211,0.14))]" />
      <div className="absolute inset-[1px] rounded-[27px] border border-white/8" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_50%)]" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#030712] via-[#030712]/70 to-transparent" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:46px_46px]" />

      {showVideo ? (
        <video
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload={priority ? 'auto' : 'metadata'}
          poster={asset.poster}
          aria-label={asset.alt}
          onError={() => setHasError(true)}
        >
          {asset.srcWebm ? <source src={asset.srcWebm} type="video/webm" /> : null}
          {asset.srcMp4 ? <source src={asset.srcMp4} type="video/mp4" /> : null}
        </video>
      ) : asset.poster ? (
        <img
          className="h-full w-full object-cover"
          src={asset.poster}
          alt={asset.alt}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#0b1120_0%,#16243a_42%,#13201d_100%)]">
          <div className="absolute inset-6 rounded-[22px] border border-dashed border-[#d9e7ff]/18" />
          <div className="relative z-10 max-w-[calc(100%-2.75rem)] text-center">
            <p className="font-display text-[0.65rem] uppercase tracking-[0.32em] text-[#dce7fb]/54">
              {asset.fallbackLabel}
            </p>
            <p className="mt-4 text-balance text-xl font-semibold tracking-[-0.03em] text-white/92">
              {title}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#d9e4f9]/66">{description}</p>
          </div>
        </div>
      )}

    </div>
  );
};
