import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timerMap.current.delete(id);
    }, duration);
    timerMap.current.set(id, timer);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timerMap.current.get(id);
    if (timer) { clearTimeout(timer); timerMap.current.delete(id); }
  }, []);

  return { toasts, addToast, removeToast };
}
