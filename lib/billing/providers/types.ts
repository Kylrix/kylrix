/**
 * Pluggable billing provider types — forks can register custom checkout backends
 * without touching BlockBee-specific code paths.
 */

import type { PaymentMethod } from '@/lib/billing/types';

export type CheckoutGiftDetails = {
  recipientUserId: string;
  recipientName?: string;
  giftMessage?: string;
};

export type CheckoutOptions = {
  couponId?: string | null;
  discountPercent?: number | null;
  adjustedAmountUsd?: number | null;
  baseUrl?: string | null;
};

export type CheckoutSession = {
  id: string;
  url: string;
  provider: PaymentMethod;
  /** Concrete adapter id, e.g. blockbee, stripe, stub */
  adapterId: string;
};

export type CreateCheckoutInput = {
  planId: string;
  userId: string;
  countryCode: string;
  months: number;
  email?: string;
  giftDetails?: CheckoutGiftDetails;
  options?: CheckoutOptions;
  amountUsd: number;
  notifyUrl: string;
  redirectUrl: string;
};

export type BillingProviderAdapter = {
  /** Stable adapter id stored on ledger rows and pending checkout registry. */
  id: string;
  /** Payment method bucket this adapter serves. */
  method: PaymentMethod;
  displayName: string;
  isConfigured(): boolean;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyTransaction?(transactionId: string): Promise<boolean>;
};

export type PendingCheckoutMeta = {
  paymentId: string;
  providerAdapterId: string;
  payerUserId: string;
  planId: string;
  months: number;
  countryCode: string;
  expectedAmountUsd: number;
  giftRecipientId?: string | null;
  giftRecipientName?: string | null;
  giftMessage?: string | null;
  couponId?: string | null;
  createdAt: string;
};
