/**
 * ppp.ts - Fixed Global Pricing (Formerly PPP)
 * Plan prices read from PRICING_PLAN_N_PRICE_USD when pricing tiers are configured.
 */

import { getPricingPlanByLedger, getPricingPlans } from '@/lib/config/pricing-plans';

export type SubscriptionTier = string;
export type PaymentMethod = 'CRYPTO' | 'CARD';

export interface RegionConfig {
  multiplier: number;
  currency: string;
  symbol: string;
  name: string;
}

export const PPP_DATA: Record<string, RegionConfig> = {
  DEFAULT: { multiplier: 1.0, currency: 'USD', symbol: '$', name: 'Global' },
};

function resolvePlanPriceUsd(tier: SubscriptionTier | string): number {
  const key = String(tier || '')
    .trim()
    .toUpperCase()
    .replace(/_MONTH$/, '')
    .replace(/_YEAR$/, '');
  const plan = getPricingPlanByLedger(key);
  if (plan) return plan.priceUsd;
  const plans = getPricingPlans();
  return plans[0]?.priceUsd ?? 0;
}

function getTierMonthlyPrice(tier: SubscriptionTier | string): number {
  return resolvePlanPriceUsd(tier);
}

/** Full 12-month price before the yearly discount. */
export function getYearlyListPrice(tier: SubscriptionTier | string): number {
  return getTierMonthlyPrice(tier) * 12;
}

/** Pay for 10 months, get 12 — the standard yearly deal. */
export function getYearlyDiscountedPrice(tier: SubscriptionTier | string): number {
  return getTierMonthlyPrice(tier) * 10;
}

/** Free months bundled in for each full 12-month block (2 per year). */
export function getBundledFreeMonths(months: number): number {
  if (months < 12) return 0;
  return Math.floor(months / 12) * 2;
}

export function calculateTotalSubscriptionPrice(
  tier: SubscriptionTier | string,
  months: number,
  method: PaymentMethod = 'CRYPTO',
): number {
  const monthly = getTierMonthlyPrice(tier);
  const paymentMultiplier = method === 'CARD' ? 1.0 : 1.0;
  const unitPrice = monthly * paymentMultiplier;

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const total = years * 10 * unitPrice + remainingMonths * unitPrice;
    return Math.round(total * 100) / 100;
  }

  return Math.round(unitPrice * Math.max(1, months) * 100) / 100;
}

export const calculateSubscriptionPrice = (
  tier: SubscriptionTier | string,
  _countryCode: string,
  method: PaymentMethod,
  months = 1,
): number => calculateTotalSubscriptionPrice(tier, months, method);
