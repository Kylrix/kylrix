import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';
import { resolveBillingNotifyUrl, resolveBillingSuccessUrl } from '@/lib/billing/callback-urls';
import { registerForkBillingProviders } from '@/lib/billing/register-fork-providers';
import {
  registerBillingAdapter,
  resolveBillingAdapterForMethod,
  resolveCryptoBillingAdapter} from '@/lib/billing/providers/registry';
import type {
  BillingProviderAdapter,
  CheckoutGiftDetails,
  CheckoutOptions,
  CheckoutSession,
  CreateCheckoutInput} from '@/lib/billing/providers/types';
import { PaymentMethod } from '@/lib/billing/types';

export type { CheckoutSession, CheckoutGiftDetails, CheckoutOptions } from '@/lib/billing/providers/types';

export interface PaymentProvider {
  name: PaymentMethod;
  adapterId: string;
  createCheckoutSession(
    planId: string,
    userId: string,
    countryCode?: string,
    months?: number,
    email?: string,
    giftDetails?: CheckoutGiftDetails,
    options?: CheckoutOptions,
  ): Promise<CheckoutSession>;
  verifyTransaction(transactionId: string): Promise<boolean>;
  handleWebhook?(payload: unknown, signature?: string): Promise<void>;
}

function buildCheckoutUrls(
  userId: string,
  planId: string,
  months: number,
  giftDetails?: CheckoutGiftDetails,
  options?: CheckoutOptions,
): { notifyUrl: string; redirectUrl: string } {
  const notify = new URL(resolveBillingNotifyUrl());
  notify.searchParams.set('order_id', userId);
  notify.searchParams.set('plan_id', planId);
  notify.searchParams.set('months', String(months));
  if (options?.couponId) notify.searchParams.set('coupon_id', String(options.couponId));
  if (typeof options?.discountPercent === 'number') {
    notify.searchParams.set('discount_percent', String(options.discountPercent));
  }
  if (giftDetails?.recipientUserId) {
    notify.searchParams.set('gift_recipient_id', giftDetails.recipientUserId);
    if (giftDetails.recipientName) notify.searchParams.set('gift_recipient_name', giftDetails.recipientName);
    if (giftDetails.giftMessage) notify.searchParams.set('gift_message', giftDetails.giftMessage);
  }

  const redirect = new URL(resolveBillingSuccessUrl());
  redirect.searchParams.set('order_id', userId);

  return { notifyUrl: notify.toString(), redirectUrl: redirect.toString() };
}

function adapterToProvider(adapter: BillingProviderAdapter, method?: PaymentMethod): PaymentProvider {
  const paymentMethod = method ?? adapter.method;
  return {
    name: paymentMethod,
    adapterId: adapter.id,
    async createCheckoutSession(
      planId,
      userId,
      countryCode = 'US',
      months = 1,
      email,
      giftDetails,
      options,
    ) {
      const pricingMethod =
        paymentMethod === PaymentMethod.CRYPTO ? ('CRYPTO' as const) : ('CARD' as const);
      const baseAmount = calculateSubscriptionPrice(planId, countryCode, pricingMethod, months);
      const amountUsd =
        typeof options?.adjustedAmountUsd === 'number' ? options.adjustedAmountUsd : baseAmount;
      const urls = buildCheckoutUrls(userId, planId, months, giftDetails, options);

      const input: CreateCheckoutInput = {
        planId,
        userId,
        countryCode,
        months,
        email,
        giftDetails,
        options,
        amountUsd,
        notifyUrl: urls.notifyUrl,
        redirectUrl: urls.redirectUrl,
      };

      return adapter.createCheckoutSession(input);
    },
    async verifyTransaction(transactionId: string) {
      if (adapter.verifyTransaction) {
        return adapter.verifyTransaction(transactionId);
      }
      return true;
    },
    async handleWebhook(payload: unknown, signature?: string) {
      console.log(`[Billing:${adapter.id}] Webhook received`, { payload, signature });
    },
  };
}

class BillingManager {
  private providers = new Map<PaymentMethod, PaymentProvider>();

  registerProvider(provider: PaymentProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`Payment method ${method} is not enabled on this deployment`);
    }
    return provider;
  }

  getActiveCryptoProvider(): PaymentProvider {
    return adapterToProvider(resolveCryptoBillingAdapter());
  }
}

export const billingManager = new BillingManager();

/** Register env-selected adapters. Call once at module load. */
export function registerDefaultBillingProviders(): void {
  registerForkBillingProviders();
  billingManager.registerProvider(adapterToProvider(resolveCryptoBillingAdapter()));
}

export { adapterToProvider };

/** Fork helper — register a custom adapter and expose it on a payment method bucket. */
export function registerForkPaymentMethod(
  adapter: BillingProviderAdapter,
  method: PaymentMethod = PaymentMethod.CRYPTO,
): void {
  registerBillingAdapter(adapter);
  billingManager.registerProvider(adapterToProvider(adapter, method));
}

registerDefaultBillingProviders();

export function resolveProviderAdapterId(method: PaymentMethod): string {
  return resolveBillingAdapterForMethod(method).id;
}
