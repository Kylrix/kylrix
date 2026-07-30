/**
 * Modular agentic surface — import from here instead of reaching into the drawer.
 * Session chat UI stays in AgenticPanelContent; one-shot / suite callers use runtime helpers.
 */

export {
  AGENTIC_TOOLS_REGISTRY,
  NOTE_TOOL_PAYLOAD_SCHEMA,
  type AgenticToolDefinition,
  type AgenticToolCallPayload,
} from './tools-registry';

export { UI_DESTINATIONS, resolveUiDestination, buildUiCatalogPrompt } from './ui-catalog';
export type { UiDestination } from './ui-catalog';

export {
  parseAgenticPreferences,
  toolRequiresAuthorization,
  DESTRUCTIVE_TOOL_KEYS,
  type AgenticPreferences,
} from './preferences';

export { planSearchQuery, executeEcosystemSearch, type SearchHit, type SearchPlan } from './search-engine';

export {
  type AgenticMessageBlock,
  type EcosystemHitRef,
  hitsToRefs,
  parseBlocksFromToolSummary,
  serializeBlocksForToolSummary,
} from './message-blocks';

export { hydrateEcosystemHitsSync, ecosystemDomainLabel, type HydratedEcosystemHit } from './hydrate-ecosystem-hits';

export { AgenticSessionLocalStore, type AgenticLocalMessage, type AgenticLocalSession } from './session-local-store';

export { registerHintProvider, resolveHints, type HintCandidate } from './hint-engine';

export { AgenticPreviewPartition, type PreviewEnvelope } from './preview-partition';

export { canonicalizeToolKey, LEGACY_TO_CANONICAL } from './tool-bridge';

export {
  executeAgenticToolCall,
  executeAgenticToolCallWithToast,
  type AgenticExecutionContext,
  type AgenticToolCallInput,
} from './client-executor';

export { emitAgenticSpineEvent, subscribeAgenticSpine, initAgenticSpineListeners } from './spine-bridge';
export type { AgenticSpineEvent } from './spine-bridge';

export { triggerWorkflowAgentRun, onFormResponseReceived } from './workflow-bridge';

export {
  assembleSystemInstructionBlocks,
  buildNavigationGuide,
  buildSearchGuide,
  buildToolsPromptSnippet,
} from './prompt-framework';

export {
  buildInstantPrompt,
  getQuickWorkflows,
  resolveAgenticPageContext,
  type AgenticPageContext,
  type QuickWorkflowAction,
} from './context-workflows';

export {
  AI_REQUIRES_PRO_CODE,
  AI_REQUIRES_PRO_MESSAGE,
  AI_UPGRADE_LABEL,
  MILESTONES_UPGRADE_LABEL,
  assertClientPaidAiAccess,
  userMayUsePaidAi,
} from './access';

export { runInstantAgenticRequest, type InstantAgenticResult } from './runtime';

export {
  AGENTIC_ERROR_CODES,
  getAgenticUserMessage,
  resolveAgenticError,
  type AgenticErrorCode,
  type AgenticUserError,
} from './errors';
