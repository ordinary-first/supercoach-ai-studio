import { useRef, useCallback } from 'react';

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 1500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveFn().catch(console.warn);
    }, delayMs);
  }, [saveFn, delayMs]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await saveFn().catch(console.warn);
  }, [saveFn]);

  return { trigger, flush };
}

/**
 * Extract the string id from a link endpoint which may be a string or an object with an `id` field.
 */
export function getLinkId(endpoint: string | { id: string }): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}
