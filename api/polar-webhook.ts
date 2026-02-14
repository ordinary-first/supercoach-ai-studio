import type { VercelRequest, VercelResponse } from '@vercel/node';

type PolarWebhookPayload = {
  type?: string;
  data?: Record<string, unknown>;
};

const SUPPORTED_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.active',
  'subscription.canceled',
  'subscription.revoked',
  'subscription.past_due',
  'customer.state_changed',
  'order.paid',
]);

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

  const payload = req.body as PolarWebhookPayload;
  const eventType = payload?.type;

  if (!eventType || typeof eventType !== 'string') {
    return res.status(400).json({ error: 'Invalid webhook payload: missing event type' });
  }

  if (!SUPPORTED_EVENTS.has(eventType)) {
    return res.status(200).json({
      received: true,
      ignored: true,
      reason: 'unsupported_event',
      eventType,
    });
  }

  // TODO: Persist subscription/customer state into your server-side user store.
  // Step 1 goal is to keep endpoint live and acknowledged by Polar.
  return res.status(200).json({
    received: true,
    ignored: false,
    eventType,
  });
}
