import { type FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Play, Mic, Loader2, Trash2 } from 'lucide-react';
import { SavedVisualization } from '../../services/firebaseService';
import { useTranslation } from '../../i18n/useTranslation';

interface DreamGalleryProps {
  items: SavedVisualization[];
  onItemTap: (item: SavedVisualization) => void;
  onItemDelete: (id: string) => void;
  onCreateDream: () => void;
}

const GRADIENTS = [
  'from-slate-800 to-blue-900',
  'from-emerald-900 to-teal-900',
  'from-orange-900 to-red-900',
  'from-indigo-900 to-slate-800',
  'from-cyan-900 to-blue-900',
  'from-zinc-800 to-neutral-900',
];

const pickGradient = (id: string): string => {
  return GRADIENTS[id.charCodeAt(0) % GRADIENTS.length];
};

const DreamGallery: FC<DreamGalleryProps> = ({
  items,
  onItemTap,
  onItemDelete,
  onCreateDream,
}) => {
  const { t } = useTranslation();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
        <Sparkles size={32} className="text-th-accent/20" />
        <p className="text-[15px] font-medium text-th-text-secondary">{t.visualization.noDreamsYet}</p>
        <p className="text-[13px] text-th-text-tertiary leading-relaxed">{t.visualization.noDreamsDesc}</p>
        <button
          type="button"
          onClick={onCreateDream}
          className="apple-card mt-4 px-6 py-2.5 rounded-full text-sm font-semibold text-th-text
            hover:bg-th-surface-hover transition-all active:scale-95 shadow-sm"
        >
          + {t.visualization.createFirstDream}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 w-full gap-0.5 px-0.5 pb-3">
      {items.map((item) => {
        const hasImage = !!item.imageUrl;
        const hasVideo = !!item.videoUrl || item.videoStatus === 'ready';
        const isPending = item.videoStatus === 'pending';
        const hasAudioOnly = !!item.audioUrl && !hasImage && !hasVideo;

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className={`relative aspect-square overflow-hidden cursor-pointer rounded-[10px] ${!hasImage ? `bg-gradient-to-br ${pickGradient(item.id)}` : ''
              }`}
            onClick={() => onItemTap(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onItemTap(item);
              }
            }}
          >
            {hasImage && (
              <img
                src={item.imageUrl}
                alt={t.visualization.imageAlt}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            )}

            {!hasImage && (
              <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[11px]
                text-white leading-[1.3] line-clamp-3"
              >
                {(item.text || item.inputText || '').split('\n')[0]}
              </span>
            )}

            {hasVideo && !isPending && (
              <span className="absolute bottom-1 right-1 flex items-center justify-center w-[22px] h-[22px]
                rounded-full bg-black/50"
              >
                <Play size={14} color="#fff" fill="#fff" />
              </span>
            )}

            {hasAudioOnly && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Mic size={20} color="rgba(255,255,255,0.6)" />
              </span>
            )}

            {isPending && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                <Loader2 size={20} color="#fff" className="animate-spin" />
              </span>
            )}

            {/* visible delete affordance — opens a confirm dialog, never deletes on its own */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmId(item.id);
              }}
              className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full flex items-center justify-center
                text-white/85 hover:text-white active:scale-90 transition-all"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
              aria-label={t.common.delete}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      {confirmId && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-8"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmId(null)}
        >
          <div
            className="apple-glass-panel w-full max-w-[280px] rounded-3xl p-6 text-center"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-400" />
            </div>
            <p className="text-[15px] font-semibold text-th-text mb-1.5">{t.visualization.deleteConfirm}</p>
            <p className="text-[13px] text-th-text-tertiary mb-5 leading-relaxed">{t.visualization.deleteConfirmDesc}</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="flex-1 py-2.5 rounded-full apple-chip text-sm font-semibold text-th-text
                  active:scale-95 transition-transform"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onItemDelete(confirmId);
                  setConfirmId(null);
                }}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-semibold
                  active:scale-95 transition-transform"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DreamGallery;
