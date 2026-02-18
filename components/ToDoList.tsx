import React, { useState } from 'react';
import { Check, Trash2, Plus, ListTodo, Circle, CheckCircle2, Target, Bell, Repeat, Sun, ArrowLeft, ChevronRight, Layout, X, Calendar } from 'lucide-react';
import { ToDoItem, RepeatFrequency } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ToDoListProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  onAddToDo: (text: string) => void;
  onToggleToDo: (id: string) => void;
  onDeleteToDo: (id: string) => void;
  onUpdateToDo: (id: string, updates: Partial<ToDoItem>) => void;
}

const ToDoList: React.FC<ToDoListProps> = ({ isOpen, onClose, todos, onAddToDo, onToggleToDo, onDeleteToDo, onUpdateToDo }) => {
  const [inputText, setInputText] = useState('');
  const [selectedToDoId, setSelectedToDoId] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onAddToDo(inputText);
      setInputText('');
    }
  };

  // Sort: MyDay first, then Incomplete first, then by creation date
  const sortedTodos = [...todos].sort((a, b) => {
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
    <div ref={focusTrapRef} className="fixed inset-0 z-50 bg-deep-space flex flex-row overflow-hidden text-white font-body">
      
      {/* Ambient Background */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* === LEFT MAIN AREA (LIST) === */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
          
          {/* Header */}
          <div className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/20 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-4">
                  <div className="p-2 md:p-3 bg-neon-lime/10 rounded-lg md:rounded-xl">
                    <ListTodo className="text-neon-lime w-5 h-5 md:w-8 md:h-8" />
                  </div>
                  <div>
                      <h1 className="text-lg md:text-2xl font-display font-bold tracking-wider text-white">할 일</h1>
                      <p className="text-[10px] md:text-sm text-gray-400 font-mono mt-0.5 hidden md:block">
                          {new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                  </div>
              </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide">
              <div className="max-w-4xl mx-auto space-y-3">
                  {sortedTodos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-600 space-y-6">
                          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                              <Target size={48} className="opacity-30" />
                          </div>
                          <div className="text-center">
                            <p className="text-xl font-bold text-gray-500">할 일이 없습니다</p>
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
                                    ? 'bg-white/10 border-neon-lime shadow-[0_0_15px_rgba(204,255,0,0.1)]'
                                    : (todo.completed 
                                        ? 'bg-white/5 border-transparent opacity-50' 
                                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20')
                            }`}
                          >
                              <button 
                                onClick={(e) => { e.stopPropagation(); onToggleToDo(todo.id); }}
                                className={`transition-colors flex-shrink-0 p-1 rounded-full hover:bg-white/10 ${todo.completed ? 'text-neon-lime' : 'text-gray-500 hover:text-neon-lime'}`}
                              >
                                  {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                              </button>

                              <div className="flex-1 min-w-0">
                                  <p className={`text-lg truncate ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>
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
                                          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${todo.dueDate < Date.now() && !todo.completed ? 'text-red-400 bg-red-400/10' : 'text-gray-400 bg-white/5'}`}>
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
                                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-2 rounded-full hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                                title="삭제"
                              >
                                  <Trash2 size={18} />
                              </button>
                              <ChevronRight size={20} className={`text-gray-600 transition-transform ${selectedToDoId === todo.id ? 'translate-x-1 text-neon-lime' : ''}`} />
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
                    <div className="absolute inset-0 bg-neon-lime/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative flex items-center bg-black/80 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl overflow-hidden transition-colors hover:border-neon-lime/50">
                        <div className="pl-6 text-neon-lime">
                            <Plus size={24} />
                        </div>
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="새로운 작업을 입력하고 Enter를 누르세요..."
                            className="w-full bg-transparent border-none py-4 px-4 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-0"
                            aria-label="새 할 일 입력"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="mr-2 px-6 py-2 bg-white/10 hover:bg-neon-lime hover:text-black rounded-full text-sm font-bold transition-all disabled:opacity-0 disabled:scale-95"
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
              className="fixed inset-0 bg-black/40 z-10 md:hidden"
              onClick={() => setSelectedToDoId(null)}
          />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-[#0a0a10]/95 backdrop-blur-2xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20 transform transition-transform duration-300 ease-out flex flex-col ${selectedToDoId ? 'translate-x-0' : 'translate-x-full'}`}
      >
          {selectedToDo ? (
              <>
                  {/* Detail Header */}
                  <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                      <div className="flex items-center gap-3">
                          <button onClick={() => setSelectedToDoId(null)} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                              <ArrowLeft size={20} />
                          </button>
                          <h3 className="text-gray-400 font-bold text-sm tracking-wider flex items-center gap-2">
                            <Layout size={16}/> 세부 정보
                          </h3>
                      </div>
                      <button onClick={() => setSelectedToDoId(null)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Detail Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Title Edit */}
                      <div className="bg-white/5 rounded-2xl p-4 flex items-start gap-4 ring-1 ring-white/5 focus-within:ring-neon-lime/50 transition-all">
                          <button 
                            onClick={() => onToggleToDo(selectedToDo.id)}
                            className={`mt-1.5 transition-colors flex-shrink-0 ${selectedToDo.completed ? 'text-neon-lime' : 'text-gray-500 hover:text-white'}`}
                          >
                              {selectedToDo.completed ? <CheckCircle2 size={26} /> : <Circle size={26} />}
                          </button>
                          <textarea 
                              value={selectedToDo.text}
                              onChange={(e) => onUpdateToDo(selectedToDo.id, { text: e.target.value })}
                              className="bg-transparent text-xl font-bold text-white w-full focus:outline-none resize-none h-auto min-h-[3rem]"
                              rows={2}
                          />
                      </div>

                      {/* Action Toggles */}
                      <div className="space-y-3">
                        <div 
                            className={`p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-all border ${selectedToDo.isMyDay ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                            onClick={() => onUpdateToDo(selectedToDo.id, { isMyDay: !selectedToDo.isMyDay })}
                        >
                            <Sun size={20} />
                            <span className="font-medium flex-1">나의 하루에 추가</span>
                            {selectedToDo.isMyDay && <Check size={16} />}
                        </div>
                      </div>

                      {/* Metadata Group */}
                      <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
                          
                          {/* Reminder */}
                          <div className="p-4 flex items-center gap-4 hover:bg-white/5 relative group transition-colors">
                              <Bell size={20} className={selectedToDo.reminder ? 'text-electric-orange' : 'text-gray-500'} />
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
                              {selectedToDo.reminder && <button onClick={() => onUpdateToDo(selectedToDo.id, { reminder: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={16}/></button>}
                          </div>

                          {/* Due Date */}
                          <div className="p-4 flex items-center gap-4 hover:bg-white/5 relative group transition-colors">
                              <Calendar size={20} className={selectedToDo.dueDate ? 'text-neon-lime' : 'text-gray-500'} />
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
                              {selectedToDo.dueDate && <button onClick={() => onUpdateToDo(selectedToDo.id, { dueDate: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={16}/></button>}
                          </div>

                          {/* Repeat */}
                          <div className="p-4 flex items-center gap-4 hover:bg-white/5 relative group transition-colors">
                              <Repeat size={20} className={selectedToDo.repeat ? 'text-blue-400' : 'text-gray-500'} />
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
                              {selectedToDo.repeat && <button onClick={() => onUpdateToDo(selectedToDo.id, { repeat: null })} className="p-1 hover:text-red-500 text-gray-500 z-10"><X size={16}/></button>}
                          </div>
                      </div>

                      {/* Notes */}
                      <div className="bg-white/5 rounded-2xl p-4 h-48 ring-1 ring-white/5 focus-within:ring-neon-lime/30 transition-all flex flex-col">
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
                  <div className="p-6 border-t border-white/10 flex justify-between items-center bg-black/40">
                      <div className="text-xs text-gray-500">
                          ID: {selectedToDo.id.slice(-6)}
                      </div>
                      <button 
                        onClick={() => { onDeleteToDo(selectedToDo.id); setSelectedToDoId(null); }}
                        className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 hover:bg-red-500/10 px-3 py-2 rounded-lg"
                      >
                          <Trash2 size={18} />
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
    </div>
  );
};

export default ToDoList;
