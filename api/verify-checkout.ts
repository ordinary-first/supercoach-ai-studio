import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../lib/authMiddleware.js';
import { setCorsHeaders } from '../lib/corsHeaders.js';

type PolarCheckout = {
  id?: string;
  status?: string;
  external_customer_id?: string | null;
  customer_external_id?: string | null;
  subscription_id?: string | null;
  products?: Array<{ id?: string; name?: string }>;
  product_id?: string | null;
};

type PlanTier = 'explorer' | 'essential' | 'visionary' | 'master' | null;

const POLAR_API_BASE = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const;

const trim = (value: string | undefined): string => (value ?? '').trim();

const parsePlanFromProductId = (productId: string | null): PlanTier => {
  if (!productId) return null;

  const explorer = trim(process.env.POLAR_PRODUCT_ID_EXPLORER);
  const essential = trim(process.env.POLAR_PRODUCT_ID_ESSENTIAL);
  const visionary = trim(process.env.POLAR_PRODUCT_ID_VISIONARY);
  const master = trim(process.env.POLAR_PRODUCT_ID_MASTER);

  if (productId === explorer) return 'explorer';
  if (productId === essential) return 'essential';
  if (productId === visionary) return 'visionary';
  if (productId === master) return 'master';
  return null;
};

const resolveCheckoutId = (req: VercelRequest): string => {
  const fromQuery = typeof req.query.checkout_id === 'string' ? req.query.checkout_id : '';
  if (fromQuery.trim().length > 0) return fromQuery.trim();

  const body = req.body as { checkoutId?: string; checkout_id?: string } | undefined;
  if (body?.checkoutId && body.checkoutId.trim().length > 0) return body.checkoutId.trim();
  if (body?.checkout_id && body.checkout_id.trim().length > 0) return body.checkout_id.trim();

  return '';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { error: authError } = await authenticateRequest(req);
  if (authError) return res.status(authError.status).json(authError.body);

  const accessToken = trim(process.env.POLAR_ACCESS_TOKEN);
  if (!accessToken) {
    return res.status(500).json({ error: 'POLAR_ACCESS_TOKEN is missing' });
  }

  const checkoutId = resolveCheckoutId(req);
  if (!checkoutId) {
    return res.status(400).json({ error: 'checkout_id is required' });
  }

  const serverMode = trim(process.env.POLAR_SERVER).toLowerCase();
  const baseUrl =
    serverMode === 'sandbox' ? POLAR_API_BASE.sandbox : POLAR_API_BASE.production;

  try {
    const response = await fetch(`${baseUrl}/checkouts/${encodeURIComponent(checkoutId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const raw = await response.text();
    const parsed = raw.length > 0 ? (JSON.parse(raw) as PolarCheckout & { detail?: string }) : {};

    if (!response.ok) {
      const message =
        typeof parsed.detail === 'string' && parsed.detail.trim().length > 0
          ? parsed.detail
          : 'Failed to verify checkout';
      return res.status(response.status).json({ error: message });
    }

    const status = typeof parsed.status === 'string' ? parsed.status : 'unknown';
    const subscriptionId =
      typeof parsed.subscription_id === 'string' && parsed.subscription_id.length > 0
        ? parsed.subscription_id
        : null;

    const productId =
      typeof parsed.product_id === 'string' && parsed.product_id.length > 0
        ? parsed.product_id
        : parsed.products && parsed.products.length > 0 && typeof parsed.products[0]?.id === 'string'
          ? (parsed.products[0]?.id as string)
          : null;

    const plan = parsePlanFromProductId(productId);
    const verified = status === 'confirmed';
    const isSubscriptionActive = verified && subscriptionId !== null;

    return res.status(200).json({
      verified,
      checkoutId,
      checkoutStatus: status,
      plan,
      productId,
      subscriptionId,
      isSubscriptionActive,
      externalCustomerId: parsed.external_customer_id ?? parsed.customer_external_id ?? null,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to reach Polar API' });
  }
}
