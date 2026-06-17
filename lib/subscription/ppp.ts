/**
 * ppp.ts - Fixed Global Pricing (Formerly PPP)
 * Base: USD = 1.0
 */

export type SubscriptionTier = 'PRO' | 'TEAMS';
export type PaymentMethod = 'CRYPTO' | 'CARD';

export interface RegionConfig {
  multiplier: number;
  currency: string;
  symbol: string;
  name: string;
}

export const GLOBAL_SUBSCRIPTION_CONFIG = {
  tier_multipliers: {
    pro: 1.0,        // Base reference
    teams: 5.0,      // 5x Pro price flat rate ($50)
  },
  base_pro_price: 10, // Fixed Pro price in USD
  card_surcharge_multiplier: 1.0, // Fixed price for all methods
  default_multiplier: 1.0
};

export const PPP_DATA: Record<string, RegionConfig> = {
  "DEFAULT": { multiplier: 1.0, currency: "USD", symbol: "$", name: "Global" }
};

export function getTierMonthlyPrice(tier: SubscriptionTier | string): number {
  const baseProPrice = GLOBAL_SUBSCRIPTION_CONFIG.base_pro_price;
  if (String(tier).toUpperCase().startsWith('TEAMS')) {
    return baseProPrice * GLOBAL_SUBSCRIPTION_CONFIG.tier_multipliers.teams;
  }
  return baseProPrice;
}

/** Full 12-month price before the yearly discount. */
export function getYearlyListPrice(tier: SubscriptionTier | string): number {
  return getTierMonthlyPrice(tier) * 12;
}

/** Pay for 10 months, get 12 — the standard yearly deal. */
export function getYearlyDiscountedPrice(tier: SubscriptionTier | string): number {
  return getTierMonthlyPrice(tier) * 10;
}

export function calculateTotalSubscriptionPrice(
  tier: SubscriptionTier | string,
  months: number,
  method: PaymentMethod = 'CRYPTO',
): number {
  const monthly = getTierMonthlyPrice(tier);
  const paymentMultiplier =
    method === 'CARD' ? GLOBAL_SUBSCRIPTION_CONFIG.card_surcharge_multiplier : 1.0;
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

