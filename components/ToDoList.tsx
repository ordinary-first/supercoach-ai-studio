import React, { useState, useMemo } from 'react';
import { Check, Trash2, Plus, ListTodo, Circle, CheckCircle2, Target, Bell, Repeat, Sun, ArrowLeft, ChevronRight, ChevronDown, Layout, X, Calendar, Star, CalendarDays, Home, Menu } from 'lucide-react';
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
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Smart list definitions
  const SMART_LIST_META: Record<SmartListId, { name: string; icon: React.ReactNode; color: string }> = {
    myDay: { name: '오늘 할 일', icon: <Sun size={20} />, color: 'text-yellow-400' },
    important: { name: '중요', icon: <Star size={20} />, color: 'text-red-400' },
    planned: { name: '계획된 일정', icon: <CalendarDays size={20} />, color: 'text-blue-400' },
    tasks: { name: '작업', icon: <Home size={20} />, color: 'text-neon-lime' },
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
    return { name: '작업', icon: <Home size={20} />, color: 'text-neon-lime' };
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

  // Split into incomplete / completed, sort each by MyDay then createdAt
  const sortByMyDayThenDate = (a: ToDoItem, b: ToDoItem) => {
    if (a.isMyDay === b.isMyDay) return b.createdAt - a.createdAt;
    return a.isMyDay ? -1 : 1;
  };
  const incompleteTodos = [...filteredTodos].filter(t => !t.completed).sort(sortByMyDayThenDate);
  const completedTodos = [...filteredTodos].filter(t => t.completed).sort(sortByMyDayThenDate);

  const selectedToDo = todos.find(t => t.id === selectedToDoId);

  const renderTodoItem = (todo: ToDoItem) => (
    <div
      key={todo.id}
      onClick={() => setSelectedToDoId(todo.id)}
      className={`group flex items-center gap-2.5 py-2.5 px-3 border-b cursor-pointer transition-all duration-150 ${
        selectedToDoId === todo.id
          ? 'bg-white/10 border-white/10'
          : (todo.completed ? 'border-white/5 opacity-50' : 'border-white/5 hover:bg-white/5')
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleToDo(todo.id); }}
        className={`transition-colors flex-shrink-0 ${todo.completed ? 'text-neon-lime' : 'text-gray-500 hover:text-neon-lime'}`}
      >
        {todo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>{todo.text}</p>
        {(todo.isMyDay || todo.dueDate || todo.repeat || todo.linkedNodeText) && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {todo.isMyDay && <span className="flex items-center gap-0.5 text-[10px] text-yellow-400"><Sun size={10} /> 오늘 할 일</span>}
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
        title="삭제"
      >
        <Trash2 size={14} />
      </button>
      <ChevronRight size={16} className={`text-gray-600 flex-shrink-0 transition-transform ${selectedToDoId === todo.id ? 'translate-x-0.5 text-neon-lime' : ''}`} />
    </div>
  );

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
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-row overflow-hidden text-white font-body">
      
      {/* Ambient Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* === SIDEBAR NAVIGATION === */}
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
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
          <div className="h-11 md:h-12 border-b border-white/10 flex items-center justify-between px-3 md:px-6 bg-black/20 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5">
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                    <Menu size={18} />
                  </button>
                  <div className={`p-1.5 rounded-lg ${activeListId === 'myDay' ? 'bg-yellow-400/10' : activeListId === 'important' ? 'bg-red-400/10' : activeListId === 'planned' ? 'bg-blue-400/10' : 'bg-neon-lime/10'}`}>
                    <span className={activeListInfo.color}>{activeListInfo.icon}</span>
                  </div>
                  <div>
                      <h1 className="text-base md:text-lg font-display font-bold tracking-wider text-white">{searchQuery ? '검색 결과' : activeListInfo.name}</h1>
                  </div>
              </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-0 pt-1 scrollbar-hide">
              <div className="max-w-4xl mx-auto">
                  {incompleteTodos.length === 0 && completedTodos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-600 space-y-4">
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                              <Target size={32} className="opacity-30" />
                          </div>
                          <div className="text-center">
                            <p className="text-base font-bold text-gray-500">할 일이 없습니다</p>
                            <p className="text-xs mt-1 text-gray-600">오늘의 승리를 위한 첫 번째 작업을 추가해보세요.</p>
                          </div>
                      </div>
                  ) : (
                    <>
                      {incompleteTodos.map(todo => renderTodoItem(todo))}

                      {/* Completed section */}
                      {completedTodos.length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => setShowCompleted(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-2 w-full text-left text-sm text-gray-400 hover:text-gray-300 transition-colors"
                          >
                            {showCompleted
                              ? <ChevronDown size={16} className="flex-shrink-0" />
                              : <ChevronRight size={16} className="flex-shrink-0" />
                            }
                            <span>완료됨</span>
                            <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded-full">{completedTodos.length}</span>
                          </button>
                          {showCompleted && completedTodos.map(todo => renderTodoItem(todo))}
                        </div>
                      )}
                    </>
                  )}
              </div>
          </div>

          {/* Always-visible add task input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2.5 py-2.5 px-3 mb-14 md:mb-0 border-t border-white/10 bg-white/5 flex-shrink-0">
            <Plus size={20} className="text-neon-lime flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { inputRef.current?.blur(); setInputText(''); } }}
              placeholder="작업 추가"
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              aria-label="새 할 일 입력"
            />
          </form>
      </div>

      {/* === RIGHT DETAIL AREA (SIDEBAR) === */}
      {selectedToDoId && (
          <div
              className="fixed inset-0 bg-black/40 z-10 md:hidden"
              onClick={() => setSelectedToDoId(null)}
          />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[380px] bg-[#0a0a10]/95 backdrop-blur-2xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20 transform transition-transform duration-300 ease-out flex flex-col ${selectedToDoId ? 'translate-x-0' : 'translate-x-full'}`}
      >
          {selectedToDo ? (
              <>
                  {/* Detail Header */}
                  <div className="py-3 px-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                      <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedToDoId(null)} className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                              <ArrowLeft size={18} />
                          </button>
                          <h3 className="text-gray-400 font-bold text-sm tracking-wider flex items-center gap-2">
                            <Layout size={14}/> 세부 정보
                          </h3>
                      </div>
                      <button onClick={() => setSelectedToDoId(null)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={20} />
                      </button>
                  </div>

                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Title Edit */}
                      <div className="bg-white/5 rounded-xl p-3 flex items-start gap-3 ring-1 ring-white/5 focus-within:ring-neon-lime/50 transition-all">
                          <button
                            onClick={() => onToggleToDo(selectedToDo.id)}
                            className={`mt-1 transition-colors flex-shrink-0 ${selectedToDo.completed ? 'text-neon-lime' : 'text-gray-500 hover:text-white'}`}
                          >
                              {selectedToDo.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                          <textarea
                              value={selectedToDo.text}
                              onChange={(e) => onUpdateToDo(selectedToDo.id, { text: e.target.value })}
                              className="bg-transparent text-base font-semibold text-white w-full focus:outline-none resize-none h-auto min-h-[2rem]"
                              rows={2}
                          />
                      </div>

                      {/* Action Toggles */}
                      <div className="space-y-2">
                        <div
                            className={`py-2.5 px-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all border ${selectedToDo.isMyDay ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                            onClick={() => onUpdateToDo(selectedToDo.id, { isMyDay: !selectedToDo.isMyDay })}
                        >
                            <Sun size={16} />
                            <span className="text-sm font-medium flex-1">나의 하루에 추가</span>
                            {selectedToDo.isMyDay && <Check size={14} />}
                        </div>
                      </div>

                      {/* Metadata Group */}
                      <div className="bg-white/5 rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">

                          {/* Reminder */}
                          <div className="py-2.5 px-3 flex items-center gap-3 hover:bg-white/5 relative group transition-colors">
                              <Bell size={16} className={selectedToDo.reminder ? 'text-electric-orange' : 'text-gray-500'} />
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
                              {selectedToDo.reminder && <button onClick={() => onUpdateToDo(selectedToDo.id, { reminder: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={14}/></button>}
                          </div>

                          {/* Due Date */}
                          <div className="py-2.5 px-3 flex items-center gap-3 hover:bg-white/5 relative group transition-colors">
                              <Calendar size={16} className={selectedToDo.dueDate ? 'text-neon-lime' : 'text-gray-500'} />
                              <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">기한 설정</p>
                                  {selectedToDo.dueDate && <p className="text-xs text-neon-lime mt-0.5">{formatDate(selectedToDo.dueDate)}</p>}
                              </div>
                              <input
                                type="date"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                    const date = new Date(e.target.value);
                                    if (!isNaN(date.getTime())) onUpdateToDo(selectedToDo.id, { dueDate: date.getTime() });
                                }}
                              />
                              {selectedToDo.dueDate && <button onClick={() => onUpdateToDo(selectedToDo.id, { dueDate: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={14}/></button>}
                          </div>

                          {/* Repeat */}
                          <div className="py-2.5 px-3 flex items-center gap-3 hover:bg-white/5 relative group transition-colors">
                              <Repeat size={16} className={selectedToDo.repeat ? 'text-blue-400' : 'text-gray-500'} />
                              <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-200">반복</p>
                                  {selectedToDo.repeat && <p className="text-xs text-blue-400 capitalize mt-0.5">{getRepeatLabel(selectedToDo.repeat)}</p>}
                              </div>
                              <select
                                value={selectedToDo.repeat || ''}
                                onChange={(e) => onUpdateToDo(selectedToDo.id, { repeat: e.target.value as RepeatFrequency || null })}
                                className="absolute inset-0 opacity-0 cursor-pointer bg-deep-space text-white"
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
                              {selectedToDo.repeat && <button onClick={() => onUpdateToDo(selectedToDo.id, { repeat: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={14}/></button>}
                          </div>
                      </div>

                      {/* Notes */}
                      <div className="bg-white/5 rounded-xl p-3 h-36 ring-1 ring-white/5 focus-within:ring-neon-lime/30 transition-all flex flex-col">
                          <textarea 
                              placeholder="메모 추가..."
                              value={selectedToDo.note || ''}
                              onChange={(e) => onUpdateToDo(selectedToDo.id, { note: e.target.value })}
                              className="w-full h-full bg-transparent text-sm text-gray-300 resize-none focus:outline-none placeholder-gray-600"
                          />
                      </div>
                      
                      <div className="text-xs text-gray-600 text-center font-mono">
                          CREATED: {new Date(selectedToDo.createdAt).toLocaleString()}
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="py-3 px-4 border-t border-white/10 flex justify-between items-center bg-black/40">
                      <div className="text-xs text-gray-500">
                          ID: {selectedToDo.id.slice(-6)}
                      </div>
                      <button
                        onClick={() => { onDeleteToDo(selectedToDo.id); setSelectedToDoId(null); }}
                        className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 hover:bg-red-500/10 px-3 py-1.5 rounded-lg"
                      >
                          <Trash2 size={16} />
                          <span className="text-sm">삭제</span>
                      </button>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600">
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
