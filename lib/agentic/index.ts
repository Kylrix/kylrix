/**
 * Modular agentic surface — import from here instead of reaching into the drawer.
 * Session chat UI stays in AgenticPanelContent; one-shot / suite callers use runtime helpers.
 */

export {
  buildInstantPrompt,
  getQuickWorkflows,
  resolveAgenticPageContext,
  type QuickWorkflowAction,
} from './context-workflows';

export {
  AI_UPGRADE_LABEL,
  userMayUsePaidAi,
} from './access';

export { runInstantAgenticRequest } from './runtime';

export * from './ai-sdk';
