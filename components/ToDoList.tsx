import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Check, Trash2, Plus, ListTodo, Circle, CheckCircle2, Target, Bell, Repeat, Sun, ArrowLeft, ArrowUp, ChevronRight, ChevronDown, Layout, X, Calendar, Star, CalendarDays, Home, Menu, GripVertical } from 'lucide-react';
import { ToDoItem, TodoList, TodoGroup, TodoStep, SmartListId, RepeatFrequency, UserPrinciple } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useTranslation } from '../i18n/useTranslation';
import TodoSidebar from './todo/TodoSidebar';
import CreateListModal from './todo/CreateListModal';
import CreateGroupModal from './todo/CreateGroupModal';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// === Extracted outside ToDoList to avoid React 19 hooks identity issue ===
interface SortableTodoItemProps {
  id: string;
  isSelected: boolean;
  isCompleted: boolean;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

const SortableTodoItem: React.FC<SortableTodoItemProps> = ({ id, isSelected, isCompleted, onSelect, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const cardClass = `apple-card group flex items-center gap-2.5 py-2.5 px-3 mx-2 mb-1.5 rounded-lg cursor-pointer transition-all duration-150 ${isSelected
    ? 'bg-th-surface border-th-accent ring-1 ring-th-accent/30'
    : (isCompleted ? 'bg-th-surface/30 opacity-50' : 'bg-th-surface/50 hover:bg-th-surface')
    }`;
  return (
    <div ref={setNodeRef} style={style} {...attributes} onClick={() => onSelect(id)} className={cardClass}>
      {!isCompleted && (
        <div {...listeners} className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 touch-none opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={16} />
        </div>
      )}
      {children}
    </div>
  );
};

// --- Steps (subtasks) sub-component ---
const StepsSection: React.FC<{
  steps: TodoStep[];
  onUpdate: (steps: TodoStep[]) => void;
  language: string;
}> = ({ steps, onUpdate, language }) => {
  const [newStepText, setNewStepText] = useState('');

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    onUpdate([...steps, { id: crypto.randomUUID(), text, completed: false }]);
    setNewStepText('');
  };

  const toggleStep = (stepId: string) => {
    onUpdate(steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s)));
  };

  const deleteStep = (stepId: string) => {
    onUpdate(steps.filter((s) => s.id !== stepId));
  };

  const label = language === 'ko' ? '단계 추가' : 'Add step';
  const done = steps.filter((s) => s.completed).length;

  return (
    <div className="space-y-1.5">
      {steps.length > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-th-border overflow-hidden">
            <div
              className="h-full rounded-full bg-th-accent transition-all"
              style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[11px] text-th-text-tertiary font-mono">{done}/{steps.length}</span>
        </div>
      )}

      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 group px-1">
          <button onClick={() => toggleStep(step.id)} className="flex-shrink-0">
            {step.completed
              ? <CheckCircle2 size={16} className="text-th-accent" />
              : <Circle size={16} className="text-th-text-tertiary" />}
          </button>
          <span className={`flex-1 text-sm ${step.completed ? 'line-through text-th-text-tertiary' : 'text-th-text'}`}>
            {step.text}
          </span>
          <button
            onClick={() => deleteStep(step.id)}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-th-text-tertiary hover:text-red-400 transition-all"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 px-1">
        <Plus size={16} className="text-th-text-tertiary flex-shrink-0" />
        <input
          type="text"
          value={newStepText}
          onChange={(e) => setNewStepText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addStep(); }}
          placeholder={label}
          className="flex-1 bg-transparent text-sm text-th-text placeholder:text-th-text-tertiary focus:outline-none py-1"
        />
      </div>
    </div>
  );
};

interface ToDoListProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  todoLists: TodoList[];
  todoGroups: TodoGroup[];
  activeListId: string;
  onActiveListChange: (id: string) => void;
  onTodoListsChange: React.Dispatch<React.SetStateAction<TodoList[]>>;
  onTodoGroupsChange: React.Dispatch<React.SetStateAction<TodoGroup[]>>;
  onAddToDo: (text: string, listId?: string, extras?: Partial<ToDoItem>) => void;
  onToggleToDo: (id: string) => void;
  onDeleteToDo: (id: string) => void;
  onUpdateToDo: (id: string, updates: Partial<ToDoItem>) => void;
  onReorderTodos: (orderedIds: string[]) => void;
  principles: UserPrinciple[];
  showPrinciplesEditor: boolean;
  onClosePrinciplesEditor: () => void;
  onOpenPrinciples: () => void;
  onAddPrinciple: (text: string) => void;
  onDeletePrinciple: (id: string) => void;
  onUpdatePrinciple: (id: string, text: string) => void;
  onSetRepresentativePrinciple: (id: string) => void;
}

