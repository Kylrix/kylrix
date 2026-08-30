/**
 * Canonical feature (capability) catalog.
 * Features align with ecosystem tools — each gated operation maps to a feature ID.
 * Env overrides: PRICING_PRO_FEATURES, PRICING_TEAMS_FEATURES (comma-separated IDs).
 */

import {
  getEnvProFeatureIds,
  getEnvTeamsFeatureIds} from '@/lib/config/product';
import type { BillingUiTier } from '@/lib/subscription/tier-resolution';

export type FeatureId = string;

export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  /** Minimum paid tier when pricing tiers are enabled. */
  minTier: 'PRO' | 'TEAMS';
  /** Optional ecosystem tool IDs this feature unlocks (for docs / MCP mapping). */
  tools?: string[];
};

/** Default Pro capabilities — cut from the Free plan when pricing tiers are on. */
export const DEFAULT_PRO_FEATURES: FeatureDefinition[] = [
  { id: 'suite.ideas', label: 'Unlimited ideas & notes', minTier: 'PRO', tools: ['objects.idea.create', 'objects.idea.update', 'objects.idea.delete'] },
  { id: 'suite.goals', label: 'Unlimited tasks & goals', minTier: 'PRO', tools: ['objects.goal.create', 'objects.goal.update', 'objects.goal.delete'] },
  { id: 'suite.vault', label: 'Unlimited passwords & vaults', minTier: 'PRO', tools: ['objects.vault.secret.create', 'objects.vault.secret.delete'] },
  { id: 'suite.forms', label: 'Unlimited forms & responses', minTier: 'PRO', tools: ['objects.form.submit'] },
  { id: 'suite.events', label: 'Unlimited events & calendar sync', minTier: 'PRO' },
  { id: 'suite.workspaces', label: 'Unlimited workspaces', minTier: 'PRO', tools: ['workspace.create', 'workspace.update', 'workspace.delete'] },
  { id: 'suite.collaboration', label: 'Object sharing & collaboration', minTier: 'PRO' },
  { id: 'suite.chat', label: 'Private chats', minTier: 'PRO' },
  { id: 'suite.moments', label: 'Moments & feeds', minTier: 'PRO' },
  { id: 'suite.storage', label: 'Cloud file storage & attachments', minTier: 'PRO' },
  { id: 'suite.ai', label: 'Intelligent AI Sidekick & Agents', minTier: 'PRO' },
  { id: 'suite.graph', label: 'Neural graph exploration', minTier: 'PRO' },
  { id: 'suite.audio', label: 'Audio messages & voice notes', minTier: 'PRO' },
  { id: 'suite.sharing', label: 'Direct link sharing & duplication', minTier: 'PRO' },
];

/** Teams-only capabilities (Pro features are inherited). */
export const DEFAULT_TEAMS_FEATURES: FeatureDefinition[] = [
  { id: 'suite.team_workspace', label: 'Shared team workspaces & permissions', minTier: 'TEAMS', tools: ['workspace.search'] },
  { id: 'suite.hangouts', label: 'Team discussion channels & Hangouts', minTier: 'TEAMS' },
  { id: 'suite.team_calls', label: 'Group Hangouts & calls', minTier: 'TEAMS' },
];

const TIER_RANK: Record<'FREE' | 'PRO' | 'TEAMS', number> = {
  FREE: 0,
  PRO: 1,
  TEAMS: 2,
};

let cachedMinTierMap: Map<FeatureId, 'PRO' | 'TEAMS'> | null = null;

function buildMinTierMap(): Map<FeatureId, 'PRO' | 'TEAMS'> {
  const map = new Map<FeatureId, 'PRO' | 'TEAMS'>();

  const envPro = getEnvProFeatureIds();
  const envTeams = getEnvTeamsFeatureIds();

  const proIds = envPro.length ? envPro : DEFAULT_PRO_FEATURES.map((f) => f.id);
  const teamsIds = envTeams.length ? envTeams : DEFAULT_TEAMS_FEATURES.map((f) => f.id);

  for (const id of proIds) {
    if (!map.has(id)) map.set(id, 'PRO');
  }
  for (const id of teamsIds) {
    map.set(id, 'TEAMS');
  }

  return map;
}

export function getFeatureMinTier(featureId: FeatureId): 'PRO' | 'TEAMS' | null {
  if (!cachedMinTierMap) {
    cachedMinTierMap = buildMinTierMap();
  }
  return cachedMinTierMap.get(featureId) ?? null;
}

export function tierMeetsFeature(
  userTier: BillingUiTier | string | null | undefined,
  featureId: FeatureId,
): boolean {
  const required = getFeatureMinTier(featureId);
  if (!required) return true;

  const normalized = String(userTier || 'FREE').trim().toUpperCase();
  if (normalized === 'LIFETIME' || normalized === 'ORG') return true;
  if (normalized === 'TEAMS') return true;
  if (normalized === 'PRO') return required === 'PRO';
  return false;
}

export function compareBillingTiers(a: BillingUiTier | string, b: BillingUiTier | string): number {
  const rank = (tier: string) => {
    const t = tier.toUpperCase();
    if (t === 'LIFETIME' || t === 'ORG') return 99;
    return TIER_RANK[t as keyof typeof TIER_RANK] ?? 0;
  };
  return rank(a) - rank(b);
}

export function listPricingFeaturesForTier(tier: 'PRO' | 'TEAMS'): FeatureDefinition[] {
  const all = [...DEFAULT_PRO_FEATURES, ...DEFAULT_TEAMS_FEATURES];
  const minTierMap = cachedMinTierMap ?? buildMinTierMap();

  if (tier === 'PRO') {
    return all.filter((f) => minTierMap.get(f.id) === 'PRO');
  }
  return all.filter((f) => minTierMap.get(f.id) === 'TEAMS');
}

export function getFeatureLabel(featureId: FeatureId): string | null {
  const found = [...DEFAULT_PRO_FEATURES, ...DEFAULT_TEAMS_FEATURES].find((f) => f.id === featureId);
  return found?.label ?? null;
}

/** Reset cached env-derived map (tests). */
export function resetFeatureCatalogCache(): void {
  cachedMinTierMap = null;
}

/** Map ecosystem tool ID → feature ID for gating. */
export const TOOL_FEATURE_MAP: Record<string, FeatureId> = {
  'workspace.create': 'suite.workspaces',
  'workspace.update': 'suite.workspaces',
  'workspace.delete': 'suite.workspaces',
  'objects.idea.create': 'suite.ideas',
  'objects.idea.update': 'suite.ideas',
  'objects.idea.delete': 'suite.ideas',
  'objects.goal.create': 'suite.goals',
  'objects.goal.update': 'suite.goals',
  'objects.goal.delete': 'suite.goals',
  'objects.vault.secret.create': 'suite.vault',
  'objects.vault.secret.delete': 'suite.vault',
  'objects.form.submit': 'suite.forms',
  'developer.pat.create': 'suite.ai',
};

export function featureIdForTool(toolId: string): FeatureId | null {
  return TOOL_FEATURE_MAP[toolId] ?? null;
}
