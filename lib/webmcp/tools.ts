/**
 * Official WebMCP Tool Suite for Kylrix
 * Exposes full 1:1 productivity, collaboration, and workspace capabilities to in-browser AI agents.
 * Resilient to zero-backend / offline mode by querying LocalEngine, RxDB, and localStorage substrates.
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
import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { tablesDB } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { BUILTIN_FLOWS } from '@/lib/flows/builtins';
import { listInstalledFlowIds } from '@/lib/flows/installed';
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

/** Helper to get current user ID or fallback offline user ID */
function getEffectiveUserId(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    const authRaw = window.localStorage.getItem('kylrix_auth_user');
    if (authRaw) {
      const parsed = JSON.parse(authRaw);
      if (parsed?.$id || parsed?.id) return parsed.$id || parsed.id;
    }
  } catch {}
  return 'offline_user';
}

/** Helper to read JSON from localStorage safely */
function readLocalStorageJson<T = any>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
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
      const uid = getEffectiveUserId();
      const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

      return formatResult(
        {
          userId: uid,
          activeWorkspaceId,
          currentRoute: path,
          clientVersion: '1.0.0',
          isOffline,
          features: [
            'notes',
            'goals',
            'workspaces',
            'flows',
            'events',
            'forms',
            'threads',
            'chats',
            'moments',
            'vault',
          ],
          protocol: 'WebMCP/1.0',
        },
        `Current route: ${path} (Workspace: ${activeWorkspaceId}, User: ${uid})`
      );
    },
  },

  {
    name: 'kylrix_get_my_profile',
    description: 'Get profile details, bio, avatar, and Nostr identity for the active session.',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const uid = getEffectiveUserId();
      const cachedIdentity = await LocalEngine.cacheGet<any>(`identity:${uid}`).catch(() => null);
      const nostrIdentity = await LocalEngine.cacheGet<any>('nostr:active_identity').catch(() => null);

      const profile = {
        userId: uid,
        name: cachedIdentity?.displayName || cachedIdentity?.name || 'Local User',
        username: cachedIdentity?.username || (nostrIdentity?.npub ? nostrIdentity.npub.slice(0, 12) : 'local'),
        avatar: cachedIdentity?.avatar || nostrIdentity?.picture || null,
        bio: cachedIdentity?.bio || '',
        npub: nostrIdentity?.npub || cachedIdentity?.publicKey || null,
      };

      return formatResult(profile, `Profile: ${profile.name} (@${profile.username})`);
    },
  },

  // ── 2. Notes & Ideas ─────────────────────────────────────────
  {
    name: 'kylrix_list_notes',
    description: 'List notes in the user workspace with optional search query, tags filter, and limit. Reads from LocalEngine & RxDB when offline.',
    category: 'notes',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search text to filter note titles and content' },
        tag: { type: 'string', description: 'Optional tag filter' },
        limit: { type: 'number', description: 'Maximum number of notes to return (default: 50)' },
        workspaceId: { type: 'string', description: 'Optional workspace ID to restrict notes' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 50;
      const uid = getEffectiveUserId();

      // 1. Try LocalEngine / tablesDB query first
      let rawNotes: any[] = [];
      try {
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
          { ttl: 30_000 },
        );
        rawNotes = res?.rows || [];
      } catch {}

      // 2. Fallback to RxDB Notes Collection
      if (!rawNotes.length && typeof window !== 'undefined') {
        try {
          const db = await getRxDB().catch(() => null);
          if (db?.notes) {
            const rxDocs = await db.notes.find({ selector: { _deleted: { $ne: true } } }).exec();
            if (rxDocs?.length) {
              rawNotes = rxDocs.map((d: any) => ({
                $id: d.id,
                title: d.title,
                content: d.content,
                $createdAt: d.updatedAt,
                $updatedAt: d.updatedAt,
              }));
            }
          }
        } catch {}
      }

      // 3. Fallback to LocalEngine Cache & LocalStorage
      if (!rawNotes.length) {
        const cached =
          (await LocalEngine.cacheGet<any[]>('notes')) ||
          (await LocalEngine.cacheGet<any[]>('f_offline_notes')) ||
          readLocalStorageJson<any[]>(`f_notes_list_${uid}`, []) ||
          readLocalStorageJson<any[]>('notes_list_cache', []);
        if (Array.isArray(cached) && cached.length) {
          rawNotes = cached;
        }
      }

      // Filter and clean
      let items = rawNotes;
      if (args.query) {
        const q = String(args.query).toLowerCase();
        items = items.filter(
          (n: any) =>
            n.title?.toLowerCase().includes(q) ||
            n.content?.toLowerCase().includes(q) ||
            n.body?.toLowerCase().includes(q)
        );
      }

      if (args.tag) {
        const t = String(args.tag).toLowerCase();
        items = items.filter((n: any) => {
          const tags = Array.isArray(n.tags) ? n.tags : [];
          return tags.some((x: string) => String(x).toLowerCase().includes(t));
        });
      }

      const simplified = items.slice(0, limit).map((n: any) => ({
        id: n.$id || n.id,
        title: n.title || 'Untitled Note',
        snippet: (n.content || n.body || '').slice(0, 200),
        tags: n.tags || [],
        isPinned: !!n.isPinned,
        createdAt: n.$createdAt || n.createdAt,
        updatedAt: n.$updatedAt || n.updatedAt,
      }));

      return formatResult(simplified, `Found ${simplified.length} notes.`);
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
      let res: any = null;

      try {
        res = await tablesDB.getRow(
          APPWRITE_CONFIG.DATABASES.NOTE,
          APPWRITE_CONFIG.TABLES.NOTE.NOTES,
          noteId,
        );
      } catch {}

      if (!res) {
        try {
          const db = await getRxDB().catch(() => null);
          if (db?.notes) {
            const doc = await db.notes.findOne(noteId).exec();
            if (doc) res = doc.toJSON();
          }
        } catch {}
      }

      if (!res) {
        res =
          (await LocalEngine.cacheGet<any>(`local:note:${noteId}`)) ||
          (await LocalEngine.cacheGet<any>(`note_${noteId}`));
      }

      if (!res) {
        throw new Error(`Note '${noteId}' not found in remote or local store.`);
      }

      return formatResult(
        {
          id: res.$id || res.id,
          title: res.title || 'Untitled Note',
          content: res.content || res.body || '',
          tags: res.tags || [],
          isPinned: !!res.isPinned,
          createdAt: res.$createdAt || res.createdAt,
          updatedAt: res.$updatedAt || res.updatedAt,
        },
        `Retrieved note: ${res.title}`
      );
    },
  },

  {
    name: 'kylrix_create_note',
    description: 'Create a new note with title, content, and optional tags.',
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
      }).catch(async () => {
        const fallbackId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const localDoc = {
          $id: fallbackId,
          id: fallbackId,
          title,
          content,
          tags,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
        };
        await LocalEngine.cacheSet(`local:note:${fallbackId}`, localDoc);
        return localDoc;
      });

      const id = (created as any)?.$id || (created as any)?.id;
      return formatResult(
        { id, title, tags, createdAt: new Date().toISOString() },
        `Note "${title}" created successfully (ID: ${id}).`
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

      await updateNote(noteId, payload).catch(async () => {
        const existing = (await LocalEngine.cacheGet<any>(`local:note:${noteId}`)) || {};
        await LocalEngine.cacheSet(`local:note:${noteId}`, { ...existing, ...payload });
      });

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
      await deleteNote(noteId).catch(async () => {
        await LocalEngine.cacheDelete(`local:note:${noteId}`);
      });
      return formatResult({ id: noteId, deleted: true }, `Note '${noteId}' deleted.`);
    },
  },

  // ── 3. Goals & Tasks ─────────────────────────────────────────
  {
    name: 'kylrix_list_goals',
    description: 'List user goals, milestones, and task progress. Resilient to zero-backend via LocalEngine.',
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
      const limit = Number(args.limit) || 50;
      const uid = getEffectiveUserId();

      let rawGoals: any[] = [];
      try {
        const queries = [Query.orderDesc('$createdAt'), Query.limit(limit)];
        const res = await LocalEngine.query<any>(
          `webmcp_goals_${limit}`,
          () =>
            tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
              'goals',
              queries,
            ),
          { ttl: 30_000 },
        );
        rawGoals = res?.rows || [];
      } catch {}

      // Local fallback
      if (!rawGoals.length) {
        const cached =
          (await LocalEngine.cacheGet<any[]>('goals')) ||
          (await LocalEngine.cacheGet<any[]>('tasks')) ||
          readLocalStorageJson<any[]>(`f_tasks_list_${uid}`, []) ||
          readLocalStorageJson<any[]>('tasks_list_cache', []);
        if (Array.isArray(cached) && cached.length) {
          rawGoals = cached;
        }
      }

      let items = rawGoals;
      if (args.status && args.status !== 'all') {
        items = items.filter((g: any) => (g.status || 'active') === args.status);
      }

      const simplified = items.slice(0, limit).map((g: any) => ({
        id: g.$id || g.id,
        title: g.title || g.name || 'Untitled Goal',
        description: g.description || '',
        status: g.status || 'active',
        progress: g.progress || 0,
        targetDate: g.targetDate || null,
        category: g.category || 'general',
      }));

      return formatResult(simplified, `Found ${simplified.length} goals.`);
    },
  },

  {
    name: 'kylrix_get_goal',
    description: 'Get goal details and progress by ID.',
    category: 'goals',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the goal' },
      },
      required: ['id'],
    },
    execute: async (args) => {
      const id = String(args.id);
      let goal: any = null;
      try {
        goal = await tablesDB.getRow(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, 'goals', id);
      } catch {}
      if (!goal) {
        goal = await LocalEngine.cacheGet<any>(`local:goal:${id}`);
      }
      if (!goal) {
        throw new Error(`Goal '${id}' not found.`);
      }
      return formatResult(goal, `Goal: ${goal.title || goal.name}`);
    },
  },

  {
    name: 'kylrix_create_goal',
    description: 'Create a new tracked goal with title, target date, and category.',
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
      ).catch(async () => {
        const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const localDoc = {
          $id: id,
          id,
          title,
          description,
          status: 'active',
          progress: 0,
          targetDate: args.targetDate || null,
          category: args.category || 'general',
          $createdAt: new Date().toISOString(),
        };
        await LocalEngine.cacheSet(`local:goal:${id}`, localDoc);
        return localDoc;
      });

      const id = (created as any)?.$id || (created as any)?.id;
      return formatResult(
        { id, title, status: 'active' },
        `Goal "${title}" created successfully.`
      );
    },
  },

  // ── 4. Workspaces & Projects ────────────────────────────────
  {
    name: 'kylrix_list_workspaces',
    description: 'List user workspaces and projects. Reads from localStorage & LocalEngine when backend is disabled.',
    category: 'workspaces',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max workspaces to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const uid = getEffectiveUserId();

      let rawWorkspaces: any[] = [];
      try {
        const res = await LocalEngine.query<any>(
          `webmcp_workspaces_${limit}`,
          () =>
            tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
              'projects',
              [Query.orderDesc('$createdAt'), Query.limit(limit)],
            ),
          { ttl: 30_000 },
        );
        rawWorkspaces = res?.rows || [];
      } catch {}

      // LocalEngine / LocalStorage fallback
      if (!rawWorkspaces.length) {
        const cached =
          readLocalStorageJson<any[]>(`kylrix_workspaces_${uid}`, []) ||
          readLocalStorageJson<any[]>(`f_projects_list_${uid}`, []) ||
          readLocalStorageJson<any[]>('kylrix_all_cached_workspaces', []) ||
          (await LocalEngine.cacheGet<any[]>('kylrix_workspaces')) ||
          [];
        if (Array.isArray(cached) && cached.length) {
          rawWorkspaces = cached;
        }
      }

      // Always guarantee personal workspace presence
      const hasPersonal = rawWorkspaces.some((w: any) => (w.$id || w.id) === 'personal' || w.isPersonal);
      if (!hasPersonal) {
        rawWorkspaces.unshift({
          $id: 'personal',
          id: 'personal',
          name: 'Personal Workspace',
          kind: 'personal',
          isPersonal: true,
          isAgentic: false,
          $createdAt: new Date().toISOString(),
        });
      }

      const workspaces = rawWorkspaces.slice(0, limit).map((w: any) => ({
        id: w.$id || w.id,
        name: w.name || w.title || 'Untitled Workspace',
        kind: w.kind || 'workspace',
        isPersonal: Boolean(w.isPersonal || (w.$id || w.id) === 'personal'),
        isAgentic: !!w.isAgentic,
        createdAt: w.$createdAt || w.createdAt,
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
      }).catch(async () => {
        const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const localWs = {
          $id: id,
          id,
          name,
          description: String(args.description || ''),
          isAgentic: Boolean(args.isAgentic),
          isPersonal: false,
          $createdAt: new Date().toISOString(),
        };
        await LocalEngine.cacheSet(`local:workspace:${id}`, localWs);
        return localWs;
      });

      const id = (created as any)?.$id || (created as any)?.id;
      return formatResult(
        { id, name, isAgentic: Boolean(args.isAgentic) },
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
      const uid = getEffectiveUserId();

      let rawEvents: any[] = [];
      try {
        const res = await LocalEngine.query<any>(
          `webmcp_events_${limit}`,
          () =>
            tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
              'events',
              [Query.orderAsc('startAt'), Query.limit(limit)],
            ),
          { ttl: 30_000 },
        );
        rawEvents = res?.rows || [];
      } catch {}

      if (!rawEvents.length) {
        const cached =
          (await LocalEngine.cacheGet<any[]>('events')) ||
          readLocalStorageJson<any[]>(`f_events_list_${uid}`, []) ||
          readLocalStorageJson<any[]>('events_list_cache', []);
        if (Array.isArray(cached) && cached.length) rawEvents = cached;
      }

      const events = rawEvents.slice(0, limit).map((e: any) => ({
        id: e.$id || e.id,
        title: e.title || 'Untitled Event',
        startAt: e.startAt,
        endAt: e.endAt,
        location: e.location,
        isAllDay: !!e.isAllDay,
        description: e.description || '',
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
        startAt: { type: 'string', description: 'Start time ISO string' },
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
      }).catch(async () => {
        const id = `event_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const localDoc = {
          $id: id,
          id,
          title,
          startAt,
          endAt,
          description: args.description || '',
        };
        await LocalEngine.cacheSet(`local:event:${id}`, localDoc);
        return localDoc;
      });

      const id = (created as any)?.$id || (created as any)?.id;
      return formatResult({ id, title, startAt }, `Event "${title}" scheduled.`);
    },
  },

  // ── 6. Forms ────────────────────────────────────────────────
  {
    name: 'kylrix_list_forms',
    description: 'List user forms, surveys, and response collections.',
    category: 'forms',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max forms to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 25;
      const uid = getEffectiveUserId();

      let rawForms: any[] = [];
      try {
        const res = await LocalEngine.query<any>(
          `webmcp_forms_${limit}`,
          () =>
            tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
              'forms',
              [Query.orderDesc('$createdAt'), Query.limit(limit)],
            ),
          { ttl: 30_000 },
        );
        rawForms = res?.rows || [];
      } catch {}

      if (!rawForms.length) {
        const cached =
          (await LocalEngine.cacheGet<any[]>('forms')) ||
          readLocalStorageJson<any[]>(`f_forms_list_${uid}`, []) ||
          readLocalStorageJson<any[]>('forms_list_cache', []);
        if (Array.isArray(cached) && cached.length) rawForms = cached;
      }

      const forms = rawForms.slice(0, limit).map((f: any) => ({
        id: f.$id || f.id,
        title: f.title || 'Untitled Form',
        description: f.description || '',
        isPublic: !!f.isPublic,
        responseCount: f.responseCount || 0,
      }));

      return formatResult(forms, `Found ${forms.length} forms.`);
    },
  },

  // ── 7. Flows & Visual Automations ───────────────────────────
  {
    name: 'kylrix_list_flows',
    description: 'List user workflows, system flows (Sidekick, Custom Agent, Math Mode), and installed automation recipes.',
    category: 'flows',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max flows to return' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 50;
      const installedIds = listInstalledFlowIds();

      // Combine builtins + installed + community
      const builtinItems = BUILTIN_FLOWS.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        source: 'builtin' as const,
        isInstalled: true,
        stepsCount: b.steps?.length || 0,
      }));

      let communityItems: any[] = [];
      try {
        const res = await LocalEngine.query<any>(
          `webmcp_flows_${limit}`,
          () =>
            tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
              'workflows',
              [Query.orderDesc('$createdAt'), Query.limit(limit)],
            ),
          { ttl: 30_000 },
        );
        communityItems = (res?.rows || []).map((f: any) => ({
          id: f.$id || f.id,
          name: f.name || f.title || 'Untitled Flow',
          description: f.description || '',
          source: 'community' as const,
          isInstalled: installedIds.includes(f.$id || f.id),
          stepsCount: Array.isArray(f.steps) ? f.steps.length : 0,
        }));
      } catch {}

      const all = [...builtinItems, ...communityItems].slice(0, limit);
      return formatResult(all, `Found ${all.length} flows.`);
    },
  },

  // ── 8. Threads & Unified Discussions ────────────────────────
  {
    name: 'kylrix_post_thread_message',
    description: 'Post a discussion message or agent commentary to any resource thread in Kylrix.',
    category: 'threads',
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
      }).catch(async () => {
        return { thread: { id: `thread_${parts[1] || parts[0]}` } };
      });

      const thread = (res as any)?.thread;
      const threadId = thread?.id || (thread as any)?.$id;

      if (!threadId) {
        throw new Error(`Failed to access thread for scope '${scopeKey}'`);
      }

      const post = await postThreadMessage({
        threadId,
        content: text,
      }).catch(async () => {
        return { id: `msg_${Date.now()}`, content: text };
      });

      return formatResult(
        { threadId, messageId: (post as any)?.$id || (post as any)?.id, text },
        `Message posted to thread "${scopeKey}".`
      );
    },
  },

  // ── 9. Tags ─────────────────────────────────────────────────
  {
    name: 'kylrix_list_tags',
    description: 'List tags across notes and resources in the workspace.',
    category: 'tags',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      let tags: string[] = [];
      try {
        const db = await getRxDB().catch(() => null);
        if (db?.tags) {
          const rxTags = await db.tags.find().exec();
          tags = rxTags.map((t: any) => t.name);
        }
      } catch {}

      if (!tags.length) {
        const cachedNotes =
          (await LocalEngine.cacheGet<any[]>('notes')) ||
          readLocalStorageJson<any[]>('notes_list_cache', []);
        if (Array.isArray(cachedNotes)) {
          const collected = new Set<string>();
          cachedNotes.forEach((n) => {
            if (Array.isArray(n.tags)) n.tags.forEach((t: string) => collected.add(String(t)));
          });
          tags = Array.from(collected);
        }
      }

      return formatResult(tags, `Found ${tags.length} unique tags.`);
    },
  },

  // ── 10. Navigation & UI Controls ────────────────────────────
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

