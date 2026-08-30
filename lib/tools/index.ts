export { toolRegistry, redactPIIAndSensitiveFields } from './registry';
export type { EcosystemToolDefinition, ToolParameterSpec } from './registry';
export {
  FEATURE_CATALOG,
  MCP_TOOL_FEATURE_MAP,
  TOOL_FEATURE_MAP,
  featureIdForMcpTool,
  featureIdForTool,
  getFeatureLabel,
  getFeatureMinTier,
  hasFreeTier,
  listExclusiveFeaturesForPlan,
  mcpToolRequiresFeatureGate,
  tierMeetsFeature,
} from './features';
export type { FeatureId } from './features';
export {
  assertActorFeatureAccess,
  checkActorFeatureAccess,
  isFeatureGatingActive,
  resolveActorBillingTier,
  userTierAllowsFeature,
  FEATURE_REQUIRES_UPGRADE_CODE,
} from './gate';
