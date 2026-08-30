/**
 * Server-side feature entitlement gate.
 * When pricing tiers are disabled (self-host), all features are open.
 */

import { isPricingTiersEnabled } from '@/lib/config/product';
import { getFeatureLabel, getLowestPlanWithFeature, isFeatureGated } from '@/lib/config/pricing-plans';
import { getFeatureMinTier, tierMeetsFeature, type FeatureId } from '@/lib/tools/features';
import { getVerifiedProEntitlementForUser } from '@/lib/services/internal/subscription-entitlement';
import type { BillingUiTier } from '@/lib/subscription/tier-resolution';

export const FEATURE_REQUIRES_UPGRADE_CODE = 'FEATURE_REQUIRES_UPGRADE';

export function isFeatureGatingActive(): boolean {
  return isPricingTiersEnabled();
}

export async function resolveActorBillingTier(userId: string): Promise<BillingUiTier> {
  if (!isFeatureGatingActive()) {
    return 'LIFETIME';
  }
  const ent = await getVerifiedProEntitlementForUser(userId);
  return ent.uiTier;
}

export function userTierAllowsFeature(
  userTier: BillingUiTier | string | null | undefined,
  featureId: FeatureId,
): boolean {
  if (!isFeatureGatingActive()) return true;
  return tierMeetsFeature(userTier, featureId);
}

export async function assertActorFeatureAccess(
  userId: string,
  featureId: FeatureId,
): Promise<void> {
  if (!isFeatureGatingActive()) return;
  if (!isFeatureGated(featureId)) return;

  const tier = await resolveActorBillingTier(userId);
  if (userTierAllowsFeature(tier, featureId)) return;

  const label = getFeatureLabel(featureId) || featureId;
  const requiredPlan = getLowestPlanWithFeature(featureId);
  const planName = requiredPlan?.name || 'a paid plan';
  const err = new Error(`${label} requires ${planName}. Upgrade to continue.`);
  (err as Error & { code?: string; featureId?: string; minTier?: string }).code =
    FEATURE_REQUIRES_UPGRADE_CODE;
  (err as Error & { featureId?: string }).featureId = featureId;
  (err as Error & { minTier?: string }).minTier = requiredPlan?.ledgerKey || planName;
  throw err;
}

export async function checkActorFeatureAccess(
  userId: string,
  featureId: FeatureId,
): Promise<{ allowed: boolean; minTier: BillingUiTier | null; userTier: BillingUiTier }> {
  const userTier = await resolveActorBillingTier(userId);
  const minTier = getFeatureMinTier(featureId);
  return {
    allowed: userTierAllowsFeature(userTier, featureId),
    minTier,
    userTier,
  };
}
