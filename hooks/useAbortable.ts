import { useRef, useEffect, useCallback } from 'react';

/**
 * Returns stable `abort()` and `getSignal()` helpers backed by an AbortController
 * that is replaced each time `abort()` is called and cleaned up on unmount.
 *
 * Usage:
 *   const { getSignal, abort } = useAbortable();
 *   // In an async operation:
 *   const signal = getSignal();
 *   await fetch('/api/...', { signal });
 *   // On cancel or unmount:
 *   abort();
 */
export function useAbortable() {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const getSignal = useCallback((): AbortSignal => {
    if (!controllerRef.current || controllerRef.current.signal.aborted) {
      controllerRef.current = new AbortController();
    }
    return controllerRef.current.signal;
  }, []);

  return { abort, getSignal };
}
