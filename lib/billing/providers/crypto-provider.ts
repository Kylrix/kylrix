/**
 * @deprecated Use billingManager.getProvider(PaymentMethod.CRYPTO) from provider-factory.
 */
import { billingManager } from '@/lib/billing/provider-factory';
import type { PaymentProvider } from '@/lib/billing/provider-factory';
import { PaymentMethod } from '@/lib/billing/types';

export type { PaymentProvider };

export class CryptoPaymentProvider implements PaymentProvider {
  private readonly inner = billingManager.getProvider(PaymentMethod.CRYPTO);

  name = this.inner.name;
  adapterId = this.inner.adapterId;

  createCheckoutSession(...args: Parameters<PaymentProvider['createCheckoutSession']>) {
    return this.inner.createCheckoutSession(...args);
  }

  verifyTransaction(transactionId: string) {
    return this.inner.verifyTransaction(transactionId);
  }

  async handleWebhook(payload: unknown, signature?: string) {
    await this.inner.handleWebhook?.(payload, signature);
  }
}
