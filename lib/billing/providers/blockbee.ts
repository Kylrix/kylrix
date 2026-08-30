import type { BillingProviderAdapter, CheckoutSession, CreateCheckoutInput } from '@/lib/billing/providers/types';
import { PaymentMethod } from '@/lib/billing/types';

const DEFAULT_API_BASE = 'https://api.blockbee.io';

function apiBase(): string {
  return (process.env.BLOCKBEE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}

export class BlockBeeBillingAdapter implements BillingProviderAdapter {
  id = 'blockbee';
  method = PaymentMethod.CRYPTO;
  displayName = 'BlockBee';

  isConfigured(): boolean {
    return Boolean(process.env.BLOCKBEE_API?.trim());
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const blockbeeApiKey = process.env.BLOCKBEE_API?.trim();
    if (!blockbeeApiKey) {
      throw new Error('BLOCKBEE_API environment variable is not configured');
    }

    const queryParams: Record<string, string> = {
      apikey: blockbeeApiKey,
      value: input.amountUsd.toString(),
      currency: 'USD',
      redirect_url: input.redirectUrl,
      notify_url: input.notifyUrl,
      post: '1',
    };
    if (input.email) {
      queryParams.customer_email = input.email;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    const response = await fetch(`${apiBase()}/checkout/request/?${queryString}`);
    const data = await response.json();

    if (data.status !== 'success') {
      const errMsg =
        data.error || data.message || (typeof data === 'object' ? JSON.stringify(data) : String(data));
      throw new Error(`BlockBee API Error: ${errMsg}`);
    }

    const paymentId = String(data.payment_id || '').trim();
    if (!paymentId || !data.payment_url) {
      throw new Error('BlockBee API returned an incomplete checkout session');
    }

    return {
      id: paymentId,
      url: data.payment_url,
      provider: this.method,
      adapterId: this.id,
    };
  }

  async verifyTransaction(_transactionId: string): Promise<boolean> {
    return true;
  }
}
