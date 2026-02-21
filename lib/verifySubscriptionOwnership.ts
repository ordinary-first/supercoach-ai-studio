import { getAdminDb } from './firebaseAdmin.js';

export const verifySubscriptionOwnership = async (
  uid: string,
  subscriptionId: string,
): Promise<boolean> => {
  const db = getAdminDb();
  const snap = await db.doc(`users/${uid}/billing/polar`).get();
  if (!snap.exists) return false;
  const data = snap.data();
  return data?.subscriptionId === subscriptionId;
};
