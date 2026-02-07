import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, Bell, Repeat, Target, Tag, AlertCircle } from 'lucide-react';
import { ToDoItem, GoalNode, RepeatFrequency, TodoPriority } from '../../types';

interface TodoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo: ToDoItem | null;
  goals: GoalNode[];
  onSave: (todo: Partial<ToDoItem>) => void;
  onDelete?: (id: string) => void;
}

const TodoEditModal: React.FC<TodoEditModalProps> = ({
  isOpen,
  onClose,
  todo,
  goals,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState<Partial<ToDoItem>>({
    text: '',
    priority: 'medium',
    dueDate: null,
    linkedGoalId: undefined,
    repeat: null,
    tags: [],
    note: ''
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (todo) {
      setFormData({
        ...todo,
        linkedGoalId: todo.linkedGoalId || todo.linkedNodeId
      });
    } else {
      setFormData({
        text: '',
        priority: 'medium',
        dueDate: null,
        linkedGoalId: undefined,
        repeat: null,
        tags: [],
        note: ''
      });
    }
  }, [todo, isOpen]);

  const handleSave = () => {
    if (!formData.text?.trim()) return;

    const todoData: Partial<ToDoItem> = {
      ...formData,
      linkedNodeId: formData.linkedGoalId,
      linkedNodeText: goals.find(g => g.id === formData.linkedGoalId)?.text
    };

    if (!todo) {
      // New todo
      todoData.id = Date.now().toString();
      todoData.createdAt = Date.now();
      todoData.completed = false;
    }

    onSave(todoData);
    onClose();
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || []
    });
  };

  if (!isOpen) return null;

  const repeatOptions: { value: RepeatFrequency; label: string }[] = [
    { value: null, label: 'No Repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'weekly-2', label: 'Twice a Week' },
    { value: 'weekly-3', label: '3 Times a Week' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const priorityOptions: { value: TodoPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'text-gray-400' },
    { value: 'medium', label: 'Medium', color: 'text-electric-orange' },
    { value: 'high', label: 'High', color: 'text-red-400' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-deep-space border border-white/20 rounded-3xl shadow-[0_0_60px_rgba(204,255,0,0.1)] overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/2 bg-neon-lime/10 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="relative p-6 border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold tracking-wider text-white">
              {todo ? 'EDIT TASK' : 'NEW TASK'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Task Text */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <AlertCircle size={14} />
              Task Description *
            </label>
            <input
              type="text"
              value={formData.text || ''}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <AlertCircle size={14} />
              Priority
            </label>
            <div className="flex gap-2">
              {priorityOptions.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => setFormData({ ...formData, priority: value })}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    formData.priority === value
                      ? `${color} border-current bg-current/10 shadow-[0_0_15px_currentColor]`
                      : 'text-gray-500 border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <Calendar size={14} />
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value).getTime() : null;
                setFormData({ ...formData, dueDate: date });
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Linked Goal */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <Target size={14} />
              Link to Goal
            </label>
            <select
              value={formData.linkedGoalId || ''}
              onChange={(e) => setFormData({ ...formData, linkedGoalId: e.target.value || undefined })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all"
            >
              <option value="">No linked goal</option>
              {goals.filter(g => g.id !== 'root').map(goal => (
                <option key={goal.id} value={goal.id}>
                  {goal.text}
                </option>
              ))}
            </select>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <Repeat size={14} />
              Repeat
            </label>
            <select
              value={formData.repeat || ''}
              onChange={(e) => setFormData({ ...formData, repeat: (e.target.value || null) as RepeatFrequency })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all"
            >
              {repeatOptions.map(({ value, label }) => (
                <option key={value || 'none'} value={value || ''}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              <Tag size={14} />
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-neon-lime/10 border border-neon-lime/30 rounded-xl text-neon-lime font-bold hover:bg-neon-lime hover:text-black transition-all"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1 bg-neon-lime/10 border border-neon-lime/20 rounded-full text-sm text-neon-lime"
                  >
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-wider uppercase">
              Notes
            </label>
            <textarea
              value={formData.note || ''}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Additional notes..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-transparent transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="relative p-6 border-t border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between gap-4">
          {todo && onDelete && (
            <button
              onClick={() => {
                onDelete(todo.id);
                onClose();
              }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}

          <div className="flex-1" />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold hover:bg-white/10 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.text?.trim()}
              className="px-6 py-2 bg-neon-lime border border-neon-lime rounded-xl text-black font-bold hover:shadow-[0_0_20px_rgba(204,255,0,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              {todo ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoEditModal;
