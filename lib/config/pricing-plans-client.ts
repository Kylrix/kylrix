/**
 * Client-safe pricing plan snapshot (inlined at build time via next.config.js).
 */

export type PublicPricingPlan = {
  index: number;
  name: string;
  description: string;
  priceUsd: number;
  ledgerKey: string;
  exclusiveFeatures: Array<{ id: string; label: string }>;
};

export function getPublicPricingPlans(): PublicPricingPlan[] {
  const raw = process.env.NEXT_PUBLIC_PRICING_PLANS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PublicPricingPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
