import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import type { BillingUiTier } from '@/lib/subscription/tier-resolution';

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
  if (isSelfHostedDeployment()) {
    const open = getOpenSuiteEntitlement();
    return {
      active: open.active,
      expiresAt: open.expiresAt,
      source: 'prefs_lifetime',
      uiTier: open.uiTier,
    };
  }

  const { databases, users } = createSystemClient();
  const now = new Date();

  try {
    const res = await databases.listRows(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.limit(100),
      Query.select(['$id', 'userId', 'status', 'currentPeriodEnd', 'currentPeriodStart', 'createdAt', 'updatedAt', 'plan'])]);
    const rows = (res.rows || []) as SubscriptionRow[];
    const unexpired = rows.filter((row) => {
      if (String(row.status || '').toLowerCase() !== 'active') return false;
      if (!row.currentPeriodEnd) return false;
      const end = new Date(row.currentPeriodEnd);
      return !Number.isNaN(end.getTime()) && end > now;
    });
    const latest = pickLatestSubscription(unexpired);
    if (latest) {
      const plan = String(latest.plan || 'PRO').toUpperCase();
      return {
        active: true,
        expiresAt: latest.currentPeriodEnd || null,
        source: 'subscription_row',
        uiTier: plan === 'TEAMS' ? 'TEAMS' : 'PRO',
      };
    }
  } catch {
    // fall through to prefs
  }

  return {
    active: false,
    expiresAt: null,
    source: 'none',
    uiTier: 'FREE',
  };
}

export async function hasPaidKylrixPlanServer(userId: string): Promise<boolean> {
  const ent = await getVerifiedProEntitlementForUser(userId).catch(() => null);
  return !!(ent && ent.active && ent.uiTier !== 'FREE');
}

