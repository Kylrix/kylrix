/**
 * Feature gating — each paid plan lists its own features vs free (no cross-plan inheritance).
 */

import {
  FEATURE_CATALOG,
  getFeatureLabel,
  getLowestPlanWithFeature,
  hasFreeTier,
  isFeatureGated,
  ledgerMeetsFeature,
  listExclusiveFeaturesForPlan,
  resetPricingPlansCache,
} from '@/lib/config/pricing-plans';
import type { BillingUiTier } from '@/lib/subscription/tier-resolution';

export type FeatureId = string;

export { FEATURE_CATALOG, getFeatureLabel, hasFreeTier, listExclusiveFeaturesForPlan, isFeatureGated };

export function getFeatureMinTier(featureId: FeatureId): BillingUiTier | null {
  const plan = getLowestPlanWithFeature(featureId);
  return (plan?.ledgerKey as BillingUiTier) || null;
}

export function tierMeetsFeature(
  userTier: BillingUiTier | string | null | undefined,
  featureId: FeatureId,
): boolean {
  return ledgerMeetsFeature(String(userTier || 'FREE'), featureId);
}

export const TOOL_FEATURE_MAP: Record<string, FeatureId> = {
  'developer.pat.create': 'oauth_provider',
};

export const MCP_TOOL_FEATURE_MAP: Record<string, FeatureId> = {
  add_workspace_collaborator: 'projects',
  create_flow: 'ai',
  delete_flow: 'ai',
  create_agent_session: 'ai',
};

export function featureIdForTool(toolId: string): FeatureId | null {
  return TOOL_FEATURE_MAP[toolId] ?? null;
}

export function featureIdForMcpTool(toolName: string): FeatureId | null {
  return MCP_TOOL_FEATURE_MAP[toolName] ?? null;
}

export function mcpToolRequiresFeatureGate(toolName: string): boolean {
  return toolName in MCP_TOOL_FEATURE_MAP;
}

export function resetFeatureCatalogCache(): void {
  resetPricingPlansCache();
}
