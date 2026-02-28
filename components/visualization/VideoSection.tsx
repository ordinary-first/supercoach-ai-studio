import { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface VideoSectionProps {
  videoUrl?: string;
  videoStatus: 'idle' | 'pending' | 'ready' | 'failed';
  isLoading: boolean;
}

const pulseStyle = `
@keyframes dreamPulse {
  0%, 100% { opacity: 0.1; transform: scale(0.8); }
  50% { opacity: 0.4; transform: scale(1.2); }
}
`;

function VideoSection({ videoUrl, videoStatus, isLoading }: VideoSectionProps) {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);
  const showVideo = videoStatus === 'ready' && videoUrl && !hasError;
  const showLoading = isLoading || videoStatus === 'pending';

  return (
    <section className="apple-card overflow-hidden rounded-[18px]">
      <style>{pulseStyle}</style>
      <div className="px-6 pt-5 pb-3">
        <span className="font-bold uppercase text-[10px] tracking-[0.15em] text-th-text-tertiary">
          SCENE · VIDEO
        </span>
      </div>

      {showVideo && (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full"
          onError={() => setHasError(true)}
        />
      )}

      {!showVideo && showLoading && (
        <div className="relative flex items-center justify-center overflow-hidden aspect-video bg-th-surface border-y border-th-border/20">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="absolute rounded-full w-32 h-32"
              style={{
                background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
                opacity: 0.15,
                animation: `dreamPulse 4s ease-in-out ${index * 1.3}s infinite`,
              }}
            />
          ))}
          <span className="absolute bottom-6 text-th-text-tertiary text-xs font-medium animate-pulse">{t.visualization.dreamMakingLabel}</span>
        </div>
      )}
    </section>
  );
}

export default VideoSection;
