export const isGuestUser = (uid?: string | null): boolean =>
  !uid || uid === 'guest' || uid.startsWith('guest_');
