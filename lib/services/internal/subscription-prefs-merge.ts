/**
 * Persist all billing-related pref keys whenever Pro time is activated,
 * so client gates relying on prefs stay aligned with subscriptions.
 */
export function applyProSubscriptionWindowToPrefs<T extends Record<string, unknown>>(
  prefs: T,
  expiresAtIso: string,
) {
  return {
    ...prefs,
    tier: 'PRO',
    subscriptionTier: 'PRO',
    subscriptionExpiresAt: expiresAtIso,
  };
}
