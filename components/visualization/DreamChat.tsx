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
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiTyping]);

  // 목표 텍스트 추출
  const goalTexts = useMemo(
    () => (nodes ?? []).filter((n) => n.type === NodeType.ROOT).map((n) => n.text),
    [nodes],
  );

  // 유저 메시지 존재 여부 (환영 메시지 후 첫 선택 전)
  const hasUserMessages = useMemo(
    () => messages.some((m) => m.role === 'user'),
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
    <div
      className="flex flex-col overflow-hidden h-full bg-th-base border border-th-border rounded-[20px]"
    >
      <style>{SHIMMER_KEYFRAMES}</style>

      {/* Generating banner */}
      {generatingBanner && (
        <button
          type="button"
          onClick={onBannerTap}
          className="flex items-center justify-between mx-3 mt-3 px-4 h-10 rounded-xl border border-yellow-500/30 cursor-pointer"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,215,0,0.08) 0%, rgba(255,215,0,0.04) 50%, rgba(255,215,0,0.08) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSlide 2s linear infinite',
          }}
        >
          <span className="text-[13px] text-yellow-500/80">
            ✦ 드림이 생성되고 있어요
          </span>
          <span className="text-[13px] text-yellow-500/95 font-medium">
            보기
          </span>
        </button>
      )}

      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-3"
      >
        <div className="flex flex-col gap-2.5 px-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-emerald-700 text-white rounded-tr-sm'
                      : 'bg-th-surface text-th-text rounded-tl-sm border border-th-border'
                  }`}
                >
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            );
          })}

          {/* Suggestion bubbles: AI 환영 메시지 후, 유저 메시지 없을 때만 */}
          {!hasUserMessages && (
            <SuggestionBubbles nodes={nodes} onSelect={handleBubbleSelect} />
          )}

          {/* Typing indicator */}
          {isAiTyping && (
            <div className="flex justify-start">
              <div className="bg-th-surface border border-th-border rounded-2xl rounded-tl-sm px-4 py-3">
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
