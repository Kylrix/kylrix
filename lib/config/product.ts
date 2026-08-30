/**
 * Server-side product + pricing configuration.
 * Never use these helpers in client bundles — use product-client.ts instead.
 */

import { parseEnvFlag } from '@/lib/config/env-flags';

const DEFAULT_PRODUCT_NAME = 'Kylrix';

export function getProductName(): string {
  const name = process.env.PRODUCT_NAME?.trim();
  return name || DEFAULT_PRODUCT_NAME;
}

/** Cloud commerce + tier gates. Off for AGPL self-host personal installs. */
export function isPricingTiersEnabled(): boolean {
  const raw =
    process.env.PRICING_TIERS_ENABLED ??
    process.env.ENABLE_PRICING_TIERS;
  if (raw === undefined || raw === '') {
    return false;
  }
  return parseEnvFlag(raw);
}

export function getProductSiteUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://www.kylrix.space';
}
