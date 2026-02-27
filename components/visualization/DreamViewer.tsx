import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share2, Loader2, Check } from 'lucide-react';
import { VisualizationResult } from '../../hooks/useGenerationPipeline';
import { useTranslation } from '../../i18n/useTranslation';
import VideoSection from './VideoSection';
import ImageSection from './ImageSection';
import AudioSection from './AudioSection';
import NarrativeSection from './NarrativeSection';

interface DreamViewerProps {
  result: VisualizationResult;
  isGenerating: boolean;
  generatingStep: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRefreshVideo?: () => void;
  isCheckingVideo?: boolean;
}

const viewerStyles = `
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes sheetDown {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}
@keyframes sectionFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

function DreamViewer({
  result,
  isGenerating,
  generatingStep,
  isOpen,
  onClose,
  onSave,
  isSaving,
  isSaved,
  isPlaying,
  onTogglePlay,
  onRefreshVideo,
  isCheckingVideo,
}: DreamViewerProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => setIsAnimating(true));
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  const showVideo =
    result.videoUrl ||
    result.videoStatus === 'pending' ||
    result.videoStatus === 'ready' ||
    (isGenerating && generatingStep.includes('video'));

  const showImage =
    result.imageUrl ||
    result.imageDataUrl ||
    (isGenerating && generatingStep.includes('image'));

  const hasAudio = result.audioStatus === 'completed' && !!(result.audioUrl || result.audioData);
  const showAudio =
    hasAudio || result.audioStatus !== 'idle' || (isGenerating && generatingStep.includes('audio'));

  const showNarrative =
    result.text || result.textStatus !== 'idle' || (isGenerating && generatingStep.includes('text'));

  return (
    <div
      className="fixed inset-0 flex flex-col apple-tab-shell"
      style={{
        zIndex: 9999,
        animation: isAnimating
          ? 'sheetUp 420ms cubic-bezier(0.32,0.72,0,1) forwards'
          : 'sheetDown 300ms ease-in forwards',
      }}
    >
      <style>{viewerStyles}</style>

      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full apple-chip flex items-center
          justify-center text-white"
      >
        <X size={20} />
      </button>

      {isGenerating && generatingStep && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4
          py-1.5 rounded-full apple-chip"
        >
          <Loader2 size={14} className="animate-spin text-white/60" />
          <span className="text-xs text-white/60">{generatingStep}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pt-16 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col gap-0.5 px-0.5">
          {showVideo && (
            <div style={{ opacity: 0, animation: 'sectionFadeIn 400ms ease forwards', animationDelay: '0ms' }}>
              <VideoSection
                videoUrl={result.videoUrl}
                videoStatus={result.videoStatus}
                isLoading={isGenerating || result.videoStatus === 'pending' || !!isCheckingVideo}
              />
            </div>
          )}

          {showImage && (
            <div
              style={{
                opacity: 0,
                animation: 'sectionFadeIn 400ms ease forwards',
                animationDelay: showVideo ? '150ms' : '0ms',
              }}
            >
              <ImageSection
                imageUrl={result.imageUrl}
                imageDataUrl={result.imageDataUrl}
                isLoading={isGenerating && !result.imageUrl && !result.imageDataUrl}
              />
            </div>
          )}

          {showAudio && (
            <div
              style={{
                opacity: 0,
                animation: 'sectionFadeIn 400ms ease forwards',
                animationDelay: `${(showVideo ? 150 : 0) + (showImage ? 150 : 0)}ms`,
              }}
            >
              <AudioSection
                hasAudio={hasAudio}
                isLoading={isGenerating && result.audioStatus === 'idle'}
                isPlaying={isPlaying}
                onTogglePlay={onTogglePlay}
              />
            </div>
          )}

          {showNarrative && (
            <div
              style={{
                opacity: 0,
                animation: 'sectionFadeIn 400ms ease forwards',
                animationDelay: `${(showVideo ? 150 : 0) + (showImage ? 150 : 0) + (showAudio ? 150 : 0)}ms`,
              }}
            >
              <NarrativeSection text={result.text} isLoading={isGenerating && !result.text} />
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-center h-20 z-10"
        style={{
          background: 'linear-gradient(to top, rgba(7,11,22,0.96) 60%, transparent)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center gap-5">
          <button
            onClick={onSave}
            disabled={isSaving || isSaved}
            className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-white
              disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isSaved ? (
              <Check size={16} />
            ) : (
              <Download size={16} />
            )}
            <span>
              {isSaving ? t.visualization.saving : isSaved ? t.visualization.savedLabel : t.visualization.saveButton}
            </span>
          </button>

          <button className="apple-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm text-white">
            <Share2 size={16} />
            <span>{t.visualization.shareButton}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DreamViewer;
