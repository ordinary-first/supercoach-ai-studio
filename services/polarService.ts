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

const toMessage = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return 'Failed to create checkout session.';
};

export const createPolarCheckout = async (
  payload: CreateCheckoutRequest
): Promise<CreateCheckoutResponse> => {
  const response = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
