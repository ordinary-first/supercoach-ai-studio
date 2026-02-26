import {
  type FC,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ChatMessage } from '../../hooks/useDreamChat';
import type { GoalNode } from '../../types';
import SuggestionBubbles from './SuggestionBubbles';
import ChatInput from './ChatInput';

interface DreamChatProps {
  nodes: GoalNode[];
  messages: ChatMessage[];
  onAddMessage: (
    role: 'ai' | 'user',
    content: string,
    type: 'suggestion' | 'scene' | 'user-input',
  ) => void;
  settings: { text: boolean; image: boolean; video: boolean; audio: boolean };
  onSettingsChange: (
    s: { text: boolean; image: boolean; video: boolean; audio: boolean },
  ) => void;
  imageQuality: 'medium' | 'high';
  onImageQualityChange: (q: 'medium' | 'high') => void;
  onGenerate: () => void;
  isGenerating: boolean;
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

const AI_REPLY =
  '좋은 선택이에요! 이 장면을 기반으로 시각화를 만들어 드릴게요. 아래에서 원하는 출력을 선택한 후 생성하기를 눌러주세요.';

const DreamChat: FC<DreamChatProps> = ({
  nodes,
  messages,
  onAddMessage,
  settings,
  onSettingsChange,
  imageQuality,
  onImageQualityChange,
  onGenerate,
  isGenerating,
  referenceImages,
  onImageAttach,
  onRemoveImage,
  generatingBanner,
  onBannerTap,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Determine if we should show suggestion bubbles (no user messages yet)
  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === 'user'),
    [messages],
  );

  const handleBubbleSelect = useCallback(
    (text: string) => {
      onAddMessage('user', text, 'user-input');
      // Delayed AI reply
      setTimeout(() => {
        onAddMessage('ai', AI_REPLY, 'scene');
      }, 400);
    },
    [onAddMessage],
  );

  const handleSend = useCallback(
    (text: string) => {
      onAddMessage('user', text, 'user-input');
      setTimeout(() => {
        onAddMessage('ai', AI_REPLY, 'scene');
      }, 400);
    },
    [onAddMessage],
  );

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        background: '#141414',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        height: '100%',
      }}
    >
      <style>{SHIMMER_KEYFRAMES}</style>

      {/* Generating banner */}
      {generatingBanner && (
        <button
          type="button"
          onClick={onBannerTap}
          className="flex items-center justify-between mx-3 mt-3 px-4 cursor-pointer
            border-none"
          style={{
            height: 40,
            borderRadius: 12,
            background:
              'linear-gradient(90deg, rgba(255,215,0,0.08) 0%, rgba(255,215,0,0.04) 50%, rgba(255,215,0,0.08) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSlide 2s linear infinite',
            border: '1px solid rgba(255,215,0,0.3)',
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: 'rgba(255,215,0,0.8)',
            }}
          >
            ✦ 드림이 생성되고 있어요
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'rgba(255,215,0,0.95)',
              fontWeight: 500,
            }}
          >
            보기
          </span>
        </button>
      )}

      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ padding: '12px 0' }}
      >
        {!hasUserMessages ? (
          <SuggestionBubbles nodes={nodes} onSelect={handleBubbleSelect} />
        ) : (
          <div className="flex flex-col gap-2.5 px-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: isUser ? '10px 14px' : '12px 16px',
                      fontSize: 14,
                      lineHeight: 1.55,
                      borderRadius: isUser
                        ? '18px 4px 18px 18px'
                        : '4px 18px 18px 18px',
                      background: isUser
                        ? 'var(--accent)'
                        : 'rgba(255,255,255,0.05)',
                      border: isUser
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.08)',
                      color: isUser
                        ? '#fff'
                        : 'rgba(255,255,255,0.85)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chat input */}
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
