const ALLOWED_ORIGINS = new Set([
  'https://secretcoach.ai',
  'https://www.secretcoach.ai',
  'https://web-legacy-ruddy.vercel.app',
]);

// Only allow our own Vercel preview deployments (project slug: web-legacy)
const isVercelPreview = (origin: string): boolean =>
  /^https:\/\/web-legacy[\w-]*\.vercel\.app$/.test(origin);

export const setCorsHeaders = (
  req: { headers: { origin?: string } },
  res: { setHeader: (key: string, value: string) => void },
): void => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin) || isVercelPreview(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  res.setHeader('Vary', 'Origin');
};
