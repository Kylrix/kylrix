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
      const periodEnd = tursoSub[0].currentPeriodEnd
        ? new Date(tursoSub[0].currentPeriodEnd).getTime()
        : null;
      const active = periodEnd === null || periodEnd > Date.now();
      if (tierUpper !== 'FREE' && active) {
        const resTier = (tierUpper === 'PRO' || tierUpper === 'TEAMS' || tierUpper === 'LIFETIME' || tierUpper === 'CONTRIBUTOR')
          ? (tierUpper as BillingUiTier)
          : 'PRO';
        return {
          active: true,
          expiresAt: periodEnd ? new Date(periodEnd).toISOString() : null,
          source: 'subscription_row',
          uiTier: resTier,
        };
      }
    }
  } catch {}

  return {
    active: false,
    expiresAt: null,
    source: 'none',
    uiTier: 'FREE',
  };
}

export async function hasPaidKylrixPlanServer(userId: string): Promise<boolean> {
  const entitlement = await getVerifiedProEntitlementForUser(userId);
  return entitlement.active;
}

export async function getUserSubscriptionTierServer(userId: string): Promise<BillingUiTier> {
  const entitlement = await getVerifiedProEntitlementForUser(userId);
  return entitlement.uiTier;
}
