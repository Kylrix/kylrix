import { NextRequest } from 'next/server';
import { resolveApiActor, type ApiActor } from '@/lib/api/guard';
import { RateLimitError } from '@/lib/api/rate-limits';
import { EdgeShieldError, assertShieldAllowed, enforceMcpPublicShield } from '@/lib/api/edge-shield';
import {
  AGENT_SESSION_JSON_SCHEMA,
  CHAT_MESSAGE_JSON_SCHEMA,
  CHAT_RECORD_JSON_SCHEMA,
  EVENT_RECORD_JSON_SCHEMA,
  FLOW_RECORD_JSON_SCHEMA,
  FORM_RECORD_JSON_SCHEMA,
  GOAL_RECORD_JSON_SCHEMA,
  MCP_AGENT_SESSION_CREATE_INPUT,
  MCP_AGENT_SESSION_GET_INPUT,
  MCP_AGENT_SESSION_LIST_INPUT,
  MCP_AGENT_SESSION_LIST_OUTPUT,
  MCP_CHAT_GET_INPUT,
  MCP_CHAT_LIST_INPUT,
  MCP_CHAT_LIST_OUTPUT,
  MCP_CHAT_MESSAGES_LIST_INPUT,
  MCP_CHAT_MESSAGES_LIST_OUTPUT,
  MCP_CHAT_SEND_INPUT,
  MCP_EVENT_CREATE_INPUT,
  MCP_EVENT_DELETE_INPUT,
  MCP_EVENT_GET_INPUT,
  MCP_EVENT_LIST_INPUT,
  MCP_EVENT_LIST_OUTPUT,
  MCP_EVENT_UPDATE_INPUT,
  MCP_FLOW_CREATE_INPUT,
  MCP_FLOW_DELETE_INPUT,
  MCP_FLOW_GET_INPUT,
  MCP_FLOW_LIST_INPUT,
  MCP_FLOW_LIST_OUTPUT,
  MCP_FORM_CREATE_INPUT,
  MCP_FORM_DELETE_INPUT,
  MCP_FORM_GET_INPUT,
  MCP_FORM_LIST_INPUT,
  MCP_FORM_LIST_OUTPUT,
  MCP_GOAL_CREATE_INPUT,
  MCP_GOAL_LIST_INPUT,
  MCP_GOAL_UPDATE_INPUT,
  MCP_MOMENT_COMMENT_CREATE_INPUT,
  MCP_MOMENT_COMMENTS_LIST_INPUT,
  MCP_MOMENT_CREATE_INPUT,
  MCP_MOMENT_GET_INPUT,
  MCP_MOMENT_LIST_INPUT,
  MCP_MOMENT_LIST_OUTPUT,
  MCP_NOTE_CREATE_INPUT,
  MCP_NOTE_DELETE_INPUT,
  MCP_NOTE_GET_INPUT,
  MCP_NOTE_LIST_INPUT,
  MCP_NOTE_LIST_OUTPUT,
  MCP_NOTE_UPDATE_INPUT,
  MCP_SUCCESS_OUTPUT,
  MCP_TAG_CREATE_INPUT,
  MCP_TAG_DELETE_INPUT,
  MCP_TAG_LIST_INPUT,
  MCP_TAG_LIST_OUTPUT,
  MCP_THREAD_MESSAGE_CREATE_INPUT,
  MCP_THREAD_MESSAGES_LIST_INPUT,
  MCP_THREAD_MESSAGES_LIST_OUTPUT,
  MCP_TRASH_LIST_INPUT,
  MCP_TRASH_LIST_OUTPUT,
  MCP_TRASH_PURGE_INPUT,
  MCP_TRASH_RESTORE_INPUT,
  MCP_WORKSPACE_COLLABORATOR_ADD_INPUT,
  MCP_WORKSPACE_COLLABORATORS_LIST_INPUT,
  MCP_WORKSPACE_COLLABORATORS_LIST_OUTPUT,
  MCP_WORKSPACE_CREATE_INPUT,
  MCP_WORKSPACE_DELETE_INPUT,
  MCP_WORKSPACE_GET_INPUT,
  MCP_WORKSPACE_LIST_INPUT,
  MCP_WORKSPACE_LIST_OUTPUT,
  MCP_WORKSPACE_UPDATE_INPUT,
  MOMENT_RECORD_JSON_SCHEMA,
  NOTE_RECORD_JSON_SCHEMA,
  TAG_RECORD_JSON_SCHEMA,
  THREAD_MESSAGE_JSON_SCHEMA,
  WORKSPACE_RECORD_JSON_SCHEMA,
} from '@/sdk/contracts';
import { executeMcpTool } from '@/lib/mcp/dispatch';

export { executeMcpTool } from '@/lib/mcp/dispatch';

export interface McpToolAnnotation {
  audience?: Array<'user' | 'assistant'>;
  readOnly?: boolean;
  idempotent?: boolean;
  destructive?: boolean;
  priority?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: readonly string[];
  };
  outputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    description?: string;
  };
  annotations?: McpToolAnnotation;
}

export const MCP_TOOLS: McpTool[] = [
  // ── 1. Profile / Authentication ──
  {
    name: 'get_my_profile',
    description: 'Retrieve identity details, active permissions, and scopes for the currently authenticated actor (user or agent).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'User or agent account ID' },
        auth: { type: 'string', description: 'Authentication provider type (pat, oauth, session)' },
        scopes: { type: 'array', items: { type: 'string' }, description: 'Active authorized scopes' },
        patId: { type: 'string', nullable: true, description: 'Personal Access Token ID if using PAT auth' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 1.0 },
  },
  {
    name: 'get_token_info',
    description: 'Inspect active personal access token metadata, authorized permission scopes, expiration, and rate limits.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        auth: { type: 'string' },
        userId: { type: 'string' },
        patId: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        catalog: { type: 'array', items: { type: 'object' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.9 },
  },
  {
    name: 'list_available_scopes',
    description: 'List all permission scopes available in the Kylrix ecosystem catalog.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        scopes: { type: 'array', items: { type: 'object' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'refresh_token_scopes',
    description: 'Refresh or adjust permission scopes on the current active Bearer PAT token on the fly. Allows autonomous agents to dynamically grant themselves needed workspace and agentic scopes.',
    inputSchema: {
      type: 'object',
      properties: {
        scopes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of permission scopes to grant or replace on this token (e.g. ["notes:read", "notes:write", "goals:read", "goals:write", "tags:read", "tags:write", "flows:read", "flows:write", "workspaces:read", "workspaces:write"])',
        },
        mode: {
          type: 'string',
          enum: ['grant', 'replace'],
          description: 'Whether to addively grant new scopes or replace current scope set (default: grant)',
        },
      },
      required: ['scopes'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        scopes: { type: 'array', items: { type: 'string' } },
        hint: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, idempotent: true, priority: 0.9 },
  },

  // ── 2. Workspaces (schemas from sdk/contracts/workspaces.ts) ──
  {
    name: 'list_workspaces',
    description: 'List all active human and agent workspaces accessible to the authenticated actor.',
    inputSchema: MCP_WORKSPACE_LIST_INPUT,
    outputSchema: MCP_WORKSPACE_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.9 },
  },
  {
    name: 'get_workspace',
    description: 'Retrieve detailed metadata and linked status for a specific workspace.',
    inputSchema: MCP_WORKSPACE_GET_INPUT,
    outputSchema: WORKSPACE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'create_workspace',
    description: 'Create a new project or agent workspace.',
    inputSchema: MCP_WORKSPACE_CREATE_INPUT,
    outputSchema: WORKSPACE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.8 },
  },
  {
    name: 'update_workspace',
    description: 'Update the title, summary, or visibility of an existing workspace.',
    inputSchema: MCP_WORKSPACE_UPDATE_INPUT,
    outputSchema: WORKSPACE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'delete_workspace',
    description: 'Delete a workspace and cascade its internal links.',
    inputSchema: MCP_WORKSPACE_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },
  {
    name: 'list_workspace_collaborators',
    description: 'List team members and collaborators attached to a workspace.',
    inputSchema: MCP_WORKSPACE_COLLABORATORS_LIST_INPUT,
    outputSchema: MCP_WORKSPACE_COLLABORATORS_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.6 },
  },
  {
    name: 'add_workspace_collaborator',
    description: 'Invite or add a user or agent as a collaborator on a workspace.',
    inputSchema: MCP_WORKSPACE_COLLABORATOR_ADD_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.6 },
  },

  // ── 3. Notes & Ideas (schemas from sdk/contracts/notes.ts) ──
  {
    name: 'list_notes',
    description: 'List notes and ideas, with optional workspace filtering.',
    inputSchema: MCP_NOTE_LIST_INPUT,
    outputSchema: MCP_NOTE_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.95 },
  },
  {
    name: 'get_note',
    description: 'Retrieve full markdown content, title, tags, and metadata for a specific note.',
    inputSchema: MCP_NOTE_GET_INPUT,
    outputSchema: NOTE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.9 },
  },
  {
    name: 'create_note',
    description: 'Create a new markdown note or idea, optionally linking it to a workspace.',
    inputSchema: MCP_NOTE_CREATE_INPUT,
    outputSchema: NOTE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.9 },
  },
  {
    name: 'update_note',
    description: 'Update the title, content, or visibility of an existing note.',
    inputSchema: MCP_NOTE_UPDATE_INPUT,
    outputSchema: NOTE_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.85 },
  },
  {
    name: 'delete_note',
    description: 'Move a note to trash or delete it.',
    inputSchema: MCP_NOTE_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.6 },
  },

  // ── 4. Goals & Tasks (schemas from sdk/contracts/goals.ts) ──
  {
    name: 'list_goals',
    description: 'List goals and task items, with optional status and workspace filtering.',
    inputSchema: MCP_GOAL_LIST_INPUT,
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: GOAL_RECORD_JSON_SCHEMA,
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.95 },
  },
  {
    name: 'get_goal',
    description: 'Retrieve full details, status, and description of a goal or task.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the goal to retrieve' },
      },
      required: ['id'],
    },
    outputSchema: GOAL_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.9 },
  },
  {
    name: 'create_goal',
    description: 'Create a new goal or actionable task, optionally linked to a workspace.',
    inputSchema: MCP_GOAL_CREATE_INPUT,
    outputSchema: GOAL_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.9 },
  },
  {
    name: 'update_goal',
    description: 'Update the title, description, status, priority, due date, or pins on an existing goal.',
    inputSchema: MCP_GOAL_UPDATE_INPUT,
    outputSchema: GOAL_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.85 },
  },
  {
    name: 'delete_goal',
    description: 'Delete a goal or task item.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the goal to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.6 },
  },

  // ── 5. Calendar Events ──
  {
    name: 'list_events',
    description: 'List scheduled calendar events.',
    inputSchema: MCP_EVENT_LIST_INPUT,
    outputSchema: MCP_EVENT_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_event',
    description: 'Retrieve details of a single calendar event.',
    inputSchema: MCP_EVENT_GET_INPUT,
    outputSchema: EVENT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_event',
    description: 'Create a calendar event with scheduling and location.',
    inputSchema: MCP_EVENT_CREATE_INPUT,
    outputSchema: EVENT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.8 },
  },
  {
    name: 'update_event',
    description: 'Update time, location, or details of a calendar event.',
    inputSchema: MCP_EVENT_UPDATE_INPUT,
    outputSchema: EVENT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event.',
    inputSchema: MCP_EVENT_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.55 },
  },

  // ── 6. Forms ──
  {
    name: 'list_forms',
    description: 'List created forms and questionnaires.',
    inputSchema: MCP_FORM_LIST_INPUT,
    outputSchema: MCP_FORM_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'get_form',
    description: 'Retrieve form schema, fields, and configuration by ID.',
    inputSchema: MCP_FORM_GET_INPUT,
    outputSchema: FORM_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'create_form',
    description: 'Create a new interactive form or intake questionnaire.',
    inputSchema: MCP_FORM_CREATE_INPUT,
    outputSchema: FORM_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'delete_form',
    description: 'Delete an interactive form.',
    inputSchema: MCP_FORM_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 7. Direct Chats & Messaging ──
  {
    name: 'list_chats',
    description: 'List direct conversations, peer messaging channels, and chat threads.',
    inputSchema: MCP_CHAT_LIST_INPUT,
    outputSchema: MCP_CHAT_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.85 },
  },
  {
    name: 'get_chat',
    description: 'Retrieve conversation details and participant list.',
    inputSchema: MCP_CHAT_GET_INPUT,
    outputSchema: CHAT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'list_chat_messages',
    description: 'List recent messages in a conversation.',
    inputSchema: MCP_CHAT_MESSAGES_LIST_INPUT,
    outputSchema: MCP_CHAT_MESSAGES_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.85 },
  },
  {
    name: 'send_chat_message',
    description: 'Send a message in an existing conversation or start a new direct chat with a user or agent.',
    inputSchema: MCP_CHAT_SEND_INPUT,
    outputSchema: CHAT_MESSAGE_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.9 },
  },

  // ── 8. Workflows & Flows ──
  {
    name: 'list_flows',
    description: 'List discoverable community flows and user workflow automations.',
    inputSchema: MCP_FLOW_LIST_INPUT,
    outputSchema: MCP_FLOW_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_flow',
    description: 'Retrieve full workflow definition, steps, and trigger conditions by ID.',
    inputSchema: MCP_FLOW_GET_INPUT,
    outputSchema: FLOW_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_flow',
    description: 'Create a new automated workflow or recipe.',
    inputSchema: MCP_FLOW_CREATE_INPUT,
    outputSchema: FLOW_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },
  {
    name: 'delete_flow',
    description: 'Delete an automated workflow.',
    inputSchema: MCP_FLOW_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 9. Tags & Classification ──
  {
    name: 'list_tags',
    description: 'List user and workspace classification tags with colors.',
    inputSchema: MCP_TAG_LIST_INPUT,
    outputSchema: MCP_TAG_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'create_tag',
    description: 'Create a new categorization tag.',
    inputSchema: MCP_TAG_CREATE_INPUT,
    outputSchema: TAG_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },
  {
    name: 'delete_tag',
    description: 'Delete a tag.',
    inputSchema: MCP_TAG_DELETE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 10. Moments / Feed ──
  {
    name: 'list_moments',
    description: 'List public or personal moments (updates, notes, activity feed).',
    inputSchema: MCP_MOMENT_LIST_INPUT,
    outputSchema: MCP_MOMENT_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'get_moment',
    description: 'Retrieve a specific moment update by ID.',
    inputSchema: MCP_MOMENT_GET_INPUT,
    outputSchema: MOMENT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.65 },
  },
  {
    name: 'create_moment',
    description: 'Publish a new status moment or social update to the feed.',
    inputSchema: MCP_MOMENT_CREATE_INPUT,
    outputSchema: MOMENT_RECORD_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'list_moment_comments',
    description: 'List comments on a moment.',
    inputSchema: MCP_MOMENT_COMMENTS_LIST_INPUT,
    outputSchema: MCP_THREAD_MESSAGES_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.65 },
  },
  {
    name: 'create_moment_comment',
    description: 'Add a comment to a moment.',
    inputSchema: MCP_MOMENT_COMMENT_CREATE_INPUT,
    outputSchema: THREAD_MESSAGE_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },

  // ── 11. Discussion Threads ──
  {
    name: 'list_thread_messages',
    description: 'List messages in an object discussion thread.',
    inputSchema: MCP_THREAD_MESSAGES_LIST_INPUT,
    outputSchema: MCP_THREAD_MESSAGES_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_thread_message',
    description: 'Post a comment or message into an object or workspace discussion thread.',
    inputSchema: MCP_THREAD_MESSAGE_CREATE_INPUT,
    outputSchema: THREAD_MESSAGE_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },

  // ── 12. Agent Sessions ──
  {
    name: 'list_agent_sessions',
    description: 'List autonomous agent execution sessions and tasks.',
    inputSchema: MCP_AGENT_SESSION_LIST_INPUT,
    outputSchema: MCP_AGENT_SESSION_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_agent_session',
    description: 'Retrieve details, status, and execution logs of an agent session.',
    inputSchema: MCP_AGENT_SESSION_GET_INPUT,
    outputSchema: AGENT_SESSION_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'create_agent_session',
    description: 'Start a new autonomous agent execution session.',
    inputSchema: MCP_AGENT_SESSION_CREATE_INPUT,
    outputSchema: AGENT_SESSION_JSON_SCHEMA,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.85 },
  },

  // ── 13. Trash & Recovery ──
  {
    name: 'list_trash',
    description: 'List deleted items in trash for recovery or purge.',
    inputSchema: MCP_TRASH_LIST_INPUT,
    outputSchema: MCP_TRASH_LIST_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.6 },
  },
  {
    name: 'restore_trash',
    description: 'Restore a deleted item from trash back into active workspace.',
    inputSchema: MCP_TRASH_RESTORE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },
  {
    name: 'purge_trash',
    description: 'Permanently purge a deleted item from trash.',
    inputSchema: MCP_TRASH_PURGE_INPUT,
    outputSchema: MCP_SUCCESS_OUTPUT,
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },];

