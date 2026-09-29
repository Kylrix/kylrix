import { createHmac } from 'crypto';

/**
 * Computes a cryptographically secure HMAC signature for user billing tier claims in user prefs.
 * Prevents client-side manipulation via account.updatePrefs().
 */
export function computeSubscriptionSig(userId: string, tier: string, expiresAtIso: string): string {
  const secret = process.env.APPWRITE_API_KEY || process.env.VIEWER_TOKEN_SECRET || 'kylrix-subscription-key';
  return createHmac('sha256', secret).update(`${userId}:${tier}:${expiresAtIso}`).digest('hex');
}

export function verifySubscriptionSig(userId: string, tier: string, expiresAtIso: string, sig: string): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const expected = computeSubscriptionSig(userId, tier, expiresAtIso);
  return expected === sig;
}

/**
 * Persist all billing-related pref keys whenever Pro time is activated,
 * so client gates relying on prefs stay aligned with subscriptions.
 */
export function applyProSubscriptionWindowToPrefs<T extends Record<string, unknown>>(
  prefs: T,
  expiresAtIso: string,
  tier: 'PRO' | 'TEAMS' | string = 'PRO',
  userId?: string
) {
  const normTier = String(tier).toUpperCase() === 'TEAMS' ? 'TEAMS' : 'PRO';
  const sig = userId ? computeSubscriptionSig(userId, normTier, expiresAtIso) : undefined;
  return {
    ...prefs,
    tier: normTier,
    subscriptionTier: normTier,
    subscriptionExpiresAt: expiresAtIso,
    ...(sig ? { subscriptionSig: sig } : {}),
  };
}
