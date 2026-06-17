const CANONICAL_ORIGIN = 'https://www.kylrix.space';

/**
 * BlockBee dashboard URLs are whitelisted to production hosts only.
 * Always resolve billing callbacks to the canonical www origin + /accounts prefix.
 */
export function resolveBlockBeeBillingBaseUrl(): string {
  const raw = String(
    process.env.BLOCKBEE_BILLING_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      CANONICAL_ORIGIN,
  )
    .trim()
    .replace(/\/+$/, '');

  if (raw.endsWith('/accounts')) return raw;
  return `${raw}/accounts`;
}

export function resolveBlockBeeNotifyBaseUrl(): string {
  const override = String(process.env.BLOCKBEE_NOTIFY_URL || '').trim().replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBlockBeeBillingBaseUrl()}/api/pro/notify`;
}

export function resolveBlockBeeRedirectBaseUrl(): string {
  const override = String(process.env.BLOCKBEE_REDIRECT_URL || '').trim().replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBlockBeeBillingBaseUrl()}/pro/success`;
}
