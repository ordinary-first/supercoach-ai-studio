import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth } from './firebaseAdmin.js';

export interface AuthenticatedUser {
  uid: string;
}

const parseBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the authenticated user's uid, or sends a 401 response and returns null.
 */
export const verifyAuth = async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      error: 'AUTH_HEADER_MISSING',
      message: 'Authorization bearer token is required',
    });
    return null;
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as Record<string, unknown>).code)
      : '';
    const isAuthError = code.startsWith('auth/');
    res.status(401).json({
      error: isAuthError ? code : 'AUTH_INVALID_TOKEN',
      message: 'Invalid or expired authentication token',
    });
    return null;
  }
};
