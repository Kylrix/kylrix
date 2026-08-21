const CANONICAL_ORIGIN = 'https://www.kylrix.space';

/**
 * BlockBee dashboard URLs are whitelisted to production hosts only.
 * Billing callbacks use the canonical www origin + /billing prefix.
 */
function resolveBlockBeeBillingBaseUrl(): string {
  const explicit = process.env.BLOCKBEE_BILLING_BASE_URL?.trim().replace(/\/+$/, '');
  if (explicit) {
    if (explicit.endsWith('/billing')) return explicit;
    if (explicit.endsWith('/accounts')) return `${explicit.slice(0, -'/accounts'.length)}/billing`;
    return `${explicit}/billing`;
  }

  // BlockBee requires publicly resolvable whitelisted production URLs (no localhost)
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  const raw = appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')
    ? appUrl
    : CANONICAL_ORIGIN;

  if (raw.endsWith('/billing')) return raw;
  if (raw.endsWith('/accounts')) return `${raw.slice(0, -'/accounts'.length)}/billing`;
  return `${raw}/billing`;
}

export function resolveBlockBeeNotifyBaseUrl(): string {
  const override = String(process.env.BLOCKBEE_NOTIFY_URL || '').trim().replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBlockBeeBillingBaseUrl()}/api/pro/notify`;
}

export function resolveBlockBeeRedirectBaseUrl(): string {
  const override = String(process.env.BLOCKBEE_REDIRECT_URL || '').trim().replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBlockBeeBillingBaseUrl()}/success`;
}
