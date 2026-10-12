import type { BillingProviderAdapter, CheckoutSession, CreateCheckoutInput } from '@/lib/billing/providers/types';
import { PaymentMethod } from '@/lib/billing/types';

/**
 * No-op crypto checkout for forks/self-host without a payment processor configured.
 * Returns a local success URL — fulfillment must be manual or via admin grants.
 */
export class StubBillingAdapter implements BillingProviderAdapter {
  id = 'stub';
  method = PaymentMethod.CRYPTO;
  displayName = 'Stub (no processor)';

  isConfigured(): boolean {
    return true;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const paymentId = `stub_${input.userId}_${Date.now()}`;
    const url = new URL(input.redirectUrl);
    url.searchParams.set('stub_checkout', '1');
    url.searchParams.set('payment_id', paymentId);
    url.searchParams.set('plan_id', input.planId);

    return {
      id: paymentId,
      url: url.toString(),
      provider: this.method,
      adapterId: this.id,
    };
  }
}
