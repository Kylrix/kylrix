import { NextRequest } from 'next/server';
import { resolveApiActor, type ApiActor } from '@/lib/api/guard';
import { RateLimitError } from '@/lib/api/rate-limits';
import { EdgeShieldError, assertShieldAllowed, enforceMcpPublicShield } from '@/lib/api/edge-shield';
import { ApiResources } from '@/lib/api/resources';
import {
  GOAL_RECORD_JSON_SCHEMA,
  MCP_GOAL_CREATE_INPUT,
  MCP_GOAL_LIST_INPUT,
  MCP_GOAL_UPDATE_INPUT,
  MCP_SUCCESS_OUTPUT,
  MCP_NOTE_CREATE_INPUT,
  MCP_NOTE_DELETE_INPUT,
  MCP_NOTE_GET_INPUT,
  MCP_NOTE_LIST_INPUT,
  MCP_NOTE_LIST_OUTPUT,
  MCP_NOTE_UPDATE_INPUT,
  NOTE_RECORD_JSON_SCHEMA,
} from '@/sdk/contracts';

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

  // ── 2. Workspaces ──
  {
    name: 'list_workspaces',
    description: 'List all active human and agent workspaces accessible to the authenticated actor.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of workspaces to return (default: 25, max: 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              summary: { type: 'string', nullable: true },
              visibility: { type: 'string' },
              isAgentic: { type: 'boolean' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.9 },
  },
  {
    name: 'get_workspace',
    description: 'Retrieve detailed metadata and linked status for a specific workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique workspace ID' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string', nullable: true },
        visibility: { type: 'string' },
        isAgentic: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'create_workspace',
    description: 'Create a new project or agent workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title or name of the workspace' },
        summary: { type: 'string', description: 'Optional description or summary of workspace objectives' },
        visibility: { type: 'string', enum: ['private', 'public', 'team'], description: 'Workspace visibility level' },
        isAgentic: { type: 'boolean', description: 'Set to true for autonomous agentic workspaces' },
      },
      required: ['title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        visibility: { type: 'string' },
        isAgentic: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.8 },
  },
  {
    name: 'update_workspace',
    description: 'Update the title, summary, or visibility of an existing workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the workspace to modify' },
        title: { type: 'string', description: 'New workspace title' },
        summary: { type: 'string', description: 'Updated workspace description' },
        visibility: { type: 'string', enum: ['private', 'public', 'team'], description: 'Updated visibility' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        visibility: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'delete_workspace',
    description: 'Delete a workspace and cascade its internal links.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the workspace to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },
  {
    name: 'list_workspace_collaborators',
    description: 'List team members and collaborators attached to a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Target workspace ID' },
      },
      required: ['workspaceId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.6 },
  },
  {
    name: 'add_workspace_collaborator',
    description: 'Invite or add a user or agent as a collaborator on a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Target workspace ID' },
        userId: { type: 'string', description: 'User ID or agent account ID to add' },
        role: { type: 'string', enum: ['editor', 'viewer', 'admin'], description: 'Assigned collaborator role' },
      },
      required: ['workspaceId', 'userId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
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
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
        limit: { type: 'number', description: 'Max events to return (default: 25)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              startTime: { type: 'string' },
              endTime: { type: 'string' },
              location: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_event',
    description: 'Retrieve details of a single calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the event' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        location: { type: 'string', nullable: true },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_event',
    description: 'Create a calendar event with scheduling and location.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the event' },
        description: { type: 'string', description: 'Description or agenda' },
        startTime: { type: 'string', description: 'ISO 8601 start timestamp' },
        endTime: { type: 'string', description: 'ISO 8601 end timestamp' },
        location: { type: 'string', description: 'Physical or virtual location URL' },
        workspaceId: { type: 'string', description: 'Optional workspace ID' },
      },
      required: ['title', 'startTime'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        startTime: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.8 },
  },
  {
    name: 'update_event',
    description: 'Update time, location, or details of a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the event to update' },
        title: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description' },
        startTime: { type: 'string', description: 'Updated start time' },
        endTime: { type: 'string', description: 'Updated end time' },
        location: { type: 'string', description: 'Updated location' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },
  {
    name: 'delete_event',
    description: 'Delete a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the event to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.55 },
  },

  // ── 6. Forms ──
  {
    name: 'list_forms',
    description: 'List created forms and questionnaires.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
        limit: { type: 'number', description: 'Max forms to return (default: 25)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'get_form',
    description: 'Retrieve form schema, fields, and configuration by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the form' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'create_form',
    description: 'Create a new interactive form or intake questionnaire.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the form' },
        description: { type: 'string', description: 'Form description' },
        schema: { type: 'object', description: 'JSON schema defining form questions and input fields' },
        workspaceId: { type: 'string', description: 'Optional workspace ID' },
      },
      required: ['title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'delete_form',
    description: 'Delete an interactive form.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the form to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 7. Direct Chats & Messaging ──
  {
    name: 'list_chats',
    description: 'List direct conversations, peer messaging channels, and chat threads.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of conversations to return (default: 25)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              participants: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.85 },
  },
  {
    name: 'get_chat',
    description: 'Retrieve conversation details and participant list.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Conversation ID' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        participants: { type: 'array', items: { type: 'string' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'list_chat_messages',
    description: 'List recent messages in a conversation.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: 'Conversation ID' },
        limit: { type: 'number', description: 'Max messages to retrieve (default: 50)' },
      },
      required: ['conversationId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              senderId: { type: 'string' },
              content: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.85 },
  },
  {
    name: 'send_chat_message',
    description: 'Send a message in an existing conversation or start a new direct chat with a user or agent.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Message text content' },
        conversationId: { type: 'string', description: 'Existing conversation ID' },
        participantId: { type: 'string', description: 'Recipient user ID or agent ID if starting a new direct chat' },
      },
      required: ['content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        conversationId: { type: 'string' },
        content: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.9 },
  },

  // ── 8. Workflows & Flows ──
  {
    name: 'list_flows',
    description: 'List discoverable community flows and user workflow automations.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max flows to return (default: 25)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_flow',
    description: 'Retrieve full workflow definition, steps, and trigger conditions by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the flow' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        steps: { type: 'array', items: { type: 'object' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_flow',
    description: 'Create a new automated workflow or recipe.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the flow' },
        description: { type: 'string', description: 'Flow description' },
        steps: { type: 'array', items: { type: 'object' }, description: 'Sequential executable steps' },
        category: { type: 'string', description: 'Category (productivity, agent, data, etc.)' },
      },
      required: ['title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },
  {
    name: 'delete_flow',
    description: 'Delete an automated workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the flow to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 9. Tags & Classification ──
  {
    name: 'list_tags',
    description: 'List user and workspace classification tags with colors.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max tags to return (default: 50)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              color: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'create_tag',
    description: 'Create a new categorization tag.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the tag' },
        color: { type: 'string', description: 'Hex color string (e.g. #6366F1)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },
  {
    name: 'delete_tag',
    description: 'Delete a tag.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the tag to delete' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },

  // ── 10. Moments / Feed ──
  {
    name: 'list_moments',
    description: 'List public or personal moments (updates, notes, activity feed).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max moments to return (default: 25)' },
        mine: { type: 'boolean', description: 'Filter only moments authored by the authenticated actor' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              caption: { type: 'string' },
              type: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.7 },
  },
  {
    name: 'get_moment',
    description: 'Retrieve a specific moment update by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Moment ID' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        caption: { type: 'string' },
        type: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.65 },
  },
  {
    name: 'create_moment',
    description: 'Publish a new status moment or social update to the feed.',
    inputSchema: {
      type: 'object',
      properties: {
        caption: { type: 'string', description: 'Text caption / body of the moment' },
        type: { type: 'string', enum: ['text', 'image', 'audio', 'note'], description: 'Type of moment' },
        isPublic: { type: 'boolean', description: 'Whether the moment is publicly visible' },
      },
      required: ['caption'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        caption: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.7 },
  },
  {
    name: 'list_moment_comments',
    description: 'List comments on a moment.',
    inputSchema: {
      type: 'object',
      properties: {
        momentId: { type: 'string', description: 'Target moment ID' },
        limit: { type: 'number', description: 'Max comments to return (default: 50)' },
      },
      required: ['momentId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              userId: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.65 },
  },
  {
    name: 'create_moment_comment',
    description: 'Add a comment to a moment.',
    inputSchema: {
      type: 'object',
      properties: {
        momentId: { type: 'string', description: 'Target moment ID' },
        content: { type: 'string', description: 'Comment text content' },
      },
      required: ['momentId', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },

  // ── 11. Discussion Threads ──
  {
    name: 'list_thread_messages',
    description: 'List messages in an object discussion thread.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Thread ID' },
        limit: { type: 'number', description: 'Max messages to return (default: 50)' },
      },
      required: ['threadId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              userId: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.75 },
  },
  {
    name: 'create_thread_message',
    description: 'Post a comment or message into an object or workspace discussion thread.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Thread ID' },
        content: { type: 'string', description: 'Message content' },
      },
      required: ['threadId', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.75 },
  },

  // ── 12. Agent Sessions ──
  {
    name: 'list_agent_sessions',
    description: 'List autonomous agent execution sessions and tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
        harness: { type: 'string', description: 'Optional harness type filter' },
        limit: { type: 'number', description: 'Max sessions to return (default: 25)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              harness: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'get_agent_session',
    description: 'Retrieve details, status, and execution logs of an agent session.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent session ID' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        events: { type: 'array', items: { type: 'object' } },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.8 },
  },
  {
    name: 'create_agent_session',
    description: 'Start a new autonomous agent execution session.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Session goal or title' },
        prompt: { type: 'string', description: 'Initial instructions for the agent' },
        harness: { type: 'string', description: 'Target harness runner' },
        workspaceId: { type: 'string', description: 'Optional workspace ID' },
      },
      required: ['title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.85 },
  },

  // ── 13. Trash & Recovery ──
  {
    name: 'list_trash',
    description: 'List deleted items in trash for recovery or purge.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['note', 'goal', 'form', 'event'], description: 'Filter by entity kind' },
        limit: { type: 'number', description: 'Max items to return (default: 50)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              kind: { type: 'string' },
              title: { type: 'string' },
              deletedAt: { type: 'string' },
            },
          },
        },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: true, idempotent: true, priority: 0.6 },
  },
  {
    name: 'restore_trash',
    description: 'Restore a deleted item from trash back into active workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the item to restore' },
        kind: { type: 'string', description: 'Kind of item (note, goal, form, event)' },
      },
      required: ['id', 'kind'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: false, priority: 0.65 },
  },
  {
    name: 'purge_trash',
    description: 'Permanently purge a deleted item from trash.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the item to purge' },
        kind: { type: 'string', description: 'Kind of item (note, goal, form, event)' },
      },
      required: ['id', 'kind'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
    annotations: { audience: ['user', 'assistant'], readOnly: false, destructive: true, priority: 0.5 },
  },
];

