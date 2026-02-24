import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Zap } from 'lucide-react';

interface GoalInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  parentName: string;
}

const GoalInputModal: React.FC<GoalInputModalProps> = ({ isOpen, onClose, onSubmit, parentName }) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setText('');
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim()) {
      onSubmit(text);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-th-overlay backdrop-blur-sm animate-fade-in">
      <div className="w-[90%] max-w-md bg-th-base border border-th-accent-border rounded-2xl shadow-[0_0_30px_var(--shadow-glow)] overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-th-surface to-transparent p-4 flex justify-between items-center border-b border-th-border">
          <div className="flex items-center gap-2 text-th-accent">
            <Zap size={18} className="animate-pulse" />
            <span className="font-display font-bold tracking-wider">NEW NODE</span>
          </div>
          <button onClick={onClose} className="text-th-text-secondary hover:text-th-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-th-text-secondary">
            상위 목표: <span className="text-th-text font-bold">{parentName}</span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="새로운 목표를 입력하세요..."
            className="w-full bg-th-header border border-th-border-strong rounded-xl p-4 text-lg text-th-text placeholder-th-text-muted focus:outline-none focus:border-th-accent-border focus:shadow-[0_0_15px_var(--shadow-glow)] transition-all"
          />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-th-text-secondary hover:text-th-text transition-colors mr-2"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-th-accent text-th-text-inverse font-bold rounded-full hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={18} />
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoalInputModal;