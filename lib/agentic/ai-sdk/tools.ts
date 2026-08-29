/**
 * Vercel AI SDK - Native Tools Definition for Kylrix
 * Bridges Kylrix's AGENTIC_TOOLS_REGISTRY into type-safe, multi-step Vercel AI SDK tools.
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  goalCreateInputZod,
  goalUpdateInputZod,
} from '@/lib/domain/goal-contract';

export interface ToolExecutionContext {
  userId?: string;
  jwt?: string;
  onToolCallEmitted?: (toolCall: { name: string; args: Record<string, any> }) => void;
}

/**
 * Generates the full catalog of Vercel AI SDK tools for multi-turn execution loops.
 */
export function getKylrixAiTools(ctx?: ToolExecutionContext) {
  return {
    create_note: tool({
      description:
        'Create a new Idea/Note in Kylrix. System assigns userId and ID. Emits create_note toolCall for UI live-sync.',
      inputSchema: z.object({
        title: z.string().describe('Title of the idea or note'),
        content: z.string().describe('Full markdown content of the note'),
        tags: z.array(z.string()).optional().describe('Optional tags for indexing and organization'),
        isPublic: z.boolean().optional().describe('Whether the note is publicly accessible'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'create_note', args });
        return {
          success: true,
          status: 'emitted',
          action: 'create_note',
          data: args,
        };
      },
    }),

    update_note: tool({
      description: 'Update an existing Idea/Note by its ID with new title, content, or tags.',
      inputSchema: z.object({
        id: z.string().describe('Target Note ID ($id)'),
        title: z.string().optional().describe('Updated title'),
        content: z.string().optional().describe('Updated markdown content'),
        tags: z.array(z.string()).optional().describe('Updated tags'),
        isPublic: z.boolean().optional().describe('Updated visibility flag'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'update_note', args });
        return {
          success: true,
          status: 'emitted',
          action: 'update_note',
          data: args,
        };
      },
    }),

    get_note: tool({
      description: 'Fetch and read an Idea/Note by its ID for analysis or discussion.',
      inputSchema: z.object({
        id: z.string().describe('Note ID ($id) to fetch'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'get_note', args });
        return {
          success: true,
          status: 'emitted',
          action: 'get_note',
          data: args,
        };
      },
    }),

    create_goal: tool({
      description: 'Create a Goal/Task in Kylrix Flow to track deliverables, milestones, and actionable tasks.',
      inputSchema: goalCreateInputZod,
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'create_goal', args });
        return {
          success: true,
          status: 'emitted',
          action: 'create_goal',
          data: args,
        };
      },
    }),

    update_goal: tool({
      description: 'Modify status, priority, title, or details of an existing Goal/Task.',
      inputSchema: goalUpdateInputZod.extend({ id: z.string().describe('Goal/Task ID ($id)') }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'update_goal', args });
        return {
          success: true,
          status: 'emitted',
          action: 'update_goal',
          data: args,
        };
      },
    }),

    create_project: tool({
      description: 'Create a new Project Workspace for grouping goals, ideas, and agentic workflows.',
      inputSchema: z.object({
        title: z.string().describe('Project title'),
        summary: z.string().optional().describe('Short project summary or mission'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'create_project', args });
        return {
          success: true,
          status: 'emitted',
          action: 'create_project',
          data: args,
        };
      },
    }),

    link_to_project: tool({
      description: 'Connect an Idea or Goal to a specific Project Workspace.',
      inputSchema: z.object({
        objectType: z.enum(['note', 'goal']).describe('Type of resource being attached'),
        objectId: z.string().describe('Resource ID ($id)'),
        projectId: z.string().optional().describe('Target Project Workspace ID'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'link_to_project', args });
        return {
          success: true,
          status: 'emitted',
          action: 'link_to_project',
          data: args,
        };
      },
    }),

    switch_workspace: tool({
      description: 'Switch active workspace context to target workspace without leaving the app.',
      inputSchema: z.object({
        workspaceId: z.string().describe('Target Workspace ID'),
        workspaceTitle: z.string().optional().describe('Target Workspace Title'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'switch_workspace', args });
        return {
          success: true,
          status: 'emitted',
          action: 'switch_workspace',
          data: args,
        };
      },
    }),

    'ui.navigate': tool({
      description: 'Navigate the application via semantic target IDs (e.g. settings.passkeys, goals.home, ideas.home) or route.',
      inputSchema: z.object({
        target: z.string().optional().describe('Semantic navigation target ID'),
        route: z.string().optional().describe('Raw relative URL route'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'ui.navigate', args });
        return {
          success: true,
          status: 'emitted',
          action: 'ui.navigate',
          data: args,
        };
      },
    }),

    search_ecosystem: tool({
      description: 'Perform cross-domain search across Ideas, Goals, Events, Forms, and Workspaces.',
      inputSchema: z.object({
        query: z.string().describe('Search query phrase'),
        limit: z.number().optional().describe('Maximum number of search results to retrieve (default 8)'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'search_ecosystem', args });
        return {
          success: true,
          status: 'emitted',
          action: 'search_ecosystem',
          data: args,
        };
      },
    }),

    suggest_next_steps: tool({
      description: 'Emit 2–4 clickable next-step action chips in the chat UI.',
      inputSchema: z.object({
        suggestions: z.array(
          z.object({
            label: z.string().describe('Short UI chip text (e.g. "Create Goal", "Add Note")'),
            prompt: z.string().describe('Self-contained command prompt Kylie will run on click'),
          })
        ).describe('List of 2 to 4 suggested actions'),
      }),
      execute: async (args) => {
        ctx?.onToolCallEmitted?.({ name: 'suggest_next_steps', args });
        return {
          success: true,
          status: 'emitted',
          action: 'suggest_next_steps',
          data: args,
        };
      },
    }),
  };
}
