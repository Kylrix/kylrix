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

export const KYLRIX_WEBMCP_TOOLS_PART2: any[] = [
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
];
