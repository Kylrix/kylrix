import { ID, Permission, Query, Role } from 'node-appwrite';
import { systemTables, type SystemTablesPort } from '@/lib/data';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { resolveParentRef } from '@/lib/api/v1/query';
import { listScopeCatalog, type PatScope } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
import { WorkflowDbService } from '@/lib/services/workflows';
import {
import {
import {
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';
import { assertActorFeatureAccess } from '@/lib/tools/gate';
import {
  DB,
  NOTES,
  FLOW_DB,
  TASKS,
  WORKFLOWS,
  badRequest,
  notFound,
  forbidden,
  assertOwnedNote,
  assertOwnedGoal,
  CHAT_DB,
  PROJECT_OBJECTS,
  linkObjectToWorkspace,
  unlinkObjectFromWorkspace,
  TAGS_TABLE,
  ensureTagsExist,
  getWorkspaceObjectIds,
  getAllLinkedWorkspaceObjectIds,
  resolveWorkspaceMekBytes,
} from './helpers';

export const apiResourcesPart2 = {
  async listWorkspaceCollaborators(actor: ApiActor, workspaceId: string) {
    requireScope(actor, 'workspaces:read');
    await this.getWorkspace(actor, workspaceId);
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
      queries: [
        Query.equal('resourceId', workspaceId),
        Query.equal('resourceType', 'project'),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    return res.rows.map((r: any) => shapeWorkspaceCollaborator(r));
  },

  async listEvents(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'events:read');
    const tables = systemTables();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const eventIds = await getWorkspaceObjectIds(tables, wsId, 'event');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const eid of eventIds) {
        if (seen.has(eid)) continue;
        seen.add(eid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'events', rowId: eid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push(shapeEventListItem(row));
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'event');
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'events',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => shapeEventListItem(r));
  },

  async listForms(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'forms:read');
    const tables = systemTables();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const formIds = await getWorkspaceObjectIds(tables, wsId, 'form');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const fid of formIds) {
        if (seen.has(fid)) continue;
        seen.add(fid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: fid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push(shapeFormListItem(row));
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'form');
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'forms',
      queries: [
        Query.equal('userId', actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => shapeFormListItem(r));
  },

  async listAgentSessions(actor: ApiActor, limit = 25, opts?: { harness?: string | null; workspaceId?: string | null }) {
    requireScope(actor, 'agents:read');
    const tables = systemTables();

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const sessionIds = await getWorkspaceObjectIds(tables, wsId, 'agent_session');
      const seen = new Set<string>();
      const rows: any[] = [];

      for (const sid of sessionIds) {
        if (seen.has(sid)) continue;
        seen.add(sid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: sid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push(shapeAgentSessionListItem(row));
        }
      }
      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'agent_session');
    const queries: string[] = [
      Query.equal('userId', actor.userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(Math.min(100, Math.max(1, limit))),
    ];
    if (opts?.harness) {
      requireScope(actor, 'agents:harness');
      queries.unshift(Query.equal('harness', String(opts.harness)));
    }
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      queries,
    });
    return res.rows
      .filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id))
      .map((r: any) => shapeAgentSessionListItem(r));
  },

  async createHarnessSession(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'agents:harness');
    requireScope(actor, 'agents:write');
    const harness = String(body.harness || body.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 64);
    if (!harness) badRequest('harness required (e.g. claude-code, codex)');
    const wsId = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    const tables = systemTables();
    const now = new Date().toISOString();
    const sessionId = ID.unique();
    const title = String(body.title || `[${harness}] mirror`).slice(0, 200);
    const seed = {
      role: 'system',
      content: `Harness mirror session for ${harness}. Read-only prompts/tool calls land here.`,
      at: now,
    };
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      rowId: sessionId,
      data: {
        userId: actor.userId,
        harness,
        context: title,
        chatHistory: JSON.stringify([seed]),
        seen: false,
        isMemory: false,
        isPublic: Boolean(wsId),
        isGuest: Boolean(wsId),
        isPinned: false,
        ...(wsId ? { isWorkspace: true, projectId: wsId } : {}),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'agent_session', sessionId, actor.userId, { title });
    }

    return {
      id: (row as any).$id,
      harness,
      context: title,
      mode: 'mirror',
      writable: false,
    };
  },

  async appendHarnessMirror(actor: ApiActor, sessionId: string, body: Record<string, unknown>) {
    requireScope(actor, 'agents:harness');
    requireScope(actor, 'agents:write');
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'agentic_sessions', rowId: sessionId })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Session not found');
    if (!row.harness) badRequest('Not a harness session');

    let history: any[] = [];
    try {
      history = JSON.parse(row.chatHistory || '[]');
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
    const entry = {
      role: String(body.role || 'assistant').slice(0, 32),
      content: String(body.content || body.prompt || body.response || '').slice(0, 12000),
      toolCalls: body.toolCalls ?? null,
      at: new Date().toISOString(),
    };
    if (!entry.content && !entry.toolCalls) badRequest('content or toolCalls required');
    history.push(entry);
    // Cap history size in row
    while (history.length > 200) history.shift();

    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'agentic_sessions',
      rowId: sessionId,
      data: {
        chatHistory: JSON.stringify(history),
        seen: false,
      },
    });
    return { id: sessionId, appended: true, count: history.length };
  },

  async createChat(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const participantId = String(body.participantId || body.recipientId || body.userId || '').trim();
    if (!participantId) badRequest('participantId or recipientId required');
    const tables = systemTables();
    const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
    const convTable = APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || APPWRITE_CONFIG.TABLES.CHAT?.CONVERSATIONS || 'conversations';

    // 1. Check existing direct conversation
    const existing = await tables.listRows({
      databaseId: chatDb,
      tableId: convTable,
      queries: [
        Query.contains('participants', actor.userId),
        Query.contains('participants', participantId),
        Query.limit(5),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    let conv = (existing.rows || []).find((c: any) => {
      const parts = Array.isArray(c.participants) ? c.participants : [];
      return parts.length === 2 && parts.includes(actor.userId) && parts.includes(participantId);
    });

    const now = new Date().toISOString();

    if (!conv) {
      // 2. Check if recipient has published public key
      const profiles = await tables.listRows({
        databaseId: chatDb,
        tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        queries: [
          Query.equal('userId', participantId),
          Query.limit(1),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      const recProfile = profiles.rows?.[0] as any;
      const hasPublicKey = Boolean(recProfile?.publicKey);
      const isEncrypted = body.isEncrypted !== undefined ? Boolean(body.isEncrypted) : hasPublicKey;

      conv = await tables.createRow({
        databaseId: chatDb,
        tableId: convTable,
        rowId: ID.unique(),
        data: {
          type: 'direct',
          name: body.name ? String(body.name).slice(0, 100) : null,
          participants: [actor.userId, participantId],
          participantCount: 2,
          isEncrypted,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now,
        },
        permissions: [
          Permission.read(Role.any()),
          Permission.update(Role.user(actor.userId)),
          Permission.update(Role.user(participantId)),
        ],
      });
    }

    // 3. Send initial message if provided
    const initialText = String(body.initialMessage || body.message || body.content || '').trim();
    if (initialText) {
      await this.sendChatMessage(actor, (conv as any).$id, { content: initialText }).catch(() => null);
    }

    return {
      id: (conv as any).$id,
      type: (conv as any).type || 'direct',
      participants: (conv as any).participants || [actor.userId, participantId],
      isEncrypted: !!(conv as any).isEncrypted,
      createdAt: (conv as any).createdAt || now,
    };
  },

  async listChats(actor: ApiActor, limit = 25) {
    requireScope(actor, 'chats:read');
    const tables = systemTables();
    const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
    const convTable =
      APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS ||
      APPWRITE_CONFIG.TABLES.CHAT?.CONVERSATIONS ||
      'conversations';
    const res = await tables.listRows({
      databaseId: chatDb,
      tableId: convTable,
      queries: [
        Query.contains('participants', actor.userId),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => shapeChatListItem(r));
  },

  async getChat(actor: ApiActor, id: string) {
    requireScope(actor, 'chats:read');
    const tables = systemTables();
    const convTable =
      APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || 'conversations';
    const row = (await tables
      .getRow({ databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: convTable, rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Chat not found');
    const parts = Array.isArray(row.participants) ? row.participants : [];
    if (!parts.includes(actor.userId)) notFound('Chat not found');
    return shapeChatDetail(row);
  },

  async listChatMessages(actor: ApiActor, conversationId: string, limit = 50) {
    requireScope(actor, 'chats:read');
    const chat = await this.getChat(actor, conversationId);
    const tables = systemTables();
    const msgTable = APPWRITE_CONFIG.TABLES.CONNECT?.MESSAGES || 'messages';
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: msgTable,
      queries: [
        Query.equal('conversationId', conversationId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(200, Math.max(1, limit))),
      ],
    });
    // E2EE: metadata only. Unencrypted / thread-style: full plaintext.
    return res.rows.map((r: any) => shapeChatMessage(r, chat.isEncrypted));
  },

  async sendChatMessage(actor: ApiActor, conversationId: string, body: Record<string, unknown>) {
    requireScope(actor, 'chats:write');
    const chat = await this.getChat(actor, conversationId);
    if (chat.isEncrypted) {
      const err = new Error(
        'Encrypted chats cannot be sent via PAT — unlock vault in the app. Use /threads for unencrypted threads.',
      );
      (err as any).status = 400;
      (err as any).code = 'e2ee_required';
      throw err;
    }
    const content = String(body.content ?? body.text ?? '').trim();
    if (!content) badRequest('content required');
    const tables = systemTables();
    const msgTable = APPWRITE_CONFIG.TABLES.CONNECT?.MESSAGES || 'messages';
    const now = new Date().toISOString();
    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: msgTable,
      rowId: ID.unique(),
      data: {
        conversationId,
        senderId: actor.userId,
        content,
        isEncrypted: false,
        createdAt: now,
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    // Update conversation lastMessageAt
    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CONNECT?.CONVERSATIONS || 'conversations',
      rowId: conversationId,
      data: {
        lastMessageAt: now,
        updatedAt: now,
      },
    }).catch(() => null);

    return {
      id: (row as any).$id,
      conversationId,
      senderId: actor.userId,
      content,
      isEncrypted: false,
      createdAt: now,
    };
  },

  async createWorkspace(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const now = new Date().toISOString();
    const tables = systemTables();
    const visibility = String(body.visibility || 'private');
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        summary: body.summary != null ? String(body.summary) : '',
        ownerId: actor.userId,
        visibility,
        status: 'active',
        kind: 'workspace',
        parentProjectId: null,
        isPublic: visibility === 'public',
        isGuest: visibility === 'public',
        isAgentic: Boolean(body.isAgentic),
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
    });
    return shapeWorkspace(row as Record<string, unknown>);
  },

  async updateWorkspace(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, id);
    const tables = systemTables();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.summary !== undefined) patch.summary = String(body.summary);
    if (body.visibility !== undefined) {
      patch.visibility = String(body.visibility);
      patch.isPublic = String(body.visibility) === 'public';
    }
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: id,
      data: patch as any,
    });
    return shapeWorkspace(row as Record<string, unknown>);
  },

  async deleteWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, id);
    const tables = systemTables();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id });
    return { id, deleted: true };
  },

  async listWorkspaceProjects(actor: ApiActor, workspaceId: string, limit = 25) {
    requireScope(actor, 'workspaces:read');
    await assertActorFeatureAccess(actor.userId, 'projects');
    await this.getWorkspace(actor, workspaceId);
    const { verifyProjectPermission } = await import('@/lib/actions/secure-ops/shared');
    const canView = await verifyProjectPermission(workspaceId, actor.userId, 'viewer');
    if (!canView) forbidden('Insufficient permissions on workspace');

    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'projects',
      queries: [
        ...subProjectsListQueries(workspaceId),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ] as any,
    });

    return (res.rows || []).map((row: any) => shapeWorkspaceProject(row, workspaceId));
  },

  async createWorkspaceProject(actor: ApiActor, workspaceId: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await assertActorFeatureAccess(actor.userId, 'projects');
    await this.getWorkspace(actor, workspaceId);
    const { verifyProjectPermission } = await import('@/lib/actions/secure-ops/shared');
    const canEdit = await verifyProjectPermission(workspaceId, actor.userId, 'editor');
    if (!canEdit) forbidden('Insufficient permissions on workspace');

    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');

    const now = new Date().toISOString();
    const tables = systemTables();
    const visibility = String(body.visibility || 'private');
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        summary: body.summary != null ? String(body.summary) : '',
        ownerId: actor.userId,
        visibility,
        status: 'active',
        kind: 'project',
        parentProjectId: workspaceId,
        isPublic: visibility === 'public',
        isGuest: visibility === 'public',
        createdAt: now,
        updatedAt: now,
      },
      permissions: [Permission.read(Role.user(actor.userId))],
    });
    return shapeWorkspaceProject(row as Record<string, unknown>, workspaceId);
  },

  async getWorkspaceProject(actor: ApiActor, workspaceId: string, projectId: string) {
    requireScope(actor, 'workspaces:read');
    await assertActorFeatureAccess(actor.userId, 'projects');
    const row = await this.resolveWorkspaceSubProject(actor, workspaceId, projectId);
    return shapeWorkspaceProject(row, workspaceId);
  },

  async updateWorkspaceProject(
    actor: ApiActor,
    workspaceId: string,
    projectId: string,
    body: Record<string, unknown>,
  ) {
    requireScope(actor, 'workspaces:write');
    await assertActorFeatureAccess(actor.userId, 'projects');
    await this.resolveWorkspaceSubProject(actor, workspaceId, projectId, 'editor');
    const tables = systemTables();
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.summary !== undefined) patch.summary = String(body.summary);
    if (body.visibility !== undefined) {
      patch.visibility = String(body.visibility);
      patch.isPublic = String(body.visibility) === 'public';
    }
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'projects',
      rowId: projectId,
      data: patch as any,
    });
    return shapeWorkspaceProject(row as Record<string, unknown>, workspaceId);
  },

  async deleteWorkspaceProject(actor: ApiActor, workspaceId: string, projectId: string) {
    requireScope(actor, 'workspaces:write');
    await assertActorFeatureAccess(actor.userId, 'projects');
    await this.resolveWorkspaceSubProject(actor, workspaceId, projectId, 'editor');
    const tables = systemTables();
    await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: projectId });
    return { id: projectId, workspaceId, deleted: true };
  },

  async resolveWorkspaceSubProject(
    actor: ApiActor,
    workspaceId: string,
    projectId: string,
    minLevel: 'viewer' | 'editor' = 'viewer',
  ) {
    await this.getWorkspace(actor, workspaceId);
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: projectId })
      .catch(() => null)) as Record<string, unknown> | null;
    if (!row || !isSubProjectRecord(row)) notFound('Project not found');
    if (getParentProjectId(row) !== workspaceId) notFound('Project not found');
    const { verifyProjectPermission } = await import('@/lib/actions/secure-ops/shared');
    const ok = await verifyProjectPermission(workspaceId, actor.userId, minLevel);
    if (!ok) forbidden('Insufficient permissions on workspace');
    return row;
  },

  async attachObjectToWorkspace(actor: ApiActor, workspaceId: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    requireScope(actor, 'objects:write');
    await this.getWorkspace(actor, workspaceId);
    const entityKind = String(body.entityKind || body.kind || '').trim();
    const entityId = String(body.entityId || body.id || '').trim();
    if (!entityKind || !entityId) badRequest('entityKind and entityId required');
    const { addObjectToProjectSecure } = await import('@/lib/actions/secure-ops');
    const res = await addObjectToProjectSecure(workspaceId, entityKind, entityId, body.role as string, body.metadata);
    return {
      id: (res as any)?.$id || ID.unique(),
      workspaceId,
      entityKind,
      entityId,
      attached: true,
    };
  },

  async getEvent(actor: ApiActor, id: string) {
    requireScope(actor, 'events:read');
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Event not found');
    return shapeEventDetail(row);
  },

  async createEvent(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const startTime =
      body.startTime != null
        ? String(body.startTime)
        : new Date().toISOString();
    const endTime =
      body.endTime != null
        ? String(body.endTime)
        : new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
    const tables = systemTables();

    let calendarId = body.calendarId != null ? String(body.calendarId) : '';
    if (!calendarId) {
      const cals = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'calendars',
        queries: [Query.equal('userId', actor.userId), Query.limit(20)],
      });
      const preferred =
        (cals.rows as any[]).find((c) => c.isDefault) || (cals.rows as any[])[0];
      if (preferred) {
        calendarId = preferred.$id;
      } else {
        const cal = await tables.createRow({
          databaseId: FLOW_DB,
          tableId: 'calendars',
          rowId: ID.unique(),
          data: {
            name: 'Personal',
            color: '#F59E0B',
            isDefault: true,
            userId: actor.userId,
            isPublic: false,
            isGuest: false,
            isPinned: false,
          },
          permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
        });
        calendarId = (cal as any).$id;
      }
    }

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'events',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body.description != null ? String(body.description) : '',
        startTime,
        endTime,
        calendarId,
        location: body.location != null ? String(body.location) : null,
        userId: actor.userId,
        status: String(body.status || 'confirmed'),
        visibility: String(body.visibility || 'private'),
        isPublic: !!body.isPublic,
        isGuest: false,
        isPinned: false,
        isDeleted: false,
        isTrash: false,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
    });
    return this.getEvent(actor, (row as any).$id);
  },

  async updateEvent(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = systemTables();
    const patch: Record<string, unknown> = {};
    for (const k of ['title', 'description', 'startTime', 'endTime', 'location', 'status', 'visibility'] as const) {
      if (body[k] !== undefined) patch[k] = body[k] == null ? null : String(body[k]);
    }
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id, data: patch as any });
    return this.getEvent(actor, id);
  },

  async deleteEvent(actor: ApiActor, id: string) {
    requireScope(actor, 'events:write');
    await this.getEvent(actor, id);
    const tables = systemTables();
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'events',
      rowId: id,
      data: {
        isDeleted: true,
        isTrash: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return { id, deleted: true, trashed: true };
  },
  async getForm(actor: ApiActor, id: string) {
    requireScope(actor, 'forms:read');
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id })
      .catch(() => null)) as any;
    if (!row || row.userId !== actor.userId) notFound('Form not found');
    return shapeFormDetail(row);
  },

  async createForm(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    const title = String(body.title || '').trim();
    if (!title) badRequest('title required');
    const tables = systemTables();
    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: 'forms',
      rowId: ID.unique(),
      data: {
        title: title.slice(0, 255),
        description: body.description != null ? String(body.description) : '',
        schema: body.schema != null ? (typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema)) : '[]',
        userId: actor.userId,
        status: String(body.status || 'published'),
        visibility: String(body.visibility || 'private'),
        isPublic: body.isPublic !== undefined ? !!body.isPublic : false,
        isGuest: false,
        isPinned: false,
        isTrash: false,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
      ],
    });
    return this.getForm(actor, (row as any).$id);
  },

  async updateForm(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = systemTables();
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 255);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.schema !== undefined) {
      patch.schema = typeof body.schema === 'string' ? body.schema : JSON.stringify(body.schema);
    }
    if (body.status !== undefined) patch.status = String(body.status);
    if (body.isPublic !== undefined) patch.isPublic = !!body.isPublic;
    await tables.updateRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id, data: patch as any });
    return this.getForm(actor, id);
  },

  async deleteForm(actor: ApiActor, id: string) {
    requireScope(actor, 'forms:write');
    await this.getForm(actor, id);
    const tables = systemTables();
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: 'forms',
      rowId: id,
      data: {
        isDeleted: true,
        isTrash: true,
        updatedAt: new Date().toISOString(),
      },
    });
    return { id, deleted: true, trashed: true };
  },

  async installFlow(actor: ApiActor, flowId: string, body: Record<string, unknown> = {}) {
    requireScope(actor, 'flows:install');
    const id = String(flowId || body.flowId || body.id || '').trim();
    if (!id) badRequest('flow id required in URL path');
    const { FlowInstallService } = await import('@/lib/services/flow-installs');
    const result = await FlowInstallService.install({
      flowId: id,
      installerId: actor.userId,
      scope: (body.scope as any) || { type: 'user' },
      grants: (body.grants as any) || null,
      bindObject: body.bindObject !== false,
    });
    return {
      created: result.created,
      installId: result.install.$id,
      installCount: result.installCount,
      scopeKey: result.install.scopeKey,
    };
  },

  async listFlowInstalls(actor: ApiActor) {
    requireScope(actor, 'flows:read');
    const { FlowInstallService } = await import('@/lib/services/flow-installs');
    const rows = await FlowInstallService.listForInstaller(actor.userId);
    return rows.map((r: any) => shapeFlowInstallListItem(r));
  },

};
