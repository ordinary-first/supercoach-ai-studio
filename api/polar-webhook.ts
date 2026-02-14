import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from 'firebase-admin/firestore';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { getAdminDb } from '../lib/firebaseAdmin.js';

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

type GenericData = Record<string, unknown>;

const trim = (value: string | undefined): string => (value ?? '').trim();

const toHeaders = (headers: VercelRequest['headers']): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') result[key] = value;
    else if (Array.isArray(value)) result[key] = value.join(',');
  }
  return result;
};

const readRawBody = async (req: VercelRequest): Promise<Buffer> => {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const planByProductId = (productId: string | null): string | null => {
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

const asObject = (value: unknown): GenericData | null => {
  if (!value || typeof value !== 'object') return null;
  return value as GenericData;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
};

const extractExternalCustomerId = (data: GenericData): string | null => {
  const direct = asString(data.externalId) ?? asString(data.external_customer_id);
  if (direct) return direct;

  const customer = asObject(data.customer);
  if (!customer) return null;
  return (
    asString(customer.externalId) ??
    asString(customer.external_id) ??
    asString(customer.externalCustomerId)
  );
};

const extractProductId = (eventType: string, data: GenericData): string | null => {
  const direct = asString(data.productId) ?? asString(data.product_id);
  if (direct) return direct;

  if (eventType === 'customer.state_changed') {
    const activeSubscriptions = data.activeSubscriptions;
    if (Array.isArray(activeSubscriptions) && activeSubscriptions.length > 0) {
      const first = asObject(activeSubscriptions[0]);
      if (first) {
        return asString(first.productId) ?? asString(first.product_id);
      }
    }
  }

  return null;
};

const extractSubscriptionStatus = (eventType: string, data: GenericData): string | null => {
  const status = asString(data.status);
  if (status) return status;

  if (eventType === 'customer.state_changed') {
    const activeSubscriptions = data.activeSubscriptions;
    if (Array.isArray(activeSubscriptions) && activeSubscriptions.length > 0) {
      return 'active';
    }
    return 'inactive';
  }

  if (eventType === 'order.paid') return 'paid';
  return null;
};

const extractSubscriptionId = (eventType: string, data: GenericData): string | null => {
  const direct = asString(data.subscriptionId) ?? asString(data.subscription_id);
  if (direct) return direct;
  if (eventType.startsWith('subscription.')) return asString(data.id);
  return null;
};

const isActiveStatus = (status: string | null): boolean => {
  if (!status) return false;
  return ['active', 'trialing', 'paid'].includes(status);
};

const syncBillingState = async (
  eventType: string,
  timestampIso: string,
  data: GenericData
): Promise<{ synced: boolean; reason?: string }> => {
  const externalCustomerId = extractExternalCustomerId(data);
  if (!externalCustomerId) {
    return { synced: false, reason: 'external_customer_id_missing' };
  }

  const productId = extractProductId(eventType, data);
  const plan = planByProductId(productId);
  const subscriptionStatus = extractSubscriptionStatus(eventType, data);
  const subscriptionId = extractSubscriptionId(eventType, data);
  const polarCustomerId =
    asString(data.customerId) ??
    asString(data.customer_id) ??
    asString(asObject(data.customer)?.id);
  const checkoutId = asString(data.checkoutId) ?? asString(data.checkout_id);
  const isActive = isActiveStatus(subscriptionStatus);

  const db = getAdminDb();
  const billingRef = db.doc(`users/${externalCustomerId}/billing/polar`);
  const profileRef = db.doc(`users/${externalCustomerId}/profile/main`);

  await billingRef.set(
    {
      provider: 'polar',
      externalCustomerId,
      polarCustomerId,
      plan,
      productId,
      subscriptionStatus,
      subscriptionId,
      checkoutId,
      isActive,
      lastEventType: eventType,
      lastEventAt: timestampIso,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await profileRef.set(
    {
      billingProvider: 'polar',
      billingPlan: plan,
      billingStatus: subscriptionStatus,
      billingIsActive: isActive,
      billingUpdatedAt: Date.now(),
    },
    { merge: true }
  );

  return { synced: true };
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

  const webhookSecret = trim(process.env.POLAR_WEBHOOK_SECRET);
  if (!webhookSecret) {
    return res.status(500).json({ error: 'POLAR_WEBHOOK_SECRET is missing' });
  }

  const rawBody = await readRawBody(req);
  const headers = toHeaders(req.headers);

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(rawBody, headers, webhookSecret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  const eventType = event.type;
  if (!SUPPORTED_EVENTS.has(eventType)) {
    return res.status(200).json({
      received: true,
      ignored: true,
      reason: 'unsupported_event',
      eventType,
    });
  }

  const data = asObject(event.data);
  if (!data) {
    return res.status(400).json({ error: 'Invalid event data' });
  }

  try {
    const synced = await syncBillingState(eventType, event.timestamp.toISOString(), data);
    return res.status(200).json({
      received: true,
      ignored: false,
      eventType,
      synced: synced.synced,
      reason: synced.reason ?? null,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to sync billing state' });
  }
}
