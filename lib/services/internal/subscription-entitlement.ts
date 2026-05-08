import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import { normalizeBillingPrefsTier, type BillingUiTier } from '@/lib/subscription/tier-resolution';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUBSCRIPTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

export type SubscriptionEntitlementSource =
  | 'subscription_row'
  | 'prefs_lifetime'
  | 'prefs_org'
  | 'none';

/**
 * Trusted Pro entitlement for gates that must mirror the ledger.
 * - Paid Pro: requires an active, unexpired subscriptions row (`plan: 'pro'`).
 * - LIFETIME / ORG: inferred from synced prefs only (staff / program tracks).
 *
 * Untrusted paths (e.g. `prefs.tier === 'PRO'` without a ledger row): **never** confer paid Pro here.
 */
export async function getVerifiedProEntitlementForUser(userId: string): Promise<{
  active: boolean;
  expiresAt: string | null;
  source: SubscriptionEntitlementSource;
  uiTier: BillingUiTier;
}> {
  const { databases, users } = createAdminClient();
  const now = new Date();

  try {
    const res = await databases.listDocuments(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.limit(100),
      Query.select(['$id', 'userId', 'status', 'currentPeriodEnd', 'currentPeriodStart', 'createdAt', 'updatedAt', 'plan']),
    ]);
    const rows = (res.documents || []) as SubscriptionRow[];
    const unexpired = rows.filter((row) => {
      if (String(row.status || '').toLowerCase() !== 'active') return false;
      if (!row.currentPeriodEnd) return false;
      const end = new Date(row.currentPeriodEnd);
      return !Number.isNaN(end.getTime()) && end > now;
    });
    const latest = pickLatestSubscription(unexpired);
    if (latest) {
      return {
        active: true,
        expiresAt: latest.currentPeriodEnd || null,
        source: 'subscription_row',
        uiTier: 'PRO',
      };
    }
  } catch {
    // fall through to prefs
  }

  try {
    const prefs = (await users.getPrefs(userId)) as Record<string, unknown>;
    const tier = normalizeBillingPrefsTier(prefs);
    const expRaw = prefs.subscriptionExpiresAt;

    if (tier === 'LIFETIME') {
      return {
        active: true,
        expiresAt: null,
        source: 'prefs_lifetime',
        uiTier: 'LIFETIME',
      };
    }
    if (tier === 'ORG') {
      return {
        active: true,
        expiresAt: typeof expRaw === 'string' ? expRaw : null,
        source: 'prefs_org',
        uiTier: 'ORG',
      };
    }
  } catch {
    // ignore
  }

  return {
    active: false,
    expiresAt: null,
    source: 'none',
    uiTier: 'FREE',
  };
}
