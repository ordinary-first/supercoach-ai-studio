import { useState, useCallback, useRef } from 'react';
import { sendDreamChatMessage } from '../services/aiService';
import type { AppLanguage } from '../i18n/types';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  type: 'suggestion' | 'scene' | 'user-input';
}

const getWelcomeMessage = (lang: AppLanguage) =>
  lang === 'ko'
    ? '안녕하세요! 어떤 장면을 시각화해 볼까요? 아래에서 마음에 드는 주제를 선택하거나 직접 입력해 주세요.'
    : 'Hello! What scene would you like to visualize? Choose a topic below or type your own.';

const getErrorMessage = (lang: AppLanguage) =>
  lang === 'ko'
    ? '죄송해요, 잠시 오류가 발생했어요. 다시 시도해 주세요.'
    : 'Sorry, an error occurred. Please try again.';

const makeId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export function useDreamChat(language: AppLanguage = 'ko') {
  const welcomeMessage = getWelcomeMessage(language);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: makeId(), role: 'ai', content: welcomeMessage, type: 'scene' },
  ]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useCallback(
    (role: ChatMessage['role'], content: string, type: ChatMessage['type']) => {
      const msg: ChatMessage = { id: makeId(), role, content, type };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string, goals: string[] = []) => {
      // 유저 메시지 추가
      addMessage('user', text, 'user-input');

      // 대화 히스토리 구성 (현재 messages + 방금 추가한 유저 메시지 제외 — API에 별도 전달)
      setIsAiTyping(true);
      setFinalPrompt(null);

      try {
        // 현재 메시지로 히스토리 구성
        const history = [...messages, { id: '', role: 'user' as const, content: text, type: 'user-input' as const }]
          .filter((m) => m.content !== welcomeMessage)
          .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

        const { reply, prompt } = await sendDreamChatMessage(
          history.slice(0, -1), // history (이전 메시지들)
          text, // 새 메시지
          goals,
        );

        addMessage('ai', reply, 'scene');
        if (prompt) setFinalPrompt(prompt);
      } catch {
        addMessage('ai', getErrorMessage(language), 'scene');
      } finally {
        setIsAiTyping(false);
      }
    },
    [addMessage, messages],
  );

  const clearMessages = useCallback(() => {
    setMessages([
      { id: makeId(), role: 'ai', content: welcomeMessage, type: 'scene' },
    ]);
    setFinalPrompt(null);
  }, []);

  /** 최종 프롬프트 또는 마지막 AI scene */
  const getLastScene = useCallback((): string => {
    if (finalPrompt) return finalPrompt;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'ai' && messages[i].type === 'scene') {
        return messages[i].content;
      }
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
  }, [messages, finalPrompt]);

  return {
    messages,
    addMessage,
    sendMessage,
    clearMessages,
    getLastScene,
    isAiTyping,
    finalPrompt,
  };
}
