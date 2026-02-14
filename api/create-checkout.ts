import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PlanTier } from '../services/polarService';

type CheckoutBody = {
  plan?: PlanTier;
  customerEmail?: string;
  customerName?: string;
  externalCustomerId?: string;
};

const PLAN_TO_ENV_KEY: Record<PlanTier, string> = {
  explorer: 'POLAR_PRODUCT_ID_EXPLORER',
  essential: 'POLAR_PRODUCT_ID_ESSENTIAL',
  visionary: 'POLAR_PRODUCT_ID_VISIONARY',
  master: 'POLAR_PRODUCT_ID_MASTER',
};

const POLAR_API_BASE = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const;

const trim = (value: string | undefined): string => (value ?? '').trim();

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

const cleanOptional = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = trim(process.env.POLAR_ACCESS_TOKEN);
  const successUrl = trim(process.env.POLAR_SUCCESS_URL);
  const serverMode = trim(process.env.POLAR_SERVER).toLowerCase();
  const baseUrl =
    serverMode === 'sandbox' ? POLAR_API_BASE.sandbox : POLAR_API_BASE.production;

  if (!accessToken) {
    return res.status(500).json({ error: 'POLAR_ACCESS_TOKEN is missing' });
  }

  if (!successUrl) {
    return res.status(500).json({ error: 'POLAR_SUCCESS_URL is missing' });
  }

  const body = (req.body ?? {}) as CheckoutBody;
  const plan = normalizePlan(body.plan);
  if (!plan) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const productId = trim(process.env[PLAN_TO_ENV_KEY[plan]]);
  if (!productId) {
    return res.status(500).json({ error: `Missing product id for plan: ${plan}` });
  }

  const origin = cleanOptional(req.headers.origin);

  const payload: Record<string, unknown> = {
    products: [productId],
    success_url: successUrl,
    metadata: {
      app: 'secret-coach-web-legacy',
      plan,
    },
  };

  const externalCustomerId = cleanOptional(body.externalCustomerId);
  const customerEmail = cleanOptional(body.customerEmail);
  const customerName = cleanOptional(body.customerName);

  if (externalCustomerId) payload.external_customer_id = externalCustomerId;
  if (customerEmail) payload.customer_email = customerEmail;
  if (customerName) payload.customer_name = customerName;
  if (origin) payload.return_url = origin;

  try {
    const polarResponse = await fetch(`${baseUrl}/checkouts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await polarResponse.text();
    const parsed = raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};

    if (!polarResponse.ok) {
      const errorMessage =
        typeof parsed.detail === 'string'
          ? parsed.detail
          : typeof parsed.error === 'string'
            ? parsed.error
            : 'Failed to create Polar checkout';
      return res.status(polarResponse.status).json({ error: errorMessage });
    }

    const checkoutUrl =
      typeof parsed.url === 'string'
        ? parsed.url
        : typeof parsed.checkout_url === 'string'
          ? parsed.checkout_url
          : null;

    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Polar checkout URL missing in response' });
    }

    return res.status(200).json({ url: checkoutUrl });
  } catch {
    return res.status(500).json({ error: 'Failed to reach Polar API' });
  }
}
