/**
 * Billing callback URLs — provider-agnostic names with BlockBee legacy aliases.
 */

const CANONICAL_ORIGIN = 'https://www.kylrix.space';

function resolveBillingBaseUrl(): string {
  const explicit =
    process.env.BILLING_CALLBACK_BASE_URL?.trim().replace(/\/+$/, '') ||
    process.env.BLOCKBEE_BILLING_BASE_URL?.trim().replace(/\/+$/, '');
  if (explicit) {
    if (explicit.endsWith('/billing')) return explicit;
    if (explicit.endsWith('/accounts')) return `${explicit.slice(0, -'/accounts'.length)}/billing`;
    return `${explicit}/billing`;
  }

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const raw =
    appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')
      ? appUrl
      : CANONICAL_ORIGIN;

  if (raw.endsWith('/billing')) return raw;
  if (raw.endsWith('/accounts')) return `${raw.slice(0, -'/accounts'.length)}/billing`;
  return `${raw}/billing`;
}

export function resolveBillingNotifyUrl(): string {
  const override = String(
    process.env.BILLING_NOTIFY_URL || process.env.BLOCKBEE_NOTIFY_URL || '',
  )
    .trim()
    .replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBillingBaseUrl()}/api/pro/notify`;
}

export function resolveBillingSuccessUrl(): string {
  const override = String(
    process.env.BILLING_SUCCESS_URL || process.env.BLOCKBEE_REDIRECT_URL || '',
  )
    .trim()
    .replace(/\/+$/, '');
  if (override) return override;
  return `${resolveBillingBaseUrl()}/success`;
}

/** @deprecated Use resolveBillingNotifyUrl */
export function resolveBlockBeeNotifyBaseUrl(): string {
  return resolveBillingNotifyUrl();
}

/** @deprecated Use resolveBillingSuccessUrl */
export function resolveBlockBeeRedirectBaseUrl(): string {
  return resolveBillingSuccessUrl();
}
