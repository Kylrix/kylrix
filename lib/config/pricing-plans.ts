/**
 * Env-driven pricing plans.
 * Each plan lists capabilities it includes that are NOT on the free plan.
 * Lists are independent per plan — duplication across plans is expected and fine.
 */

import { parseEnvCsv, parseEnvInt } from '@/lib/config/env-flags';

/** Known gated capabilities (only these can appear in PRICING_PLAN_N_FEATURES). */
export const FEATURE_CATALOG: Record<string, string> = {
  ai: 'Intelligent AI Sidekick & Agents',
  voice: 'Audio messages & voice notes',
  file_upload: 'Cloud file storage & attachments',
  sharing: 'Direct sharing & collaborators on objects',
  pinned_notes: 'Pinned notes',
  milestones: 'Goal milestones',
  discussions: 'Resource discussions',
  oauth_provider: 'Sign in with your app (OAuth)',
  article_mode: 'Article mode',
  /** Team Projects — nested workspaces (UI: Projects; root tier uses Workspaces). */
  projects: 'Projects & team workspaces',
  api_limits: 'Higher API rate limits',
  group_hangouts: 'Group hangouts & channels',
};

export type PricingPlan = {
  index: number;
  name: string;
  description: string;
  priceUsd: number;
  /** Checkout / ledger key (e.g. PRO, TEAMS, PLAN_A). */
  ledgerKey: string;
  /** Capability ids this plan includes that are not on the free plan. */
  exclusiveFeatures: string[];
};

const MAX_PLAN_SCAN = 12;

const PRO_VS_FREE = [
  'ai',
  'voice',
  'file_upload',
  'sharing',
  'pinned_notes',
  'milestones',
  'discussions',
  'oauth_provider',
  'article_mode',
];

const TEAMS_VS_FREE = [
  ...PRO_VS_FREE,
  'projects',
  'api_limits',
  'group_hangouts',
];

let cachedPlans: PricingPlan[] | null = null;

function readPlanCount(): number {
  const explicit = parseEnvInt(process.env.PRICING_PLAN_COUNT, 0);
  if (explicit > 0) return Math.min(explicit, MAX_PLAN_SCAN);

  let detected = 0;
  for (let i = 1; i <= MAX_PLAN_SCAN; i++) {
    const hasAny =
      process.env[`PRICING_PLAN_${i}_NAME`] ||
      process.env[`PRICING_PLAN_${i}_PRICE_USD`] ||
      process.env[`PRICING_PLAN_${i}_FEATURES`];
    if (!hasAny) break;
    detected = i;
  }
  return detected;
}

function defaultCloudPlans(): PricingPlan[] {
  return [
    {
      index: 1,
      name: 'Pro',
      description: 'Full private suite for individuals',
      priceUsd: 10,
      ledgerKey: 'PRO',
      exclusiveFeatures: [...PRO_VS_FREE],
    },
    {
      index: 2,
      name: 'Teams',
      description: 'Projects, higher API limits, and group hangouts',
      priceUsd: 50,
      ledgerKey: 'TEAMS',
      exclusiveFeatures: [...TEAMS_VS_FREE],
    },
  ];
}

export function getPricingPlans(): PricingPlan[] {
  if (cachedPlans) return cachedPlans;

  const count = readPlanCount();
  if (count === 0) {
    cachedPlans = defaultCloudPlans();
    return cachedPlans;
  }

  const plans: PricingPlan[] = [];
  for (let i = 1; i <= count; i++) {
    const features = parseEnvCsv(process.env[`PRICING_PLAN_${i}_FEATURES`]).filter(
      (id) => id in FEATURE_CATALOG,
    );
    plans.push({
      index: i,
      name: process.env[`PRICING_PLAN_${i}_NAME`]?.trim() || `Plan ${i}`,
      description: process.env[`PRICING_PLAN_${i}_DESCRIPTION`]?.trim() || '',
      priceUsd: parseEnvInt(process.env[`PRICING_PLAN_${i}_PRICE_USD`], 0),
      ledgerKey: (process.env[`PRICING_PLAN_${i}_LEDGER`]?.trim() || `PLAN${i}`).toUpperCase(),
      exclusiveFeatures: features,
    });
  }

  cachedPlans = plans;
  return plans;
}

export function getPricingPlanByLedger(ledgerKey: string): PricingPlan | undefined {
  const key = String(ledgerKey || '').trim().toUpperCase();
  return getPricingPlans().find((p) => p.ledgerKey === key);
}

export function getPricingPlanByIndex(index: number): PricingPlan | undefined {
  return getPricingPlans().find((p) => p.index === index);
}

export function isFeatureGated(featureId: string): boolean {
  return getPricingPlans().some((plan) => plan.exclusiveFeatures.includes(featureId));
}

/** First plan (by index) that lists this feature — for upgrade messaging only. */
export function getLowestPlanWithFeature(featureId: string): PricingPlan | null {
  for (const plan of getPricingPlans()) {
    if (plan.exclusiveFeatures.includes(featureId)) return plan;
  }
  return null;
}

export function getFeatureLabel(featureId: string): string | null {
  return FEATURE_CATALOG[featureId] ?? null;
}

/** True when at least one catalog feature is not listed on any paid plan. */
export function hasFreeTier(): boolean {
  const gated = new Set(getPricingPlans().flatMap((p) => p.exclusiveFeatures));
  return Object.keys(FEATURE_CATALOG).some((id) => !gated.has(id));
}

/**
 * Whether a billing ledger includes a gated feature.
 * Each plan stands alone — no inheritance from other plans.
 */
export function ledgerMeetsFeature(
  ledgerKey: string | null | undefined,
  featureId: string,
): boolean {
  if (!isFeatureGated(featureId)) return true;

  const key = String(ledgerKey || 'FREE').trim().toUpperCase();
  if (key === 'LIFETIME' || key === 'ORG') return true;

  const plan = getPricingPlanByLedger(key);
  if (plan) {
    return plan.exclusiveFeatures.includes(featureId);
  }

  if (!hasFreeTier()) return false;
  return false;
}

export function listExclusiveFeaturesForPlan(planIndex: number): Array<{ id: string; label: string }> {
  const plan = getPricingPlanByIndex(planIndex);
  if (!plan) return [];
  return plan.exclusiveFeatures.map((id) => ({
    id,
    label: FEATURE_CATALOG[id] || id,
  }));
}

export function resetPricingPlansCache(): void {
  cachedPlans = null;
}

export function serializePricingPlansForClient(): string {
  return JSON.stringify(
    getPricingPlans().map((p) => ({
      index: p.index,
      name: p.name,
      description: p.description,
      priceUsd: p.priceUsd,
      ledgerKey: p.ledgerKey,
      exclusiveFeatures: p.exclusiveFeatures.map((id) => ({
        id,
        label: FEATURE_CATALOG[id] || id,
      })),
    })),
  );
}
