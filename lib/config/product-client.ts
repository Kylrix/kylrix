/**
 * Client-safe product flags mirrored at build time via next.config.js.
 */

const DEFAULT_PRODUCT_NAME = 'Kylrix';

export function getPublicProductName(): string {
  return process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || DEFAULT_PRODUCT_NAME;
}

export function isPublicPricingTiersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRICING_TIERS_ENABLED === 'true';
}
