/**
 * Deployment surface — the layer beneath product/billing logic.
 * Cloud and self-hosted builds read the same helpers; callers never branch on env vars directly.
 */

export type DeploymentSurface = 'cloud' | 'selfhosted';

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function parseEnvFlag(value: string | undefined | null): boolean {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

/** Server/runtime flag — set `SELFHOSTED=true` on self-hosted installs. */
export function readSelfHostedEnv(): boolean {
  return parseEnvFlag(process.env.SELFHOSTED);
}

/** Client bundle flag — mirrored from SELFHOSTED at build time via next.config.js. */
export function readSelfHostedClientEnv(): boolean {
  return parseEnvFlag(process.env.NEXT_PUBLIC_SELFHOSTED);
}

export function isSelfHostedDeployment(): boolean {
  if (typeof window === 'undefined') {
    return readSelfHostedEnv();
  }
  return readSelfHostedClientEnv() || readSelfHostedEnv();
}

export function getDeploymentSurface(): DeploymentSurface {
  return isSelfHostedDeployment() ? 'selfhosted' : 'cloud';
}

export function isCloudDeployment(): boolean {
  return !isSelfHostedDeployment();
}

/** Commerce/checkout remains a cloud-only surface. */
export function isBillingCommerceEnabled(): boolean {
  return isCloudDeployment();
}
