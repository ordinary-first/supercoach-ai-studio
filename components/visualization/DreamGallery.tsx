import { type FC, useRef, useCallback } from 'react';
import { Sparkles, Play, Mic, Loader2 } from 'lucide-react';
import { SavedVisualization } from '../../services/firebaseService';

interface DreamGalleryProps {
  items: SavedVisualization[];
  onItemTap: (item: SavedVisualization) => void;
  onItemDelete: (id: string) => void;
  onCreateDream: () => void;
}

const GRADIENTS = [
  'from-purple-900 to-blue-900',
  'from-emerald-900 to-teal-900',
  'from-orange-900 to-red-900',
  'from-indigo-900 to-violet-900',
  'from-cyan-900 to-blue-900',
  'from-pink-900 to-rose-900',
];

const pickGradient = (id: string): string =>
  GRADIENTS[id.charCodeAt(0) % GRADIENTS.length];

const DreamGallery: FC<DreamGalleryProps> = ({
  items,
  onItemTap,
  onItemDelete,
  onCreateDream,
}) => {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedIdRef = useRef<string | null>(null);

  const handleTouchStart = useCallback(
    (item: SavedVisualization) => {
      pressedIdRef.current = item.id;
      longPressRef.current = setTimeout(() => {
        if (pressedIdRef.current === item.id) {
          onItemDelete(item.id);
        }
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Sparkles size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>
          아직 드림이 없어요
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          첫 번째 드림을 만들어보세요
        </p>
        <button
          type="button"
          onClick={onCreateDream}
          className="mt-2 px-5 py-2 rounded-full cursor-pointer"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
          }}
        >
          + 드림 만들기
        </button>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-3 w-full"
      style={{ gap: 2 }}
    >
      {items.map((item) => {
        const hasImage = !!item.imageUrl;
        const hasVideo = !!item.videoUrl || item.videoStatus === 'ready';
        const isPending = item.videoStatus === 'pending';
        const hasAudioOnly =
          !!item.audioUrl && !hasImage && !hasVideo;

        return (
          <button
            key={item.id}
            type="button"
            className={`relative aspect-square overflow-hidden cursor-pointer ${
              !hasImage ? `bg-gradient-to-br ${pickGradient(item.id)}` : ''
            }`}
            onClick={() => onItemTap(item)}
            onTouchStart={() => handleTouchStart(item)}
            onTouchEnd={cancelLongPress}
            onTouchCancel={cancelLongPress}
            onContextMenu={(e) => {
              e.preventDefault();
              onItemDelete(item.id);
            }}
            style={{ border: 'none', padding: 0 }}
          >
            {/* Thumbnail image */}
            {hasImage && (
              <img
                src={item.imageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            )}

            {/* Text fallback (no image) */}
            {!hasImage && (
              <span
                className="absolute inset-0 flex items-center justify-center px-1 text-center"
                style={{
                  fontSize: 11,
                  color: '#fff',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {(item.text || item.inputText || '').split('\n')[0]}
              </span>
            )}

            {/* Video badge */}
            {hasVideo && !isPending && (
              <span
                className="absolute bottom-1 right-1 flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.5)',
                }}
              >
                <Play size={14} color="#fff" fill="#fff" />
              </span>
            )}

            {/* Audio-only badge */}
            {hasAudioOnly && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Mic size={20} color="rgba(255,255,255,0.6)" />
              </span>
            )}

            {/* Pending / generating shimmer */}
            {isPending && (
              <span
                className="absolute inset-0 flex items-center justify-center animate-pulse"
                style={{ background: 'rgba(0,0,0,0.35)' }}
              >
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
