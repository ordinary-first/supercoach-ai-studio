import React, { useState, useMemo } from 'react';
import { Check, Trash2, Plus, ListTodo, Circle, CheckCircle2, Target, Bell, Repeat, Sun, ArrowLeft, ChevronRight, Layout, X, Calendar, Star, CalendarDays, Home, Menu } from 'lucide-react';
import { ToDoItem, TodoList, TodoGroup, SmartListId, RepeatFrequency } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import TodoSidebar from './todo/TodoSidebar';
import CreateListModal from './todo/CreateListModal';
import CreateGroupModal from './todo/CreateGroupModal';

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
  onAddToDo: (text: string, listId?: string) => void;
  onToggleToDo: (id: string) => void;
  onDeleteToDo: (id: string) => void;
  onUpdateToDo: (id: string, updates: Partial<ToDoItem>) => void;
}

const ToDoList: React.FC<ToDoListProps> = ({ isOpen, onClose, todos, todoLists, todoGroups, activeListId, onActiveListChange, onTodoListsChange, onTodoGroupsChange, onAddToDo, onToggleToDo, onDeleteToDo, onUpdateToDo }) => {
  const [inputText, setInputText] = useState('');
  const [selectedToDoId, setSelectedToDoId] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Smart list definitions
  const SMART_LIST_META: Record<SmartListId, { name: string; icon: React.ReactNode; color: string }> = {
    myDay: { name: '오늘 할 일', icon: <Sun size={20} />, color: 'text-yellow-400' },
    important: { name: '중요', icon: <Star size={20} />, color: 'text-red-400' },
    planned: { name: '계획된 일정', icon: <CalendarDays size={20} />, color: 'text-blue-400' },
    tasks: { name: '작업', icon: <Home size={20} />, color: 'text-th-accent' },
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
    if (customList) return { name: customList.name, icon: <ListTodo size={20} />, color: `text-[${customList.color || '#CCFF00'}]` };
    return { name: '작업', icon: <Home size={20} />, color: 'text-th-accent' };
  }, [activeListId, todoLists]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      const listId = (['myDay', 'important', 'planned', 'tasks'] as string[]).includes(activeListId) ? undefined : activeListId;
      onAddToDo(inputText, listId);
      setInputText('');
    }
  };

  // Sort: MyDay first, then Incomplete first, then by creation date
  const sortedTodos = [...filteredTodos].sort((a, b) => {
      if (a.completed === b.completed) {
          if (a.isMyDay === b.isMyDay) return b.createdAt - a.createdAt;
          return a.isMyDay ? -1 : 1;
      }
      return a.completed ? 1 : -1;
  });

  const selectedToDo = todos.find(t => t.id === selectedToDoId);

  // Date Format Helpers
  const formatDate = (timestamp?: number | null) => {
      if (!timestamp) return null;
      return new Date(timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const formatTime = (timestamp?: number | null) => {
      if (!timestamp) return null;
      return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const getRepeatLabel = (freq: RepeatFrequency | undefined) => {
      if (!freq) return null;
      const labels: Record<string, string> = {
          'daily': '매일',
          'weekdays': '평일(월~금)',
          'weekly': '매주(주 1회)',
          'monthly': '매월',
          'weekly-2': '주 2회',
          'weekly-3': '주 3회',
          'weekly-4': '주 4회',
          'weekly-5': '주 5회',
          'weekly-6': '주 6회',
      };
      return labels[freq] || freq;
  };

  if (!isOpen) return null;

  return (
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-th-base flex flex-row overflow-hidden text-th-text font-body">

      {/* Ambient Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* === SIDEBAR NAVIGATION === */}
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-th-overlay z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 w-[260px] z-40 md:relative md:z-10 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <TodoSidebar
          todos={todos}
          lists={todoLists}
          groups={todoGroups}
          activeListId={activeListId}
          searchQuery={searchQuery}
          onSelectList={(id) => { onActiveListChange(id); setIsSidebarOpen(false); }}
          onSearchChange={setSearchQuery}
          onCreateList={() => { setEditingListId(null); setShowCreateList(true); }}
          onCreateGroup={() => { setEditingGroupId(null); setShowCreateGroup(true); }}
          onDeleteList={handleDeleteList}
          onDeleteGroup={handleDeleteGroup}
          onRenameList={handleRenameList}
          onRenameGroup={handleRenameGroup}
          onToggleGroupCollapse={handleToggleGroupCollapse}
        />
      </div>

      {/* === LEFT MAIN AREA (LIST) === */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

          {/* Header */}
          <div className="h-14 md:h-20 border-b border-th-border flex items-center justify-between px-4 md:px-8 bg-th-header backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-colors">
                    <Menu size={20} />
                  </button>
                  <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${activeListId === 'myDay' ? 'bg-yellow-400/10' : activeListId === 'important' ? 'bg-red-400/10' : activeListId === 'planned' ? 'bg-blue-400/10' : 'bg-th-accent-muted'}`}>
                    <span className={activeListInfo.color}>{activeListInfo.icon}</span>
                  </div>
                  <div>
                      <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-th-text">{searchQuery ? '검색 결과' : activeListInfo.name}</h1>
                      <p className="text-[10px] md:text-sm text-th-text-secondary font-mono mt-0.5 hidden md:block">
                          {searchQuery ? `"${searchQuery}" · ${sortedTodos.length}개 결과` : new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                  </div>
              </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide">
              <div className="max-w-4xl mx-auto space-y-3">
                  {sortedTodos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-th-text-muted space-y-6">
                          <div className="w-24 h-24 rounded-full bg-th-surface flex items-center justify-center">
                              <Target size={48} className="opacity-30" />
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold text-th-text-tertiary">할 일이 없습니다</p>
                            <p className="text-sm mt-2">오늘의 승리를 위한 첫 번째 작업을 추가해보세요.</p>
                          </div>
                      </div>
                  ) : (
                      sortedTodos.map(todo => (
                          <div
                            key={todo.id}
                            onClick={() => setSelectedToDoId(todo.id)}
                            className={`group flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                selectedToDoId === todo.id
                                    ? 'bg-th-surface-hover border-th-accent-border shadow-[var(--shadow-glow)]'
                                    : (todo.completed
                                        ? 'bg-th-surface border-transparent opacity-50'
                                        : 'bg-th-surface border-th-border hover:bg-th-surface-hover hover:border-th-border')
                            }`}
                          >
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleToDo(todo.id); }}
                                className={`transition-colors flex-shrink-0 p-1 rounded-full hover:bg-th-surface-hover ${todo.completed ? 'text-th-accent' : 'text-th-text-tertiary hover:text-th-accent'}`}
                              >
                                  {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                              </button>

                              <div className="flex-1 min-w-0">
                                  <p className={`text-lg truncate ${todo.completed ? 'line-through text-th-text-tertiary' : 'text-th-text'}`}>
                                      {todo.text}
                                  </p>
                                  <div className="flex flex-wrap gap-3 mt-1.5">
                                      {todo.isMyDay && (
                                          <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                                              <Sun size={12} />
                                              <span>오늘</span>
                                          </div>
                                      )}
                                      {todo.dueDate && (
                                          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${todo.dueDate < Date.now() && !todo.completed ? 'text-red-400 bg-red-400/10' : 'text-th-text-secondary bg-th-surface'}`}>
                                              <Calendar size={12} />
                                              <span>{formatDate(todo.dueDate)}</span>
                                          </div>
                                      )}
                                      {todo.repeat && (
                                          <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                                              <Repeat size={12} />
                                              <span className="capitalize">{getRepeatLabel(todo.repeat)}</span>
                                          </div>
                                      )}
                                      {todo.linkedNodeText && (
                                          <div className="flex items-center gap-1 text-xs text-electric-orange/80 bg-electric-orange/10 px-2 py-0.5 rounded-full">
                                              <Target size={12} />
                                              <span className="truncate max-w-[150px]">{todo.linkedNodeText}</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); onDeleteToDo(todo.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-2 rounded-full hover:bg-red-500/20 text-th-text-tertiary hover:text-red-400"
                                title="삭제"
                              >
                                  <Trash2 size={18} />
                              </button>
                              <ChevronRight size={20} className={`text-th-text-muted transition-transform ${selectedToDoId === todo.id ? 'translate-x-1 text-th-accent' : ''}`} />
                          </div>
                      ))
                  )}
                  {/* Bottom padding for floating input */}
                  <div className="h-48"></div>
              </div>
          </div>

          {/* Floating Input Area */}
          <div className="absolute bottom-[120px] left-0 right-0 px-4 flex justify-center z-20 pointer-events-none">
              <div className="w-full max-w-4xl pointer-events-auto">
                <form onSubmit={handleSubmit} className="relative group">
                    <div className="absolute inset-0 bg-th-accent-muted blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative flex items-center bg-th-elevated backdrop-blur-xl border border-th-border rounded-full shadow-2xl overflow-hidden transition-colors hover:border-th-accent-border">
                        <div className="pl-6 text-th-accent">
                            <Plus size={24} />
                        </div>
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="새로운 작업을 입력하고 Enter를 누르세요..."
                            className="w-full bg-transparent border-none py-4 px-4 text-lg text-th-text placeholder-th-text-tertiary focus:outline-none focus:ring-0"
                            aria-label="새 할 일 입력"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="mr-2 px-6 py-2 bg-th-surface-hover hover:bg-th-accent hover:text-th-text-inverse rounded-full text-sm font-bold transition-all disabled:opacity-0 disabled:scale-95"
                            aria-label="할 일 추가"
                        >
                            추가
                        </button>
                    </div>
                </form>
              </div>
          </div>
      </div>

      {/* === RIGHT DETAIL AREA (SIDEBAR) === */}
      {selectedToDoId && (
          <div
              className="fixed inset-0 bg-th-header z-10 md:hidden"
              onClick={() => setSelectedToDoId(null)}
          />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-th-base/95 backdrop-blur-2xl border-l border-th-border shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20 transform transition-transform duration-300 ease-out flex flex-col ${selectedToDoId ? 'translate-x-0' : 'translate-x-full'}`}
      >
          {selectedToDo ? (
              <>
                  {/* Detail Header */}
                  <div className="p-6 border-b border-th-border flex items-center justify-between bg-th-header">
                      <div className="flex items-center gap-3">
                          <button onClick={() => setSelectedToDoId(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-th-surface-hover text-th-text-secondary hover:text-th-text transition-all">
                              <ArrowLeft size={20} />
                          </button>
                          <h3 className="text-th-text-secondary font-bold text-sm tracking-wider flex items-center gap-2">
                            <Layout size={16}/> 세부 정보
                          </h3>
                      </div>
                      <button onClick={() => setSelectedToDoId(null)} className="text-th-text-tertiary hover:text-th-text transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Title Edit */}
                      <div className="bg-th-surface rounded-2xl p-4 flex items-start gap-4 ring-1 ring-th-border focus-within:ring-th-accent-border transition-all">
                          <button
                            onClick={() => onToggleToDo(selectedToDo.id)}
                            className={`mt-1.5 transition-colors flex-shrink-0 ${selectedToDo.completed ? 'text-th-accent' : 'text-th-text-tertiary hover:text-th-text'}`}
                          >
                              {selectedToDo.completed ? <CheckCircle2 size={26} /> : <Circle size={26} />}
                          </button>
                          <textarea
                              value={selectedToDo.text}
                              onChange={(e) => onUpdateToDo(selectedToDo.id, { text: e.target.value })}
                              className="bg-transparent text-xl font-bold text-th-text w-full focus:outline-none resize-none h-auto min-h-[3rem]"
                              rows={2}
                          />
                      </div>

                      {/* Action Toggles */}
                      <div className="space-y-3">
                        <div
                            className={`p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-all border ${selectedToDo.isMyDay ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' : 'bg-th-surface border-th-border text-th-text-secondary hover:bg-th-surface-hover'}`}
                            onClick={() => onUpdateToDo(selectedToDo.id, { isMyDay: !selectedToDo.isMyDay })}
                        >
                            <Sun size={20} />
                            <span className="font-medium flex-1">나의 하루에 추가</span>
                            {selectedToDo.isMyDay && <Check size={16} />}
                        </div>
                      </div>

                      {/* Metadata Group */}
                      <div className="bg-th-surface rounded-2xl overflow-hidden border border-th-border divide-y divide-th-border">

                          {/* Reminder */}
                          <div className="p-4 flex items-center gap-4 hover:bg-th-surface relative group transition-colors">
                              <Bell size={20} className={selectedToDo.reminder ? 'text-electric-orange' : 'text-th-text-tertiary'} />
                              <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">미리 알림</p>
                                  {selectedToDo.reminder && <p className="text-xs text-electric-orange mt-0.5">{formatDate(selectedToDo.reminder)} {formatTime(selectedToDo.reminder)}</p>}
                              </div>
                              <input
                                type="datetime-local"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    const date = new Date(e.target.value);
                                    if (!isNaN(date.getTime())) onUpdateToDo(selectedToDo.id, { reminder: date.getTime() });
                                }}
                              />
                              {selectedToDo.reminder && <button onClick={() => onUpdateToDo(selectedToDo.id, { reminder: null })} className="p-1 hover:text-red-500 text-th-text-tertiary z-10"><X size={16}/></button>}
                          </div>

                          {/* Due Date */}
                          <div className="p-4 flex items-center gap-4 hover:bg-th-surface relative group transition-colors">
                              <Calendar size={20} className={selectedToDo.dueDate ? 'text-th-accent' : 'text-th-text-tertiary'} />
                              <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">기한 설정</p>
                                  {selectedToDo.dueDate && <p className="text-xs text-th-accent mt-0.5">{formatDate(selectedToDo.dueDate)}</p>}
                              </div>
                              <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    const date = new Date(e.target.value);
                                    if (!isNaN(date.getTime())) onUpdateToDo(selectedToDo.id, { dueDate: date.getTime() });
                                }}
                              />
                              {selectedToDo.dueDate && <button onClick={() => onUpdateToDo(selectedToDo.id, { dueDate: null })} className="p-1 hover:text-red-500 text-th-text-tertiary z-10"><X size={16}/></button>}
                          </div>

                          {/* Repeat */}
                          <div className="p-4 flex items-center gap-4 hover:bg-th-surface relative group transition-colors">
                              <Repeat size={20} className={selectedToDo.repeat ? 'text-blue-400' : 'text-th-text-tertiary'} />
                              <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">반복</p>
                                  {selectedToDo.repeat && <p className="text-xs text-blue-400 capitalize mt-0.5">{getRepeatLabel(selectedToDo.repeat)}</p>}
                              </div>
                              <select
                                value={selectedToDo.repeat || ''}
                                onChange={(e) => onUpdateToDo(selectedToDo.id, { repeat: e.target.value as RepeatFrequency || null })}
                                className="absolute inset-0 opacity-0 cursor-pointer bg-th-base text-th-text"
                              >
                                  <option value="">반복 안 함</option>
                                  <option value="daily">매일</option>
                                  <option value="weekdays">평일 (월-금)</option>
                                  <option value="weekly">주 1회 (매주)</option>
                                  <option value="weekly-2">주 2회</option>
                                  <option value="weekly-3">주 3회</option>
                                  <option value="weekly-4">주 4회</option>
                                  <option value="weekly-5">주 5회</option>
                                  <option value="weekly-6">주 6회</option>
                                  <option value="monthly">매월</option>
                              </select>
                              {selectedToDo.repeat && <button onClick={() => onUpdateToDo(selectedToDo.id, { repeat: null })} className="p-1 hover:text-red-500 text-th-text-tertiary z-10"><X size={16}/></button>}
                          </div>
                      </div>

                      {/* Notes */}
                      <div className="bg-th-surface rounded-2xl p-4 h-48 ring-1 ring-th-border focus-within:ring-th-accent-border transition-all flex flex-col">
                          <textarea
                              placeholder="메모 추가..."
                              value={selectedToDo.note || ''}
                              onChange={(e) => onUpdateToDo(selectedToDo.id, { note: e.target.value })}
                              className="w-full h-full bg-transparent text-sm text-gray-300 resize-none focus:outline-none placeholder-th-text-muted"
                          />
                      </div>

                      <div className="text-xs text-th-text-muted text-center font-mono">
                          CREATED: {new Date(selectedToDo.createdAt).toLocaleString()}
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t border-th-border flex justify-between items-center bg-th-header">
                      <div className="text-xs text-th-text-tertiary">
                          ID: {selectedToDo.id.slice(-6)}
                      </div>
                      <button
                        onClick={() => { onDeleteToDo(selectedToDo.id); setSelectedToDoId(null); }}
                        className="text-th-text-secondary hover:text-red-500 transition-colors flex items-center gap-2 hover:bg-red-500/10 px-3 py-2 rounded-lg"
                      >
                          <Trash2 size={18} />
                          <span className="text-sm">삭제</span>
                      </button>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex items-center justify-center text-th-text-muted">
                  선택된 작업이 없습니다
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
        initialColor={editingListId ? todoLists.find(l => l.id === editingListId)?.color : '#CCFF00'}
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
