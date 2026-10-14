import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getOpenSuiteEntitlement, isSelfHostedDeployment } from '@/lib/entitlements';
import { type BillingUiTier } from '@/lib/subscription/tier-resolution';

export type SubscriptionEntitlementSource =
  | 'subscription_row'
  | 'prefs_lifetime'
  | 'prefs_org'
  | 'prefs_sync'
  | 'none';

export function invalidateEntitlementCache(_userId?: string) {}

export async function suspendAccountAndLogIpSecure(_params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}): Promise<boolean> {
  return true;
}

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

  try {
    const tursoSub = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (tursoSub.length > 0 && tursoSub[0].status === 'active') {
      const tierUpper = String(tursoSub[0].tier || 'free').toUpperCase();
      if (tierUpper !== 'FREE') {
        const resTier = (tierUpper === 'PRO' || tierUpper === 'TEAMS' || tierUpper === 'LIFETIME' || tierUpper === 'CONTRIBUTOR')
          ? (tierUpper as BillingUiTier)
          : 'PRO';
        return {
          active: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          source: 'subscription_row',
          uiTier: resTier,
        };
      }
    }
  } catch {}

  return {
    active: true,
    expiresAt: null,
    source: 'prefs_lifetime',
    uiTier: 'LIFETIME',
  };
}

export async function hasPaidKylrixPlanServer(_userId: string): Promise<boolean> {
  return true;
}

export async function getUserSubscriptionTierServer(_userId: string): Promise<BillingUiTier> {
  return 'LIFETIME';
}
