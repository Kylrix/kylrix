/**
 * ppp.ts - Fixed Global Pricing (Formerly PPP)
 * Base: USD = 1.0 — amounts read from env when pricing tiers are configured.
 */

import { getProMonthlyPriceUsd, getTeamsMonthlyPriceUsd } from '@/lib/config/product';

export type SubscriptionTier = 'PRO' | 'TEAMS';
export type PaymentMethod = 'CRYPTO' | 'CARD';

export interface RegionConfig {
  multiplier: number;
  currency: string;
  symbol: string;
  name: string;
}

function getGlobalSubscriptionConfig() {
  const baseProPrice = getProMonthlyPriceUsd();
  const teamsPrice = getTeamsMonthlyPriceUsd();
  const teamsMultiplier = baseProPrice > 0 ? teamsPrice / baseProPrice : 5;
  return {
    tier_multipliers: {
      pro: 1.0,
      teams: teamsMultiplier,
    },
    base_pro_price: baseProPrice,
    card_surcharge_multiplier: 1.0,
    default_multiplier: 1.0,
  };
}

export const PPP_DATA: Record<string, RegionConfig> = {
  "DEFAULT": { multiplier: 1.0, currency: "USD", symbol: "$", name: "Global" }
};

function getTierMonthlyPrice(tier: SubscriptionTier | string): number {
  const config = getGlobalSubscriptionConfig();
  const baseProPrice = config.base_pro_price;
  if (String(tier).toUpperCase().startsWith('TEAMS')) {
    return baseProPrice * config.tier_multipliers.teams;
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

/** Free months bundled in for each full 12-month block (2 per year). */
export function getBundledFreeMonths(months: number): number {
  if (months < 12) return 0;
  return Math.floor(months / 12) * 2;
}

export function calculateTotalSubscriptionPrice(
  tier: SubscriptionTier | string,
  months: number,
  method: PaymentMethod = 'CRYPTO'): number {
  const monthly = getTierMonthlyPrice(tier);
  const paymentMultiplier =
    method === 'CARD' ? getGlobalSubscriptionConfig().card_surcharge_multiplier : 1.0;
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
  months = 1): number => calculateTotalSubscriptionPrice(tier, months, method);

