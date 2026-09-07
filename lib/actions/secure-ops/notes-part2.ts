'use server';

import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { inferAttachmentMimeType, resolveAttachmentVisualKind } from '@/lib/note-object-visual';
import {
  JWTSchema,
  NoteSchema,
  SuggestionParamsSchema
} from '@/lib/validations/schemas';

// Import interfaces / types from shared

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  verifyResourcePermissionSecure,
  verifyNotePermission} = shared;

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTES_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

async function hydrateSharedNoteRow(noteId: string) {
  const tables = createSystemTablesDB();
  const doc = await tables.getRow({
    databaseId: NOTE_DB_ID,
    tableId: NOTES_TABLE_ID,
    rowId: noteId}) as any;

  if (!doc || doc.isTrash === true || doc.isDeleted === true) {
    return null;
  }

  try {
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const pivot = await tables.listRows({
      databaseId: NOTE_DB_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any});
    if (pivot.rows.length) {
      const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
      doc.tags = tags;
    }
  } catch {}

  if (!doc.attachments || !Array.isArray(doc.attachments)) {
    doc.attachments = [];
  }

  return doc;
}

async function canReadSharedNoteSecure(noteId: string, actorId?: string | null) {
  const tables = createSystemTablesDB();
  try {
    const doc = await tables.getRow({
      databaseId: NOTE_DB_ID,
      tableId: NOTES_TABLE_ID,
      rowId: noteId,
    }) as any;
    if (!doc || doc.isTrash === true || doc.isDeleted === true) return false;
  } catch {
    return false;
  }
  if (actorId) {
    const allowed = await verifyNotePermission(noteId, actorId, 'viewer');
    if (allowed) return true;
  }
  const publicNote = await validatePublicNoteAccess(noteId);
  return !!publicNote;
}

export async function deleteNoteSecure(noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
  if (!isValidAppwriteRowId(noteId)) {
    // Offline-only / ephemeral draft item — local deletion is clean success
    return { success: true, offline: true };
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'admin');
  if (!isAllowed) {
    try {
      await tables.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID_NOTES,
        rowId: noteId});
    } catch {
      return JSON.parse(JSON.stringify({ $id: noteId, localOnly: true }));
    }
    throw new Error('Forbidden: Insufficient permissions to delete this note');
  }

  const result = await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
      data: { isTrash: true }
    });
  return JSON.parse(JSON.stringify(result));
}

export async function createthreadNoteSecure(data: {
  title: string;
  content: string;
  format?: string;
  threadSecret: string;
  expiresAt?: string;
  isEncrypted?: boolean;
  creatorDeletionProofHash?: string;
}) {
  const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isthread: true,
    threadSecret: data.threadSecret,
    expiresAt: expiresAt,
    version: 'v2',
    isEncrypted: data.isEncrypted || false,
    ...(data.creatorDeletionProofHash ? { creatorDeletionProofHash: data.creatorDeletionProofHash } : {})});

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: data.title,
      content: data.content,
      format: data.format || 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isthread: true,
      isThread: false},
    permissions: [`read("any")`]});

  return JSON.parse(JSON.stringify(result));
}

export async function createthreadNoteForCallSecure(callId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isthread: true,
    linkedSource: 'call',
    linkedTaskId: callId,
    expiresAt: expiresAt,
    version: 'v2'});

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: title || 'Call Chat',
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      creatorId: actor.$id,
      resourceId: callId,
      resourceType: 'call',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isthread: true,
      isThread: true},
    permissions: [Permission.read(Role.user(actor.$id))]});

  return JSON.parse(JSON.stringify(result));
}

export async function createthreadNoteForProjectSecure(projectId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  }).catch(() => null);

  if (!project) {
      throw new Error('Project not found');
  }

  let projMeta: any = {};
  try {
    projMeta = JSON.parse((project as any).metadata || '{}');
  } catch {}

  // Prefer existing canonical thread; never spin a new shell note into Ideas.
  const { ThreadService } = await import('@/lib/services/threads');
  const legacyNoteId =
    projMeta.discussionNoteId && projMeta.discussionNoteId !== (project as any).primaryThreadId
      ? String(projMeta.discussionNoteId)
      : null;

  const { thread, created } = await ThreadService.getOrCreate({
    parentKind: 'workspace',
    parentId: projectId,
    channel: ThreadService.CHANNEL_GENERAL,
    ownerId: (project as any).ownerId || actor.$id,
    title: title || `${(project as any).title || 'Workspace'} discussion`,
    legacyNoteId,
  });

  projMeta.discussionThreadId = thread.id;
  // Keep discussionNoteId only for true legacy note shells (message bridge).
  if (legacyNoteId) projMeta.discussionNoteId = legacyNoteId;
  else delete projMeta.discussionNoteId;

  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      primaryThreadId: thread.id,
      metadata: JSON.stringify(projMeta),
      updatedAt: new Date().toISOString(),
    }
  });

  // Back-compat shape for callers expecting a note-like {$id}
  return JSON.parse(JSON.stringify({
    $id: thread.id,
    title: thread.title,
    isthread: false,
    isThread: false,
    resourceType: 'project',
    resourceId: projectId,
    primaryThreadId: thread.id,
    created,
    _canonicalThread: true,
  }));
}

