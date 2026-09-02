/**
 * Official WebMCP Tool Suite for Kylrix
 * Exposes core productivity, collaboration, and workspace capabilities to in-browser AI agents.
 */

import type { WebMcpToolDefinition } from './types';
import {
  createNote,
  updateNote,
  deleteNote,
  createProject,
  createEvent,
  postThreadMessage,
  getOrCreateThread,
  createRow,
} from '@/lib/actions/client-ops';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'appwrite';

/** Helper to format standard JSON content results for WebMCP agents */
function formatResult(data: any, summary?: string) {
  return {
    content: [
      {
        type: 'json' as const,
        data,
      },
      ...(summary
        ? [
            {
              type: 'text' as const,
              text: summary,
            },
          ]
        : []),
    ],
    meta: { count: Array.isArray(data) ? data.length : 1 },
  };
}

export const KYLRIX_WEBMCP_TOOLS: WebMcpToolDefinition[] = [
  // ── 1. App & System Context ──────────────────────────────────
  {
    name: 'kylrix_get_app_context',
    description: 'Get current user session context, active workspace, route location, and available capabilities in Kylrix.',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const activeWorkspaceId =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('kylrix_active_workspace') || 'personal'
          : 'personal';
      const path = typeof window !== 'undefined' ? window.location.pathname : '/';
      return formatResult(
        {
          activeWorkspaceId,
          currentRoute: path,
          clientVersion: '1.0.0',
          features: ['notes', 'goals', 'workspaces', 'flows', 'events', 'forms', 'threads', 'vault'],
          protocol: 'WebMCP/1.0',
        },
        `Current route: ${path} (Workspace: ${activeWorkspaceId})`
      );
    },
  },

  // ── 2. Notes ────────────────────────────────────────────────
  {
    name: 'kylrix_list_notes',
    description: 'List notes in the user workspace with optional search query and limit.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search text to filter note titles and content' },
        limit: { type: 'number', description: 'Maximum number of notes to return (default: 25)' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to restrict notes' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const queries = [
        Query.equal('isTrash', false),
        Query.equal('isDeleted', false),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
      ];

      const res = await LocalEngine.query<any>(
        `webmcp_notes_${limit}`,
        () =>
          tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.NOTE,
            APPWRITE_CONFIG.TABLES.NOTE.NOTES,
            queries,
          ),
        { ttl: 60_000 },
      ).catch(() => ({ rows: [] }));

      let items = res?.rows || [];
      if (args.query) {
        const q = String(args.query).toLowerCase();
        items = items.filter(
          (n: any) =>
            n.title?.toLowerCase().includes(q) ||
            n.content?.toLowerCase().includes(q) ||
            n.body?.toLowerCase().includes(q)
        );
      }

      const simplified = items.map((n: any) => ({
        id: n.$id,
        title: n.title || 'Untitled Note',
        snippet: (n.content || n.body || '').slice(0, 200),
        isPinned: !!n.isPinned,
        createdAt: n.$createdAt,
        updatedAt: n.$updatedAt,
      }));

      return formatResult(simplified, `Found ${simplified.length} notes.`);
    },
  },

  {
    name: 'kylrix_create_note',
    description: 'Create a new note with a title, markdown content, and optional tags.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Markdown content or body of the note' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of tag labels',
        },
        workspaceId: { type: 'string', description: 'Optional workspace ID' },
      },
      required: ['title'],
    },
    execute: async (args) => {
      const title = String(args.title || 'Untitled Note').trim();
      const content = String(args.content || '').trim();
      const tags = Array.isArray(args.tags) ? args.tags : [];

      const created = await createNote({
        title,
        content,
        tags,
      });

      if (!created || !created.$id) {
        throw new Error('Failed to create note.');
      }

      return formatResult(
        { id: created.$id, title, tags, createdAt: new Date().toISOString() },
        `Note "${title}" created successfully (ID: ${created.$id}).`
      );
    },
  },

  {
    name: 'kylrix_get_note',
    description: 'Retrieve full details and content of a note by its ID.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to retrieve' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const noteId = String(args.id);
      const res = await tablesDB.getRow(
        APPWRITE_CONFIG.DATABASES.NOTE,
        APPWRITE_CONFIG.TABLES.NOTE.NOTES,
        noteId,
      ).catch(() => null);

      if (!res) {
        throw new Error(`Note '${noteId}' not found.`);
      }

      return formatResult(
        {
          id: res.$id,
          title: res.title || 'Untitled Note',
          content: res.content || res.body || '',
          tags: res.tags || [],
          isPinned: !!res.isPinned,
          createdAt: res.$createdAt,
          updatedAt: res.$updatedAt,
        },
        `Retrieved note: ${res.title}`
      );
    },
  },

  {
    name: 'kylrix_update_note',
    description: 'Update the title, content, or tags of an existing note.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to update' },
        title: { type: 'string', description: 'Updated title' },
        content: { type: 'string', description: 'Updated body content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const noteId = String(args.id);
      const payload: any = {};
      if (args.title !== undefined) payload.title = String(args.title);
      if (args.content !== undefined) payload.content = String(args.content);
      if (args.tags !== undefined) payload.tags = args.tags;

      await updateNote(noteId, payload);
      return formatResult({ id: noteId, ...payload }, `Note '${noteId}' updated successfully.`);
    },
  },

  {
    name: 'kylrix_delete_note',
    description: 'Delete or move a note to trash.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to delete' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const noteId = String(args.id);
      await deleteNote(noteId);
      return formatResult({ id: noteId, deleted: true }, `Note '${noteId}' deleted.`);
    },
  },

  // ── 3. Goals ────────────────────────────────────────────────
  {
    name: 'kylrix_list_goals',
    description: 'List user goals and status milestones.',
    category: 'goals',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'completed', 'paused', 'all'],
          description: 'Filter goals by status',
        },
        limit: { type: 'number', description: 'Max number of goals to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const queries = [Query.orderDesc('$createdAt'), Query.limit(limit)];

      const res = await LocalEngine.query<any>(
        `webmcp_goals_${limit}`,
        () =>
          tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'goals',
            queries,
          ),
        { ttl: 60_000 },
      ).catch(() => ({ rows: [] }));

      const items = (res?.rows || []).map((g: any) => ({
        id: g.$id,
        title: g.title || g.name || 'Untitled Goal',
        description: g.description || '',
        status: g.status || 'active',
        progress: g.progress || 0,
        targetDate: g.targetDate || null,
      }));

      return formatResult(items, `Found ${items.length} goals.`);
    },
  },

  {
    name: 'kylrix_create_goal',
    description: 'Create a new tracked goal with title, target date, and milestones.',
    category: 'goals',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the goal' },
        description: { type: 'string', description: 'Detailed goal description' },
        targetDate: { type: 'string', description: 'Target ISO date string (YYYY-MM-DD)' },
        category: { type: 'string', description: 'Goal category (e.g. engineering, health, growth)' },
      },
      required: ['title'],
    },
    execute: async (args) => {
      const title = String(args.title).trim();
      const description = String(args.description || '').trim();

      const created = await createRow(
        APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
        'goals',
        {
          title,
          description,
          status: 'active',
          progress: 0,
          targetDate: args.targetDate || null,
          category: args.category || 'general',
        }
      );

      return formatResult(
        { id: created?.$id, title, status: 'active' },
        `Goal "${title}" created successfully.`
      );
    },
  },

  // ── 4. Workspaces & Projects ────────────────────────────────
  {
    name: 'kylrix_list_workspaces',
    description: 'List user workspaces and projects.',
    category: 'workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max workspaces to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const res = await LocalEngine.query<any>(
        `webmcp_workspaces_${limit}`,
        () =>
          tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'projects',
            [Query.orderDesc('$createdAt'), Query.limit(limit)],
          ),
        { ttl: 60_000 },
      ).catch(() => ({ rows: [] }));

      const workspaces = (res?.rows || []).map((w: any) => ({
        id: w.$id,
        name: w.name || w.title || 'Untitled Workspace',
        kind: w.kind || 'workspace',
        isAgentic: !!w.isAgentic,
        createdAt: w.$createdAt,
      }));

      return formatResult(workspaces, `Found ${workspaces.length} workspaces.`);
    },
  },

  {
    name: 'kylrix_create_workspace',
    description: 'Create a new project workspace in Kylrix.',
    category: 'workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the workspace' },
        description: { type: 'string', description: 'Workspace objective or description' },
        isAgentic: { type: 'boolean', description: 'Enable autonomous agent runtime workspace' },
      },
      required: ['name'],
    },
    execute: async (args) => {
      const name = String(args.name).trim();
      const created = await createProject({
        name,
        description: String(args.description || ''),
        isAgentic: Boolean(args.isAgentic),
      });

      return formatResult(
        { id: created?.$id, name, isAgentic: Boolean(args.isAgentic) },
        `Workspace "${name}" created.`
      );
    },
  },

  {
    name: 'kylrix_switch_workspace',
    description: 'Switch the active workspace in the user browser session.',
    category: 'workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID to switch to' },
      },
      required: ['workspaceId'],
    },
    execute: async (args) => {
      const id = String(args.workspaceId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('kylrix_active_workspace', id);
        window.dispatchEvent(new CustomEvent('kylrix:workspace-switched', { detail: { workspaceId: id } }));
      }
      return formatResult({ activeWorkspaceId: id }, `Switched active workspace to: ${id}`);
    },
  },

  // ── 5. Events & Calendar ────────────────────────────────────
  {
    name: 'kylrix_list_events',
    description: 'List scheduled calendar events, milestones, and deadlines.',
    category: 'events',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max events to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const res = await LocalEngine.query<any>(
        `webmcp_events_${limit}`,
        () =>
          tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'events',
            [Query.orderAsc('startAt'), Query.limit(limit)],
          ),
        { ttl: 60_000 },
      ).catch(() => ({ rows: [] }));

      const events = (res?.rows || []).map((e: any) => ({
        id: e.$id,
        title: e.title || 'Untitled Event',
        startAt: e.startAt,
        endAt: e.endAt,
        location: e.location,
        isAllDay: !!e.isAllDay,
      }));

      return formatResult(events, `Found ${events.length} events.`);
    },
  },

  {
    name: 'kylrix_create_event',
    description: 'Create a calendar event with start/end time and description.',
    category: 'events',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        startAt: { type: 'string', description: 'Start time ISO string (e.g. 2026-09-02T10:00:00Z)' },
        endAt: { type: 'string', description: 'End time ISO string' },
        description: { type: 'string', description: 'Event notes' },
      },
      required: ['title', 'startAt'],
    },
    execute: async (args) => {
      const title = String(args.title).trim();
      const startAt = String(args.startAt);
      const endAt = args.endAt ? String(args.endAt) : startAt;

      const created = await createEvent({
        title,
        startAt,
        endAt,
        description: args.description || '',
      });

      return formatResult({ id: created?.$id, title, startAt }, `Event "${title}" scheduled.`);
    },
  },

  // ── 6. Flows & Visual Automations ───────────────────────────
  {
    name: 'kylrix_list_flows',
    description: 'List user workflows and automation recipes.',
    category: 'flows',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max flows to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const res = await LocalEngine.query<any>(
        `webmcp_flows_${limit}`,
        () =>
          tablesDB.listRows(
            APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            'workflows',
            [Query.orderDesc('$createdAt'), Query.limit(limit)],
          ),
        { ttl: 60_000 },
      ).catch(() => ({ rows: [] }));

      const flows = (res?.rows || []).map((f: any) => ({
        id: f.$id,
        name: f.name || f.title || 'Untitled Flow',
        description: f.description || '',
        trigger: f.trigger || 'manual',
        status: f.status || 'draft',
      }));

      return formatResult(flows, `Found ${flows.length} flows.`);
    },
  },

  // ── 7. Threads & Unified Discussions ────────────────────────
  {
    name: 'kylrix_post_thread_message',
    description: 'Post a discussion message or agent commentary to any resource thread in Kylrix.',
    category: 'chat',
    inputSchema: {
      type: 'object',
      properties: {
        scopeKey: {
          type: 'string',
          description: 'Unique thread scope (e.g., "note:<id>", "workspace:<id>", "general")',
        },
        message: { type: 'string', description: 'Message markdown content to post' },
      },
      required: ['scopeKey', 'message'],
    },
    execute: async (args) => {
      const scopeKey = String(args.scopeKey);
      const text = String(args.message).trim();

      const parts = scopeKey.includes(':') ? scopeKey.split(':') : ['resource', scopeKey];
      const res = await getOrCreateThread({
        parentKind: parts[0] || 'resource',
        parentId: parts[1] || parts[0],
      });
      const thread = res?.thread;
      const threadId = thread?.id || (thread as any)?.$id;

      if (!threadId) {
        throw new Error(`Failed to access thread for scope '${scopeKey}'`);
      }

      const post = await postThreadMessage({
        threadId,
        content: text,
      });

      return formatResult(
        { threadId, messageId: (post as any)?.$id || (post as any)?.id, text },
        `Message posted to thread "${scopeKey}".`
      );
    },
  },

  // ── 8. Navigation & UI Controls ─────────────────────────────
  {
    name: 'kylrix_navigate_ui',
    description: 'Navigate to a designated page or open an action drawer in the Kylrix mono-app UI.',
    category: 'navigation',
    inputSchema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          enum: [
            '/app',
            '/goals',
            '/workspaces',
            '/flows',
            '/events',
            '/forms',
            '/connect',
            '/vault',
            '/settings',
            '/settings/agents',
          ],
          description: 'Target route destination',
        },
      },
      required: ['destination'],
    },
    execute: async (args) => {
      const dest = String(args.destination);
      if (typeof window !== 'undefined') {
        window.location.assign(dest);
      }
      return formatResult({ destination: dest }, `Navigated to ${dest}`);
    },
  },
];
