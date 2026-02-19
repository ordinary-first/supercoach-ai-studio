import { getAuthHeaders, getAuthToken } from './apiClient';

export type PlanTier = 'explorer' | 'essential' | 'visionary' | 'master';

interface CreateCheckoutRequest {
  plan: PlanTier;
  customerEmail?: string;
  customerName?: string;
  externalCustomerId?: string;
}

interface CreateCheckoutResponse {
  url: string;
}

export interface VerifyCheckoutResponse {
  verified: boolean;
  checkoutId: string;
  checkoutStatus: string;
  plan: PlanTier | null;
  productId: string | null;
  subscriptionId: string | null;
  isSubscriptionActive: boolean;
  externalCustomerId: string | null;
}

const toMessage = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return 'Failed to create checkout session.';
};

export const createPolarCheckout = async (
  payload: CreateCheckoutRequest
): Promise<CreateCheckoutResponse> => {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };

  if (!response.ok || typeof result.url !== 'string') {
    throw new Error(toMessage(result.error));
  }

  return { url: result.url };
};

export const verifyPolarCheckout = async (
  checkoutId: string
): Promise<VerifyCheckoutResponse> => {
  const token = await getAuthToken();
  const fetchHeaders: Record<string, string> = {};
  if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
  const response = await fetch(
    `/api/verify-checkout?checkout_id=${encodeURIComponent(checkoutId)}`,
    { method: 'GET', headers: fetchHeaders }
  );

  const result = (await response.json().catch(() => ({}))) as
    | VerifyCheckoutResponse
    | { error?: string };

  if (!response.ok || !('verified' in result)) {
    throw new Error(toMessage((result as { error?: string }).error));
  }

  return result;
};
