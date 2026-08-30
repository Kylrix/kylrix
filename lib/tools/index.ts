export { toolRegistry, redactPIIAndSensitiveFields } from './registry';
export type { EcosystemToolDefinition, ToolParameterSpec } from './registry';
export {
  DEFAULT_PRO_FEATURES,
  DEFAULT_TEAMS_FEATURES,
  TOOL_FEATURE_MAP,
  featureIdForTool,
  getFeatureLabel,
  getFeatureMinTier,
  listPricingFeaturesForTier,
  tierMeetsFeature,
} from './features';
export type { FeatureDefinition, FeatureId } from './features';
export {
  assertActorFeatureAccess,
  checkActorFeatureAccess,
  isFeatureGatingActive,
  resolveActorBillingTier,
  userTierAllowsFeature,
  FEATURE_REQUIRES_UPGRADE_CODE,
} from './gate';
export {
  MCP_TOOL_FEATURE_MAP,
  featureIdForMcpTool,
  mcpToolRequiresFeatureGate,
} from './mcp-features';
