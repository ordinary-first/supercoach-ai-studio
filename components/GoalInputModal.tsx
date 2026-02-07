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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[90%] max-w-md bg-deep-space border border-neon-lime/30 rounded-2xl shadow-[0_0_30px_rgba(204,255,0,0.1)] overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-white/5 to-transparent p-4 flex justify-between items-center border-b border-white/10">
          <div className="flex items-center gap-2 text-neon-lime">
            <Zap size={18} className="animate-pulse" />
            <span className="font-display font-bold tracking-wider">NEW NODE</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-gray-400">
            상위 목표: <span className="text-white font-bold">{parentName}</span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="새로운 목표를 입력하세요..."
            className="w-full bg-black/40 border border-white/20 rounded-xl p-4 text-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-lime focus:shadow-[0_0_15px_rgba(204,255,0,0.2)] transition-all"
          />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors mr-2"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-neon-lime text-black font-bold rounded-full hover:bg-white hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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