import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share2, Loader2, Check } from 'lucide-react';
import { VisualizationResult } from '../../hooks/useGenerationPipeline';
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

const slideStyle = `
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes slideDown {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
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
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Mount with entry animation
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

  // Determine which sections to show
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
    hasAudio ||
    result.audioStatus !== 'idle' ||
    (isGenerating && generatingStep.includes('audio'));

  const showNarrative =
    result.text ||
    result.textStatus !== 'idle' ||
    (isGenerating && generatingStep.includes('text'));

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 9999,
        backgroundColor: '#0A0A0A',
        animation: isAnimating
          ? 'slideUp 400ms cubic-bezier(0.32,0.72,0,1) forwards'
          : 'slideDown 300ms ease-in forwards',
      }}
    >
      <style>{slideStyle}</style>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 flex items-center justify-center rounded-full"
        style={{
          width: '40px',
          height: '40px',
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <X size={20} color="#fff" />
      </button>

      {/* Generating step indicator */}
      {isGenerating && generatingStep && (
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <Loader2 size={14} color="#888" className="animate-spin" />
          <span style={{ color: '#888', fontSize: '12px' }}>
            {generatingStep}
          </span>
        </div>
      )}

      {/* Scroll container */}
      <div
        className="flex-1 overflow-y-auto pt-16 pb-24"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col" style={{ gap: '2px' }}>
          {showVideo && (
            <VideoSection
              videoUrl={result.videoUrl}
              videoStatus={result.videoStatus}
              isLoading={
                isGenerating ||
                result.videoStatus === 'pending' ||
                !!isCheckingVideo
              }
            />
          )}

          {showImage && (
            <ImageSection
              imageUrl={result.imageUrl}
              imageDataUrl={result.imageDataUrl}
              isLoading={isGenerating && !result.imageUrl && !result.imageDataUrl}
            />
          )}

          {showAudio && (
            <AudioSection
              hasAudio={hasAudio}
              isLoading={isGenerating && result.audioStatus === 'idle'}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
            />
          )}

          {showNarrative && (
            <NarrativeSection
              text={result.text}
              isLoading={isGenerating && !result.text}
            />
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-center"
        style={{
          height: '80px',
          background: 'linear-gradient(to top, #0A0A0A 60%, transparent)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-5">
          {/* Save */}
          <button
            onClick={onSave}
            disabled={isSaving || isSaved}
            className="flex items-center gap-2 rounded-full transition-opacity"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '12px 24px',
              fontSize: '14px',
              color: '#fff',
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isSaved ? (
              <Check size={16} />
            ) : (
              <Download size={16} />
            )}
            <span>
              {isSaving
                ? '\uC800\uC7A5 \uC911...'
                : isSaved
                  ? '\uC800\uC7A5\uB428'
                  : '\uC800\uC7A5'}
            </span>
          </button>

          {/* Share */}
          <button
            className="flex items-center gap-2 rounded-full"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '12px 24px',
              fontSize: '14px',
              color: '#fff',
            }}
          >
            <Share2 size={16} />
            <span>{'\uACF5\uC720'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DreamViewer;
