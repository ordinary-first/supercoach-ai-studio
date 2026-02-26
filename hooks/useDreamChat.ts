import { useState, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  type: 'suggestion' | 'scene' | 'user-input';
}

export function useDreamChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((role: ChatMessage['role'], content: string, type: ChatMessage['type']) => {
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      type,
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  /** Return the last AI scene description (used as generation prompt) */
  const getLastScene = useCallback((): string => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'ai' && messages[i].type === 'scene') {
        return messages[i].content;
      }
    }
    // Fallback: last user input
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return '';
  }, [messages]);

  return { messages, addMessage, clearMessages, getLastScene };
}
