/**
 * Entitlement policy — the tablecloth between deployment surface and cloud billing rules.
 * Cloud tier resolution stays in tier-resolution; this layer decides what the running deployment grants.
 */

import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import {
  billingTierHasPaidAccess,
  normalizeBillingPrefsTier,
  type BillingUiTier,
} from '@/lib/subscription/tier-resolution';

/** Tier used when the full suite is open (self-hosted). */
export const OPEN_SUITE_TIER: BillingUiTier = 'LIFETIME';

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
    source: 'selfhosted',
  };
}

export function resolveEffectiveBillingTier(
  prefs: Record<string, unknown> | null | undefined,
): BillingUiTier {
  if (isSelfHostedDeployment()) {
    return OPEN_SUITE_TIER;
  }
  return normalizeBillingPrefsTier(prefs);
}

export function resolveEffectiveBillingTierFromLabel(tier: string | null | undefined): BillingUiTier {
  if (isSelfHostedDeployment()) {
    return OPEN_SUITE_TIER;
  }
  const normalized = String(tier || 'FREE').trim().toUpperCase();
  if (normalized === 'LIFETIME') return 'LIFETIME';
  if (normalized === 'TEAMS') return 'TEAMS';
  if (normalized === 'ORG') return 'ORG';
  if (normalized === 'PRO') return 'PRO';
  return 'FREE';
}

export function effectiveTierHasPaidAccess(tier?: BillingUiTier | string | null): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  return billingTierHasPaidAccess(tier || 'FREE');
}

export function allowsCollaboratorSharing(tier: BillingUiTier | string, resourceType?: string): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  const normalized = String(tier || 'FREE').toUpperCase();
  if (resourceType === 'project') {
    return normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME';
  }
  // Objects (notes, tasks, etc.) unlock for PRO and higher
  return normalized === 'PRO' || normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME';
}

export function getCollaboratorCap(tier: BillingUiTier | string, resourceType?: string): number {
  if (isSelfHostedDeployment()) {
    return Number.POSITIVE_INFINITY;
  }
  const normalized = String(tier || 'FREE').toUpperCase();
  if (resourceType === 'project') {
    if (normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME') {
      return Number.POSITIVE_INFINITY;
    }
    return 0;
  }
  // Objects (notes, tasks, etc.) unlock unlimited for PRO and higher
  if (normalized === 'PRO' || normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME') {
    return Number.POSITIVE_INFINITY;
  }
  return 0;
}

export function getProjectCap(tier: BillingUiTier | string): number {
  return Number.POSITIVE_INFINITY;
}

export function getContainerObjectCap(tier: BillingUiTier | string): number {
  return Number.POSITIVE_INFINITY;
}

export function allowsGroupHangouts(tier: BillingUiTier | string): boolean {
  return true;
}

export function allowsGroupCalls(tier: BillingUiTier | string): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  const normalized = String(tier || 'FREE').toUpperCase();
  return normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME';
}

export function allowsAudioRecordings(tier: BillingUiTier | string): boolean {
  if (isSelfHostedDeployment()) {
    return true;
  }
  const normalized = String(tier || 'FREE').toUpperCase();
  return normalized === 'PRO' || normalized === 'TEAMS' || normalized === 'ORG' || normalized === 'LIFETIME';
}

export function getNoteContentCharLimit(tier: BillingUiTier | string): number {
  return 655350000;
}
