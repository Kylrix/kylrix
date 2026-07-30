/** Normalized tiers used for paywalls, badges, and billing gates. */

export type BillingUiTier = 'FREE' | 'PRO' | 'TEAMS' | 'ORG' | 'LIFETIME';

export function normalizeBillingPrefsTier(prefs: Record<string, unknown> | null | undefined): BillingUiTier {
  if (!prefs) return 'FREE';

  const raw = prefs.subscriptionTier ?? prefs.tier;
  const tier = String(raw ?? 'FREE').trim().toUpperCase();
  const expRaw = prefs.subscriptionExpiresAt;
  const expMs = typeof expRaw === 'string' && expRaw ? new Date(expRaw).getTime() : Number.NaN;
  const expiryValid = () => Number.isFinite(expMs) && expMs > Date.now();

  if (tier === 'LIFETIME') return 'LIFETIME';
  if (tier === 'TEAMS') {
    if (expiryValid()) return 'TEAMS';
    return 'FREE';
  }
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

/** PRO, TEAMS, ORG, and LIFETIME unlock Pro-gated UX. */
export function billingTierHasPaidAccess(tier: BillingUiTier | string): boolean {
  const t = String(tier || 'FREE').toUpperCase();
  return t === 'PRO' || t === 'TEAMS' || t === 'ORG' || t === 'LIFETIME';
}

const TIER_RANK: Record<BillingUiTier, number> = {
  FREE: 0,
  PRO: 1,
  TEAMS: 2,
  ORG: 3,
  LIFETIME: 4};

/** Map subscription ledger plan labels to a normalized UI tier. */
export function planLabelToUiTier(plan: string | null | undefined): BillingUiTier {
  const p = String(plan || '').trim().toUpperCase().replace(/-/g, '_');
  if (!p || p === 'FREE') return 'FREE';
  if (p.includes('LIFETIME')) return 'LIFETIME';
  if (p === 'ORG' || p.includes('ORG')) return 'ORG';
  if (p.includes('TEAMS') || p === 'TEAM') return 'TEAMS';
  if (p.includes('PRO')) return 'PRO';
  return 'PRO';
}

export function maxBillingUiTier(...tiers: BillingUiTier[]): BillingUiTier {
  return tiers.reduce(
    (best, tier) => ((TIER_RANK[tier] ?? 0) > (TIER_RANK[best] ?? 0) ? tier : best),
    'FREE',
  );
}

export function billingTierHasTeamsAccess(tier: BillingUiTier | string): boolean {
  const t = String(tier || 'FREE').toUpperCase();
  return t === 'TEAMS' || t === 'ORG' || t === 'LIFETIME';
}
