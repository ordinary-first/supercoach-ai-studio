
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
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CoachingQuestion | null>(null);
  const [showTopicCards, setShowTopicCards] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const memory = useCoachMemory(userId, isOpen, nodes || [], todos);

  const tabLabels: Record<TabType, string> = {
    GOALS: '목표 마인드맵',
    CALENDAR: '일정 캘린더',
    TODO: '할 일 목록',
    VISUALIZE: '시각화',
    FEEDBACK: '피드백',
  };

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 코칭 토픽 선택 시 AI 첫 메시지 자동 전송
  useEffect(() => {
    if (!isOpen || !selectedTopic?.topicDirective || messages.length > 0 || isLoading) return;

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
          onMessagesChange([
            { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now() },
          ]);
        }
      } catch {
        if (!cancelled) {
          onMessagesChange([
            { id: 'err-' + Date.now(), sender: 'ai', text: '코칭 시작 중 오류가 발생했습니다.', timestamp: Date.now() },
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
        { id: 'err-' + Date.now(), sender: 'ai', text: '시스템 통신 오류가 발생했습니다.', timestamp: Date.now() },
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
                <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-white">AI 코치</h1>
                <p className="text-[10px] text-neon-lime/60 font-mono mt-0.5">
                  {tabLabels[activeTab]} 코칭 중
                </p>
            </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Chat Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 scrollbar-hide relative z-10">
        <div className="max-w-2xl mx-auto py-4 space-y-3">
          {messages.length === 0 && !isLoading && (() => {
            const questions = getCoachingQuestions(selectedNode, nodes || []);
            return questions.length > 0 && showTopicCards ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 border border-white/10 shadow-xl backdrop-blur-sm px-5 py-4">
                  <p className="text-sm text-gray-100 leading-relaxed mb-4">
                    안녕하세요! 아래 질문 중 궁금한 것을 선택해보세요 🙂
                  </p>
                  <div className="space-y-2">
                    {questions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => handleTopicSelect(q)}
                        className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-neon-lime/40 hover:bg-neon-lime/5 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{q.icon}</span>
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-neon-lime transition-colors">
                              {q.question}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {q.summary}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Sparkles size={28} className="text-neon-lime animate-pulse" />
                </div>
                <p className="text-sm font-display uppercase tracking-widest mb-1 text-gray-500">입력 대기 중</p>
                <p className="text-xs text-gray-600 max-w-xs">목표와 비전에 대한 조언을 요청하세요.</p>
              </div>
            );
          })()}
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
                placeholder="코치에게 질문하세요..."
                className="w-full bg-transparent border-none py-4 px-6 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-0"
                aria-label="코치에게 메시지 보내기"
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
