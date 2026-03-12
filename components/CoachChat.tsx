import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, GoalNode, UserProfile, ToDoItem } from '../types';
import { sendChatMessage } from '../services/aiService';
import { saveFeedbackCard } from '../services/firebaseService';
import { Send, MessageCircle, Sparkles, Plus, X } from 'lucide-react';
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

type CoachTodoActionType = 'add' | 'remove' | 'postpone' | 'complete' | 'update';

interface CoachTodoAction {
  type: CoachTodoActionType;
  text?: string;
  newText?: string;
  days?: number;
  dueDate?: string;
}

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
  alarmSlot?: 'morning' | 'evening' | null;
  onAlarmSlotConsumed?: () => void;
  onAddTodoFromCoach?: (text: string, extras?: Partial<ToDoItem>) => void;
  onUpdateTodoFromCoach?: (id: string, updates: Partial<ToDoItem>) => void;
  onDeleteTodoFromCoach?: (id: string) => void;
}

const QUESTIONS_PER_PAGE = 3;

const CoachChat: React.FC<CoachChatProps> = ({
  isOpen,
  onClose,
  selectedNode,
  nodes,
  userProfile,
  userId,
  todos,
  onOpenVisualization,
  messages,
  onMessagesChange,
  activeTab,
  alarmSlot = null,
  onAlarmSlotConsumed,
  onAddTodoFromCoach,
  onUpdateTodoFromCoach,
  onDeleteTodoFromCoach,
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
  const [pendingTodoActions, setPendingTodoActions] = useState<CoachTodoAction[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  const memory = useCoachMemory(userId, isOpen, nodes || [], todos, language);
  const { pendingDirective, feedbackSlot, markFeedbackDone } =
    useCoachFeedback(isOpen, todos, language, alarmSlot);

  const effectiveKeyboardHeight = Math.max(keyboardHeight, viewportKeyboardInset);

  const tabLabels: Record<TabType, string> = {
    GOALS: t.coach.tabLabels.GOALS,
    CALENDAR: t.coach.tabLabels.CALENDAR,
    TODO: t.coach.tabLabels.TODO,
    VISUALIZE: t.coach.tabLabels.VISUALIZE,
    FEEDBACK: t.coach.tabLabels.FEEDBACK,
  };

  const getTodoActionDirective = useCallback(() => {
    if (language === 'ko') {
      return `사용자의 마지막 입력에 할일 변경 의도가 있으면 응답 끝에 반드시 아래 주석을 붙이세요.
<!-- TODO_ACTIONS: [{"type":"add|remove|postpone|complete|update","text":"대상 할일","newText":"수정 텍스트(선택)","days":1,"dueDate":"today|tomorrow|YYYY-MM-DD(선택)"}] -->
의도가 없으면 빈 배열 []을 넣으세요.`;
    }

    return `If the user's last input implies todo changes, append this at the end:
<!-- TODO_ACTIONS: [{"type":"add|remove|postpone|complete|update","text":"target todo","newText":"optional new text","days":1,"dueDate":"today|tomorrow|YYYY-MM-DD"}] -->
If no todo change intent exists, return an empty list [].`;
  }, [language]);

  const extractResponseMeta = useCallback((text: string) => {
    const commentMatch = text.match(/<!-- COMMENT:\s*([\s\S]*?)-->/);
    const actionsMatch = text.match(/<!-- TODO_ACTIONS:\s*([\s\S]*?)-->/);

    let actions: CoachTodoAction[] = [];
    if (actionsMatch?.[1]) {
      try {
        const parsed = JSON.parse(actionsMatch[1]);
        if (Array.isArray(parsed)) {
          actions = parsed
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
              type: String((item as Record<string, unknown>).type || '') as CoachTodoActionType,
              text: typeof (item as Record<string, unknown>).text === 'string'
                ? (item as Record<string, unknown>).text as string
                : undefined,
              newText: typeof (item as Record<string, unknown>).newText === 'string'
                ? (item as Record<string, unknown>).newText as string
                : undefined,
              days: typeof (item as Record<string, unknown>).days === 'number'
                ? (item as Record<string, unknown>).days as number
                : undefined,
              dueDate: typeof (item as Record<string, unknown>).dueDate === 'string'
                ? (item as Record<string, unknown>).dueDate as string
                : undefined,
            }))
            .filter((item) => (
              item.type === 'add'
              || item.type === 'remove'
              || item.type === 'postpone'
              || item.type === 'complete'
              || item.type === 'update'
            ));
        }
      } catch {
        actions = [];
      }
    }

    const clean = text
      .replace(/\s*<!-- COMMENT:[\s\S]*?-->/g, '')
      .replace(/\s*<!-- TODO_ACTIONS:[\s\S]*?-->/g, '')
      .trim();

    return {
      clean,
      comment: commentMatch?.[1]?.trim() || null,
      actions,
    };
  }, []);

  const saveDailyComment = useCallback(async (comment: string) => {
    if (!userId) return;

    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const completed = todos.filter((todo) => todo.completed).map((todo) => todo.text);
    const incomplete = todos.filter((todo) => !todo.completed).map((todo) => todo.text);

    await saveFeedbackCard(userId, {
      date: dateKey,
      completedTodos: completed,
      incompleteTodos: incomplete,
      coachComment: comment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, [userId, todos]);

  const findTodoByText = useCallback((text: string): ToDoItem | null => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return null;

    const exact = todos.find((todo) => todo.text.trim().toLowerCase() === normalized);
    if (exact) return exact;

    const partial = todos.filter((todo) => todo.text.trim().toLowerCase().includes(normalized));
    return partial.length === 1 ? partial[0] : null;
  }, [todos]);

  const describeAction = useCallback((action: CoachTodoAction): string => {
    const target = action.text || '';

    if (language === 'ko') {
      if (action.type === 'add') return `추가: ${target}`;
      if (action.type === 'remove') return `삭제: ${target}`;
      if (action.type === 'postpone') return `미루기(${action.days || 1}일): ${target}`;
      if (action.type === 'complete') return `완료 처리: ${target}`;
      return `수정: ${target} -> ${action.newText || ''}`;
    }

    if (action.type === 'add') return `Add: ${target}`;
    if (action.type === 'remove') return `Remove: ${target}`;
    if (action.type === 'postpone') return `Postpone (${action.days || 1}d): ${target}`;
    if (action.type === 'complete') return `Complete: ${target}`;
    return `Update: ${target} -> ${action.newText || ''}`;
  }, [language]);

  const applyTodoActions = useCallback(() => {
    if (!pendingTodoActions.length) return;

    let applied = 0;

    for (const action of pendingTodoActions) {
      if (action.type === 'add') {
        if (!action.text || !onAddTodoFromCoach) continue;

        const dueDate = action.dueDate === 'today'
          ? new Date().setHours(23, 59, 59, 999)
          : action.dueDate === 'tomorrow'
            ? (() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              d.setHours(23, 59, 59, 999);
              return d.getTime();
            })()
            : action.dueDate
              ? (() => {
                const parsed = new Date(action.dueDate);
                return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
              })()
              : null;

        onAddTodoFromCoach(action.text, dueDate ? { dueDate } : undefined);
        applied += 1;
        continue;
      }

      if (!action.text) continue;
      const target = findTodoByText(action.text);
      if (!target) continue;

      if (action.type === 'remove' && onDeleteTodoFromCoach) {
        onDeleteTodoFromCoach(target.id);
        applied += 1;
        continue;
      }

      if (action.type === 'complete' && onUpdateTodoFromCoach) {
        onUpdateTodoFromCoach(target.id, { completed: true });
        applied += 1;
        continue;
      }

      if (action.type === 'postpone' && onUpdateTodoFromCoach) {
        const days = action.days && action.days > 0 ? action.days : 1;
        const base = target.dueDate ? new Date(target.dueDate) : new Date();
        base.setDate(base.getDate() + days);
        base.setHours(23, 59, 59, 999);
        onUpdateTodoFromCoach(target.id, { dueDate: base.getTime() });
        applied += 1;
        continue;
      }

      if (action.type === 'update' && action.newText && onUpdateTodoFromCoach) {
        onUpdateTodoFromCoach(target.id, { text: action.newText });
        applied += 1;
      }
    }

    setPendingTodoActions([]);
    if (applied <= 0) return;

    const resultText = language === 'ko'
      ? `요청한 변경 ${applied}건을 할일 목록에 반영했어요.`
      : `Applied ${applied} requested todo changes.`;

    onMessagesChange((prev) => [
      ...prev,
      { id: `sys-${Date.now()}`, sender: 'ai', text: resultText, timestamp: Date.now() },
    ]);
  }, [
    pendingTodoActions,
    onAddTodoFromCoach,
    onUpdateTodoFromCoach,
    onDeleteTodoFromCoach,
    findTodoByText,
    language,
    onMessagesChange,
  ]);

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const nav = navigator as unknown as {
      virtualKeyboard?: {
        overlaysContent: boolean;
        boundingRect: DOMRect;
        addEventListener: (e: string, fn: () => void) => void;
        removeEventListener: (e: string, fn: () => void) => void;
      };
    };

    if (!nav.virtualKeyboard) return;
    nav.virtualKeyboard.overlaysContent = true;

    const onChange = () => setKeyboardHeight(Math.round(nav.virtualKeyboard!.boundingRect.height));
    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () => nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

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

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let timers: ReturnType<typeof setTimeout>[] = [];
    let prevHeight = vv.height;

    const onResize = () => {
      const shrunk = vv.height < prevHeight;
      prevHeight = vv.height;
      if (!shrunk) return;

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, effectiveKeyboardHeight]);

  useEffect(() => {
    if (!isOpen) return;
    setShowTopicCards(true);
    setSelectedTopic(null);
    setQuestionPage(0);
    setPendingTodoActions([]);
    requestAnimationFrame(() => scrollToBottom());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !pendingDirective || isLoading || selectedTopic) return;

    let cancelled = false;
    setIsLoading(true);
    setShowTopicCards(false);

    (async () => {
      try {
        const goalCtx = buildGoalContext(nodes || [], language);
        const todoCtx = buildTodoContext(todos, language);
        const subGoalCount = (nodes || []).filter((n) => n.type !== 'ROOT').length;

        const directive = `${pendingDirective}\n\n${getTodoActionDirective()}`;
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
          directive,
        );

        if (cancelled) return;

        const rawText = response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') || '';

        const { clean, comment, actions } = extractResponseMeta(rawText);
        if (clean) {
          onMessagesChange((prev) => [
            ...prev,
            { id: Date.now().toString(), sender: 'ai', text: clean, timestamp: Date.now() },
          ]);
        }
        if (actions.length > 0) {
          setPendingTodoActions(actions);
        }

        if (feedbackSlot === 'morning') {
          markFeedbackDone();
        }

        if (comment && feedbackSlot === 'evening') {
          saveDailyComment(comment).catch(() => {});
          markFeedbackDone();
        }

        onAlarmSlotConsumed?.();
      } catch (err) {
        console.error('[CoachChat] auto-feedback failed:', err);
        if (!cancelled) {
          onMessagesChange((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, sender: 'ai', text: t.coach.errorStart, timestamp: Date.now() },
          ]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    pendingDirective,
    isLoading,
    selectedTopic,
    nodes,
    todos,
    language,
    getTodoActionDirective,
    userProfile,
    memory,
    activeTab,
    userId,
    extractResponseMeta,
    feedbackSlot,
    markFeedbackDone,
    saveDailyComment,
    onMessagesChange,
    onAlarmSlotConsumed,
  ]);

  useEffect(() => {
    if (!isOpen || !selectedTopic?.topicDirective || isLoading) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const goalCtx = buildGoalContext(nodes || [], language);
        const todoCtx = buildTodoContext(todos, language);
        const subGoalCount = (nodes || []).filter((n) => n.type !== 'ROOT').length;

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
          selectedTopic.topicDirective,
        );

        if (cancelled) return;

        const aiText = response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .filter(Boolean)
          .join('') || '';

        if (aiText) {
          onMessagesChange((prev) => [
            ...prev,
            { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now() },
          ]);
        }
      } catch {
        if (!cancelled) {
          onMessagesChange((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, sender: 'ai', text: t.coach.errorStart, timestamp: Date.now() },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setSelectedTopic(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    selectedTopic,
    isLoading,
    nodes,
    todos,
    language,
    userProfile,
    memory,
    activeTab,
    userId,
    onMessagesChange,
    t.coach.errorStart,
  ]);

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
      text: inputText || (imageToSend ? '[image]' : ''),
      timestamp: Date.now(),
      ...(imageToSend && { imageDataUrl: imageToSend }),
    };

    onMessagesChange((prev) => [...prev, userMsg]);
    setInputText('');
    setPendingImage(null);
    setIsLoading(true);

    try {
      const history = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const goalCtx = buildGoalContext(nodes || [], language);
      const todoCtx = buildTodoContext(todos, language);
      const subGoalCount = (nodes || []).filter((n) => n.type !== 'ROOT').length;

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
        getTodoActionDirective(),
        imageToSend || undefined,
      );

      const rawText = response.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join('') || '';

      const { clean, comment, actions } = extractResponseMeta(rawText);
      if (clean) {
        onMessagesChange((prev) => [
          ...prev,
          { id: Date.now().toString(), sender: 'ai', text: clean, timestamp: Date.now() },
        ]);
      }
      if (actions.length > 0) {
        setPendingTodoActions(actions);
      }

      if (comment && feedbackSlot === 'evening') {
        saveDailyComment(comment).catch(() => {});
        markFeedbackDone();
      }
    } catch {
      onMessagesChange((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, sender: 'ai', text: t.coach.errorSystem, timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const questions = getCoachingQuestions(selectedNode, nodes || []);
  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));
  const pageQuestions = questions.slice(
    questionPage * QUESTIONS_PER_PAGE,
    (questionPage + 1) * QUESTIONS_PER_PAGE,
  );

  return (
    <div
      ref={focusTrapRef}
      className="fixed inset-0 z-[60] bg-th-base flex flex-col overflow-hidden text-th-text font-body"
      style={
        effectiveKeyboardHeight > 0
          ? { height: `calc(100% - ${effectiveKeyboardHeight}px)` }
          : undefined
      }
    >
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-th-accent-muted rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-th-accent-muted rounded-full blur-[120px] pointer-events-none opacity-60" />

      <div className="h-14 md:h-20 border-b border-th-border/5 dark:border-th-border flex items-center justify-between px-4 md:px-8 bg-th-base/40 dark:bg-th-header backdrop-blur-md shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2 md:p-3 bg-th-accent/15 dark:bg-th-accent-muted rounded-lg md:rounded-xl border border-th-accent/20 dark:border-transparent">
            <MessageCircle className="text-th-accent w-5 h-5 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-th-text">
              {t.coach.title}
            </h1>
            <p className="text-[10px] text-th-accent/70 font-mono mt-0.5">
              {t.coach.coachingStatus.replace('{tab}', tabLabels[activeTab])}
            </p>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 scrollbar-hide relative z-10">
        <div className="max-w-2xl mx-auto py-3 space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-2 text-[15px] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white rounded-tr-sm'
                    : 'bg-th-surface text-th-text dark:text-gray-100 rounded-tl-sm border border-th-border/20 dark:border-th-border shadow-lg backdrop-blur-sm'
                }`}
              >
                {msg.imageDataUrl && (
                  <img src={msg.imageDataUrl} alt="" className="max-w-full rounded-lg mb-1.5" />
                )}
                <span className="whitespace-pre-wrap">
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((segment, idx) => (
                    segment.startsWith('**') && segment.endsWith('**')
                      ? <strong key={idx} className="text-th-accent font-bold">{segment.slice(2, -2)}</strong>
                      : segment
                  ))}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-th-surface border border-th-border rounded-xl rounded-tl-sm px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-th-accent rounded-full animate-pulse" />
                  <span
                    className="w-2 h-2 bg-th-accent rounded-full animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <span
                    className="w-2 h-2 bg-th-accent rounded-full animate-pulse"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              </div>
            </div>
          )}

          {pendingTodoActions.length > 0 && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-th-surface border border-th-border/30 shadow-lg px-4 py-3 space-y-2">
                <p className="text-[13px] font-semibold text-th-text-secondary">
                  {language === 'ko' ? '할일 반영 제안' : 'Todo changes suggested'}
                </p>
                <div className="space-y-1">
                  {pendingTodoActions.map((action, idx) => (
                    <p key={`todo-action-${idx}`} className="text-[13px] text-th-text-tertiary">
                      - {describeAction(action)}
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={applyTodoActions}
                    className="px-3 py-1.5 rounded-full bg-th-accent text-th-text-inverse text-[12px] font-semibold"
                  >
                    {language === 'ko' ? '반영' : 'Apply'}
                  </button>
                  <button
                    onClick={() => setPendingTodoActions([])}
                    className="px-3 py-1.5 rounded-full bg-th-surface-hover text-th-text-secondary text-[12px] font-semibold"
                  >
                    {language === 'ko' ? '취소' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && showTopicCards && questions.length > 0 && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-th-surface border border-th-border/20 shadow-lg px-4 py-3">
                <p className="text-[15px] text-th-text leading-relaxed mb-2.5">
                  {t.coach.selectQuestion}
                </p>
                <div className="space-y-2">
                  {pageQuestions.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic)}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-th-surface border border-th-border/20 hover:border-th-accent-border hover:bg-th-accent-muted transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{topic.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-th-text group-hover:text-th-accent transition-colors">
                            {topic.question}
                          </p>
                          <p className="text-xs text-th-text-tertiary mt-0.5">
                            {topic.summary}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={`question-page-${idx}`}
                        onClick={() => setQuestionPage(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === questionPage
                            ? 'bg-th-accent shadow-[0_0_4px_var(--shadow-glow)]'
                            : 'bg-th-border hover:bg-th-surface-hover'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.length === 0 && !isLoading && (!showTopicCards || questions.length === 0) && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-th-surface flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-th-accent animate-pulse" />
              </div>
              <p className="text-sm font-display uppercase tracking-widest mb-1 text-th-text-tertiary">
                {t.coach.emptyTitle}
              </p>
              <p className="text-xs text-th-text-muted max-w-xs">{t.coach.emptyDesc}</p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 flex justify-center z-20 bg-th-base border-t border-th-border">
        <div className="w-full max-w-2xl">
          {pendingImage && (
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <div className="relative">
                <img
                  src={pendingImage}
                  alt="preview"
                  className="w-14 h-14 object-cover rounded-lg border border-th-border"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-2.5 text-th-text-tertiary hover:text-th-accent transition-colors"
              aria-label="Attach image"
            >
              <Plus size={22} />
            </button>

            <div className="flex-1 flex items-center min-h-[52px] bg-th-elevated/50 dark:bg-th-elevated border border-th-border/30 dark:border-th-border rounded-[26px] shadow-lg overflow-hidden transition-colors hover:border-th-accent-border">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                onFocus={() => {
                  setTimeout(() => scrollToBottom(), 300);
                  setTimeout(() => scrollToBottom(), 600);
                }}
                placeholder={t.coach.placeholder}
                className="w-full bg-transparent border-none py-3.5 px-4 text-[15px] leading-[1.45] text-th-text placeholder-th-text-tertiary focus:outline-none focus:ring-0"
                aria-label={t.coach.sendMessage}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!inputText.trim() && !pendingImage}
              className="shrink-0 p-3 bg-th-accent rounded-full text-th-text-inverse hover:bg-white transition-all disabled:opacity-0 disabled:scale-95"
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

