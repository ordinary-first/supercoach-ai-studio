import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface NarrativeSectionProps {
  text?: string;
  isLoading: boolean;
}

const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

const SHIMMER_BG =
  'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)';

function NarrativeSection({ text, isLoading }: NarrativeSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section style={{ backgroundColor: '#111111', padding: '20px 24px' }}>
        <style>{shimmerStyle}</style>
        <div className="mb-3">
          <span
            className="font-medium uppercase"
            style={{ color: '#444', fontSize: '11px', letterSpacing: '0.12em' }}
          >
            NARRATIVE
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {[100, 85, 60].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded"
              style={{
                width: `${w}%`,
                background: SHIMMER_BG,
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
              }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (!text) return null;

  return (
    <section style={{ backgroundColor: '#111111', padding: '20px 24px' }}>
      <div className="mb-3">
        <span
          className="font-medium uppercase"
          style={{ color: '#444', fontSize: '11px', letterSpacing: '0.12em' }}
        >
          NARRATIVE
        </span>
      </div>

      <div className="relative">
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: expanded ? '2000px' : '4.5em',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.8)',
              letterSpacing: '0.01em',
              whiteSpace: 'pre-wrap',
            }}
          >
            {text}
          </p>
        </div>

        {/* Fade gradient when collapsed */}
        {!expanded && text.length > 120 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, #111111 0%, transparent 100%)',
            }}
          />
        )}
      </div>

      {text.length > 120 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 flex items-center gap-1"
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}
        >
          {expanded ? (
            <>
              {'\uC811\uAE30'} <ChevronUp size={14} />
            </>
          ) : (
            <>
              {'\uB354 \uBCF4\uAE30'} <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </section>
  );
}

export default NarrativeSection;
