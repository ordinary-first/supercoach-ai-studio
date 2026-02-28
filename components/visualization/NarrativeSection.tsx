import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

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
  'linear-gradient(90deg, var(--bg-surface) 25%, var(--border) 50%, var(--bg-surface) 75%)';

function NarrativeSection({ text, isLoading }: NarrativeSectionProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <section className="apple-card rounded-[18px] px-6 py-5">
        <style>{shimmerStyle}</style>
        <div className="mb-3">
          <span className="font-bold uppercase text-[10px] tracking-[0.15em] text-th-text-tertiary">NARRATIVE</span>
        </div>
        <div className="flex flex-col gap-3">
          {[100, 85, 60].map((width, index) => (
            <div
              key={index}
              className="h-4 rounded"
              style={{
                width: `${width}%`,
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
    <section className="apple-card rounded-[18px] px-6 py-5">
      <div className="mb-3">
        <span className="font-bold uppercase text-[10px] tracking-[0.15em] text-th-text-tertiary">NARRATIVE</span>
      </div>

      <div className="relative">
        <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: expanded ? '2000px' : '6em' }}>
          <p className="text-base leading-[1.65] text-th-text tracking-[0.012em] whitespace-pre-wrap">{text}</p>
        </div>

        {!expanded && text.length > 200 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--bg-card) 20%, transparent 100%)' }}
          />
        )}
      </div>

      {text.length > 200 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 flex items-center gap-1.5 text-th-accent font-semibold text-[13px] hover:underline"
        >
          {expanded ? (
            <>
              {t.visualization.foldUp} <ChevronUp size={14} />
            </>
          ) : (
            <>
              {t.visualization.moreSee} <ChevronDown size={14} />
            </>
          )}
        </button>
      )}
    </section>
  );
}

export default NarrativeSection;
