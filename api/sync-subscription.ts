import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../lib/firebaseAdmin.js';

type GenericData = Record<string, unknown>;

const trim = (v: string | undefined): string => (v ?? '').trim();

const asString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const c = v.trim();
  return c.length > 0 ? c : null;
};

const POLAR_API_BASE = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const;

const planByProductId = (productId: string | null): string | null => {
  if (!productId) return null;
  const map: Record<string, string> = {
    [trim(process.env.POLAR_PRODUCT_ID_EXPLORER)]: 'explorer',
    [trim(process.env.POLAR_PRODUCT_ID_ESSENTIAL)]: 'essential',
    [trim(process.env.POLAR_PRODUCT_ID_VISIONARY)]: 'visionary',
    [trim(process.env.POLAR_PRODUCT_ID_MASTER)]: 'master',
  };
  return map[productId] ?? null;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = asString(req.query.uid as string);
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }

  const accessToken = trim(process.env.POLAR_ACCESS_TOKEN);
  if (!accessToken) {
    return res.status(500).json({ error: 'POLAR_ACCESS_TOKEN is missing' });
  }

  const serverMode = trim(process.env.POLAR_SERVER).toLowerCase();
  const baseUrl =
    serverMode === 'sandbox'
      ? POLAR_API_BASE.sandbox
      : POLAR_API_BASE.production;

  try {
    const url = `${baseUrl}/subscriptions/?external_customer_id=${encodeURIComponent(uid)}&active=true&limit=10`;
    const polarRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!polarRes.ok) {
      return res.status(polarRes.status).json({
        error: 'Failed to fetch subscriptions from Polar',
      });
    }

    const data = (await polarRes.json()) as {
      items: GenericData[];
    };

    const activeSub = data.items.find(
      (s) => asString(s.status) === 'active',
    );

    if (!activeSub) {
      return res.status(200).json({
        synced: true,
        plan: null,
        isActive: false,
        subscriptionId: null,
      });
    }

    const productId = asString(activeSub.product_id);
    const plan = planByProductId(productId);
    const subscriptionId = asString(activeSub.id);
    const subscriptionStatus = asString(activeSub.status);
    const cancelAtPeriodEnd = activeSub.cancel_at_period_end === true;

    // Firestore 동기화
    const db = getAdminDb();
    const profileRef = db.doc(`users/${uid}/profile/main`);
    const billingRef = db.doc(`users/${uid}/billing/polar`);

    await Promise.all([
      profileRef.set(
        {
          billingProvider: 'polar',
          billingPlan: plan,
          billingStatus: subscriptionStatus,
          billingIsActive: true,
          billingSubscriptionId: subscriptionId,
          billingUpdatedAt: Date.now(),
        },
        { merge: true },
      ),
      billingRef.set(
        {
          provider: 'polar',
          externalCustomerId: uid,
          plan,
          productId,
          subscriptionStatus,
          subscriptionId,
          isActive: true,
          cancelAtPeriodEnd,
          syncedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
    ]);

    return res.status(200).json({
      synced: true,
      plan,
      isActive: true,
      subscriptionId,
      cancelAtPeriodEnd,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to sync subscription' });
  }
}
