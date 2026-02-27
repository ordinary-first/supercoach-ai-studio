import {
  type FC,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ChatMessage } from '../../hooks/useDreamChat';
import type { GoalNode } from '../../types';
import { NodeType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import SuggestionBubbles from './SuggestionBubbles';
import ChatInput from './ChatInput';

interface DreamChatProps {
  nodes: GoalNode[];
  messages: ChatMessage[];
  onSendMessage: (text: string, goals: string[]) => void;
  isAiTyping: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  settings: { text: boolean; image: boolean; video: boolean; audio: boolean };
  onSettingsChange: (
    s: { text: boolean; image: boolean; video: boolean; audio: boolean },
  ) => void;
  imageQuality: 'medium' | 'high';
  onImageQualityChange: (q: 'medium' | 'high') => void;
  referenceImages: string[];
  onImageAttach: (dataUrl: string) => void;
  onRemoveImage: (index: number) => void;
  generatingBanner?: boolean;
  onBannerTap?: () => void;
}

const SHIMMER_KEYFRAMES = `
@keyframes shimmerSlide {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const DreamChat: FC<DreamChatProps> = ({
  nodes,
  messages,
  onSendMessage,
  isAiTyping,
  onGenerate,
  isGenerating,
  settings,
  onSettingsChange,
  imageQuality,
  onImageQualityChange,
  referenceImages,
  onImageAttach,
  onRemoveImage,
  generatingBanner,
  onBannerTap,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiTyping]);

  const goalTexts = useMemo(
    () => (nodes ?? []).filter((node) => node.type === NodeType.ROOT).map((node) => node.text),
    [nodes],
  );

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages],
  );

  const handleBubbleSelect = useCallback(
    (text: string) => onSendMessage(text, goalTexts),
    [onSendMessage, goalTexts],
  );

  const handleSend = useCallback(
    (text: string) => onSendMessage(text, goalTexts),
    [onSendMessage, goalTexts],
  );

  return (
    <div className="apple-glass-panel flex flex-col overflow-hidden h-full rounded-[20px]">
      <style>{SHIMMER_KEYFRAMES}</style>

      {generatingBanner && (
        <button
          type="button"
          onClick={onBannerTap}
          className="flex items-center justify-between mx-3 mt-3 px-4 h-10 rounded-xl border
            border-th-accent/30 cursor-pointer"
          style={{
            background:
              'linear-gradient(90deg, rgba(204,255,0,0.12) 0%, rgba(204,255,0,0.05) 50%, rgba(204,255,0,0.12) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSlide 2s linear infinite',
          }}
        >
          <span className="text-[13px] text-th-accent/85">{t.visualization.dreamBeingCreated}</span>
          <span className="text-[13px] text-th-accent font-medium">{t.visualization.viewButton}</span>
        </button>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3">
        <div className="flex flex-col gap-2.5 px-4">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-th-accent/90 text-black rounded-tr-sm'
                      : 'apple-card text-th-text rounded-tl-sm'
                  }`}
                >
                  <span className="whitespace-pre-wrap">{message.content}</span>
                </div>
              </div>
            );
          })}

          {!hasUserMessages && <SuggestionBubbles nodes={nodes} onSelect={handleBubbleSelect} />}

          {isAiTyping && (
            <div className="flex justify-start">
              <div className="apple-card rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" />
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={endRef} />
      </div>

      <ChatInput
        settings={settings}
        onSettingsChange={onSettingsChange}
        imageQuality={imageQuality}
        onImageQualityChange={onImageQualityChange}
        onSend={handleSend}
        onGenerate={onGenerate}
        onImageAttach={onImageAttach}
        isGenerating={isGenerating}
        referenceImages={referenceImages}
        onRemoveImage={onRemoveImage}
      />
    </div>
  );
};

export default DreamChat;
