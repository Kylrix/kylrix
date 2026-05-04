/**
 * ppp.ts - 2026 Global Purchasing Power Parity Multipliers
 * Base: USD = 1.0
 */

export type SubscriptionTier = 'PRO';
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
  },
  base_pro_price: 10, // Base Pro price in USD
  card_surcharge_multiplier: 1.25, // 25% overhead for legacy banking
  default_multiplier: 1.0
};

export const PPP_DATA: Record<string, RegionConfig> = {
  // NORTH AMERICA
  "US": { multiplier: 1.0, currency: "USD", symbol: "$", name: "United States" },
  "CA": { multiplier: 0.92, currency: "CAD", symbol: "CA$", name: "Canada" },
  "MX": { multiplier: 0.45, currency: "MXN", symbol: "Mex$", name: "Mexico" },

  // AFRICA
  "NG": { multiplier: 0.32, currency: "NGN", symbol: "₦", name: "Nigeria" },
  "ZA": { multiplier: 0.48, currency: "ZAR", symbol: "R", name: "South Africa" },
  "KE": { multiplier: 0.30, currency: "KES", symbol: "KSh", name: "Kenya" },
  "EG": { multiplier: 0.28, currency: "EGP", symbol: "E£", name: "Egypt" },
  "GH": { multiplier: 0.25, currency: "GHS", symbol: "GH₵", name: "Ghana" },
  "ET": { multiplier: 0.22, currency: "ETB", symbol: "Br", name: "Ethiopia" },
  "MA": { multiplier: 0.42, currency: "MAD", symbol: "DH", name: "Morocco" },

  // EUROPE
  "GB": { multiplier: 0.88, currency: "GBP", symbol: "£", name: "United Kingdom" },
  "DE": { multiplier: 0.90, currency: "EUR", symbol: "€", name: "Germany" },
  "FR": { multiplier: 0.88, currency: "EUR", symbol: "€", name: "France" },
  "IT": { multiplier: 0.78, currency: "EUR", symbol: "€", name: "Italy" },
  "ES": { multiplier: 0.72, currency: "EUR", symbol: "€", name: "Spain" },
  "CH": { multiplier: 1.25, currency: "CHF", symbol: "Fr", name: "Switzerland" },
  "NO": { multiplier: 1.15, currency: "NOK", symbol: "kr", name: "Norway" },
  "PL": { multiplier: 0.55, currency: "PLN", symbol: "zł", name: "Poland" },
  "TR": { multiplier: 0.35, currency: "TRY", symbol: "₺", name: "Turkey" },
  "UA": { multiplier: 0.28, currency: "UAH", symbol: "₴", name: "Ukraine" },

  // ASIA & PACIFIC
  "IN": { multiplier: 0.34, currency: "INR", symbol: "₹", name: "India" },
  "CN": { multiplier: 0.62, currency: "CNY", symbol: "¥", name: "China" },
  "JP": { multiplier: 0.75, currency: "JPY", symbol: "¥", name: "Japan" },
  "KR": { multiplier: 0.82, currency: "KRW", symbol: "₩", name: "South Korea" },
  "SG": { multiplier: 1.10, currency: "SGD", symbol: "S$", name: "Singapore" },
  "AU": { multiplier: 0.95, currency: "AUD", symbol: "A$", name: "Australia" },
  "ID": { multiplier: 0.36, currency: "IDR", symbol: "Rp", name: "Indonesia" },
  "PK": { multiplier: 0.20, currency: "PKR", symbol: "₨", name: "Pakistan" },
  "VN": { multiplier: 0.32, currency: "VND", symbol: "₫", name: "Vietnam" },
  "PH": { multiplier: 0.38, currency: "PHP", symbol: "₱", name: "Philippines" },

  // SOUTH AMERICA
  "BR": { multiplier: 0.46, currency: "BRL", symbol: "R$", name: "Brazil" },
  "AR": { multiplier: 0.38, currency: "ARS", symbol: "$", name: "Argentina" },
  "CO": { multiplier: 0.35, currency: "COP", symbol: "$", name: "Colombia" },
  "CL": { multiplier: 0.58, currency: "CLP", symbol: "$", name: "Chile" },

  // MIDDLE EAST
  "AE": { multiplier: 0.95, currency: "AED", symbol: "د.إ", name: "United Arab Emirates" },
  "SA": { multiplier: 0.78, currency: "SAR", symbol: "ر.س", name: "Saudi Arabia" },
  "IL": { multiplier: 1.05, currency: "ILS", symbol: "₪", name: "Israel" },

  "DEFAULT": { multiplier: 1.0, currency: "USD", symbol: "$", name: "Global" }
};

/**
 * Pricing Engine Logic
 */
export const calculateSubscriptionPrice = (
  tier: SubscriptionTier,
  countryCode: string,
  method: PaymentMethod
): number => {
  const region = PPP_DATA[countryCode] || PPP_DATA.DEFAULT;
  const baseProPrice = GLOBAL_SUBSCRIPTION_CONFIG.base_pro_price;
  
  // Base Pro price adjusted by PPP
  const pppAdjustedPro = baseProPrice * region.multiplier;
  
  const paymentMultiplier = method === 'CARD' 
    ? GLOBAL_SUBSCRIPTION_CONFIG.card_surcharge_multiplier 
    : 1.0;

  // Final Formula: PPP_Adjusted_Pro * Card_Surcharge
  const finalPrice = pppAdjustedPro * paymentMultiplier;
  
  return Math.round(finalPrice * 100) / 100;
};
