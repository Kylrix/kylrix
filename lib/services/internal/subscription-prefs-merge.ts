/**
 * Persist all billing-related pref keys whenever Pro time is activated,
 * so client gates relying on prefs stay aligned with subscriptions.
 */
export function applyProSubscriptionWindowToPrefs<T extends Record<string, unknown>>(
  prefs: T,
  expiresAtIso: string,
  tier: 'PRO' | 'TEAMS' | string = 'PRO') {
  const normTier = String(tier).toUpperCase() === 'TEAMS' ? 'TEAMS' : 'PRO';
  return {
    ...prefs,
    tier: normTier,
    subscriptionTier: normTier,
    subscriptionExpiresAt: expiresAtIso};
}
