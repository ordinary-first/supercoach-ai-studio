import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PlanTier } from '../services/polarService';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';
import { verifySubscriptionOwnership } from '../lib/verifySubscriptionOwnership.js';

const trim = (v: string | undefined): string => (v ?? '').trim();

const POLAR_API_BASE = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const;

const PLAN_TO_ENV_KEY: Record<PlanTier, string> = {
  explorer: 'POLAR_PRODUCT_ID_EXPLORER',
  essential: 'POLAR_PRODUCT_ID_ESSENTIAL',
  visionary: 'POLAR_PRODUCT_ID_VISIONARY',
  master: 'POLAR_PRODUCT_ID_MASTER',
};

const normalizePlan = (plan: unknown): PlanTier | null => {
  if (
    plan === 'explorer' ||
    plan === 'essential' ||
    plan === 'visionary' ||
    plan === 'master'
  ) {
    return plan;
  }
  return null;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);
  const uid = user!.uid;

  const accessToken = trim(process.env.POLAR_ACCESS_TOKEN);
  if (!accessToken) {
    return res.status(500).json({ error: 'POLAR_ACCESS_TOKEN is missing' });
  }

  const body = (req.body ?? {}) as {
    subscriptionId?: string;
    newPlan?: string;
  };

  const subscriptionId = typeof body.subscriptionId === 'string'
    ? body.subscriptionId.trim()
    : '';
  const newPlan = normalizePlan(body.newPlan);

  if (!subscriptionId) {
    return res.status(400).json({ error: 'Missing subscriptionId' });
  }
  if (!newPlan) {
    return res.status(400).json({ error: 'Invalid newPlan' });
  }

  const isOwner = await verifySubscriptionOwnership(uid, subscriptionId);
  if (!isOwner) {
    return res.status(403).json({ error: 'Subscription does not belong to this user' });
  }

  const productId = trim(process.env[PLAN_TO_ENV_KEY[newPlan]]);
  if (!productId) {
    return res
      .status(500)
      .json({ error: `Missing product id for plan: ${newPlan}` });
  }

  const serverMode = trim(process.env.POLAR_SERVER).toLowerCase();
  const baseUrl =
    serverMode === 'sandbox'
      ? POLAR_API_BASE.sandbox
      : POLAR_API_BASE.production;

  try {
    const polarRes = await fetch(
      `${baseUrl}/subscriptions/${subscriptionId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ product_id: productId }),
      },
    );

    const raw = await polarRes.text();
    const parsed = raw.length > 0
      ? (JSON.parse(raw) as Record<string, unknown>)
      : {};

    if (!polarRes.ok) {
      const detail =
        typeof parsed.detail === 'string'
          ? parsed.detail
          : typeof parsed.error === 'string'
            ? parsed.error
            : 'Failed to change plan';
      return res.status(polarRes.status).json({ error: detail });
    }

    return res.status(200).json({
      success: true,
      newPlan,
      subscriptionId,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to reach Polar API' });
  }
}
