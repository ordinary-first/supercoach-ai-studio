export const safePathSegment = (value: unknown): string => {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || 'unknown';
};
