import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../lib/firebaseAdmin.js';

const createRequestId = (): string => {
  return `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const parseBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const sanitizeString = (value: unknown, maxLen = 2000): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = createRequestId();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Method not allowed',
      requestId,
    });
  }

  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        errorCode: 'AUTH_HEADER_MISSING',
        errorMessage: 'Authorization bearer token is required',
        requestId,
      });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Parse & validate input
    const rating = Number(req.body?.rating);
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({
        errorCode: 'INVALID_RATING',
        errorMessage: 'Rating must be an integer between 1 and 5',
        requestId,
      });
    }

    const text = sanitizeString(req.body?.text);
    if (!text || text.length < 5) {
      return res.status(400).json({
        errorCode: 'INVALID_TEXT',
        errorMessage: 'Review text must be at least 5 characters',
        requestId,
      });
    }

    const userRole = sanitizeString(req.body?.userRole, 50) || undefined;

    // Load user profile to get name & avatar
    const db = getAdminDb();
    const profileSnap = await db.doc(`users/${uid}/profile/main`).get();
    const profile = profileSnap.data() || {};
    const userName = String(profile.name || decoded.name || '사용자').slice(0, 50);
    const userAvatarUrl = String(profile.avatarUrl || decoded.picture || '').slice(0, 2000) || undefined;

    const now = Date.now();
    const reviewData = {
      userId: uid,
      userName,
      userAvatarUrl: userAvatarUrl || null,
      userRole: userRole || null,
      rating,
      text,
      createdAt: now,
      updatedAt: now,
      approved: true, // Auto-approve; can add moderation later
    };

    // Use userId as doc ID (one review per user, overwrite on re-submit)
    const reviewRef = db.doc(`reviews/${uid}`);
    await reviewRef.set(reviewData);

    return res.status(200).json({
      id: uid,
      ...reviewData,
      requestId,
    });
  } catch (error: any) {
    const code = String(error?.code || '');
    const isAuthError = code.startsWith('auth/');
    const status = isAuthError ? 401 : 500;
    const errorCode = isAuthError ? 'AUTH_INVALID_TOKEN' : 'SAVE_REVIEW_FAILED';
    const errorMessage = String(error?.message || 'Failed to save review');

    console.error('[save-review]', requestId, errorCode, errorMessage);
    return res.status(status).json({ errorCode, errorMessage, requestId });
  }
}
