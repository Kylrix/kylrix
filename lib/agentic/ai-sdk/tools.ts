/**
 * Vercel AI SDK - Native Tools Definition for Kylrix
 * Bridges Kylrix's AGENTIC_TOOLS_REGISTRY into type-safe, multi-step Vercel AI SDK tools.
 */

import { tool } from 'ai';
import { AGENTIC_TOOL_SCHEMAS } from '@/sdk/contracts/agentic';

export interface ToolExecutionContext {
  userId?: string;
  jwt?: string;
  onToolCallEmitted?: (toolCall: { name: string; args: Record<string, any> }) => void;
}

/**
 * Generates the full catalog of Vercel AI SDK tools for multi-turn execution loops.
 */
export function getKylrixAiTools(ctx?: ToolExecutionContext) {
  const emit = (name: string, args: Record<string, unknown>) => {
    ctx?.onToolCallEmitted?.({ name, args });
    return {
      success: true,
      status: 'emitted',
      action: name,
      data: args,
    };
  };

  return {
    create_note: tool({
      description:
        'Create a new Idea/Note in Kylrix. System assigns userId and ID. Emits create_note toolCall for UI live-sync.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.create_note,
      execute: async (args) => emit('create_note', args),
    }),

    update_note: tool({
      description: 'Update an existing Idea/Note by its ID with new title, content, or tags.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.update_note,
      execute: async (args) => emit('update_note', args),
    }),

    get_note: tool({
      description: 'Fetch and read an Idea/Note by its ID for analysis or discussion.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.get_note,
      execute: async (args) => emit('get_note', args),
    }),

    create_goal: tool({
      description: 'Create a Goal/Task in Kylrix Flow to track deliverables, milestones, and actionable tasks.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.create_goal,
      execute: async (args) => emit('create_goal', args),
    }),

    update_goal: tool({
      description: 'Modify status, priority, title, or details of an existing Goal/Task.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.update_goal,
      execute: async (args) => emit('update_goal', args),
    }),

    create_project: tool({
      description: 'Create a new Project Workspace for grouping goals, ideas, and agentic workflows.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.create_project,
      execute: async (args) => emit('create_project', args),
    }),

    link_to_project: tool({
      description: 'Connect an Idea or Goal to a specific Project Workspace.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.link_to_project,
      execute: async (args) => emit('link_to_project', args),
    }),

    switch_workspace: tool({
      description: 'Switch active workspace context to target workspace without leaving the app.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.switch_workspace,
      execute: async (args) => emit('switch_workspace', args),
    }),

    'ui.navigate': tool({
      description: 'Navigate the application via semantic target IDs (e.g. settings.passkeys, goals.home, ideas.home) or route.',
      inputSchema: AGENTIC_TOOL_SCHEMAS['ui.navigate'],
      execute: async (args) => emit('ui.navigate', args),
    }),

    search_ecosystem: tool({
      description: 'Perform cross-domain search across Ideas, Goals, Events, Forms, and Workspaces.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.search_ecosystem,
      execute: async (args) => emit('search_ecosystem', args),
    }),

    suggest_next_steps: tool({
      description: 'Emit 2–4 clickable next-step action chips in the chat UI.',
      inputSchema: AGENTIC_TOOL_SCHEMAS.suggest_next_steps,
      execute: async (args) => emit('suggest_next_steps', args),
    }),
  };
}
