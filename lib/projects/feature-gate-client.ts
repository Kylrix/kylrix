'use client';

import { getPublicPricingPlans } from '@/lib/config/pricing-plans-client';
import { isPublicPricingTiersEnabled } from '@/lib/config/product-client';

export function clientUserHasFeature(ledgerKey: string | null | undefined, featureId: string): boolean {
  if (!isPublicPricingTiersEnabled()) return true;
  const key = String(ledgerKey || 'FREE').trim().toUpperCase();
  if (key === 'LIFETIME' || key === 'ORG') return true;

  const plan = getPublicPricingPlans().find((p) => p.ledgerKey === key);
  if (!plan) return false;
  return plan.exclusiveFeatures.some((f) => f.id === featureId);
}

export function userCanUseProjects(userTier: string | null | undefined): boolean {
  return clientUserHasFeature(userTier, 'projects');
}
