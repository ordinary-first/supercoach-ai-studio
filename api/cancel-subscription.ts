import type { VercelRequest, VercelResponse } from '@vercel/node';

const trim = (v: string | undefined): string => (v ?? '').trim();

const POLAR_API_BASE = {
  production: 'https://api.polar.sh/v1',
  sandbox: 'https://sandbox-api.polar.sh/v1',
} as const;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = trim(process.env.POLAR_ACCESS_TOKEN);
  if (!accessToken) {
    return res.status(500).json({ error: 'POLAR_ACCESS_TOKEN is missing' });
  }

  const body = (req.body ?? {}) as { subscriptionId?: string };
  const subscriptionId = typeof body.subscriptionId === 'string'
    ? body.subscriptionId.trim()
    : '';

  if (!subscriptionId) {
    return res.status(400).json({ error: 'Missing subscriptionId' });
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
        body: JSON.stringify({ cancel_at_period_end: true }),
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
            : 'Failed to cancel subscription';
      return res.status(polarRes.status).json({ error: detail });
    }

    return res.status(200).json({
      success: true,
      cancelAtPeriodEnd: true,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to reach Polar API' });
  }
}
