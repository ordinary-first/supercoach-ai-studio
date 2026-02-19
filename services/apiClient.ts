import { auth } from './firebaseService';

/**
 * Get the current Firebase user's ID token for API authorization.
 * Returns null if the user is not logged in.
 */
export const getAuthToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
};

/**
 * Build headers object with Content-Type and Authorization (if logged in).
 */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};
