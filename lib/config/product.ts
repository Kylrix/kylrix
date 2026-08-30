/**
 * Server-side product + pricing configuration.
 * Never use these helpers in client bundles — use product-client.ts instead.
 */

import { parseEnvCsv, parseEnvFlag, parseEnvInt } from '@/lib/config/env-flags';

const DEFAULT_PRODUCT_NAME = 'Kylrix';
const DEFAULT_PRO_MONTHLY_USD = 10;
const DEFAULT_TEAMS_MONTHLY_USD = 50;

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

export function getProMonthlyPriceUsd(): number {
  return parseEnvInt(process.env.PRICING_PRO_MONTHLY_USD, DEFAULT_PRO_MONTHLY_USD);
}

export function getTeamsMonthlyPriceUsd(): number {
  return parseEnvInt(process.env.PRICING_TEAMS_MONTHLY_USD, DEFAULT_TEAMS_MONTHLY_USD);
}

/** Pro-tier capability IDs (comma-separated). Overrides code defaults when set. */
export function getEnvProFeatureIds(): string[] {
  return parseEnvCsv(process.env.PRICING_PRO_FEATURES);
}

/** Teams-only capability IDs (comma-separated). Pro capabilities are inherited. */
export function getEnvTeamsFeatureIds(): string[] {
  return parseEnvCsv(process.env.PRICING_TEAMS_FEATURES);
}

export function getProductSiteUrl(): string {
  const url = process.env.APP_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://www.kylrix.space';
}
