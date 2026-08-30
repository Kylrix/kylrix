/**
 * Deployment surface — the layer beneath product/billing logic.
 * Cloud and self-hosted builds read the same helpers; callers never branch on env vars directly.
 */

import { parseEnvFlag } from '@/lib/config/env-flags';
import { isPricingTiersEnabled } from '@/lib/config/product';

/** Server/runtime flag — legacy self-hosted installs may set `SELFHOSTED=true`. */
function readSelfHostedEnv(): boolean {
  return parseEnvFlag(process.env.SELFHOSTED);
}

/** Client bundle flag — mirrored from SELFHOSTED at build time via next.config.js. */
function readSelfHostedClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_SELFHOSTED);
}

function readPricingTiersClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_PRICING_TIERS_ENABLED);
}

export function isSelfHostedDeployment(): boolean {
  if (typeof window === 'undefined') {
    if (readSelfHostedEnv()) return true;
    return !isPricingTiersEnabled();
  }
  if (readSelfHostedClientEnv()) return true;
  return !readPricingTiersClientEnv();
}

/** Commerce/checkout + tier paywalls — enabled for cloud deployments with pricing tiers on. */
export function isBillingCommerceEnabled(): boolean {
  if (typeof window === 'undefined') {
    return isPricingTiersEnabled() && !readSelfHostedEnv();
  }
  return readPricingTiersClientEnv() && !readSelfHostedClientEnv();
}