export async function createthreadNoteForResourceSecure(
  resourceId: string,
  resourceType: 'task' | 'project' | 'tag' | 'event' | 'form',
  title?: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const { ThreadService } = await import('@/lib/services/threads');
  const kindMap: Record<string, string> = {
    task: 'goal',
    project: 'workspace',
    event: 'event',
    form: 'form',
    tag: 'object',
  };
  const parentKind = kindMap[resourceType] || 'object';
  const channel =
    parentKind === 'workspace' ? ThreadService.CHANNEL_GENERAL : ThreadService.CHANNEL_DISCUSS;

  const { thread, created } = await ThreadService.getOrCreate({
    parentKind,
    parentId: resourceId,
    channel,
    ownerId: actor.$id,
    title: title || 'Discussion',
  });

  return JSON.parse(JSON.stringify({
    $id: thread.id,
    title: thread.title,
    isthread: false,
    isThread: false,
    resourceType,
    resourceId,
    primaryThreadId: thread.id,
    created,
    _canonicalThread: true,
  }));
}

export async function createthreadNoteChatSecure(data: {
  title: string;
  participants: string[];
  customRowId?: string;
  jwt?: string;
}) {
  const actor = await getActor(data.jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // 100 years
  const metadata = JSON.stringify({
    isthread: true,
    version: 'v2',
    isChat: true,
    expiresAt: expiresAt,
    linkedResourceType: 'chat',
    participants: data.participants});

  const tables = createSystemTablesDB();
  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: data.customRowId || ID.unique(),
    data: {
      title: data.title,
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      creatorId: actor.$id,
      resourceType: 'chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isthread: true,
      isThread: true,
      isChat: true,
      collaborators: data.participants},
    permissions: data.participants.map(id => Permission.read(Role.user(id)))});

  // Create polymorphic Collaborators rows for each participant
  for (const participantId of data.participants) {
    if (participantId === actor.$id) continue;
    try {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: 'Collaborators',
        rowId: ID.unique(),
        data: {
          resourceId: result.$id,
          resourceType: 'note',
          userId: participantId,
          permission: 'write',
          status: 'accepted',
          invitedAt: new Date().toISOString(),
          accepted: true},
        permissions: data.participants.map(id => Permission.read(Role.user(id)))});
    } catch (e) {
      console.error('[createthreadNoteChat] Failed to add collaborator row:', e);
    }
  }

  return JSON.parse(JSON.stringify(result));
}

export async function listthreadNoteChatsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const actorId = actor.$id;

  // 1. Fetch resources the user is a collaborator for
  const collaboratorsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: 'Collaborators',
      queries: [
          Query.equal('userId', actorId),
          Query.limit(500)
      ] as any
  }).catch(() => ({ rows: [] }));

  const collabResourceIds = collaboratorsRes.rows.map(r => r.resourceId).filter(Boolean);

  // 2. Build Authorization Filter: (Owned by me) OR (Linked to resource I collaborate on)
  const authOrFilters = [
      Query.equal('creatorId', actorId),
      Query.equal('userId', actorId) // Fallback for rows before the tracking column update
  ];

  if (collabResourceIds.length > 0) {
      // Chunk into groups of 100 to respect Appwrite Query.equal array limits if needed
      // but for simplicity here we assume < 100 for now.
      authOrFilters.push(Query.equal('$id', collabResourceIds.slice(0, 100)));
  }

  // Use the system client to manually enforce our visibility logic
  const res = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    queries: [
      Query.equal('isThread', true),
      Query.or(authOrFilters),
      Query.limit(100)
    ] as any
  }).catch(() => ({ rows: [] }));

  // Sort by updatedAt descending
  const rows = [...(res.rows || [])];


  rows.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());

  return JSON.parse(JSON.stringify(rows));
}

export async function listTagsSecure(userId?: string, jwt?: string) {
  let actor: any = null;
  try {
    actor = await getActor(jwt);
  } catch (_) {}

  const targetUserId = userId || actor?.$id;
  const systemTables = createSystemTablesDB();

  const result = await systemTables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.TAGS || '67ff06280034908cf08a',
    queries: targetUserId
      ? [Query.equal('userId', targetUserId), Query.orderDesc('$createdAt'), Query.limit(100)]
      : [Query.orderDesc('$createdAt'), Query.limit(100)]});

  return JSON.parse(JSON.stringify(result));
}
