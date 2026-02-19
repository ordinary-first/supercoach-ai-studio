import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = new Set([
  'https://secretcoach.ai',
  'https://www.secretcoach.ai',
  'https://web-legacy-ruddy.vercel.app',
]);

// Allow localhost in development
const isDev = (process.env.NODE_ENV || '').toLowerCase() === 'development' ||
  (process.env.VERCEL_ENV || '').toLowerCase() === 'preview';

const isAllowedOrigin = (origin: string | undefined): string | null => {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (isDev && (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'))) {
    return origin;
  }
  // Allow Vercel preview deployments
  if (/^https:\/\/[\w-]+-[\w-]+\.vercel\.app$/.test(origin)) return origin;
  return null;
};

/**
 * Set CORS and security headers. Returns true if the request is a preflight (OPTIONS)
 * and has been handled (caller should return early).
 */
export const setCorsHeaders = (
  req: VercelRequest,
  res: VercelResponse,
  { allowMethods = 'POST, OPTIONS' }: { allowMethods?: string } = {},
): boolean => {
  const origin = req.headers.origin as string | undefined;
  const allowed = isAllowedOrigin(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', allowMethods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
};
