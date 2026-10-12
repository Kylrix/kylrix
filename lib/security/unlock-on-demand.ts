/**
 * Unlock-on-demand preference — Appwrite account prefs.
 *
 * When enabled (default): never auto-prompt MasterPass on navigation / tab focus.
 * Prompt only when the user opens a locked item or starts an action that needs unlock.
 */

export const UNLOCK_ON_DEMAND_PREF_KEY = 'unlock_on_demand' as const;

/** Default ON for everyone until they explicitly turn it off. */
export const UNLOCK_ON_DEMAND_DEFAULT = true;

export function isUnlockOnDemandEnabled(
  prefs: Record<string, unknown> | null | undefined
): boolean {
  if (!prefs || typeof prefs !== 'object') return UNLOCK_ON_DEMAND_DEFAULT;
  const raw = prefs[UNLOCK_ON_DEMAND_PREF_KEY];
  if (raw === undefined || raw === null) return UNLOCK_ON_DEMAND_DEFAULT;
  if (typeof raw === 'boolean') return raw;
  if (raw === '1' || raw === 1 || raw === 'true') return true;
  if (raw === '0' || raw === 0 || raw === 'false') return false;
  return UNLOCK_ON_DEMAND_DEFAULT;
}
