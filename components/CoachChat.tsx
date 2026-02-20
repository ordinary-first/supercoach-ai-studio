
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GoalNode, UserProfile, ToDoItem } from '../types';
import { sendChatMessage } from '../services/aiService';
import { Send, MessageCircle, Sparkles } from 'lucide-react';
import CloseButton from './CloseButton';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { TabType } from './BottomDock';
import {
  useCoachMemory,
  buildGoalContext,
  buildTodoContext,
} from '../hooks/useCoachMemory';
import { useTranslation } from '../i18n/LanguageContext';

interface CoachChatProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: GoalNode | null;
  nodes?: GoalNode[];
  userProfile: UserProfile | null;
  userId: string | null;
  todos: ToDoItem[];
  onOpenVisualization: () => void;
  messages: ChatMessage[];
  onMessagesChange: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeTab: TabType;
}

const CoachChat: React.FC<CoachChatProps> = ({
  isOpen, onClose, selectedNode, nodes, userProfile, userId, todos, onOpenVisualization, messages, onMessagesChange, activeTab
}) => {
  const { t, locale } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const memory = useCoachMemory(userId, isOpen, nodes || [], todos);

  const tabLabels: Record<TabType, string> = {
    GOALS: t.coach.tabGoals,
    CALENDAR: t.coach.tabCalendar,
    TODO: t.coach.tabTodo,
    VISUALIZE: t.coach.tabVisualize,
    FEEDBACK: t.nav.feedback,
  };

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      timestamp: Date.now(),
    };
    onMessagesChange(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
      const goalCtx = buildGoalContext(nodes || []);
      const todoCtx = buildTodoContext(todos);

      const response = await sendChatMessage(
        history,
        userMsg.text,
        userProfile,
        memory,
        goalCtx,
        todoCtx,
        tabLabels[activeTab],
        userId || undefined,
        locale,
      );

      const aiText = response.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .filter(Boolean)
        .join('') || '';

      if (aiText) {
        onMessagesChange(prev => [
          ...prev,
          { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now() },
        ]);
      }
    } catch {
      onMessagesChange(prev => [
        ...prev,
        { id: 'err-' + Date.now(), sender: 'ai', text: t.coach.systemError, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-[60] bg-deep-space flex flex-col overflow-hidden text-white font-body">

      {/* Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-neon-lime/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-electric-orange/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/20 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-4">
            <div className="p-2 md:p-3 bg-neon-lime/10 rounded-lg md:rounded-xl">
                <MessageCircle className="text-neon-lime w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
                <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-white">{t.coach.title}</h1>
                <p className="text-[10px] text-neon-lime/60 font-mono mt-0.5">
                  {tabLabels[activeTab]} {t.coach.coaching}
                </p>
            </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Chat Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 scrollbar-hide relative z-10">
        <div className="max-w-2xl mx-auto py-4 space-y-3">
          {messages.length === 0 && (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Sparkles size={28} className="text-neon-lime animate-pulse" />
                  </div>
                  <p className="text-sm font-display uppercase tracking-widest mb-1 text-gray-500">{t.coach.waitingInput}</p>
                  <p className="text-xs text-gray-600 max-w-xs">{t.coach.askAdvice}</p>
              </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-electric-orange text-white rounded-tr-sm'
                  : 'bg-white/5 text-gray-100 rounded-tl-sm border border-white/10 shadow-xl backdrop-blur-sm'
              }`}>
                <span className="whitespace-pre-wrap">
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((segment, i) =>
                    segment.startsWith('**') && segment.endsWith('**')
                      ? <strong key={i} className="text-neon-lime font-bold">{segment.slice(2, -2)}</strong>
                      : segment
                  )}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-neon-lime rounded-full animate-pulse"></span>
                  <span className="w-2 h-2 bg-neon-lime rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                  <span className="w-2 h-2 bg-neon-lime rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 flex justify-center z-20">
        <div className="w-full max-w-2xl">
          <div className="relative group">
            <div className="absolute inset-0 bg-neon-lime/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center bg-black/80 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl overflow-hidden transition-colors hover:border-neon-lime/50">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder={t.coach.placeholder}
                className="w-full bg-transparent border-none py-4 px-6 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-0"
                aria-label={t.coach.sendMessage}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="mr-2 p-3 bg-neon-lime rounded-full text-black hover:bg-white transition-all disabled:opacity-0 disabled:scale-95"
                aria-label="전송"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachChat;
