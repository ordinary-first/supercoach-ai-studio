import { auth } from './firebaseService';

export const getAuthHeaders = async (): Promise<
  Record<string, string>
> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};
