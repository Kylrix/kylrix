import { cache } from 'react';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { type BillingUiTier } from '@/lib/subscription/tier-resolution';
import { verifySubscriptionSig } from './subscription-prefs-merge';

export type SubscriptionEntitlementSource =
  | 'subscription_row'
  | 'prefs_lifetime'
  | 'prefs_org'
  | 'prefs_sync'
  | 'none';

type EntitlementResult = {
  active: boolean;
  expiresAt: string | null;
  source: SubscriptionEntitlementSource;
  uiTier: BillingUiTier;
};

const entitlementCache = new Map<string, { data: EntitlementResult; expiresAt: number }>();
const ENTITLEMENT_TTL_MS = 60000; // 60 seconds

export function invalidateEntitlementCache(userId?: string) {
  if (userId) {
    entitlementCache.delete(userId);
  } else {
    entitlementCache.clear();
  }
}

export async function suspendAccountAndLogIpSecure(_params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}): Promise<boolean> {
  return true;
}

export const getVerifiedProEntitlementForUser = cache(async function getVerifiedProEntitlementForUser(userId: string): Promise<EntitlementResult> {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) {
    return { active: false, expiresAt: null, source: 'none', uiTier: 'FREE' };
  }

  if (isSelfHostedDeployment()) {
    const open = getOpenSuiteEntitlement();
    return {
      active: open.active,
      expiresAt: open.expiresAt,
      source: 'prefs_lifetime',
      uiTier: open.uiTier,
    };
  }

  const cached = entitlementCache.get(cleanUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 1. Resolve user email and check matching account IDs for subscriptions or contributor flag
  try {
    let targetUser = await db
      .select({ id: schema.user.id, email: schema.user.email, isContributor: schema.user.isContributor })
      .from(schema.user)
      .where(eq(schema.user.id, cleanUserId))
      .limit(1);

    if (!targetUser.length && cleanUserId.includes('@')) {
      targetUser = await db
        .select({ id: schema.user.id, email: schema.user.email, isContributor: schema.user.isContributor })
        .from(schema.user)
        .where(eq(schema.user.email, cleanUserId.toLowerCase()))
        .limit(1);
    }

    if (!targetUser.length) {
      targetUser = await db
        .select({ id: schema.user.id, email: schema.user.email, isContributor: schema.user.isContributor })
        .from(schema.user)
        .where(eq(schema.user.appwriteAccountId, cleanUserId))
        .limit(1);
    }

    const u = targetUser[0];
    let targetUserIds = [cleanUserId];
    if (u) {
      if (u.id) targetUserIds.push(u.id);
      if (u.isContributor) {
        const res: EntitlementResult = {
          active: true,
          expiresAt: null,
          source: 'subscription_row',
          uiTier: 'CONTRIBUTOR',
        };
        entitlementCache.set(cleanUserId, { data: res, expiresAt: Date.now() + ENTITLEMENT_TTL_MS });
        return res;
      }
    }

    const tursoSub = await db
      .select()
      .from(schema.subscriptions)
      .where(inArray(schema.subscriptions.userId, Array.from(new Set(targetUserIds))))
      .limit(10);

    for (const sub of tursoSub) {
      if (sub.status === 'active') {
        const tierUpper = String(sub.tier || 'free').toUpperCase();
        const periodEnd = sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).getTime()
          : null;
        const active = periodEnd === null || periodEnd > Date.now();
        if (tierUpper !== 'FREE' && active) {
          const resTier = (tierUpper === 'PRO' || tierUpper === 'TEAMS' || tierUpper === 'LIFETIME' || tierUpper === 'CONTRIBUTOR')
            ? (tierUpper as BillingUiTier)
            : 'PRO';
          const res: EntitlementResult = {
            active: true,
            expiresAt: periodEnd ? new Date(periodEnd).toISOString() : null,
            source: 'subscription_row',
            uiTier: resTier,
          };
          entitlementCache.set(cleanUserId, { data: res, expiresAt: Date.now() + ENTITLEMENT_TTL_MS });
          return res;
        }
      }
    }
  } catch (_e) {
    // Turso DB lookup optional fallback
  }

  // 2. Verified fallback check: check signed user prefs (HMAC verified)
  try {
    const { createSystemClient } = await import('@/lib/data');
    const { users } = createSystemClient();
    const appwriteUser = await users.get(userId).catch(() => null);
    if (appwriteUser?.prefs) {
      const p = appwriteUser.prefs as any;
      const prefTier = String(p.subscriptionTier || p.tier || '').toUpperCase();
      const expIso = p.subscriptionExpiresAt;
      const sig = p.subscriptionSig;

      if (
        prefTier &&
        prefTier !== 'FREE' &&
        expIso &&
        sig &&
        new Date(expIso).getTime() > Date.now() &&
        verifySubscriptionSig(userId, prefTier, expIso, sig)
      ) {
        const resTier = (prefTier === 'PRO' || prefTier === 'TEAMS' || prefTier === 'LIFETIME' || prefTier === 'CONTRIBUTOR')
          ? (prefTier as BillingUiTier)
          : 'PRO';
        return {
          active: true,
          expiresAt: expIso,
          source: 'prefs_sync',
          uiTier: resTier,
        };
      }
    }
  } catch (_e) {}

  return {
    active: false,
    expiresAt: null,
    source: 'none',
    uiTier: 'FREE',
  };
});

export async function hasPaidKylrixPlanServer(userId: string): Promise<boolean> {
  const entitlement = await getVerifiedProEntitlementForUser(userId);
  return entitlement.active;
}

export async function getUserSubscriptionTierServer(userId: string): Promise<BillingUiTier> {
  const entitlement = await getVerifiedProEntitlementForUser(userId);
  return entitlement.uiTier;
}
