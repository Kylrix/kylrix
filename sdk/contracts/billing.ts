import { MCP_EMPTY_INPUT } from './common';

export interface BillingCheckoutSessionRecord {
  id: string;
  url: string;
  provider: string;
  planId: string;
  amountUsd: number;
  status: string;
  addressIn?: string | null;
  qrCode?: string | null;
  paymentUri?: string | null;
  minimumTransactionCoin?: number | null;
  coin?: string | null;
  expiresAt?: string | null;
}

export interface BillingStatusRecord {
  authenticated: boolean;
  userId: string;
  active: boolean;
  tier: string;
  expiresAt: string | null;
  source: string;
  balance: {
    amount: number;
    symbol: string;
  };
  transactions: Array<{
    id: string;
    plan: string;
    amountUsd: string;
    status: string;
    provider: string;
    createdAt?: string;
  }>;
}

export interface BillingCouponRecord {
  ok: boolean;
  claimed: boolean;
  requiresPayment?: boolean;
  couponId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  discountPercent?: number;
  message?: string;
}

export interface SupportedPaymentCoinRecord {
  ticker: string;
  name: string;
  network: string;
  symbol: string;
  recommended?: boolean;
}

export function shapeBillingCheckoutSession(data: {
  id: string;
  url: string;
  provider?: string;
  planId: string;
  amountUsd: number;
  status?: string;
  addressIn?: string | null;
  qrCode?: string | null;
  paymentUri?: string | null;
  minimumTransactionCoin?: number | null;
  coin?: string | null;
  expiresAt?: string | null;
}): BillingCheckoutSessionRecord {
  return {
    id: data.id,
    url: data.url,
    provider: data.provider || 'crypto',
    planId: data.planId,
    amountUsd: data.amountUsd,
    status: data.status || 'pending',
    addressIn: data.addressIn || null,
    qrCode: data.qrCode || null,
    paymentUri: data.paymentUri || null,
    minimumTransactionCoin: data.minimumTransactionCoin || null,
    coin: data.coin || null,
    expiresAt: data.expiresAt || null,
  };
}

export function shapeBillingStatus(data: {
  userId: string;
  active: boolean;
  tier: string;
  expiresAt: string | null;
  source: string;
  balance: { amount: number; symbol: string };
  transactions?: any[];
}): BillingStatusRecord {
  return {
    authenticated: true,
    userId: data.userId,
    active: data.active,
    tier: data.tier,
    expiresAt: data.expiresAt,
    source: data.source,
    balance: data.balance,
    transactions: (data.transactions || []).map((tx) => ({
      id: tx.$id || tx.paymentId || tx.id,
      plan: tx.plan || 'pro',
      amountUsd: tx.amountUsd || '$0.00',
      status: tx.status || 'completed',
      provider: tx.provider || 'blockbee',
      createdAt: tx.createdAt || tx.$createdAt,
    })),
  };
}

export function shapeBillingCouponResult(data: {
  ok: boolean;
  claimed: boolean;
  requiresPayment?: boolean;
  couponId: string;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  discountPercent?: number;
  message?: string;
}): BillingCouponRecord {
  return {
    ok: data.ok,
    claimed: data.claimed,
    requiresPayment: data.requiresPayment ?? false,
    couponId: data.couponId || '',
    subscriptionId: data.subscriptionId || null,
    currentPeriodEnd: data.currentPeriodEnd || null,
    discountPercent: data.discountPercent,
    message: data.message,
  };
}

// ── JSON Schemas for MCP & OpenAPI ──

export const BILLING_CHECKOUT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Unique payment or checkout ID' },
    url: { type: 'string', description: 'Hosted checkout URL for human/browser checkout' },
    provider: { type: 'string', description: 'Payment provider (crypto, blockbee)' },
    planId: { type: 'string', description: 'Target subscription plan (PRO_MONTH, PRO_YEAR, TEAMS_MONTH, TEAMS_YEAR)' },
    amountUsd: { type: 'number', description: 'Amount in USD' },
    status: { type: 'string', description: 'Payment status (pending, completed)' },
    addressIn: { type: 'string', nullable: true, description: 'Direct on-chain deposit address for CLI/autonomous agent payments' },
    qrCode: { type: 'string', nullable: true, description: 'Base64/URL QR code for on-chain crypto payment' },
    paymentUri: { type: 'string', nullable: true, description: 'BIP21 / Crypto URI for wallet automation' },
    minimumTransactionCoin: { type: 'number', nullable: true, description: 'Minimum deposit required in native coin units' },
    coin: { type: 'string', nullable: true, description: 'Crypto ticker selected for direct payment' },
  },
} as const;

export const BILLING_STATUS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    authenticated: { type: 'boolean' },
    userId: { type: 'string' },
    active: { type: 'boolean', description: 'Whether the account currently has active Pro/Teams access' },
    tier: { type: 'string', description: 'Current tier: FREE, PRO, or TEAMS' },
    expiresAt: { type: 'string', nullable: true, description: 'ISO date of current subscription expiry' },
    source: { type: 'string', description: 'Entitlement origin: subscription, admin, trial, or none' },
    balance: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        symbol: { type: 'string' },
      },
    },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          plan: { type: 'string' },
          amountUsd: { type: 'string' },
          status: { type: 'string' },
          provider: { type: 'string' },
        },
      },
    },
  },
} as const;

export const BILLING_COUPON_JSON_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    claimed: { type: 'boolean' },
    couponId: { type: 'string' },
    subscriptionId: { type: 'string', nullable: true },
    currentPeriodEnd: { type: 'string', nullable: true },
    discountPercent: { type: 'number', nullable: true },
    message: { type: 'string', nullable: true },
  },
} as const;

export const SUPPORTED_COINS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    coins: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ticker: { type: 'string' },
          name: { type: 'string' },
          network: { type: 'string' },
          symbol: { type: 'string' },
          recommended: { type: 'boolean' },
        },
      },
    },
  },
} as const;

// ── MCP Input Contracts ──

export const MCP_BILLING_CHECKOUT_INPUT = {
  type: 'object',
  properties: {
    planId: {
      type: 'string',
      enum: ['PRO_MONTH', 'PRO_YEAR', 'TEAMS_MONTH', 'TEAMS_YEAR'],
      default: 'PRO_MONTH',
      description: 'The subscription plan to upgrade to.',
    },
    months: {
      type: 'integer',
      default: 1,
      description: 'Number of months to purchase (1-36). For yearly, default is 1 year (12 months billed at discount).',
    },
    ticker: {
      type: 'string',
      description: 'Optional cryptocurrency ticker (e.g. "polygon/usdt", "solana/usdt", "tron/usdt", "btc", "eth") to generate a direct on-chain deposit address for autonomous payment without web redirect.',
    },
    couponId: {
      type: 'string',
      description: 'Optional discount or promo coupon code to apply.',
    },
  },
} as const;

export const MCP_BILLING_STATUS_INPUT = MCP_EMPTY_INPUT;

export const MCP_BILLING_COUPON_INPUT = {
  type: 'object',
  properties: {
    couponId: {
      type: 'string',
      description: 'The promotional or gift coupon code to redeem.',
    },
  },
  required: ['couponId'],
} as const;

export const MCP_BILLING_COINS_INPUT = MCP_EMPTY_INPUT;
