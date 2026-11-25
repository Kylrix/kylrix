import type {
  BillingProviderAdapter,
  CheckoutSession,
  CreateCheckoutInput,
} from '@/lib/billing/providers/types';
import { PaymentMethod } from '@/lib/billing/types';

const DEFAULT_SANDBOX_API_BASE = 'https://sandbox-api.bachs.io';
const DEFAULT_LIVE_API_BASE = 'https://api.bachs.io';

function resolveBachsApiBase(apiKey: string): string {
  const override = process.env.BACHS_API_BASE?.trim().replace(/\/+$/, '');
  if (override) return override;

  const env = (process.env.BACHS_ENVIRONMENT || '').trim().toLowerCase();
  if (env === 'sandbox' || apiKey.startsWith('sk_sandbox_')) {
    return DEFAULT_SANDBOX_API_BASE;
  }
  return DEFAULT_LIVE_API_BASE;
}

export class BachsBillingAdapter implements BillingProviderAdapter {
  id = 'bachs';
  method = PaymentMethod.CARD;
  displayName = 'Credit / Debit Card (Bachs)';

  isConfigured(): boolean {
    return Boolean(process.env.BACHS_API_KEY?.trim());
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const apiKey = process.env.BACHS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('BACHS_API_KEY environment variable is not configured');
    }

    const apiBase = resolveBachsApiBase(apiKey);
    const amountStr = input.amountUsd.toFixed(2);

    const payload: Record<string, unknown> = {
      pricing: {
        currency: 'USD',
        amount: amountStr,
        price_type: 'fixed',
      },
      payment_method_types: ['USD_CARD'],
      success_url: input.redirectUrl,
      cancel_url: input.redirectUrl,
      metadata: {
        planId: input.planId,
        userId: input.userId,
        months: String(input.months),
        countryCode: input.countryCode,
        couponId: input.options?.couponId || '',
        giftRecipientId: input.giftDetails?.recipientUserId || '',
        giftRecipientName: input.giftDetails?.recipientName || '',
      },
    };

    if (input.email) {
      payload.customer = {
        email: input.email,
      };
    }

    const response = await fetch(`${apiBase}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        data?.detail ||
        data?.message ||
        data?.error_code ||
        (typeof data === 'object' ? JSON.stringify(data) : String(data));
      throw new Error(`Bachs API Error (${response.status}): ${errMsg}`);
    }

    const checkoutId = String(data.checkout_id || data.id || '').trim();
    const checkoutUrl = String(data.checkout_url || data.url || '').trim();

    if (!checkoutId || !checkoutUrl) {
      throw new Error('Bachs API returned an incomplete checkout session response');
    }

    return {
      id: checkoutId,
      url: checkoutUrl,
      provider: this.method,
      adapterId: this.id,
    };
  }

  async verifyTransaction(checkoutId: string): Promise<boolean> {
    const apiKey = process.env.BACHS_API_KEY?.trim();
    if (!apiKey) return false;

    try {
      const apiBase = resolveBachsApiBase(apiKey);
      const response = await fetch(`${apiBase}/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data?.status === 'completed' || data?.payment_status === 'paid';
    } catch {
      return false;
    }
  }
}
