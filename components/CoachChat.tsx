
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GoalNode, UserProfile, ToDoItem } from '../types';
import { sendChatMessage } from '../services/aiService';
import { Send, MessageCircle, Sparkles } from 'lucide-react';
import CloseButton from './CloseButton';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { TabType } from './BottomDock';
import { CoachingQuestion, getCoachingQuestions } from '../constants/coachingTopics';
import {
  useCoachMemory,
  buildGoalContext,
  buildTodoContext,
} from '../hooks/useCoachMemory';
import { useTranslation } from '../i18n/useTranslation';

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
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CoachingQuestion | null>(null);
  const [showTopicCards, setShowTopicCards] = useState(true);
  const [questionPage, setQuestionPage] = useState(0);
  const QUESTIONS_PER_PAGE = 3;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const memory = useCoachMemory(userId, isOpen, nodes || [], todos);

  const tabLabels: Record<TabType, string> = {
    GOALS: t.coach.tabLabels.GOALS,
    CALENDAR: t.coach.tabLabels.CALENDAR,
    TODO: t.coach.tabLabels.TODO,
    VISUALIZE: t.coach.tabLabels.VISUALIZE,
    FEEDBACK: '피드백',
  };

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 채팅 열릴 때 질문 상태 리셋 + 스크롤
  useEffect(() => {
    if (isOpen) {
      setShowTopicCards(true);
      setSelectedTopic(null);
      setQuestionPage(0);
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [isOpen]);

  // 코칭 토픽 선택 시 AI 첫 메시지 자동 전송
  useEffect(() => {
    if (!isOpen || !selectedTopic?.topicDirective || isLoading) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const goalCtx = buildGoalContext(nodes || []);
        const todoCtx = buildTodoContext(todos);
        const subGoalCount = (nodes || []).filter(n => n.type !== 'ROOT').length;

        const response = await sendChatMessage(
          [],
          '',
          userProfile,
          memory,
          goalCtx,
          todoCtx,
          tabLabels[activeTab],
          userId || undefined,
          subGoalCount,
          selectedTopic.topicDirective!,
        );

        if (cancelled) return;

        const aiText = response.candidates?.[0]?.content?.parts
          ?.map(p => p.text)
          .filter(Boolean)
          .join('') || '';

        if (aiText) {
          onMessagesChange(prev => [...prev,
            { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now() },
          ]);
        }
      } catch {
        if (!cancelled) {
          onMessagesChange(prev => [...prev,
            { id: 'err-' + Date.now(), sender: 'ai', text: t.coach.errorStart, timestamp: Date.now() },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setSelectedTopic(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, selectedTopic]);

  const handleTopicSelect = (topic: CoachingQuestion) => {
    setShowTopicCards(false);
    if (topic.topicDirective) {
      setSelectedTopic(topic);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setShowTopicCards(false);
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

      const subGoalCount = (nodes || []).filter(n => n.type !== 'ROOT').length;
      const response = await sendChatMessage(
        history,
        userMsg.text,
        userProfile,
        memory,
        goalCtx,
        todoCtx,
        tabLabels[activeTab],
        userId || undefined,
        subGoalCount,
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
        { id: 'err-' + Date.now(), sender: 'ai', text: t.coach.errorSystem, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-[60] bg-th-base flex flex-col overflow-hidden text-th-text font-body">

      {/* Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-th-accent-muted rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-700/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="h-14 md:h-20 border-b border-th-border flex items-center justify-between px-4 md:px-8 bg-th-header backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-4">
            <div className="p-2 md:p-3 bg-th-accent-muted rounded-lg md:rounded-xl">
                <MessageCircle className="text-th-accent w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
                <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-th-text">{t.coach.title}</h1>
                <p className="text-[10px] text-neon-lime/60 font-mono mt-0.5">
                  {t.coach.coachingStatus.replace('{tab}', tabLabels[activeTab])}
                </p>
            </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Chat Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 scrollbar-hide relative z-10">
        <div className="max-w-2xl mx-auto py-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-700 text-white rounded-tr-sm'
                  : 'bg-th-surface text-gray-100 rounded-tl-sm border border-th-border shadow-xl backdrop-blur-sm'
              }`}>
                <span className="whitespace-pre-wrap">
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((segment, i) =>
                    segment.startsWith('**') && segment.endsWith('**')
                      ? <strong key={i} className="text-th-accent font-bold">{segment.slice(2, -2)}</strong>
                      : segment
                  )}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-th-surface border border-th-border rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse"></span>
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
                </div>
              </div>
            </div>
          )}

          {/* 질문 카드 — 대화 아래에 AI 말풍선 형태로 */}
          {(() => {
            const questions = getCoachingQuestions(selectedNode, nodes || []);
            if (!showTopicCards || questions.length === 0) return null;
            const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);
            const pageQuestions = questions.slice(
              questionPage * QUESTIONS_PER_PAGE,
              (questionPage + 1) * QUESTIONS_PER_PAGE
            );
            return (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-th-surface border border-th-border shadow-xl backdrop-blur-sm px-5 py-4">
                  <p className="text-sm text-gray-100 leading-relaxed mb-3">
                    {t.coach.selectQuestion}
                  </p>
                  <div className="space-y-2">
                    {pageQuestions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => handleTopicSelect(q)}
                        className="w-full text-left px-4 py-3 rounded-xl bg-th-surface border border-th-border hover:border-th-accent-border hover:bg-th-accent-muted transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{q.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-th-text group-hover:text-th-accent transition-colors">
                              {q.question}
                            </p>
                            <p className="text-xs text-th-text-tertiary mt-0.5">
                              {q.summary}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-1.5 mt-3">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setQuestionPage(i)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            i === questionPage
                              ? 'bg-th-accent shadow-[0_0_4px_var(--shadow-glow)]'
                              : 'bg-th-border hover:bg-th-surface-hover'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 빈 상태 — 메시지 없고 질문도 없을 때만 */}
          {messages.length === 0 && !isLoading && (() => {
            const questions = getCoachingQuestions(selectedNode, nodes || []);
            if (showTopicCards && questions.length > 0) return null;
            return (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-th-surface flex items-center justify-center mb-4">
                  <Sparkles size={28} className="text-th-accent animate-pulse" />
                </div>
                <p className="text-sm font-display uppercase tracking-widest mb-1 text-th-text-tertiary">{t.coach.emptyTitle}</p>
                <p className="text-xs text-th-text-muted max-w-xs">{t.coach.emptyDesc}</p>
              </div>
            );
          })()}

        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 flex justify-center z-20">
        <div className="w-full max-w-2xl">
          <div className="relative group">
            <div className="absolute inset-0 bg-th-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center bg-th-elevated backdrop-blur-xl border border-th-border rounded-full shadow-2xl overflow-hidden transition-colors hover:border-th-accent-border">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder={t.coach.placeholder}
                className="w-full bg-transparent border-none py-4 px-6 text-lg text-th-text placeholder-th-text-tertiary focus:outline-none focus:ring-0"
                aria-label={t.coach.sendMessage}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="mr-2 p-3 bg-th-accent rounded-full text-th-text-inverse hover:bg-white transition-all disabled:opacity-0 disabled:scale-95"
                aria-label={t.coach.sendLabel}
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
