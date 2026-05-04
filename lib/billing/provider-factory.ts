import { PaymentMethod } from './types';

export interface CheckoutSession {
  id: string;
  url: string;
  provider: PaymentMethod;
}

export interface PaymentProvider {
  name: PaymentMethod;
  createCheckoutSession(
    planId: string,
    userId: string,
    countryCode?: string,
    months?: number,
    email?: string,
    giftDetails?: {
      recipientUserId: string;
      recipientName?: string;
      giftMessage?: string;
    },
    options?: {
      couponId?: string | null;
      discountPercent?: number | null;
      adjustedAmountUsd?: number | null;
    },
  ): Promise<CheckoutSession>;
  verifyTransaction(transactionId: string): Promise<boolean>;
  handleWebhook(payload: any, signature?: string): Promise<void>;
}

export class BillingManager {
  private providers: Map<PaymentMethod, PaymentProvider> = new Map();

  registerProvider(provider: PaymentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) throw new Error(`Provider ${method} not registered`);
    return provider;
  }
}

export const billingManager = new BillingManager();
