import React from 'react';
import { Circle, CheckCircle2, Calendar, Target, Sun, Repeat, Trash2, Edit3 } from 'lucide-react';
import { ToDoItem, RepeatFrequency } from '../../types';

interface TodoItemProps {
  todo: ToDoItem;
  onToggle: (id: string) => void;
  onEdit: (todo: ToDoItem) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onEdit, onDelete, isSelected = false }) => {
  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  const getRepeatLabel = (freq: RepeatFrequency | undefined) => {
    if (!freq) return null;
    const labels: Record<string, string> = {
      'daily': '매일',
      'weekdays': '평일',
      'weekly': '매주',
      'monthly': '매월',
      'weekly-2': '주 2회',
      'weekly-3': '주 3회',
      'weekly-4': '주 4회',
      'weekly-5': '주 5회',
      'weekly-6': '주 6회',
    };
    return labels[freq] || freq;
  };

  const getPriorityColor = () => {
    switch (todo.priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-electric-orange';
      case 'low': return 'bg-gray-500';
      default: return 'bg-gray-700';
    }
  };

  const isOverdue = todo.dueDate && todo.dueDate < Date.now() && !todo.completed;

  return (
    <div
      onClick={() => onEdit(todo)}
      className={`group relative flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${
        isSelected
          ? 'bg-white/10 border-neon-lime shadow-[0_0_20px_rgba(204,255,0,0.15)] scale-[1.01]'
          : (todo.completed
            ? 'bg-white/5 border-transparent opacity-60 hover:opacity-80'
            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20')
      }`}
    >
      {/* Priority indicator dot */}
      {todo.priority && (
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 ${getPriorityColor()} rounded-r-full transition-all duration-300 ${isSelected ? 'w-1.5' : ''}`} />
      )}

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(todo.id);
        }}
        className={`flex-shrink-0 p-1 rounded-full transition-all hover:bg-white/10 hover:scale-110 ${
          todo.completed ? 'text-neon-lime' : 'text-gray-500 hover:text-neon-lime'
        }`}
      >
        {todo.completed ? (
          <CheckCircle2 size={26} className="animate-[pulse_0.5s_ease-in-out]" />
        ) : (
          <Circle size={26} />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-lg mb-1 transition-all ${
          todo.completed
            ? 'line-through text-gray-500'
            : 'text-white font-medium'
        }`}>
          {todo.text}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-2">
          {todo.isMyDay && (
            <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full border border-yellow-400/20">
              <Sun size={12} />
              <span>오늘</span>
            </div>
          )}

          {todo.dueDate && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
              isOverdue
                ? 'text-red-400 bg-red-400/10 border-red-400/20 animate-pulse'
                : 'text-gray-400 bg-white/5 border-white/10'
            }`}>
              <Calendar size={12} />
              <span>{formatDate(todo.dueDate)}</span>
            </div>
          )}

          {todo.repeat && (
            <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full border border-blue-400/20">
              <Repeat size={12} />
              <span>{getRepeatLabel(todo.repeat)}</span>
            </div>
          )}

          {(todo.linkedNodeText || todo.linkedGoalId) && (
            <div className="flex items-center gap-1 text-xs text-electric-orange bg-electric-orange/10 px-2 py-1 rounded-full border border-electric-orange/20">
              <Target size={12} />
              <span className="truncate max-w-[120px]">
                {todo.linkedNodeText || 'Goal'}
              </span>
            </div>
          )}

          {todo.tags && todo.tags.length > 0 && (
            <>
              {todo.tags.slice(0, 2).map((tag, idx) => (
                <div key={idx} className="text-xs text-neon-lime/70 bg-neon-lime/5 px-2 py-1 rounded-full border border-neon-lime/20">
                  #{tag}
                </div>
              ))}
              {todo.tags.length > 2 && (
                <div className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                  +{todo.tags.length - 2}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(todo);
          }}
          className="p-2 rounded-lg bg-white/5 hover:bg-neon-lime hover:text-black transition-all"
          title="Edit"
        >
          <Edit3 size={16} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(todo.id);
          }}
          className="p-2 rounded-lg bg-white/5 hover:bg-red-500 hover:text-white transition-all"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default TodoItem;
