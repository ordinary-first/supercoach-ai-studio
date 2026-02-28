import { type FC, useRef, useCallback } from 'react';
import { Sparkles, Play, Mic, Loader2 } from 'lucide-react';
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
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedIdRef = useRef<string | null>(null);

  const handleTouchStart = useCallback(
    (item: SavedVisualization) => {
      pressedIdRef.current = item.id;
      longPressRef.current = setTimeout(() => {
        if (pressedIdRef.current === item.id) onItemDelete(item.id);
        pressedIdRef.current = null;
      }, 800);
    },
    [onItemDelete],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    pressedIdRef.current = null;
  }, []);

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
          <button
            key={item.id}
            type="button"
            className={`relative aspect-square overflow-hidden cursor-pointer rounded-[10px] ${!hasImage ? `bg-gradient-to-br ${pickGradient(item.id)}` : ''
              }`}
            onClick={() => onItemTap(item)}
            onTouchStart={() => handleTouchStart(item)}
            onTouchEnd={cancelLongPress}
            onTouchCancel={cancelLongPress}
            onContextMenu={(event) => {
              event.preventDefault();
              onItemDelete(item.id);
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
          </button>
        );
      })}
    </div>
  );
};

export default DreamGallery;
