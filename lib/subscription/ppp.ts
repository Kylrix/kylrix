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

export const calculateSubscriptionPrice = (
  tier: SubscriptionTier | string,
  _countryCode: string, // Ignored
  method: PaymentMethod,
  months = 1
): number => {
  const baseProPrice = GLOBAL_SUBSCRIPTION_CONFIG.base_pro_price;
  
  // Fixed base price
  let basePrice = baseProPrice;
  
  if (String(tier).toUpperCase() === 'TEAMS') {
    basePrice = basePrice * GLOBAL_SUBSCRIPTION_CONFIG.tier_multipliers.teams;
  }
  
  const paymentMultiplier = method === 'CARD' 
    ? GLOBAL_SUBSCRIPTION_CONFIG.card_surcharge_multiplier 
    : 1.0;

  // Final Price in USD: BasePrice * Card_Surcharge * months
  const finalPrice = basePrice * paymentMultiplier * Math.max(1, months);
  
  return Math.round(finalPrice * 100) / 100;
};

