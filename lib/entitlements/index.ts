export {
  getOpenSuiteEntitlement,
  resolveEffectiveBillingTier,
  resolveEffectiveBillingTierFromLabel,
  effectiveTierHasPaidAccess,
  allowsCollaboratorSharing,
  allowsGroupHangouts,
  getCollaboratorCap,
  getProjectCap,
  getContainerObjectCap,
  getNoteContentCharLimit,
  OPEN_SUITE_TIER,
  type OpenEntitlement,
} from '@/lib/entitlements/policy';

export {
  getDeploymentSurface,
  isBillingCommerceEnabled,
  isCloudDeployment,
  isSelfHostedDeployment,
  readSelfHostedClientEnv,
  readSelfHostedEnv,
  type DeploymentSurface,
} from '@/lib/deployment/surface';
