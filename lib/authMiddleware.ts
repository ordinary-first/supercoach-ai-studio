import type { VercelRequest } from '@vercel/node';
import { getAdminAuth } from './firebaseAdmin.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: { status: number; body: Record<string, unknown> } | null;
}

const parseBearerToken = (
  headerValue: string | undefined,
): string | null => {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const authenticateRequest = async (
  req: VercelRequest,
): Promise<AuthResult> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return {
      user: null,
      error: {
        status: 401,
        body: {
          errorCode: 'AUTH_HEADER_MISSING',
          errorMessage: 'Authorization bearer token is required',
        },
      },
    };
  }

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      user: { uid: decoded.uid, email: decoded.email },
      error: null,
    };
  } catch (err: unknown) {
    const code = String(
      (err as { code?: string })?.code || '',
    );
    const isAuthError = code.startsWith('auth/');
    return {
      user: null,
      error: {
        status: isAuthError ? 401 : 500,
        body: {
          errorCode: isAuthError
            ? 'AUTH_INVALID_TOKEN'
            : 'AUTH_VERIFICATION_FAILED',
          errorMessage: 'Authentication failed',
        },
      },
    };
  }
};
