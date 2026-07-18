/**
 * Modular agentic surface — import from here instead of reaching into the drawer.
 * Session chat UI stays in AgenticPanelContent; one-shot / suite callers use runtime helpers.
 */

export {
  AGENTIC_TOOLS_REGISTRY,
  NOTE_TOOL_PAYLOAD_SCHEMA,
  type AgenticToolDefinition,
} from './tools-registry';

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
