import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../lib/firebaseAdmin.js';

const PRODUCT_TO_PLAN: Record<string, string> = {
  [process.env.RC_PRODUCT_ID_ESSENTIAL ?? '']: 'essential',
  [process.env.RC_PRODUCT_ID_VISIONARY ?? '']: 'visionary',
  [process.env.RC_PRODUCT_ID_MASTER ?? '']: 'master',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const event = req.body;
    const appUserId = event?.event?.app_user_id;

    if (!appUserId) {
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    const eventType = event?.event?.type;
    const productId = event?.event?.product_id ?? '';
    const plan = PRODUCT_TO_PLAN[productId] ?? 'explorer';

    const activeEvents = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
    ];
    const inactiveEvents = [
      'CANCELLATION',
      'EXPIRATION',
      'BILLING_ISSUE',
    ];

    let isActive = false;
    if (activeEvents.includes(eventType)) {
      isActive = true;
    } else if (inactiveEvents.includes(eventType)) {
      isActive = false;
    } else {
      return res.status(200).json({ ok: true, skipped: eventType });
    }

    const db = getAdminDb();
    const profileRef = db.doc(`users/${appUserId}/profile/main`);
    await profileRef.set(
      {
        billingProvider: 'revenuecat',
        billingPlan: isActive ? plan : 'explorer',
        billingIsActive: isActive,
        billingUpdatedAt: Date.now(),
      },
      { merge: true },
    );

    return res.status(200).json({ ok: true, plan: isActive ? plan : 'explorer' });
  } catch (err: any) {
    console.error('[RC Webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