export async function executeMcpTool(actor: ApiActor, name: string, args: Record<string, any> = {}): Promise<any> {
  switch (name) {
    // Profile & Token Scopes
    case 'get_my_profile':
      return ApiResources.me(actor);
    case 'get_token_info':
      return ApiResources.tokenMe(actor);
    case 'list_available_scopes':
      return ApiResources.tokenScopeCatalog(actor);
    case 'refresh_token_scopes':
      return ApiResources.tokenUpdateScopes(actor, {
        scopes: args.scopes,
        mode: args.mode || 'grant',
      }, args.mode === 'replace' ? 'replace' : 'grant');

    // Workspaces
    case 'list_workspaces':
      return ApiResources.listWorkspaces(actor, args.limit || 25);
    case 'get_workspace':
      return ApiResources.getWorkspace(actor, String(args.id));
    case 'create_workspace':
      return ApiResources.createWorkspace(actor, args);
    case 'update_workspace':
      return ApiResources.updateWorkspace(actor, String(args.id), args);
    case 'delete_workspace':
      return ApiResources.deleteWorkspace(actor, String(args.id));
    case 'list_workspace_collaborators':
      return ApiResources.listWorkspaceCollaborators(actor, String(args.workspaceId));
    case 'add_workspace_collaborator':
      return ApiResources.addWorkspaceCollaborator(actor, String(args.workspaceId), args);

    // Notes
    case 'list_notes':
      return ApiResources.listNotes(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'get_note':
      return ApiResources.getNote(actor, String(args.id));
    case 'create_note':
      return ApiResources.createNote(actor, args);
    case 'update_note':
      return ApiResources.updateNote(actor, String(args.id), args);
    case 'delete_note':
      return ApiResources.deleteNote(actor, String(args.id));

    // Goals
    case 'list_goals': {
      const items = await ApiResources.listGoals(actor, args.limit || 25, {
        workspaceId: args.workspaceId || null,
        status: args.status || null,
      });
      return { items };
    }
    case 'get_goal':
      return ApiResources.getGoal(actor, String(args.id));
    case 'create_goal':
      return ApiResources.createGoal(actor, args);
    case 'update_goal':
      return ApiResources.updateGoal(actor, String(args.id), args);
    case 'delete_goal':
      return ApiResources.deleteGoal(actor, String(args.id));

    // Events
    case 'list_events':
      return ApiResources.listEvents(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'get_event':
      return ApiResources.getEvent(actor, String(args.id));
    case 'create_event':
      return ApiResources.createEvent(actor, args);
    case 'update_event':
      return ApiResources.updateEvent(actor, String(args.id), args);
    case 'delete_event':
      return ApiResources.deleteEvent(actor, String(args.id));

    // Forms
    case 'list_forms':
      return ApiResources.listForms(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'get_form':
      return ApiResources.getForm(actor, String(args.id));
    case 'create_form':
      return ApiResources.createForm(actor, args);
    case 'delete_form':
      return ApiResources.deleteForm(actor, String(args.id));

    // Chats
    case 'list_chats':
      return ApiResources.listChats(actor, args.limit || 25);
    case 'get_chat':
      return ApiResources.getChat(actor, String(args.id));
    case 'list_chat_messages':
      return ApiResources.listChatMessages(actor, String(args.conversationId), args.limit || 50);
    case 'send_chat_message': {
      let convId = args.conversationId;
      if (!convId && args.participantId) {
        const conv = await ApiResources.createChat(actor, { participantId: args.participantId });
        convId = conv.id;
      }
      if (!convId) {
        throw new Error('Either conversationId or participantId is required to send a chat message');
      }
      return ApiResources.sendChatMessage(actor, convId, { content: args.content });
    }

    // Flows
    case 'list_flows':
      return ApiResources.listFlows(actor, args.limit || 25);
    case 'get_flow':
      return ApiResources.getFlow(actor, String(args.id));
    case 'create_flow':
      return ApiResources.createFlow(actor, args);
    case 'delete_flow':
      return ApiResources.deleteFlow(actor, String(args.id));

    // Tags
    case 'list_tags':
      return ApiResources.listTags(actor, args.limit || 50);
    case 'create_tag':
      return ApiResources.createTag(actor, args);
    case 'delete_tag':
      return ApiResources.deleteTag(actor, String(args.id));

    // Moments
    case 'list_moments':
      return ApiResources.listMoments(actor, args.limit || 25, { mine: args.mine });
    case 'get_moment':
      return ApiResources.getMoment(actor, String(args.id));
    case 'create_moment':
      return ApiResources.createMoment(actor, args);
    case 'list_moment_comments':
      return ApiResources.listMomentComments(actor, String(args.momentId), args.limit || 50);
    case 'create_moment_comment':
      return ApiResources.createMomentComment(actor, String(args.momentId), { text: args.content || args.text });

    // Threads
    case 'list_thread_messages':
      return ApiResources.listThreadMessages(actor, String(args.threadId), args.limit || 50);
    case 'create_thread_message':
      return ApiResources.createThreadMessage(actor, String(args.threadId), { content: args.content });

    // Agent Sessions
    case 'list_agent_sessions':
      return ApiResources.listAgentSessions(actor, args.limit || 25, { workspaceId: args.workspaceId, harness: args.harness });
    case 'get_agent_session':
      return ApiResources.getAgentSession(actor, String(args.id));
    case 'create_agent_session':
      return ApiResources.createHarnessSession(actor, args);

    // Trash
    case 'list_trash':
      return ApiResources.listTrash(actor, args.limit || 50, { kind: args.kind });
    case 'restore_trash':
      return ApiResources.restoreTrash(actor, { id: args.id, kind: args.kind });
    case 'purge_trash':
      return ApiResources.purgeTrash(actor, { id: args.id, kind: args.kind });

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

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
