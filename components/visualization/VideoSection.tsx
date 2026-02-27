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
      <div className="px-6 pt-5 pb-2">
        <span className="font-medium uppercase text-[11px] tracking-[0.12em] text-white/35">
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
        <div className="relative flex items-center justify-center overflow-hidden h-[56vw] bg-black/35">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="absolute rounded-full w-32 h-32"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                animation: `dreamPulse 3s ease-in-out ${index}s infinite`,
              }}
            />
          ))}
          <span className="absolute bottom-6 text-white/45 text-xs">{t.visualization.dreamMakingLabel}</span>
        </div>
      )}
    </section>
  );
}

export default VideoSection;
