import React from 'react';
import { Toast } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-emerald-900/80', border: 'border-emerald-500/30', icon: '✓' },
  error: { bg: 'bg-red-900/80', border: 'border-red-500/30', icon: '✕' },
  warning: { bg: 'bg-amber-900/80', border: 'border-amber-500/30', icon: '!' },
  info: { bg: 'bg-blue-900/80', border: 'border-blue-500/30', icon: 'i' },
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[300] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => {
        const style = typeStyles[toast.type] || typeStyles.info;
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border backdrop-blur-md rounded-xl px-4 py-3 flex items-start gap-3 shadow-2xl animate-fade-in cursor-pointer`}
            onClick={() => onRemove(toast.id)}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
              toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
              toast.type === 'error' ? 'bg-red-500/20 text-red-400' :
              toast.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              {style.icon}
            </span>
            <p className="text-xs text-gray-200 leading-relaxed">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
