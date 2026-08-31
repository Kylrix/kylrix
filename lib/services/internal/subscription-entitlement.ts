import { Query } from 'node-appwrite';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { type SubscriptionRow } from '@/lib/billing/subscription-helpers';
import {
  maxBillingUiTier,
  normalizeBillingPrefsTier,
  planLabelToUiTier,
  type BillingUiTier} from '@/lib/subscription/tier-resolution';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUBSCRIPTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

export type SubscriptionEntitlementSource =
  | 'subscription_row'
  | 'prefs_lifetime'
  | 'prefs_org'
  | 'prefs_sync'
  | 'none';

function readUserPrefs(user: { prefs?: unknown }): Record<string, unknown> {
  if (!user.prefs) return {};
  if (typeof user.prefs === 'string') {
    try {
      return JSON.parse(user.prefs) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return user.prefs as Record<string, unknown>;
}

function pickBestSubscriptionRow(rows: SubscriptionRow[]): SubscriptionRow | null {
  if (!rows.length) return null;
  const rank = (tier: BillingUiTier) => {
    if (tier === 'LIFETIME' || tier === 'ORG') return 4;
    if (tier === 'TEAMS') return 3;
    if (tier === 'PRO') return 2;
    return 0;
  };
  return [...rows].sort((a: any, b: any) => {
    const byTier = rank(planLabelToUiTier(b.plan)) - rank(planLabelToUiTier(a.plan));
    if (byTier !== 0) return byTier;

    const endA = a.currentPeriodEnd ? new Date(a.currentPeriodEnd).getTime() : 0;
    const endB = b.currentPeriodEnd ? new Date(b.currentPeriodEnd).getTime() : 0;
    return endB - endA;
  })[0] || null;
}

const entitlementCache = new Map<string, {
  data: {
    active: boolean;
    expiresAt: string | null;
    source: SubscriptionEntitlementSource;
    uiTier: BillingUiTier;
  };
  ts: number;
}>();

export function invalidateEntitlementCache(userId?: string) {
  if (userId) entitlementCache.delete(userId);
  else entitlementCache.clear();
}

/**
 * Trusted billing entitlement — merges subscription ledger + synced prefs and
 * always picks the highest active tier (TEAMS wins over PRO).
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
      uiTier: open.uiTier};
  }

  const cached = entitlementCache.get(userId);
  if (cached && Date.now() - cached.ts < 1000 * 60 * 5) {
    return cached.data;
  }

  const { databases, users } = createSystemClient();
  const now = new Date();

  let ledgerTier: BillingUiTier = 'FREE';
  let ledgerExpiresAt: string | null = null;
  let ledgerSource: SubscriptionEntitlementSource = 'none';

  try {
    const res = await databases.listRows(NOTE_DB_ID, SUBSCRIPTIONS_TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('status', 'active'),
      Query.limit(100),
      Query.select(['$id', 'userId', 'status', 'currentPeriodEnd', 'currentPeriodStart', 'createdAt', 'updatedAt', 'plan']),
    ]);
    const rows = (res.rows || []) as SubscriptionRow[];
    const unexpired = rows.filter((row) => {
      if (String(row.status || '').toLowerCase() !== 'active') return false;
      if (!row.currentPeriodEnd) return false;
      const end = new Date(row.currentPeriodEnd);
      return !Number.isNaN(end.getTime()) && end > now;
    });

    if (unexpired.length) {
      const bestRow = pickBestSubscriptionRow(unexpired);
      if (bestRow) {
        ledgerTier = planLabelToUiTier(bestRow.plan);
        ledgerExpiresAt = bestRow.currentPeriodEnd || null;
        ledgerSource = 'subscription_row';
      } else {
        ledgerTier = maxBillingUiTier(...unexpired.map((row: any) => planLabelToUiTier(row.plan)));
        const fallbackRow = unexpired[0];
        ledgerExpiresAt = fallbackRow?.currentPeriodEnd || null;
        ledgerSource = 'subscription_row';
      }
    }
  } catch {
    // fall through to prefs
  }

  let prefsTier: BillingUiTier = 'FREE';
  let prefsExpiresAt: string | null = null;
  let prefsSource: SubscriptionEntitlementSource = 'none';

  try {
    const user = await users.get(userId);
    const prefs = readUserPrefs(user);
    prefsTier = normalizeBillingPrefsTier(prefs);
    if (prefsTier !== 'FREE') {
      const expRaw = prefs.subscriptionExpiresAt;
      prefsExpiresAt = typeof expRaw === 'string' ? expRaw : null;
      prefsSource = prefsTier === 'LIFETIME'
        ? 'prefs_lifetime'
        : prefsTier === 'ORG'
          ? 'prefs_org'
          : 'prefs_sync';
    }
  } catch {
    // fall through
  }

  const uiTier = maxBillingUiTier(ledgerTier, prefsTier);
  if (uiTier === 'FREE') {
    const res = {
      active: false,
      expiresAt: null,
      source: 'none' as SubscriptionEntitlementSource,
      uiTier: 'FREE' as BillingUiTier};
    entitlementCache.set(userId, { data: res, ts: Date.now() });
    return res;
  }

  const expiresAt = uiTier === prefsTier && prefsExpiresAt
    ? prefsExpiresAt
    : ledgerExpiresAt || prefsExpiresAt;

  const source = uiTier === prefsTier && tierRank(uiTier) >= tierRank(ledgerTier)
    ? prefsSource
    : ledgerSource;

  const result = {
    active: true,
    expiresAt,
    source: source === 'none' ? ('prefs_sync' as SubscriptionEntitlementSource) : source,
    uiTier};

  entitlementCache.set(userId, { data: result, ts: Date.now() });
  return result;
}

function tierRank(tier: BillingUiTier): number {
  if (tier === 'LIFETIME' || tier === 'ORG') return 4;
  if (tier === 'TEAMS') return 3;
  if (tier === 'PRO') return 2;
  return 0;
}

export async function hasPaidKylrixPlanServer(userId: string): Promise<boolean> {
  const ent = await getVerifiedProEntitlementForUser(userId).catch(() => null);
  return !!(ent && ent.active && ent.uiTier !== 'FREE');
}


/** Server-authoritative tier for collaboration and billing gates (ledger + prefs). */
export async function getUserSubscriptionTierServer(userId: string): Promise<BillingUiTier> {
  if (isSelfHostedDeployment()) {
    return getOpenSuiteEntitlement().uiTier;
  }

  const ent = await getVerifiedProEntitlementForUser(userId).catch(() => null);
  if (ent?.active && ent.uiTier !== 'FREE') {
    return ent.uiTier;
  }

  try {
    const { users } = createSystemClient();
    const user = await users.get(userId);
    return normalizeBillingPrefsTier(readUserPrefs(user));
  } catch {
    return 'FREE';
  }
}
