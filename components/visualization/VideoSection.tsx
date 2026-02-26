import { useState } from 'react';

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
  const [hasError, setHasError] = useState(false);
  const showVideo = videoStatus === 'ready' && videoUrl && !hasError;
  const showLoading = isLoading || videoStatus === 'pending';

  return (
    <section style={{ backgroundColor: '#111111' }}>
      <style>{pulseStyle}</style>
      <div className="px-6 pt-5 pb-2">
        <span
          className="font-medium uppercase"
          style={{
            color: '#444',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
        >
          SCENE &middot; VIDEO
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
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{ height: '56vw', backgroundColor: '#0D0D0D' }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full w-32 h-32"
              style={{
                background:
                  'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                animation: `dreamPulse 3s ease-in-out ${i}s infinite`,
              }}
            />
          ))}
          <span
            className="absolute bottom-6"
            style={{ color: '#444', fontSize: '12px' }}
          >
            {'\uAFC8\uC774 \uB9CC\uB4E4\uC5B4\uC9C0\uACE0 \uC788\uC5B4\uC694'}
          </span>
        </div>
      )}
    </section>
  );
}

export default VideoSection;
