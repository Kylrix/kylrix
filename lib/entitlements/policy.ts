/**
 * Entitlement policy — the tablecloth between deployment surface and cloud billing rules.
 * Cloud tier resolution stays in tier-resolution; this layer decides what the running deployment grants.
 */

import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import { ledgerMeetsFeature } from '@/lib/config/pricing-plans';
import {
  billingTierHasPaidAccess,
  normalizeBillingPrefsTier,
  type BillingUiTier} from '@/lib/subscription/tier-resolution';

/** Tier used when the full suite is open (self-hosted). */
const OPEN_SUITE_TIER: BillingUiTier = 'LIFETIME';

export type OpenEntitlement = {
  uiTier: BillingUiTier;
  active: boolean;
  expiresAt: string | null;
  source: 'selfhosted' | 'cloud';
};

export function getOpenSuiteEntitlement(): OpenEntitlement {
  return {
    uiTier: OPEN_SUITE_TIER,
    active: true,
    expiresAt: null,
    source: 'selfhosted'};
}

export function resolveEffectiveBillingTier(
  prefs: Record<string, unknown> | null | undefined): BillingUiTier {
  if (isSelfHostedDeployment()) {
    return OPEN_SUITE_TIER;
  }
  return normalizeBillingPrefsTier(prefs);
}


export function effectiveTierHasPaidAccess(tier?: BillingUiTier | string | null): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  return billingTierHasPaidAccess(tier || 'FREE');
}

export function allowsCollaboratorSharing(_tier?: BillingUiTier | string, _resourceType?: string): boolean {
  // Collaborators are free and limitless on all plans across selfhosted and cloud deployments
  return true;
}

export function getCollaboratorCap(_tier?: BillingUiTier | string, _resourceType?: string): number {
  // Collaborators are free and limitless on all plans across selfhosted and cloud deployments
  return Number.POSITIVE_INFINITY;
}

export function getProjectCap(_tier: BillingUiTier | string): number {
  return Number.POSITIVE_INFINITY;
}


export function allowsGroupHangouts(tier: BillingUiTier | string): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  return ledgerMeetsFeature(tier, 'group_hangouts');
}

export function allowsGroupCalls(tier: BillingUiTier | string): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  return ledgerMeetsFeature(tier, 'group_hangouts');
}


