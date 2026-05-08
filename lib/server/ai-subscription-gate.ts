import { getVerifiedProEntitlementForUser } from '@/lib/services/internal/subscription-entitlement';

/** Uses subscriptions ledger + staff/program prefs — not raw `tier` alone. */
export async function userHasPaidAiAccess(userId: string): Promise<boolean> {
  const ent = await getVerifiedProEntitlementForUser(userId);
  return ent.active;
}
