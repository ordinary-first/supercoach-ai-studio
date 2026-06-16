import { type FC, useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ChatMessage, SceneBranch } from '../../hooks/useDreamChat';
import type { RefineButton, RefineResult } from '../../services/aiService';
import type { GoalNode, UserProfile } from '../../types';
import { NodeType } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import SuggestionBubbles from './SuggestionBubbles';
import ChatInput from './ChatInput';

interface DreamChatProps {
  nodes: GoalNode[];
  userProfile: UserProfile | null;
  savedTitles: string[];
  messages: ChatMessage[];
  isAiTyping: boolean;
  isRefining: boolean;
  currentScene: string;
  refine: RefineResult;
  branch: SceneBranch | null;
  onSendMessage: (text: string, goals: string[]) => void;
  onTapRefine: (button: RefineButton) => void;
  onPickBranch: (which: 'original' | 'variant') => void;
  onDismissBranch: () => void;
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
}

const DreamChat: FC<DreamChatProps> = ({
  nodes,
  userProfile,
  savedTitles,
  messages,
  isAiTyping,
  isRefining,
  currentScene,
  refine,
  branch,
  onSendMessage,
  onTapRefine,
  onPickBranch,
  onDismissBranch,
  onGenerate,
  isGenerating,
  settings,
  onSettingsChange,
  imageQuality,
  onImageQualityChange,
  referenceImages,
  onImageAttach,
  onRemoveImage,
}) => {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiTyping, branch, refine.buttons.length]);

  const goalTexts = useMemo(
    () => (nodes ?? []).filter((node) => node.type === NodeType.ROOT).map((node) => node.text),
    [nodes],
  );

  const hasUserMessages = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages],
  );

  const handleSend = useCallback(
    (text: string) => onSendMessage(text, goalTexts),
    [onSendMessage, goalTexts],
  );

  const handleSelectSeed = useCallback(
    (seed: string) => onSendMessage(seed, goalTexts),
    [onSendMessage, goalTexts],
  );

  const handleWriteOwn = useCallback(() => setFocusSignal((n) => n + 1), []);

  const showRefineArea = !!currentScene && !branch && !isAiTyping;

  return (
    <div className="apple-glass-panel flex flex-col overflow-hidden h-full rounded-[20px]">
      <div className="flex-1 overflow-y-auto py-3">
        <div className="flex flex-col gap-2.5 px-4">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] md:max-w-[70%] rounded-[17px] px-3.5 py-2 text-[14.5px] leading-[1.45] shadow-sm transition-all ${isUser
                    ? 'bg-th-accent text-th-text-inverse rounded-tr-sm'
                    : 'apple-card text-th-text rounded-tl-sm border border-th-border/15 backdrop-blur-md'
                    }`}
                >
                  <span className="whitespace-pre-wrap">{message.content}</span>
                </div>
              </div>
            );
          })}

          {!hasUserMessages && !currentScene && (
            <SuggestionBubbles
              nodes={nodes}
              userProfile={userProfile}
              savedTitles={savedTitles}
              onSelectSeed={handleSelectSeed}
              onWriteOwn={handleWriteOwn}
            />
          )}

          {(isAiTyping || isRefining) && (
            <div className="flex justify-start">
              <div className="apple-card rounded-[17px] rounded-tl-sm px-3.5 py-2.5 bg-th-surface/30 backdrop-blur-md border border-th-border/10">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-th-accent rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          {/* 갈림길: 원본 vs 변형 — 한쪽을 고른다 */}
          {branch && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2 text-[12px] text-th-text-tertiary px-1">
                <span className="flex-1 h-px bg-th-border/40" />
                <span>{t.visualization.twoDirections}</span>
                <span className="flex-1 h-px bg-th-border/40" />
              </div>
              {(['original', 'variant'] as const).map((which) => (
                <button
                  key={which}
                  type="button"
                  onClick={() => onPickBranch(which)}
                  className="text-left apple-card rounded-[16px] px-3.5 py-3 border border-th-border/20
                    hover:border-th-accent/40 active:scale-[0.99] transition-all"
                >
                  <span className="block text-[13.5px] leading-[1.5] text-th-text whitespace-pre-wrap">
                    {which === 'original' ? branch.original : branch.variant}
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-th-accent">
                    {t.visualization.pickThis} →
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={onDismissBranch}
                className="self-center text-[12px] text-th-text-tertiary hover:text-th-text py-1"
              >
                {t.visualization.cancel}
              </button>
            </div>
          )}

          {/* 수정 버튼 + 이 장면으로 생성하기 */}
          {showRefineArea && (
            <div className="flex flex-col gap-2.5 pt-1">
              {!refine.isFinalReady && refine.buttons.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {refine.buttons.map((button, index) => (
                    <button
                      key={`${button.label}-${index}`}
                      type="button"
                      onClick={() => onTapRefine(button)}
                      className="apple-chip rounded-full px-3.5 py-2 text-[13px] text-th-text border border-th-border/30
                        hover:border-th-accent/40 active:scale-[0.97] transition-all"
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className="self-start flex items-center gap-1.5 rounded-full bg-th-accent px-4 py-2 text-[13px]
                  font-bold text-white active:scale-[0.97] transition-transform shadow-sm disabled:opacity-50"
                style={{ textShadow: '0 1px 2px rgba(4, 18, 38, 0.32)' }}
              >
                {isGenerating
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Sparkles size={13} />}
                <span>{t.visualization.generateThisScene}</span>
              </button>
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
        focusSignal={focusSignal}
        busy={isAiTyping || isRefining}
      />
    </div>
  );
};

export default DreamChat;