const ToDoList: React.FC<ToDoListProps> = ({ isOpen, onClose, todos, todoLists, todoGroups, activeListId, onActiveListChange, onTodoListsChange, onTodoGroupsChange, onAddToDo, onToggleToDo, onDeleteToDo, onUpdateToDo, onReorderTodos, principles, showPrinciplesEditor, onClosePrinciplesEditor, onOpenPrinciples, onAddPrinciple, onDeletePrinciple, onUpdatePrinciple, onSetRepresentativePrinciple }) => {
  const { t, language } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [selectedToDoId, setSelectedToDoId] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const uiText = useMemo(() => {
    if (language === 'ko') {
      return {
        smartMyDay: '오늘 할 일',
        smartImportant: '중요',
        smartPlanned: '계획된 일정',
        smartTasks: '작업',
        searchResults: '검색 결과',
        completedSection: '완료',
        createdLabel: '생성일',
        idLabel: 'ID',
      };
    }
    return {
      smartMyDay: 'My Day',
      smartImportant: 'Important',
      smartPlanned: 'Planned',
      smartTasks: 'Tasks',
      searchResults: 'Search results',
      completedSection: 'Completed',
      createdLabel: 'Created',
      idLabel: 'ID',
    };
  }, [language]);

  // Smart list definitions
  const SMART_LIST_META: Record<SmartListId, { name: string; icon: React.ReactNode; color: string }> = {
    myDay: { name: uiText.smartMyDay, icon: <Sun size={20} />, color: 'text-yellow-400' },
    important: { name: uiText.smartImportant, icon: <Star size={20} />, color: 'text-red-400' },
    planned: { name: uiText.smartPlanned, icon: <CalendarDays size={20} />, color: 'text-blue-400' },
    tasks: { name: uiText.smartTasks, icon: <Home size={20} />, color: 'text-neon-lime' },
  };

  // Filter todos based on active list or search
  const filteredTodos = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return todos.filter(t =>
        t.text.toLowerCase().includes(q) ||
        (t.note?.toLowerCase().includes(q)) ||
        (t.tags?.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    switch (activeListId) {
      case 'myDay': return todos.filter(t => !!t.isMyDay);
      case 'important': return todos.filter(t => t.priority === 'high');
      case 'planned': return todos.filter(t => t.dueDate != null);
      case 'tasks': return todos.filter(t => !t.listId || t.listId === 'tasks');
      default: return todos.filter(t => t.listId === activeListId);
    }
  }, [todos, activeListId, searchQuery]);

  // Get active list display info
  const activeListInfo = useMemo(() => {
    const smart = SMART_LIST_META[activeListId as SmartListId];
    if (smart) return smart;
    const customList = todoLists.find(l => l.id === activeListId);
    if (customList) return { name: customList.name, icon: <ListTodo size={20} />, color: `text-[${customList.color || '#5AA9FF'}]` };
    return { name: uiText.smartTasks, icon: <Home size={20} />, color: 'text-neon-lime' };
  }, [activeListId, todoLists, uiText.smartTasks]);

  // CRUD handlers
  const handleCreateList = (name: string, color: string, groupId?: string) => {
    const newList: TodoList = { id: `list_${Date.now()}`, name, color, groupId, sortOrder: todoLists.length, createdAt: Date.now() };
    onTodoListsChange(prev => [...prev, newList]);
  };

  const handleCreateGroup = (name: string) => {
    const newGroup: TodoGroup = { id: `grp_${Date.now()}`, name, isCollapsed: false, sortOrder: todoGroups.length, createdAt: Date.now() };
    onTodoGroupsChange(prev => [...prev, newGroup]);
  };

  const handleDeleteList = (id: string) => {
    onTodoListsChange(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) onActiveListChange('tasks');
  };

  const handleDeleteGroup = (id: string) => {
    onTodoGroupsChange(prev => prev.filter(g => g.id !== id));
    onTodoListsChange(prev => prev.map(l => l.groupId === id ? { ...l, groupId: undefined } : l));
  };

  const handleRenameList = (id: string) => { setEditingListId(id); setShowCreateList(true); };
  const handleRenameGroup = (id: string) => { setEditingGroupId(id); setShowCreateGroup(true); };

  const handleSaveRenamedList = (name: string, color: string, groupId?: string) => {
    if (editingListId) {
      onTodoListsChange(prev => prev.map(l => l.id === editingListId ? { ...l, name, color, groupId } : l));
      setEditingListId(null);
    } else {
      handleCreateList(name, color, groupId);
    }
  };

  const handleSaveRenamedGroup = (name: string) => {
    if (editingGroupId) {
      onTodoGroupsChange(prev => prev.map(g => g.id === editingGroupId ? { ...g, name } : g));
      setEditingGroupId(null);
    } else {
      handleCreateGroup(name);
    }
  };

  const handleToggleGroupCollapse = (id: string) => {
    onTodoGroupsChange(prev => prev.map(g => g.id === id ? { ...g, isCollapsed: !g.isCollapsed } : g));
  };

  // Mobile keyboard height via VirtualKeyboard API (overlays-content 모드)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const nav = navigator as unknown as { virtualKeyboard?: { overlaysContent: boolean; boundingRect: DOMRect; addEventListener: (e: string, fn: () => void) => void; removeEventListener: (e: string, fn: () => void) => void } };
    if (!nav.virtualKeyboard) return;
    nav.virtualKeyboard.overlaysContent = true;
    const onChange = () => setKeyboardHeight(Math.round(nav.virtualKeyboard!.boundingRect.height));
    nav.virtualKeyboard.addEventListener('geometrychange', onChange);
    return () => nav.virtualKeyboard!.removeEventListener('geometrychange', onChange);
  }, []);

  // Quick action pending states
  const [pendingDueDate, setPendingDueDate] = useState<number | null>(null);
  const [pendingReminder, setPendingReminder] = useState<number | null>(null);
  const [pendingRepeat, setPendingRepeat] = useState<RepeatFrequency>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      const isSmartList = (['myDay', 'important', 'planned', 'tasks'] as string[]).includes(activeListId);
      const listId = isSmartList ? undefined : activeListId;

      // Smart list 속성 자동 설정
      const extras: Partial<ToDoItem> = {};
      if (activeListId === 'myDay') extras.isMyDay = true;
      if (activeListId === 'important') extras.priority = 'high';

      // 퀵 액션 값 머지
      if (pendingDueDate) extras.dueDate = pendingDueDate;
      if (pendingReminder) extras.reminder = pendingReminder;
      if (pendingRepeat) extras.repeat = pendingRepeat;

      onAddToDo(inputText, listId, Object.keys(extras).length > 0 ? extras : undefined);
      setInputText('');
      setPendingDueDate(null);
      setPendingReminder(null);
      setPendingRepeat(null);
    }
  };

  // Sort: sortOrder 우선, 없으면 MyDay -> createdAt 순서
  const sortTodos = (a: ToDoItem, b: ToDoItem) => {
    if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
    if (a.sortOrder != null) return -1;
    if (b.sortOrder != null) return 1;
    if (a.isMyDay === b.isMyDay) return b.createdAt - a.createdAt;
    return a.isMyDay ? -1 : 1;
  };
  const incompleteTodos = [...filteredTodos].filter(t => !t.completed).sort(sortTodos);
  const completedTodos = [...filteredTodos].filter(t => t.completed).sort(sortTodos);

  // DnD
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const handleDragStart = useCallback((e: DragStartEvent) => setActiveDragId(e.active.id as string), []);
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = incompleteTodos.findIndex(t => t.id === active.id);
    const newIdx = incompleteTodos.findIndex(t => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(incompleteTodos, oldIdx, newIdx);
    onReorderTodos(reordered.map(t => t.id));
  }, [incompleteTodos, onReorderTodos]);
  const activeDragTodo = activeDragId ? incompleteTodos.find(t => t.id === activeDragId) : null;

  const selectedToDo = todos.find(t => t.id === selectedToDoId);
  // 카드형 기본 클래스
  const getCardClass = (todo: ToDoItem) =>
    `apple-card group flex items-center gap-2.5 py-2.5 px-3 mx-2 mb-1.5 rounded-lg cursor-pointer transition-all duration-150 ${selectedToDoId === todo.id
      ? 'bg-th-surface border-th-accent ring-1 ring-th-accent/30'
      : (todo.completed ? 'bg-th-surface/30 opacity-50' : 'bg-th-surface/50 hover:bg-th-surface')
    }`;

  // 아이템 공통 콘텐츠 (체크박스 + 텍스트 + 메타 + 삭제 + 상세)
  const renderTodoItemContent = (todo: ToDoItem) => (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleToDo(todo.id); }}
        className={`transition-colors flex-shrink-0 ${todo.completed ? 'text-th-accent' : 'text-th-text-tertiary hover:text-th-accent'}`}
      >
        {todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${todo.completed ? 'line-through text-th-text-muted' : 'text-th-text'}`}>{todo.text}</p>
        {(todo.isMyDay || todo.dueDate || todo.repeat || todo.linkedNodeText) && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {todo.isMyDay && (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                <Sun size={10} /> {uiText.smartMyDay}
              </span>
            )}
            {todo.dueDate && (
              <span className={`flex items-center gap-0.5 text-[10px] ${todo.dueDate < Date.now() && !todo.completed ? 'text-red-400' : 'text-gray-500'}`}>
                <Calendar size={10} /> {formatDate(todo.dueDate)}
              </span>
            )}
            {todo.repeat && <span className="flex items-center gap-0.5 text-[10px] text-blue-400"><Repeat size={10} /> {getRepeatLabel(todo.repeat)}</span>}
            {todo.linkedNodeText && <span className="flex items-center gap-0.5 text-[10px] text-electric-orange/80"><Target size={10} /> {todo.linkedNodeText}</span>}
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDeleteToDo(todo.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
        title={t.todo.deleteTitle}
      >
        <Trash2 size={14} />
      </button>
      <ChevronRight size={16} className={`text-gray-600 flex-shrink-0 transition-transform ${selectedToDoId === todo.id ? 'translate-x-0.5 text-neon-lime' : ''}`} />
    </>
  );

  // Non-sortable for completed items
  const renderTodoItem = (todo: ToDoItem) => (
    <div key={todo.id} onClick={() => setSelectedToDoId(todo.id)} className={getCardClass(todo)}>
      {renderTodoItemContent(todo)}
    </div>
  );

  // Date Format Helpers
  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return null;
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    return new Date(timestamp).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatTime = (timestamp?: number | null) => {
    if (!timestamp) return null;
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    return new Date(timestamp).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRepeatLabel = (freq: RepeatFrequency | undefined) => {
    if (!freq) return null;
    return t.todo.repeatOptions[freq] || freq;
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="apple-tab-shell fixed inset-0 z-50 pb-16 flex flex-row overflow-hidden text-th-text font-body">

      {/* Ambient Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-th-accent-muted rounded-full blur-[120px] pointer-events-none opacity-20"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none opacity-20"></div>

      {/* === SIDEBAR NAVIGATION === */}
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-th-overlay/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 w-[260px] z-40 pb-16 md:pb-0 md:relative md:z-10 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <TodoSidebar
          todos={todos}
          lists={todoLists}
          groups={todoGroups}
          activeListId={activeListId}
          searchQuery={searchQuery}
          principles={principles}
          showPrinciplesEditor={showPrinciplesEditor}
          onSelectList={(id) => { onActiveListChange(id); setIsSidebarOpen(false); if (showPrinciplesEditor) onClosePrinciplesEditor(); }}
          onSearchChange={setSearchQuery}
          onCreateList={() => { setEditingListId(null); setShowCreateList(true); }}
          onCreateGroup={() => { setEditingGroupId(null); setShowCreateGroup(true); }}
          onDeleteList={handleDeleteList}
          onDeleteGroup={handleDeleteGroup}
          onRenameList={handleRenameList}
          onRenameGroup={handleRenameGroup}
          onToggleGroupCollapse={handleToggleGroupCollapse}
          onOpenPrinciples={() => { onOpenPrinciples(); setIsSidebarOpen(false); }}
        />
      </div>

      {/* === LEFT MAIN AREA (LIST) === */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* Header */}
        <div className="apple-glass-header h-11 md:h-12 flex items-center justify-between px-3 md:px-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-colors">
              <Menu size={18} />
            </button>
            {showPrinciplesEditor ? (
              <div className="p-1.5 rounded-lg bg-th-accent-muted">
                <span className="text-th-accent text-sm font-bold">✦</span>
              </div>
            ) : (
              <div className={`p-1.5 rounded-lg ${activeListId === 'myDay' ? 'bg-yellow-400/10' : activeListId === 'important' ? 'bg-red-400/10' : activeListId === 'planned' ? 'bg-blue-400/10' : 'bg-th-accent-muted'}`}>
                <span className={activeListInfo.color}>{activeListInfo.icon}</span>
              </div>
            )}
            <div>
              <h1 className="text-base md:text-lg font-display font-bold tracking-wider text-th-text">
                {showPrinciplesEditor
                  ? (language === 'ko' ? '이것만지켜줘!' : 'My Principles')
                  : (searchQuery ? uiText.searchResults : activeListInfo.name)}
              </h1>
            </div>
          </div>
        </div>

        {/* === PRINCIPLES FULL VIEW === */}
        {showPrinciplesEditor ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 scrollbar-hide">
              {principles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-5">
                  <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-th-accent/20 to-th-accent/5
                    flex items-center justify-center shadow-lg shadow-th-accent/5 ring-1 ring-th-accent/10">
                    <span className="text-4xl">✦</span>
                  </div>
                  <div className="text-center space-y-1.5">
                    <p className="text-lg font-bold text-th-text">
                      {language === 'ko' ? '나만의 원칙 만들기' : 'Create Your Principles'}
                    </p>
                    <p className="text-sm text-th-text-tertiary leading-relaxed max-w-[240px] mx-auto">
                      {language === 'ko'
                        ? '매일 지킬 나만의 원칙을 적어보세요.'
                        : 'Write principles to live by.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* 원칙 리스트 */}
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-th-text-tertiary px-1 pt-1">
                    {language === 'ko'
                      ? `전체 원칙 · ${principles.length}개`
                      : `All Principles · ${principles.length}`}
                  </p>
                  {principles.map((p, idx) => (
                    <div
                      key={p.id}
                      className="group rounded-2xl bg-th-surface/40 px-4 py-3.5 flex items-center gap-3.5
                        ring-1 ring-white/[0.04] hover:ring-th-accent/25 hover:bg-th-surface/60
                        transition-all duration-200"
                    >
                      <button
                        onClick={() => onSetRepresentativePrinciple(p.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          p.isRepresentative
                            ? 'bg-th-accent-muted text-th-accent shadow-[0_0_10px_var(--shadow-glow)]'
                            : 'bg-th-surface text-th-text-tertiary hover:text-th-accent'
                        }`}
                        title={language === 'ko' ? '대표 원칙으로 설정' : 'Set as representative principle'}
                      >
                        {p.isRepresentative ? <Star size={15} fill="currentColor" /> : <span className="text-[11px] font-bold tabular-nums">{idx + 1}</span>}
                      </button>
                      <input
                        type="text"
                        value={p.text}
                        onChange={(e) => onUpdatePrinciple(p.id, e.target.value)}
                        className="flex-1 bg-transparent text-[15px] text-th-text focus:outline-none
                          placeholder:text-th-text-tertiary min-w-0 font-medium"
                      />
                      <button
                        onClick={() => onDeletePrinciple(p.id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5
                          text-th-text-tertiary hover:text-red-400 hover:bg-red-400/10
                          rounded-lg transition-all duration-200"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Add principle input */}
            <div className="-mt-1 px-4 pt-2.5 pb-3.5 flex-shrink-0 bg-transparent">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem('principleInput') as HTMLInputElement;
                  const text = input.value.trim();
                  if (!text) return;
                  onAddPrinciple(text);
                  input.value = '';
                }}
                className="flex items-center gap-3 rounded-xl bg-th-surface/50 ring-1 ring-white/[0.06]
                  px-3.5 py-2.5 focus-within:ring-th-accent/30 transition-all"
              >
                <Plus size={18} className="text-th-accent flex-shrink-0" />
                <input
                  name="principleInput"
                  type="text"
                  placeholder={language === 'ko' ? '새로운 원칙 추가하기...' : 'Add a new principle...'}
                  className="flex-1 bg-transparent text-sm text-th-text
                    placeholder-th-text-tertiary focus:outline-none"
                  autoFocus
                />
              </form>
            </div>
          </>
        ) : (
        <>
        {/* List Content */}
        <div className="flex-1 overflow-y-auto px-0 pt-1 scrollbar-hide">
          <div className="max-w-4xl mx-auto">
            {incompleteTodos.length === 0 && completedTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-th-text-tertiary space-y-4">
                <div className="w-20 h-20 rounded-full bg-th-surface border border-th-border/10 flex items-center justify-center shadow-sm">
                  <Target size={36} className="text-th-accent opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-th-text-secondary">{t.todo.empty}</p>
                  <p className="text-sm mt-1 text-th-text-tertiary">{t.todo.emptyHint}</p>
                </div>
              </div>
            ) : (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={incompleteTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {incompleteTodos.map(todo => (
                      <SortableTodoItem key={todo.id} id={todo.id} isSelected={selectedToDoId === todo.id} isCompleted={todo.completed} onSelect={setSelectedToDoId}>
                        {renderTodoItemContent(todo)}
                      </SortableTodoItem>
                    ))}
                  </SortableContext>
                  <DragOverlay>
                    {activeDragTodo && (
                      <div className={`${getCardClass(activeDragTodo)} shadow-lg shadow-black/20 ring-1 ring-th-accent/40`}>
                        {renderTodoItemContent(activeDragTodo)}
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>

                {/* Completed section */}
                {completedTodos.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowCompleted(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2.5 w-full text-left text-sm text-th-text-tertiary hover:text-th-text-secondary transition-colors font-medium border-t border-th-border/20"
                    >
                      {showCompleted
                        ? <ChevronDown size={16} className="flex-shrink-0" />
                        : <ChevronRight size={16} className="flex-shrink-0" />
                      }
                      <span>{uiText.completedSection}</span>
                      <span className="text-[11px] bg-th-surface border border-th-border px-1.5 py-0.5 rounded-full font-mono font-bold">{completedTodos.length}</span>
                    </button>
                    {showCompleted && completedTodos.map(todo => renderTodoItem(todo))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Add task input + quick actions */}
        <div
          className="apple-glass-header flex flex-col border-t border-th-border flex-shrink-0"
          style={keyboardHeight > 0 ? { position: 'fixed', bottom: `${keyboardHeight}px`, left: 0, right: 0, zIndex: 60 } : undefined}
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-3 py-3.5 px-4 min-h-[56px]">
            <Plus size={22} className="text-th-accent flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Escape') { inputRef.current?.blur(); setInputText(''); } }}
              placeholder={t.todo.addLabel}
              className="flex-1 bg-transparent text-[15px] leading-[1.45] text-th-text placeholder-th-text-tertiary focus:outline-none"
              aria-label={t.todo.inputLabel}
            />
            {inputText.trim() && (
              <button
                type="submit"
                className="w-8 h-8 rounded-full bg-th-accent flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95"
                aria-label={t.todo.addLabel}
              >
                <ArrowUp size={18} className="text-th-text-inverse" />
              </button>
            )}
          </form>

          {/* Quick action buttons */}
          {(isInputFocused || inputText) && (
            <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border shadow-sm ${pendingDueDate ? 'bg-th-accent-muted border-th-accent-border text-th-accent font-bold scale-[1.02]' : 'bg-th-surface border-th-border text-th-text-tertiary hover:bg-th-surface-hover hover:text-th-text'}`}>
                <Calendar size={13} />
                <span>{pendingDueDate ? formatDate(pendingDueDate) : t.todo.dueDate}</span>
                <input type="date" className="absolute opacity-0 w-0 h-0" onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) setPendingDueDate(d.getTime());
                }} />
                {pendingDueDate && <button type="button" onClick={(e) => { e.preventDefault(); setPendingDueDate(null); }} className="ml-0.5 hover:text-red-500 transition-colors"><X size={12} /></button>}
              </label>

              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border shadow-sm ${pendingReminder ? 'bg-electric-orange/10 border-electric-orange/30 text-electric-orange font-bold scale-[1.02]' : 'bg-th-surface border-th-border text-th-text-tertiary hover:bg-th-surface-hover hover:text-th-text'}`}>
                <Bell size={13} />
                <span>{pendingReminder ? `${formatDate(pendingReminder)} ${formatTime(pendingReminder)}` : t.todo.reminder}</span>
                <input type="datetime-local" className="absolute opacity-0 w-0 h-0" onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) setPendingReminder(d.getTime());
                }} />
                {pendingReminder && <button type="button" onClick={(e) => { e.preventDefault(); setPendingReminder(null); }} className="ml-0.5 hover:text-red-500 transition-colors"><X size={12} /></button>}
              </label>

              <label className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-all border shadow-sm ${pendingRepeat ? 'bg-th-accent-muted border-th-accent-border text-th-accent font-bold scale-[1.02]' : 'bg-th-surface border-th-border text-th-text-tertiary hover:bg-th-surface-hover hover:text-th-text'}`}>
                <Repeat size={13} />
                <span>{pendingRepeat ? getRepeatLabel(pendingRepeat) : t.todo.repeatLabel}</span>
                <select className="absolute inset-0 opacity-0 cursor-pointer" value={pendingRepeat || ''} onChange={(e) => setPendingRepeat((e.target.value || null) as RepeatFrequency)}>
                  <option value="">{t.todo.repeatOptions.none}</option>
                  <option value="daily">{t.todo.repeatOptions.daily}</option>
                  <option value="weekdays">{t.todo.repeatOptions.weekdays}</option>
                  <option value="weekly">{t.todo.repeatOptions.weekly}</option>
                  <option value="monthly">{t.todo.repeatOptions.monthly}</option>
                </select>
                {pendingRepeat && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingRepeat(null); }} className="ml-0.5 hover:text-red-500 transition-colors"><X size={12} /></button>}
              </label>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* === RIGHT DETAIL AREA (SIDEBAR) === */}
      {selectedToDoId && (
        <div
          className="fixed inset-0 bg-th-overlay/60 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setSelectedToDoId(null)}
        />
      )}
      <div
        className={`apple-glass-panel fixed inset-y-0 right-0 w-full md:w-[380px] border-l border-th-border shadow-[-20px_0_50px_rgba(0,0,0,0.15)] z-20 transform transition-transform duration-300 ease-out flex flex-col ${selectedToDoId ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedToDo ? (
          <>
            {/* Detail Header */}
            <div className="apple-glass-header py-3 px-4 flex items-center justify-between border-b border-th-border/20">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedToDoId(null)} className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-all">
                  <ArrowLeft size={18} />
                </button>
                <h3 className="text-th-text-tertiary font-bold text-xs tracking-wider flex items-center gap-2 uppercase">
                  <Layout size={14} /> {t.todo.detail}
                </h3>
              </div>
              <button onClick={() => setSelectedToDoId(null)} className="text-th-text-tertiary hover:text-red-500 transition-colors p-1.5 hover:bg-red-500/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title Edit */}
              <div className="bg-th-surface/50 rounded-xl p-3 flex items-start gap-3 ring-1 ring-th-border focus-within:ring-th-accent/50 transition-all">
                <button
                  onClick={() => onToggleToDo(selectedToDo.id)}
                  className={`mt-1 transition-colors flex-shrink-0 ${selectedToDo.completed ? 'text-th-accent' : 'text-th-text-tertiary hover:text-th-text'}`}
                >
                  {selectedToDo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <textarea
                  value={selectedToDo.text}
                  onChange={(e) => onUpdateToDo(selectedToDo.id, { text: e.target.value })}
                  className="bg-transparent text-base font-semibold text-th-text w-full focus:outline-none resize-none h-auto min-h-[2rem]"
                  rows={2}
                />
              </div>

              {/* Steps / Subtasks */}
              <StepsSection
                steps={selectedToDo.steps ?? []}
                onUpdate={(steps) => onUpdateToDo(selectedToDo.id, { steps })}
                language={language}
              />

              {/* Action Toggles */}
              <div className="space-y-2">
                <div
                  className={`py-2.5 px-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all border shadow-sm ${selectedToDo.isMyDay ? 'bg-yellow-400/5 border-yellow-400/30 text-yellow-600 dark:text-yellow-400 font-bold' : 'bg-th-surface border-th-border text-th-text-secondary hover:bg-th-surface-hover hover:text-th-text'}`}
                  onClick={() => onUpdateToDo(selectedToDo.id, { isMyDay: !selectedToDo.isMyDay })}
                >
                  <Sun size={16} />
                  <span className="text-sm font-medium flex-1">{t.todo.myDay}</span>
                  {selectedToDo.isMyDay && <Check size={14} />}
                </div>
              </div>

              {/* Metadata Group */}
              <div className="bg-th-surface rounded-xl overflow-hidden border border-th-border divide-y divide-th-border/20 shadow-sm">

                {/* Reminder */}
                <div className="py-3 px-3.5 flex items-center gap-3 hover:bg-th-surface-hover relative group transition-colors">
                  <Bell size={16} className={selectedToDo.reminder ? 'text-electric-orange' : 'text-th-text-tertiary'} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-th-text-secondary">{t.todo.reminder}</p>
                    {selectedToDo.reminder && <p className="text-xs text-electric-orange mt-0.5 font-semibold">{formatDate(selectedToDo.reminder)} {formatTime(selectedToDo.reminder)}</p>}
                  </div>
                  <input
                    type="datetime-local"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (!isNaN(date.getTime())) onUpdateToDo(selectedToDo.id, { reminder: date.getTime() });
                    }}
                  />
                  {selectedToDo.reminder && <button onClick={() => onUpdateToDo(selectedToDo.id, { reminder: null })} className="p-1 hover:text-red-500 text-th-text-tertiary hover:bg-red-500/10 rounded transition-colors z-10"><X size={14} /></button>}
                </div>

                {/* Due Date */}
                <div className="py-3 px-3.5 flex items-center gap-3 hover:bg-th-surface-hover relative group transition-colors">
                  <Calendar size={16} className={selectedToDo.dueDate ? 'text-th-accent' : 'text-th-text-tertiary'} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-th-text-secondary">{t.todo.dueDate}</p>
                    {selectedToDo.dueDate && <p className="text-xs text-th-accent mt-0.5 font-semibold">{formatDate(selectedToDo.dueDate)}</p>}
                  </div>
                  <input
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      if (!isNaN(date.getTime())) onUpdateToDo(selectedToDo.id, { dueDate: date.getTime() });
                    }}
                  />
                  {selectedToDo.dueDate && <button onClick={() => onUpdateToDo(selectedToDo.id, { dueDate: null })} className="p-1 hover:text-red-500 text-th-text-tertiary hover:bg-red-500/10 rounded transition-colors z-10"><X size={14} /></button>}
                </div>

                {/* Repeat */}
                <div className="py-3 px-3.5 flex items-center gap-3 hover:bg-th-surface-hover relative group transition-colors">
                  <Repeat size={16} className={selectedToDo.repeat ? 'text-blue-500 dark:text-blue-400' : 'text-th-text-tertiary'} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-th-text-secondary">{t.todo.repeatLabel}</p>
                    {selectedToDo.repeat && <p className="text-xs text-blue-500 dark:text-blue-400 capitalize mt-0.5 font-semibold">{getRepeatLabel(selectedToDo.repeat)}</p>}
                  </div>
                  <select
                    value={selectedToDo.repeat || ''}
                    onChange={(e) => onUpdateToDo(selectedToDo.id, { repeat: e.target.value as RepeatFrequency || null })}
                    className="absolute inset-0 opacity-0 cursor-pointer bg-th-base text-th-text"
                  >
                    <option value="">{t.todo.repeatOptions.none}</option>
                    <option value="daily">{t.todo.repeatOptions.daily}</option>
                    <option value="weekdays">{t.todo.repeatOptions.weekdays}</option>
                    <option value="weekly">{t.todo.repeatOptions.weekly}</option>
                    <option value="weekly-2">{t.todo.repeatOptions['weekly-2']}</option>
                    <option value="weekly-3">{t.todo.repeatOptions['weekly-3']}</option>
                    <option value="weekly-4">{t.todo.repeatOptions['weekly-4']}</option>
                    <option value="weekly-5">{t.todo.repeatOptions['weekly-5']}</option>
                    <option value="weekly-6">{t.todo.repeatOptions['weekly-6']}</option>
                    <option value="monthly">{t.todo.repeatOptions.monthly}</option>
                  </select>
                  {selectedToDo.repeat && <button onClick={() => onUpdateToDo(selectedToDo.id, { repeat: null })} className="p-1 hover:text-red-500 text-th-text-tertiary hover:bg-red-500/10 rounded transition-colors z-10"><X size={14} /></button>}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-th-surface rounded-xl p-3 h-36 border border-th-border focus-within:border-th-accent-border focus-within:ring-1 focus-within:ring-th-accent/20 transition-all flex flex-col shadow-sm">
                <textarea
                  placeholder={t.todo.notePlaceholder}
                  value={selectedToDo.note || ''}
                  onChange={(e) => onUpdateToDo(selectedToDo.id, { note: e.target.value })}
                  className="w-full h-full bg-transparent text-sm text-th-text-secondary resize-none focus:outline-none placeholder:text-th-text-tertiary font-medium"
                />
              </div>

              <div className="text-xs text-gray-600 text-center font-mono">
                {uiText.createdLabel}: {new Date(selectedToDo.createdAt).toLocaleString(
                  language === 'ko' ? 'ko-KR' : 'en-US'
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="py-3 px-4 border-t border-th-border flex justify-between items-center bg-th-header/30">
              <div className="text-[10px] text-th-text-tertiary font-mono">
                {uiText.idLabel}: {selectedToDo.id.slice(-6).toUpperCase()}
              </div>
              <button
                onClick={() => { onDeleteToDo(selectedToDo.id); setSelectedToDoId(null); }}
                className="text-th-text-tertiary hover:text-red-500 transition-colors flex items-center gap-2 hover:bg-red-500/10 px-3 py-2 rounded-lg"
              >
                <Trash2 size={16} />
                <span className="text-sm font-bold uppercase tracking-tight">{t.todo.deleteTitle}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            {t.todo.noSelection}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateListModal
        isOpen={showCreateList}
        onClose={() => { setShowCreateList(false); setEditingListId(null); }}
        onSave={handleSaveRenamedList}
        groups={todoGroups}
        initialName={editingListId ? todoLists.find(l => l.id === editingListId)?.name : ''}
        initialColor={editingListId ? todoLists.find(l => l.id === editingListId)?.color : '#5AA9FF'}
        initialGroupId={editingListId ? todoLists.find(l => l.id === editingListId)?.groupId : undefined}
      />
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => { setShowCreateGroup(false); setEditingGroupId(null); }}
        onSave={handleSaveRenamedGroup}
        initialName={editingGroupId ? todoGroups.find(g => g.id === editingGroupId)?.name : ''}
      />
    </div>
  );
};

export default ToDoList;

