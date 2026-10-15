'use server';

import { systemTables } from '@/lib/data/system-tables';
import * as shared from './shared';
import { broadcastRealtimeEvent } from '@/lib/realtime/partykit';
import { inferAttachmentMimeType, resolveAttachmentVisualKind } from '@/lib/note-object-visual';
import { JWTSchema, NoteSchema, SuggestionParamsSchema } from '@/lib/validations/schemas';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const { getActor, verifyNotePermission } = shared;

async function hydrateSharedNoteRow(noteId: string) {
  try {
    const { getNoteTurso } = await import('@/lib/actions/turso-ops');
    const tursoRes = await getNoteTurso(noteId);
    if (tursoRes.success && tursoRes.row && !tursoRes.row.isTrashed) {
      const r = tursoRes.row;
      let tags: string[] = [];
      try {
        tags = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []);
      } catch {
        tags = [];
      }
      return {
        $id: r.id,
        id: r.id,
        title: r.title,
        content: r.content,
        userId: r.userId,
        isPublic: true,
        isGuest: true,
        isWorkspace: Boolean(r.isWorkspace),
        tags,
        attachments: [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    }
  } catch {}
  return null;
}

async function canReadSharedNoteSecure(noteId: string, actorId?: string | null) {
  try {
    const { getNoteTurso } = await import('@/lib/actions/turso-ops');
    const tursoRes = await getNoteTurso(noteId);
    if (tursoRes.success && tursoRes.row && !tursoRes.row.isTrashed) {
      if (tursoRes.row.isPublished || tursoRes.row.userId === actorId) return true;
    }
  } catch {}

  if (actorId) {
    const allowed = await verifyNotePermission(noteId, actorId, 'viewer');
    if (allowed) return true;
  }
  return false;
}

export async function getSharedNoteDataSecure(noteId: string, jwt?: string) {
  const validatedJwt = JWTSchema.parse(jwt);
  const actor = await getActor(validatedJwt).catch(() => null);

  const canRead = await canReadSharedNoteSecure(noteId, actor?.$id);
  if (!canRead) return null;

  return await hydrateSharedNoteRow(noteId);
}

export async function getNoteSecondaryObjectPreviewSecure(
  input: {
    noteId: string;
    childKind: string;
    childId: string;
    bucketId?: string;
    label?: string;
    href?: string;
    mimeType?: string;
  },
  jwt?: string,
) {
  const validatedJwt = JWTSchema.parse(jwt);
  const actor = await getActor(validatedJwt).catch(() => null);
  const canRead = await canReadSharedNoteSecure(input.noteId, actor?.$id);
  if (!canRead) {
    return { ok: false as const };
  }

  const childKind = String(input.childKind || '').trim();
  const childId = String(input.childId || '').trim();
  const fallbackTitle = String(input.label || input.href || childId || 'Attached object').trim();
  const mimeType = inferAttachmentMimeType(input.label, { mimeType: input.mimeType }, childKind);
  const visualKind = resolveAttachmentVisualKind(mimeType, childKind, input.label);

  if (childKind === 'link') {
    const href = String(input.href || childId || '').trim();
    return {
      ok: true as const,
      title: fallbackTitle,
      href,
      previewDataUrl: null as string | null,
      childKind,
      mimeType,
      visualKind,
    };
  }

  if (childKind === 'file' || childKind === 'image' || childKind === 'voice') {
    return {
      ok: true as const,
      title: fallbackTitle,
      href: null as string | null,
      previewDataUrl: null as string | null,
      childKind,
      bucketId: '',
      fileId: childId,
      mimeType,
      visualKind,
    };
  }

  try {
    const tables = systemTables();
    const row = await tables.getRow({
      databaseId: 'turso',
      tableId: childKind,
      rowId: childId,
    }) as any;
    return {
      ok: true as const,
      title: String(row?.title || row?.name || fallbackTitle).trim(),
      href: null as string | null,
      previewDataUrl: null as string | null,
      childKind,
      mimeType,
      visualKind,
    };
  } catch {
    return {
      ok: true as const,
      title: fallbackTitle,
      href: null as string | null,
      previewDataUrl: null as string | null,
      childKind,
      mimeType,
      visualKind,
    };
  }
}

export async function getNoteInheritedFileBlobSecure(
  _noteId: string,
  fileId: string,
  _bucketId: string,
  _jwt?: string,
) {
  return {
    dataUrl: null,
    mimeType: 'application/octet-stream',
    name: fileId,
  };
}

export async function getPublicNoteCommentsSecure(noteId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.comments)
      .where(and(eq(schema.comments.resourceId, noteId), eq(schema.comments.resourceType, 'note')));
    const cleanRows = rows.map((c) => ({
      $id: c.id,
      id: c.id,
      noteId: c.resourceId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    return { rows: cleanRows };
  } catch {
    return { rows: [] };
  }
}

export async function getPublicNoteReactionsSecure(noteId: string, targetId?: string, targetType?: string) {
  try {
    const rows = await db
      .select()
      .from(schema.reactions)
      .where(and(eq(schema.reactions.resourceId, targetId || noteId), eq(schema.reactions.resourceType, targetType || 'note')));
    const cleanRows = rows.map((r) => ({
      $id: r.id,
      id: r.id,
      targetId: r.resourceId,
      targetType: r.resourceType,
      reactionType: r.emoji,
      userId: r.userId,
      createdAt: r.createdAt,
    }));
    return { rows: cleanRows };
  } catch {
    return { rows: [] };
  }
}

export async function getCrossSuggestionsSecure(params: any, jwt?: string) {
  const validated = SuggestionParamsSchema.parse(params);
  const validatedJwt = JWTSchema.parse(jwt);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { sourceApp, sourceType, sourceId } = validated;
  const baseId = sourceId || 'unknown';

  let suggestions = [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note-link action.' },
    { id: `event:${baseId}`, label: 'Create Event', description: 'Expose an event creation action.' },
  ];

  if (sourceApp === 'note' || sourceType === 'note') {
    suggestions = [
      { id: `task:${baseId}`, label: 'Create Task', description: 'Convert the note into an actionable task.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Turn the note into a scheduled event.' },
      { id: `followup:${baseId}`, label: 'Add Follow-up', description: 'Generate a follow-up action from this note.' },
    ];
  } else if (sourceType === 'task' || sourceApp === 'flow') {
    suggestions = [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Link a source note to this task.' },
      { id: `event:${baseId}`, label: 'Calendar Event', description: 'Map this task onto a calendar surface.' },
    ];
  }

  return { sourceApp, sourceType, sourceId, suggestions };
}

export async function syncNotesDeltaSecure(localManifest: { id: string; updatedAt: string }[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { listNotesTurso } = await import('@/lib/actions/turso-ops');
  const res = await listNotesTurso(actor.$id);

  const serverManifest = new Map<string, string>(
    (res.rows || []).map((d: any) => [String(d.id), String(d.updatedAt)])
  );
  const localMap = new Map(localManifest.map((m) => [m.id, m.updatedAt]));

  const toFetch: string[] = [];
  const toDelete: string[] = [];

  for (const [sId, sUpdated] of serverManifest.entries()) {
    const lUpdated = localMap.get(sId);
    if (!lUpdated || new Date(sUpdated) > new Date(lUpdated)) {
      toFetch.push(sId);
    }
  }

  for (const lId of localMap.keys()) {
    if (!serverManifest.has(lId)) {
      toDelete.push(lId);
    }
  }

  const patches = (res.rows || []).filter((r: any) => toFetch.includes(r.id));

  return {
    success: true,
    patches,
    deletedIds: toDelete,
    serverTime: new Date().toISOString(),
  };
}

export async function pullNotesDeltaSecure(params: { lastCheckpoint: string | null; limit: number }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { listNotesTurso } = await import('@/lib/actions/turso-ops');
  const res = await listNotesTurso(actor.$id);

  let documents = (res.rows || []).map((doc: any) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    userId: doc.userId,
    updatedAt: doc.updatedAt,
    _deleted: doc.isTrashed || false,
  }));

  if (params.lastCheckpoint) {
    documents = documents.filter((d: any) => new Date(d.updatedAt) > new Date(params.lastCheckpoint!));
  }

  documents = documents.slice(0, params.limit || 50);
  const lastDoc = documents[documents.length - 1];
  const checkpoint = lastDoc ? { updatedAt: lastDoc.updatedAt, id: lastDoc.id } : null;

  return { documents, checkpoint };
}

export async function pushNotesDeltaSecure(rows: any[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { upsertNoteTurso } = await import('@/lib/actions/turso-ops');

  for (const row of rows) {
    const { newDocumentState } = row;
    await upsertNoteTurso({
      id: newDocumentState.id || crypto.randomUUID(),
      userId: actor.$id,
      title: newDocumentState.title || '',
      content: newDocumentState.content || '',
      createdAt: newDocumentState.createdAt || new Date().toISOString(),
      updatedAt: newDocumentState.updatedAt || new Date().toISOString(),
    });
  }

  return [];
}

export async function createNoteSecure(data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const reservedRowId = data?.$id || data?.id || crypto.randomUUID();
  const { clampNoteTitle } = await import('@/constants/noteTitle');
  if (data && typeof data === 'object') {
    data.title = clampNoteTitle((data as any).title, 'Untitled Thought');
  }
  const validated = NoteSchema.parse(data);

  const { upsertNoteTurso } = await import('@/lib/actions/turso-ops');
  await upsertNoteTurso({
    id: reservedRowId,
    userId: actor.$id,
    title: validated.title || '',
    content: validated.content || '',
    isLocked: Boolean(data?.isLocked),
    isPublished: Boolean(data?.isPublished),
    isPinned: Boolean(data?.isPinned),
    isTrashed: Boolean(data?.isTrash || data?.isTrashed),
    isWorkspace: Boolean(data?.isWorkspace),
    projectId: data?.projectId || null,
    category: data?.category || null,
    tags: Array.isArray(data?.tags) ? JSON.stringify(data.tags) : (data?.tags || null),
    createdAt: data?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createdNote = {
    $id: reservedRowId,
    id: reservedRowId,
    title: validated.title,
    content: validated.content,
    userId: actor.$id,
    createdAt: data?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  void broadcastRealtimeEvent({
    tableId: 'notes',
    rowId: reservedRowId,
    action: 'create',
    payload: createdNote,
  });

  return JSON.parse(JSON.stringify(createdNote));
}

export async function updateNoteSecure(noteId: string, data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { upsertNoteTurso } = await import('@/lib/actions/turso-ops');
  const now = new Date().toISOString();

  if (data.title !== undefined) {
    const { clampNoteTitle } = await import('@/constants/noteTitle');
    data.title = clampNoteTitle(data.title, 'Untitled Thought');
  }

  await upsertNoteTurso({
    id: noteId,
    userId: actor.$id,
    title: data?.title || '',
    content: data?.content || '',
    isLocked: Boolean(data?.isLocked),
    isPublished: Boolean(data?.isPublished),
    isPinned: Boolean(data?.isPinned),
    isTrashed: Boolean(data?.isTrash || data?.isTrashed),
    isWorkspace: Boolean(data?.isWorkspace),
    projectId: data?.projectId || null,
    category: data?.category || null,
    tags: Array.isArray(data?.tags) ? JSON.stringify(data.tags) : (data?.tags || null),
    createdAt: data?.createdAt || now,
    updatedAt: now,
  });

  const updatedNote = {
    $id: noteId,
    id: noteId,
    userId: actor.$id,
    ...data,
    updatedAt: now,
  };

  void broadcastRealtimeEvent({
    tableId: 'notes',
    rowId: noteId,
    action: 'update',
    payload: updatedNote,
  });

  return JSON.parse(JSON.stringify(updatedNote));
}

export async function deleteNoteSecure(noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { deleteNoteTurso } = await import('@/lib/actions/turso-ops');
  await deleteNoteTurso(noteId);

  return JSON.parse(JSON.stringify({ $id: noteId, success: true }));
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
  const { upsertNoteTurso } = await import('@/lib/actions/turso-ops');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await upsertNoteTurso({
    id,
    userId: 'thread',
    title: data.title,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: id, id, title: data.title, content: data.content }));
}

export async function createthreadNoteForCallSecure(callId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { upsertNoteTurso } = await import('@/lib/actions/turso-ops');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await upsertNoteTurso({
    id,
    userId: actor.$id,
    title: title || 'Call Chat',
    content: '',
    createdAt: now,
    updatedAt: now,
  });

  return JSON.parse(JSON.stringify({ $id: id, id, title: title || 'Call Chat' }));
}

export async function createthreadNoteForProjectSecure(projectId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const { ThreadService } = await import('@/lib/services/threads');
  const { thread, created } = await ThreadService.getOrCreate({
    parentKind: 'workspace',
    parentId: projectId,
    channel: ThreadService.CHANNEL_GENERAL,
    ownerId: actor.$id,
    title: title || 'Workspace discussion',
  });

  return JSON.parse(JSON.stringify({
    $id: thread.id,
    title: thread.title,
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

  const { thread, created } = await ThreadService.getOrCreate({
    parentKind,
    parentId: resourceId,
    channel: ThreadService.CHANNEL_GENERAL,
    ownerId: actor.$id,
    title: title || 'Discussion',
  });

  return JSON.parse(JSON.stringify({
    $id: thread.id,
    title: thread.title,
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

  const { upsertConversationTurso } = await import('@/lib/actions/turso-ops');
  const id = data.customRowId || crypto.randomUUID();
  const now = new Date().toISOString();

  await upsertConversationTurso({
    id,
    creatorId: actor.$id,
    name: data.title,
    participants: JSON.stringify(data.participants),
    createdAt: now,
    updatedAt: now,
  });

  return {
    $id: id,
    id,
    title: data.title,
    creatorId: actor.$id,
    createdAt: now,
    updatedAt: now,
    isThread: true,
    isChat: true,
    collaborators: data.participants,
  };
}

export async function listthreadNoteChatsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const { listConversationsTurso } = await import('@/lib/actions/turso-ops');
  const res = await listConversationsTurso(actor.$id);

  return (res.rows || []).map((r: any) => ({
    $id: r.id,
    id: r.id,
    title: r.name || 'Conversation',
    creatorId: r.creatorId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isThread: true,
    isChat: true,
  }));
}

export async function listTagsSecure(userId?: string, jwt?: string) {
  let actor: any = null;
  try {
    actor = await getActor(jwt);
  } catch (_) {}

  const targetUserId = userId || actor?.$id;
  try {
    const conditions = targetUserId ? [eq(schema.tags.userId, targetUserId)] : [];
    const rows = await db.select().from(schema.tags).where(and(...conditions));
    const cleanRows = rows.map((r) => ({
      $id: r.id,
      id: r.id,
      name: r.name,
      userId: r.userId,
      usageCount: r.usageCount || 0,
      isPublic: Boolean(r.isPublic),
      createdAt: r.createdAt,
    }));
    return { rows: cleanRows, total: cleanRows.length };
  } catch {
    return { rows: [], total: 0 };
  }
}
