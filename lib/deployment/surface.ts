/**
 * Deployment surface — the layer beneath product/billing logic.
 * Cloud and self-hosted builds read the same helpers; callers never branch on env vars directly.
 */

type DeploymentSurface = 'cloud' | 'selfhosted';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function parseEnvFlag(value: string | undefined | null): boolean {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

/** Server/runtime flag — set `SELFHOSTED=true` on self-hosted installs. */
function readSelfHostedEnv(): boolean {
  return parseEnvFlag(process.env.SELFHOSTED);
}

/** Client bundle flag — mirrored from SELFHOSTED at build time via next.config.js. */
function readSelfHostedClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_SELFHOSTED);
}

export function isSelfHostedDeployment(): boolean {
  if (typeof window === 'undefined') {
    return readSelfHostedEnv();
  }
  return readSelfHostedClientEnv() || readSelfHostedEnv();
}


function isCloudDeployment(): boolean {
  return !isSelfHostedDeployment();
}

/** Commerce/checkout remains a cloud-only surface. */
export function isBillingCommerceEnabled(): boolean {
  return isCloudDeployment();
}
