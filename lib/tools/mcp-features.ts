/**
 * MCP tool name → feature ID mapping for server-side gating.
 * Read/list operations are generally free; mutating tools require the mapped feature.
 */

import type { FeatureId } from '@/lib/tools/features';

export const MCP_TOOL_FEATURE_MAP: Record<string, FeatureId> = {
  create_workspace: 'suite.workspaces',
  update_workspace: 'suite.workspaces',
  delete_workspace: 'suite.workspaces',
  add_workspace_collaborator: 'suite.team_workspace',

  create_note: 'suite.ideas',
  update_note: 'suite.ideas',
  delete_note: 'suite.ideas',

  create_goal: 'suite.goals',
  update_goal: 'suite.goals',
  delete_goal: 'suite.goals',

  create_event: 'suite.events',
  update_event: 'suite.events',
  delete_event: 'suite.events',

  create_form: 'suite.forms',
  delete_form: 'suite.forms',

  send_chat_message: 'suite.chat',

  create_flow: 'suite.ai',
  delete_flow: 'suite.ai',

  create_moment: 'suite.moments',
  create_moment_comment: 'suite.moments',

  create_thread_message: 'suite.collaboration',
  ensure_thread: 'suite.collaboration',

  create_agent_session: 'suite.ai',

  create_tag: 'suite.ideas',
  delete_tag: 'suite.ideas',
};

export function featureIdForMcpTool(toolName: string): FeatureId | null {
  return MCP_TOOL_FEATURE_MAP[toolName] ?? null;
}

export function mcpToolRequiresFeatureGate(toolName: string): boolean {
  return toolName in MCP_TOOL_FEATURE_MAP;
}
