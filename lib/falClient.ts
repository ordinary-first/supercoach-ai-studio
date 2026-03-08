import { createFalClient } from '@fal-ai/client';

let cached: ReturnType<typeof createFalClient> | null = null;

export function getFalClient() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error('FAL_KEY not configured');
  if (!cached) {
    cached = createFalClient({ credentials: key });
  }
  return cached;
}
