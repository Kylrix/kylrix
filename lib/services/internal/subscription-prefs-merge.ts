import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Computes a cryptographically secure HMAC signature for user billing tier claims in user prefs.
 * Prevents client-side manipulation via account.updatePrefs().
 */
export function computeSubscriptionSig(userId: string, tier: string, expiresAtIso: string): string {
  const secret = process.env.APPWRITE_API_KEY || process.env.VIEWER_TOKEN_SECRET || 'kylrix-subscription-key';
  return createHmac('sha256', secret).update(`${userId}:${tier}:${expiresAtIso}`).digest('hex');
}

/**
 * Verifies subscription signature using constant-time comparison to prevent timing attacks.
 * Hashing both signatures to fixed-length SHA-256 digests guarantees uniform length comparison.
 */
export function verifySubscriptionSig(userId: string, tier: string, expiresAtIso: string, sig: string): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const expected = computeSubscriptionSig(userId, tier, expiresAtIso);
  const sigHash = createHash('sha256').update(sig).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(sigHash, expectedHash);
}

/**
 * Persist all billing-related pref keys whenever Pro time is activated,
 * so client gates relying on prefs stay aligned with subscriptions.
 */
export function applyProSubscriptionWindowToPrefs<T extends Record<string, unknown>>(
  prefs: T,
  expiresAtIso: string,
  tier: 'PRO' | 'TEAMS' | 'LIFETIME' | string = 'PRO',
  userId?: string
) {
  const rawTier = String(tier).toUpperCase();
  const normTier = rawTier === 'LIFETIME' ? 'LIFETIME' : rawTier === 'TEAMS' ? 'TEAMS' : rawTier === 'ORG' ? 'ORG' : 'PRO';
  const sig = userId ? computeSubscriptionSig(userId, normTier, expiresAtIso) : undefined;
  return {
    ...prefs,
    tier: normTier,
    subscriptionTier: normTier,
    subscriptionExpiresAt: expiresAtIso,
    isLifetime: normTier === 'LIFETIME',
    ...(sig ? { subscriptionSig: sig } : {}),
  };
}
