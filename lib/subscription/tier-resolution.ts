/** Normalized tiers used for paywalls, badges, and billing gates. */

export type BillingUiTier = 'FREE' | 'PRO' | 'ORG' | 'LIFETIME';

export function normalizeBillingPrefsTier(prefs: Record<string, unknown> | null | undefined): BillingUiTier {
  if (!prefs) return 'FREE';

  const raw = prefs.subscriptionTier ?? prefs.tier;
  const tier = String(raw ?? 'FREE').trim().toUpperCase();
  const expRaw = prefs.subscriptionExpiresAt;
  const expMs = typeof expRaw === 'string' && expRaw ? new Date(expRaw).getTime() : Number.NaN;
  const expiryValid = () => Number.isFinite(expMs) && expMs > Date.now();

  if (tier === 'LIFETIME') return 'LIFETIME';
  if (tier === 'ORG') {
    if (expiryValid()) return 'ORG';
    return 'FREE';
  }
  if (tier === 'PRO') {
    if (expiryValid()) return 'PRO';
    return 'FREE';
  }
  return 'FREE';
}

/** PRO, ORG, and LIFETIME unlock Pro-gated UX. */
export function billingTierHasPaidAccess(tier: BillingUiTier | string): boolean {
  const t = String(tier || 'FREE').toUpperCase();
  return t === 'PRO' || t === 'ORG' || t === 'LIFETIME';
}
