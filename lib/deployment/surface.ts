/**
 * Deployment surface — the layer beneath product/billing logic.
 * Cloud and self-hosted builds read the same helpers; callers never branch on env vars directly.
 */

import { parseEnvFlag } from '@/lib/config/env-flags';
import { isPricingTiersEnabled } from '@/lib/config/product';

/** Server/runtime flag — self-hosted installs may set `SELFHOSTED=true` or `SELFHOST_MODE=true`. */
function readSelfHostedEnv(): boolean {
  return parseEnvFlag(process.env.SELFHOSTED) || parseEnvFlag(process.env.SELFHOST_MODE);
}

/** Client bundle flag — mirrored from SELFHOSTED/SELFHOST_MODE at build time. */
function readSelfHostedClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_SELFHOSTED) || parseEnvFlag(process.env.NEXT_PUBLIC_SELFHOST_MODE);
}

function readPricingTiersClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_PRICING_TIERS_ENABLED);
}

export function isSelfHostedDeployment(): boolean {
  if (typeof window === 'undefined') {
    return readSelfHostedEnv();
  }
  return readSelfHostedClientEnv();
}

/** Decoupled Backend mode: indicates if local bundled backend is active vs standalone Next.js deployment. */
export function isIntegratedBackend(): boolean {
  const flag = typeof window === 'undefined' ? process.env.BACKEND : process.env.NEXT_PUBLIC_BACKEND;
  return parseEnvFlag(flag);
}

/**
 * Dogfood Safety mode: total airgap against remote backend to prevent burning database read/write limits.
 * Cuts off all remote backend operations; application relies strictly on LocalEngine / RxDB substrate.
 */
export function isDogfoodSafetyActive(): boolean {
  const flag =
    typeof window === 'undefined'
      ? process.env.DOGFOOD_SAFETY || process.env.NEXT_PUBLIC_DOGFOOD_SAFETY
      : process.env.NEXT_PUBLIC_DOGFOOD_SAFETY || (window as any)?.__KYLRIX_DOGFOOD_SAFETY__;
  return parseEnvFlag(flag);
}

/** Commerce/checkout + tier paywalls — enabled for cloud deployments with pricing tiers on. */
export function isBillingCommerceEnabled(): boolean {
  if (typeof window === 'undefined') {
    return isPricingTiersEnabled() && !readSelfHostedEnv();
  }
  return readPricingTiersClientEnv() && !readSelfHostedClientEnv();
}

/**
 * KYLRIX_CLOUD mode: indicates official Kylrix Cloud ecosystem runtime.
 * Allows applying custom hand-wired shortcuts and logic for Kylrix main cloud
 * directly in code while bypassing pricing tier envs.
 */
export function isKylrixCloud(): boolean {
  const flag =
    typeof window === 'undefined'
      ? process.env.KYLRIX_CLOUD || process.env.NEXT_PUBLIC_KYLRIX_CLOUD
      : process.env.NEXT_PUBLIC_KYLRIX_CLOUD || (window as any)?.__KYLRIX_CLOUD__;
  return parseEnvFlag(flag);
}
