import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '(empty)',
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ? 'set' : 'missing',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ? 'set' : 'missing',
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ? 'set' : 'missing',
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '(empty)',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'set' : 'missing',
  });
}