const MCP_PUBLIC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'initialized',
  'ping',
  'tools/list',
  'resources/list',
  'prompts/list',
]);

function mcpJsonRpcError(id: unknown, code: number, message: string, data?: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

function mapGuardErrorToMcp(err: unknown, id: unknown) {
  if (err instanceof RateLimitError || (err as any)?.code === 'rate_limit_exceeded') {
    return {
      httpStatus: 429,
      body: mcpJsonRpcError(id, -32029, (err as Error).message, {
        type: (err as RateLimitError).type,
        retry_after: (err as RateLimitError).retryAfterSec,
      }),
    };
  }
  if (err instanceof EdgeShieldError || (err as any)?.code === 'edge_rate_limited') {
    return {
      httpStatus: 429,
      body: mcpJsonRpcError(id, -32029, (err as Error).message, {
        reason: (err as EdgeShieldError).reason,
        retry_after: (err as EdgeShieldError).retryAfterSec,
      }),
    };
  }
  const status = (err as any)?.status;
  if (status === 401) {
    return { httpStatus: 401, body: mcpJsonRpcError(id, -32001, (err as Error).message || 'Unauthorized') };
  }
  if (status === 413) {
    return { httpStatus: 413, body: mcpJsonRpcError(id, -32602, (err as Error).message || 'Payload too large') };
  }
  return null;
}

export type McpRpcResult =
  | { httpStatus: number; body: any }
  | { httpStatus?: number; body: any | null };

export async function handleMcpRpc(req: NextRequest, rpcPayload: any): Promise<McpRpcResult> {
  const { id, method, params } = rpcPayload || {};

  if (MCP_PUBLIC_METHODS.has(method)) {
    assertShieldAllowed(enforceMcpPublicShield(req));
  }

  // Handshake methods that can execute without strict authentication
  if (method === 'initialize') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: 'kylrix',
            displayName: 'Kylrix',
            description: 'Sovereign, local-first agentic workspace MCP server',
            version: '1.0.0',
            homepage: 'https://www.kylrix.space',
            iconUrl: 'https://www.kylrix.space/apple-touch-icon.png',
          },
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return { body: null }; // Notifications produce no response
  }

  if (method === 'ping') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {},
      },
    };
  }

  if (method === 'tools/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          tools: MCP_TOOLS,
        },
      },
    };
  }

  if (method === 'resources/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          resources: [],
        },
      },
    };
  }

  if (method === 'prompts/list') {
    return {
      body: {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          prompts: [],
        },
      },
    };
  }

  // Tool execution requires authenticated actor
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      let actor: ApiActor;
      try {
        actor = await resolveApiActor(req);
      } catch (authErr) {
        const mapped = mapGuardErrorToMcp(authErr, id);
        if (mapped) return mapped;
        if (toolName === 'list_available_scopes') {
          const { listScopeCatalog } = await import('@/lib/api/scopes');
          return {
            body: {
              jsonrpc: '2.0',
              id: id ?? null,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ scopes: listScopeCatalog() }, null, 2),
                  },
                ],
                isError: false,
              },
            },
          };
        }
        throw authErr;
      }

      const toolResult = await executeMcpTool(actor, toolName, toolArgs);

      return {
        body: {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
              },
            ],
            isError: false,
          },
        },
      };
    } catch (err: any) {
      const mapped = mapGuardErrorToMcp(err, id);
      if (mapped) return mapped;
      return {
        body: {
          jsonrpc: '2.0',
          id: id ?? null,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: err?.message || 'Tool execution failed' }),
              },
            ],
            isError: true,
          },
        },
      };
    }
  }

  return {
    body: {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    },
  };
}
