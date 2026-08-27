import { NextRequest } from 'next/server';
import { resolveApiActor, type ApiActor } from '@/lib/api/guard';
import { ApiResources } from '@/lib/api/resources';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'list_workspaces',
    description: 'List all workspaces (projects) accessible to the authenticated user or agent.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of workspaces to return (default: 25)' },
      },
    },
  },
  {
    name: 'create_workspace',
    description: 'Create a new workspace in Kylrix.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the workspace' },
        summary: { type: 'string', description: 'Optional summary or description of the workspace' },
        visibility: { type: 'string', enum: ['private', 'public', 'team'], description: 'Workspace visibility' },
        isAgentic: { type: 'boolean', description: 'Whether this is an autonomous agent workspace' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_notes',
    description: 'List ideas and notes. Can be scoped to a specific workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID to filter notes' },
        limit: { type: 'number', description: 'Max number of notes to return (default: 25)' },
      },
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note or idea, optionally linked to a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Markdown content of the note' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to link this note to' },
        isPublic: { type: 'boolean', description: 'Whether the note is publicly accessible' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_note',
    description: 'Retrieve a note by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to retrieve' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_note',
    description: 'Update an existing note.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to update' },
        title: { type: 'string', description: 'New title of the note' },
        content: { type: 'string', description: 'New markdown content' },
        isPublic: { type: 'boolean', description: 'Whether the note is public' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_goals',
    description: 'List goals and task items. Can be scoped to a specific workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID to filter goals' },
        limit: { type: 'number', description: 'Max number of goals to return (default: 25)' },
      },
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new goal or task, optionally bound to a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the goal' },
        description: { type: 'string', description: 'Detailed description of the goal' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked'], description: 'Initial status' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to link this goal to' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_goal',
    description: 'Update status, title, or description of a goal.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the goal to update' },
        title: { type: 'string', description: 'Updated title' },
        description: { type: 'string', description: 'Updated description' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked'], description: 'Updated status' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_chats',
    description: 'List direct conversations and chat threads.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of chats to return (default: 25)' },
      },
    },
  },
  {
    name: 'send_chat_message',
    description: 'Send a message in a conversation or initiate a direct chat with a user/agent.',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: 'Existing conversation ID (if known)' },
        participantId: { type: 'string', description: 'Recipient user ID or agent ID (if starting a direct chat)' },
        content: { type: 'string', description: 'Message content to send' },
      },
      required: ['content'],
    },
  },
  {
    name: 'list_events',
    description: 'List calendar events.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
        limit: { type: 'number', description: 'Max number of events to return (default: 25)' },
      },
    },
  },
  {
    name: 'create_event',
    description: 'Create a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the event' },
        startTime: { type: 'string', description: 'ISO 8601 start timestamp' },
        endTime: { type: 'string', description: 'ISO 8601 end timestamp' },
        location: { type: 'string', description: 'Optional location' },
        workspaceId: { type: 'string', description: 'Optional workspace ID' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_forms',
    description: 'List created forms.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
        limit: { type: 'number', description: 'Max number of forms to return (default: 25)' },
      },
    },
  },
];

export async function executeMcpTool(actor: ApiActor, name: string, args: Record<string, any> = {}): Promise<any> {
  switch (name) {
    case 'list_workspaces':
      return ApiResources.listWorkspaces(actor, args.limit || 25);
    case 'create_workspace':
      return ApiResources.createWorkspace(actor, args);
    case 'list_notes':
      return ApiResources.listNotes(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'create_note':
      return ApiResources.createNote(actor, args);
    case 'get_note':
      return ApiResources.getNote(actor, String(args.id));
    case 'update_note':
      return ApiResources.updateNote(actor, String(args.id), args);
    case 'list_goals':
      return ApiResources.listGoals(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'create_goal':
      return ApiResources.createGoal(actor, args);
    case 'update_goal':
      return ApiResources.updateGoal(actor, String(args.id), args);
    case 'list_chats':
      return ApiResources.listChats(actor, args.limit || 25);
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
    case 'list_events':
      return ApiResources.listEvents(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    case 'create_event':
      return ApiResources.createEvent(actor, args);
    case 'list_forms':
      return ApiResources.listForms(actor, args.limit || 25, { workspaceId: args.workspaceId || null });
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export async function handleMcpRpc(req: NextRequest, rpcPayload: any): Promise<any> {
  const { id, method, params } = rpcPayload || {};

  // Handshake methods that can execute without strict authentication
  if (method === 'initialize') {
    return {
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
          name: 'kylrix-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return null; // Notifications produce no response
  }

  if (method === 'ping') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {},
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === 'resources/list') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        resources: [],
      },
    };
  }

  if (method === 'prompts/list') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        prompts: [],
      },
    };
  }

  // Tool execution requires authenticated actor
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    try {
      const actor = await resolveApiActor(req);
      const toolResult = await executeMcpTool(actor, toolName, toolArgs);

      return {
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
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: `Error executing ${toolName}: ${err?.message || String(err)}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method not found: ${method}`,
    },
  };
}
