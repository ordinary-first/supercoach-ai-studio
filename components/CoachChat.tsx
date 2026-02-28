
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, GoalNode, UserProfile, ToDoItem } from '../types';
import { sendChatMessage } from '../services/aiService';
import { saveFeedbackCard } from '../services/firebaseService';
import { Send, MessageCircle, Sparkles, Plus, X, ImageIcon } from 'lucide-react';
import CloseButton from './CloseButton';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { TabType } from './BottomDock';
import { CoachingQuestion, getCoachingQuestions } from '../constants/coachingTopics';
import {
  useCoachMemory,
  buildGoalContext,
  buildTodoContext,
} from '../hooks/useCoachMemory';
import { useCoachFeedback } from '../hooks/useCoachFeedback';
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
  const { t, language } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CoachingQuestion | null>(null);
  const [showTopicCards, setShowTopicCards] = useState(true);
  const [questionPage, setQuestionPage] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportKeyboardInset, setViewportKeyboardInset] = useState(0);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const QUESTIONS_PER_PAGE = 3;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);
  const memory = useCoachMemory(userId, isOpen, nodes || [], todos, language);
  const { pendingDirective, feedbackSlot, markFeedbackDone } =
    useCoachFeedback(isOpen, todos, language);
  const effectiveKeyboardHeight = Math.max(keyboardHeight, viewportKeyboardInset);

  // Mobile keyboard height via VirtualKeyboard API (overlays-content 모드)
  useEffect(() => {
    const nav = navigator as unknown as { virtualKeyboard?: { overlaysContent: boolean; boundingRect: DOMRect; addEventListener: (e: string, fn: () => void) => void; removeEventListener: (e: string, fn: () => void) => void } };
    if (!nav.virtualKeyboard) return;
    nav.virtualKeyboard.overlaysContent = true;
    const onChange = () => setKeyboardHeight(Math.round(nav.virtualKeyboard!.boundingRect.height));
    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () => nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

  // Fallback: derive keyboard inset from visualViewport for browsers without VirtualKeyboard API.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const syncViewportInset = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setViewportKeyboardInset(inset);
    };

    syncViewportInset();
    vv.addEventListener('resize', syncViewportInset);
    vv.addEventListener('scroll', syncViewportInset);
    window.addEventListener('resize', syncViewportInset);

    return () => {
      vv.removeEventListener('resize', syncViewportInset);
      vv.removeEventListener('scroll', syncViewportInset);
      window.removeEventListener('resize', syncViewportInset);
    };
  }, []);

  // 키보드 올라올 때 최신 메시지로 스크롤 (다단계 타이밍)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let prevHeight = vv.height;
    const onResize = () => {
      const shrunk = vv.height < prevHeight;
      prevHeight = vv.height;
      if (!shrunk) return;
      // 키보드 애니메이션 완료까지 다단계 스크롤
      timers.forEach(clearTimeout);
      timers = [
        setTimeout(() => scrollToBottom(), 50),
        setTimeout(() => scrollToBottom(), 200),
        setTimeout(() => scrollToBottom(), 400),
      ];
    };
    vv.addEventListener('resize', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      timers.forEach(clearTimeout);
    };
  }, []);

  const extractComment = useCallback((text: string) => {
    const match = text.match(/<!-- COMMENT: (.+?) -->/);
    if (!match) return { clean: text, comment: null };
    return {
      clean: text.replace(/\s*<!-- COMMENT: .+? -->/, '').trim(),
      comment: match[1],
    };
  }, []);

  const saveDailyComment = useCallback(async (comment: string) => {
    if (!userId) return;
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const completed = todos.filter(t => t.completed).map(t => t.text);
    const incomplete = todos.filter(t => !t.completed).map(t => t.text);
    await saveFeedbackCard(userId, {
      date: dateKey,
      completedTodos: completed,
      incompleteTodos: incomplete,
      coachComment: comment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, [userId, todos]);

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
  }, [messages, isLoading, effectiveKeyboardHeight]);

  // 채팅 열릴 때 질문 상태 리셋 + 스크롤
  useEffect(() => {
    if (isOpen) {
      setShowTopicCards(true);
      setSelectedTopic(null);
      setQuestionPage(0);
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [isOpen]);

  // 아침/저녁 피드백 디렉티브 자동 전송
  useEffect(() => {
    if (!isOpen || !pendingDirective || isLoading || selectedTopic) return;

    let cancelled = false;
    setIsLoading(true);
    setShowTopicCards(false);

    (async () => {
      try {
        const goalCtx = buildGoalContext(nodes || []);
        const todoCtx = buildTodoContext(todos);
        const subGoalCount = (nodes || []).filter(n => n.type !== 'ROOT').length;

        const response = await sendChatMessage(
          [], '', userProfile, memory,
          goalCtx, todoCtx, tabLabels[activeTab],
          userId || undefined, subGoalCount,
          pendingDirective,
        );

        if (cancelled) return;

        const rawText = response.candidates?.[0]?.content?.parts
          ?.map(p => p.text).filter(Boolean).join('') || '';

        const { clean, comment } = extractComment(rawText);

        if (clean) {
          onMessagesChange(prev => [...prev,
          { id: Date.now().toString(), sender: 'ai', text: clean, timestamp: Date.now() },
          ]);
        }

        if (comment && feedbackSlot === 'evening') {
          saveDailyComment(comment).catch(() => { });
        }

        markFeedbackDone();
      } catch {
        if (!cancelled) {
          onMessagesChange(prev => [...prev,
          { id: 'err-' + Date.now(), sender: 'ai', text: t.coach.errorStart, timestamp: Date.now() },
          ]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, pendingDirective]);

  // 코칭 토픽 선택 시 AI 첫 메시지 자동 전송
  useEffect(() => {
    if (!isOpen || !selectedTopic?.topicDirective || isLoading) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const goalCtx = buildGoalContext(nodes || [], language);
        const todoCtx = buildTodoContext(todos, language);
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!inputText.trim() && !pendingImage) return;
    setShowTopicCards(false);
    const imageToSend = pendingImage;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText || (imageToSend ? '📷 이미지' : ''),
      timestamp: Date.now(),
      ...(imageToSend && { imageDataUrl: imageToSend }),
    };
    onMessagesChange(prev => [...prev, userMsg]);
    setInputText('');
    setPendingImage(null);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
      const goalCtx = buildGoalContext(nodes || [], language);
      const todoCtx = buildTodoContext(todos, language);

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
        undefined,
        imageToSend || undefined,
      );

      const rawText = response.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        .filter(Boolean)
        .join('') || '';

      const { clean, comment } = extractComment(rawText);

      if (clean) {
        onMessagesChange(prev => [
          ...prev,
          { id: Date.now().toString(), sender: 'ai', text: clean, timestamp: Date.now() },
        ]);
      }

      if (comment && feedbackSlot === 'evening') {
        saveDailyComment(comment).catch(() => { });
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
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-[60] bg-th-base flex flex-col overflow-hidden text-th-text font-body"
      style={effectiveKeyboardHeight > 0 ? { height: `calc(100% - ${effectiveKeyboardHeight}px)` } : undefined}
    >

      {/* Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-th-accent-muted rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-700/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="h-11 md:h-14 border-b border-th-border/5 flex items-center justify-between px-3 md:px-6 bg-th-base/40 backdrop-blur-3xl shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 md:w-9 md:h-9 bg-th-accent/15 rounded-[8px] md:rounded-[11px] flex items-center justify-center border border-th-accent/20">
            <MessageCircle className="text-th-accent w-3.5 h-3.5 md:w-5 md:h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-[14px] md:text-base font-display font-bold tracking-tight text-th-text leading-none">{t.coach.title}</h1>
            <p className="text-[8px] md:text-[9.5px] text-th-text-tertiary font-body font-extrabold mt-0.5 uppercase tracking-widest opacity-60">
              {t.coach.coachingStatus.replace('{tab}', tabLabels[activeTab])}
            </p>
          </div>
        </div>
        <CloseButton onClick={onClose} size="sm" className="scale-90" />
      </div>

      {/* Chat Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 scrollbar-hide relative z-10">
        <div className="max-w-2xl mx-auto py-3 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-1.5 px-2`}>
              <div className={`max-w-[75%] md:max-w-[70%] rounded-[17px] px-3.5 py-2 text-[14.5px] leading-[1.45] shadow-sm transition-all ${msg.sender === 'user'
                  ? 'bg-th-accent text-th-text-inverse dark:bg-emerald-700 dark:text-white rounded-tr-sm'
                  : 'bg-th-surface text-th-text rounded-tl-sm border border-th-border/20 backdrop-blur-md'
                }`}>
                {msg.imageDataUrl && (
                  <img src={msg.imageDataUrl} alt="" className="max-w-full rounded-lg mb-1.5" />
                )}
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
              <div className="bg-th-surface border border-th-border rounded-xl rounded-tl-sm px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse"></span>
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
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
              <div className="flex justify-start px-2 mt-1">
                <div className="max-w-[85%] md:max-w-[75%] rounded-[20px] rounded-tl-sm bg-th-surface border border-th-border/20 shadow-xl backdrop-blur-xl px-5 py-4">
                  <p className="text-[13.5px] md:text-[14px] text-th-text font-bold tracking-tight leading-relaxed mb-3">
                    {t.coach.selectQuestion}
                  </p>
                  <div className="space-y-2">
                    {pageQuestions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => handleTopicSelect(q)}
                        className="w-full text-left px-3.5 py-3 rounded-xl bg-th-base/40 border border-th-border/5 hover:border-th-accent-border/30 hover:bg-th-surface-hover hover:scale-[1.005] active:scale-[0.985] transition-all duration-300 group shadow-sm"
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
                          className={`w-2 h-2 rounded-full transition-all ${i === questionPage
                            ? 'bg-th-accent w-4 shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                            : 'bg-th-text-tertiary/40 hover:bg-th-accent/40'
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
      <div
        className="shrink-0 px-3 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 flex justify-center z-20 bg-th-base border-t border-th-border"
      >
        <div className="w-full max-w-2xl">
          {/* 이미지 미리보기 */}
          {pendingImage && (
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <div className="relative">
                <img src={pendingImage} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-th-border" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <X size={10} className="text-white" />
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-2 text-th-text-tertiary hover:text-th-accent transition-colors"
              aria-label="이미지 첨부"
            >
              <Plus size={20} />
            </button>
            <div className="flex-1 flex items-center bg-th-elevated/50 backdrop-blur-lg border border-th-border/30 rounded-full shadow-inner-sm overflow-hidden transition-all duration-300 focus-within:border-th-accent/50 focus-within:bg-th-elevated">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                onFocus={() => { setTimeout(() => scrollToBottom(), 300); setTimeout(() => scrollToBottom(), 600); }}
                placeholder={t.coach.placeholder}
                className="w-full bg-transparent border-none py-3.5 px-6 text-[15px] text-th-text placeholder:text-th-text-tertiary focus:outline-none focus:ring-0"
                aria-label={t.coach.sendMessage}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() && !pendingImage}
              className="shrink-0 w-11 h-11 bg-th-accent rounded-full text-th-text-inverse flex items-center justify-center hover:brightness-110 active:scale-90 transition-all shadow-lg shadow-th-accent/20 disabled:opacity-0 disabled:scale-95"
              aria-label={t.coach.sendLabel}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachChat;
