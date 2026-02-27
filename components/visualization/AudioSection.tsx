import { Play, Pause } from 'lucide-react';

interface AudioSectionProps {
  hasAudio: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const waveBarStyle = `
@keyframes waveBar {
  0%, 100% { height: 4px; }
  50% { height: var(--max-h); }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

const BAR_CONFIGS = [
  { maxH: '20px', delay: '0s' },
  { maxH: '28px', delay: '0.15s' },
  { maxH: '16px', delay: '0.3s' },
  { maxH: '32px', delay: '0.1s' },
  { maxH: '12px', delay: '0.25s' },
  { maxH: '24px', delay: '0.05s' },
  { maxH: '18px', delay: '0.2s' },
];

function AudioSection({ hasAudio, isLoading, isPlaying, onTogglePlay }: AudioSectionProps) {
  return (
    <section className="apple-card flex flex-col rounded-[18px]">
      <style>{waveBarStyle}</style>
      <div className="px-6 pt-5 pb-2">
        <span className="font-medium uppercase text-[11px] tracking-[0.12em] text-white/35">AUDIO</span>
      </div>

      <div className="flex items-center px-6 pb-4 h-[52px]">
        <div className="flex-1 flex items-center gap-[3px] h-8">
          {isLoading ? (
            <div
              className="w-full h-3 rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
              }}
            />
          ) : (
            BAR_CONFIGS.map((config, index) => (
              <div
                key={index}
                className="rounded-full"
                style={{
                  width: '3px',
                  minHeight: '4px',
                  height: isPlaying ? undefined : '4px',
                  backgroundColor: 'rgba(255,255,255,0.6)',
                  ['--max-h' as string]: config.maxH,
                  ...(isPlaying
                    ? { animation: `waveBar 0.8s ease-in-out ${config.delay} infinite` }
                    : {}),
                }}
              />
            ))
          )}
        </div>

        {hasAudio && !isLoading && (
          <button
            onClick={onTogglePlay}
            className="ml-4 flex items-center justify-center rounded-full shrink-0 w-10 h-10 bg-white"
          >
            {isPlaying ? <Pause size={18} color="#000" fill="#000" /> : <Play size={18} color="#000" fill="#000" />}
          </button>
        )}
      </div>
    </section>
  );
}

export default AudioSection;
