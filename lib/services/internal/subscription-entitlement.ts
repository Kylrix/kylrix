import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { pickLatestSubscription, type SubscriptionRow } from '@/lib/billing/subscription-helpers';

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const SUBSCRIPTIONS_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;

function parsePrefsTier(prefs: Record<string, unknown>): string {
  const st = prefs.subscriptionTier;
  const t = prefs.tier;
  return String((st != null ? st : t) || 'FREE').toUpperCase();
}

/**
 * Authoritative Pro check for UI gates that must not trust the URL alone.
 * 1) Active subscription row with unexpired currentPeriodEnd (normal paid track).
 * 2) Prefs: LIFETIME / ORG (legacy / grants) with optional expiry for ORG.
 */
export async function getVerifiedProEntitlementForUser(userId: string): Promise<{
  active: boolean;
  expiresAt: string | null;
  source: 'subscription_row' | 'prefs_lifetime' | 'prefs_org' | 'none';
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
      };
    }
  } catch {
    // fall through to prefs
  }

  try {
    const prefs = (await users.getPrefs(userId)) as Record<string, unknown>;
    const tier = parsePrefsTier(prefs);
    const expRaw = prefs.subscriptionExpiresAt;
    const exp = typeof expRaw === 'string' && expRaw ? new Date(expRaw) : null;
    const expiryOk = !exp || (!Number.isNaN(exp.getTime()) && exp > now);

    if (tier === 'LIFETIME') {
      return { active: true, expiresAt: null, source: 'prefs_lifetime' };
    }
    if (tier === 'ORG' && expiryOk) {
      return { active: true, expiresAt: typeof expRaw === 'string' ? expRaw : null, source: 'prefs_org' };
    }
  } catch {
    // ignore
  }

  return { active: false, expiresAt: null, source: 'none' };
}
