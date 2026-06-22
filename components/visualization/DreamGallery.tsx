import { type FC, useState, useRef } from 'react';
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
  // 롱프레스(모바일)/우클릭(웹)으로 그 항목만 삭제 모드로 진입 → 휴지통 노출.
  // 평소엔 썸네일을 깨끗하게 유지한다(상시 노출 안 함).
  const [armedId, setArmedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const startPress = (id: string) => {
    longPressFired.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setArmedId(id);
    }, 500);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleTap = (item: SavedVisualization) => {
    // 롱프레스로 막 무장한 직후 발생하는 click 은 무시(무장 유지)
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    // 무장된 항목 본문을 탭하면 삭제 모드 해제(열지 않음)
    if (armedId === item.id) {
      setArmedId(null);
      return;
    }
    if (armedId) setArmedId(null);
    onItemTap(item);
  };

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
        const isArmed = armedId === item.id;

        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className={`relative aspect-square overflow-hidden cursor-pointer rounded-[10px]
              transition-transform ${isArmed ? 'scale-[0.97]' : ''} ${!hasImage ? `bg-gradient-to-br ${pickGradient(item.id)}` : ''
              }`}
            onClick={() => handleTap(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onItemTap(item);
              }
            }}
            onTouchStart={() => startPress(item.id)}
            onTouchMove={endPress}
            onTouchEnd={endPress}
            onTouchCancel={endPress}
            onContextMenu={(event) => {
              event.preventDefault();
              longPressFired.current = false;
              setArmedId(item.id);
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

            {/* 삭제 모드: 롱프레스/우클릭으로만 등장. 휴지통 탭 → 확인 팝업. 주변 탭 → 해제 */}
            {isArmed && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setArmedId(null);
                    setConfirmId(item.id);
                  }}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500 text-white
                    shadow-lg active:scale-90 transition-transform"
                  aria-label={t.common.delete}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
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
