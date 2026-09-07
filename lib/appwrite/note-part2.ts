import { ID, Query, Permission, Role } from 'appwrite';
import { account, databases, getCurrentUser } from './client';
import type {
import { TargetType } from '@/types/appwrite';
import { APPWRITE_CONFIG } from './config';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createNoteCreationService } from '@/sdk';
import { buildAutoTitleFromContent, clampNoteTitle } from '@/constants/noteTitle';
import { buildSourceNoteTags } from '@/sdk/crosslinks';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { invalidateTablesDbRowCache } from '@/lib/ecosystem/tablesdb-row-cache';
import { publishNexusInvalidate } from '@/lib/ecosystem/nexus-bridge';
import { ownerRowPermissions } from '@/lib/appwrite/owner-acl';
import {
  activeNoteKeys,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID_NOTES,
  APPWRITE_TABLE_ID_TAGS,
  APPWRITE_TABLE_ID_COMMENTS,
  APPWRITE_TABLE_ID_REACTIONS,
  POLYMORPHIC_COLLABORATORS_TABLE
} from './note-shared';
export async function createTag(data: Partial<Tags & { $id?: string; isPublic?: boolean; isGuest?: boolean }>, jwt?: string) {
  const rawName = data.name?.trim();
  if (!rawName) throw new Error("Tag name is required");
  const nameLower = rawName.toLowerCase();

  // 1. Client-side path: local cache first, sync to Appwrite in background
  if (typeof window !== 'undefined') {
    const user = await getCurrentUser();
    const userId = user?.$id || null;
    const { readLocalTagRows, findLocalTagByName } = await import('@/lib/data/local/tags');

    try {
      const localRows = await readLocalTagRows(userId);
      const match = findLocalTagByName(localRows, rawName);
      if (match) {
        return hydrateTagMetadata(match as unknown as Tags);
      }
    } catch {}

    const metadata = { color: data.color || '#A855F7', description: data.description || '' };
    const tagId = data.$id || ID.unique();
    const now = new Date().toISOString();
    const payload = {
      $id: tagId,
      name: rawName,
      nameLower,
      metadata: JSON.stringify(metadata),
      isPublic: !!data.isPublic,
      isGuest: !!data.isGuest,
      usageCount: 0,
    };

    const optimistic = hydrateTagMetadata({
      $id: tagId,
      name: rawName,
      nameLower,
      userId,
      metadata: JSON.stringify(metadata),
      usageCount: 0,
      $createdAt: now,
      $updatedAt: now,
      color: metadata.color,
      description: metadata.description,
    } as unknown as Tags);

    void (async () => {
      try {
        const { createRow } = await import('@/lib/actions/client-ops');
        const doc = await createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, payload);
        try {
          const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
          if (doc?.$id) autonomicSyncEngine.markPending(doc.$id);
        } catch {}
        invalidateCache('list:tags');
      } catch (err) {
        console.warn('[createTag] background sync failed:', err);
      }
    })();

    invalidateCache('list:tags');
    return optimistic;
  }

  // 2. Server-side path
  const { systemTables } = await import('@/lib/data');
  const tables = systemTables();
  const { getActor } = await import('@/lib/actions/secure-ops/shared');
  const actor = await getActor(jwt).catch(() => null);
  const userId = actor?.$id;

  if (userId) {
    const existing = await tables
      .listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID_TAGS,
        queries: [Query.equal('userId', userId), Query.equal('nameLower', nameLower), Query.limit(1)] as any,
      })
      .catch(() => ({ rows: [] as any[] }));
    if (existing.rows && existing.rows.length > 0) {
      return hydrateTagMetadata(existing.rows[0] as unknown as Tags);
    }
  }

  const metadata = { color: data.color || '#A855F7', description: data.description || '' };
  const payload = {
    name: rawName,
    nameLower,
    metadata: JSON.stringify(metadata),
    isPublic: !!data.isPublic,
    isGuest: !!data.isGuest,
    usageCount: 0
  };

  const { createRowSecure } = await import('@/lib/actions/secure-ops');
  const doc = await createRowSecure(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, payload, undefined, jwt);
  return hydrateTagMetadata(doc as unknown as Tags);
}

function hydrateTagMetadata(tag: Tags): Tags {
    if (!tag) return tag;
    const t = tag as any;
    if (t.metadata) {
        try {
            const extra = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
            if (extra && typeof extra === 'object') {
                Object.assign(t, extra);
            }
        } catch { /* ignore */ }
    }
    return t as Tags;
}

async function getTag(tagId: string): Promise<Tags> {
  const doc = await databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tagId);
  return hydrateTagMetadata(doc as unknown as Tags);
}

export async function updateTag(tagId: string, data: Partial<Tags & { isPublic?: boolean; isGuest?: boolean }>, jwt?: string) {
  if (typeof window !== 'undefined') {
    const { updateRow } = await import('@/lib/actions/client-ops');
    const existing = await getTag(tagId);
    const name = data.name?.trim() || existing.name;
    
    const metadata: Record<string, any> = {};
    try {
        if ((existing as any).metadata) {
            Object.assign(metadata, typeof (existing as any).metadata === 'string' ? JSON.parse((existing as any).metadata) : (existing as any).metadata);
        }
    } catch {}
    
    if (data.color) metadata.color = data.color;
    if (data.description) metadata.description = data.description;

    const payload = {
      name,
      nameLower: name?.toLowerCase(),
      metadata: JSON.stringify(metadata),
      isPublic: data.isPublic !== undefined ? !!data.isPublic : !!(existing as Tags & { isPublic?: boolean }).isPublic,
      isGuest: data.isGuest !== undefined ? !!data.isGuest : !!(existing as Tags & { isGuest?: boolean }).isGuest};

    const doc = await updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tagId, payload);
    invalidateCache('list:tags');
    return hydrateTagMetadata(doc as unknown as Tags);
  }

  const { updateRowSecure } = await import('@/lib/actions/secure-ops');
  const existing = await getTag(tagId);
  const name = data.name?.trim() || existing.name;
  
  const metadata: Record<string, any> = {};
  try {
      if ((existing as any).metadata) {
          Object.assign(metadata, typeof (existing as any).metadata === 'string' ? JSON.parse((existing as any).metadata) : (existing as any).metadata);
      }
  } catch {}
  
  if (data.color) metadata.color = data.color;
  if (data.description) metadata.description = data.description;

  const payload = {
    name,
    nameLower: name?.toLowerCase(),
    metadata: JSON.stringify(metadata),
    isPublic: data.isPublic !== undefined ? !!data.isPublic : !!(existing as Tags & { isPublic?: boolean }).isPublic,
    isGuest: data.isGuest !== undefined ? !!data.isGuest : !!(existing as Tags & { isGuest?: boolean }).isGuest};

  const doc = await updateRowSecure(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tagId, payload, undefined, jwt);
  return hydrateTagMetadata(doc as unknown as Tags);
}

export async function deleteTag(tagId: string, jwt?: string) {
  if (typeof window !== 'undefined') {
    const { deleteRow } = await import('@/lib/actions/client-ops');
    const res = await deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tagId);
    invalidateCache('list:tags');
    return res;
  }
  const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
  return deleteRowSecure(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, tagId, jwt);
}

export async function listTags(_queries: any[] = [], _limit: number = 100) {
  if (typeof window !== 'undefined') {
    const { listTags: listTagsClient } = await import('@/lib/actions/client-ops');
    const res = await listTagsClient();
    const rows = Array.isArray(res) ? res : (Array.isArray(res?.rows) ? res.rows : []);
    return {
      total: rows.length,
      rows: rows.map((t: any) => hydrateTagMetadata(t as Tags))};
  }

  const { listTagsSecure } = await import('@/lib/actions/secure-ops');
  const res = await listTagsSecure();
  const rows = Array.isArray(res) ? res : (Array.isArray(res?.rows) ? res.rows : []);
  return {
    total: rows.length,
    rows: rows.map((t: any) => hydrateTagMetadata(t as Tags))};
}

// New function to get all tags with cursor pagination
export async function getAllTags(): Promise<{ rows: Tags[], total: number }> {
  const user = await getCurrentUser();
  if (!user || !user.$id) {
    return { rows: [], total: 0 };
  }

  let allTags: Tags[] = [];
  let cursor: string | undefined = undefined;
  const batchSize = 100;
  
  while (true) {
    const queries = [
      Query.equal("userId", user.$id),
      Query.notEqual("isTrash", true),
      Query.limit(batchSize),
      Query.orderDesc("$createdAt")
    ];
    
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    
    const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, queries);
    const tags = (res.rows as unknown as Tags[]).map((t: any) => hydrateTagMetadata(t));
    
    allTags = [...allTags, ...tags];
    
    if (tags.length < batchSize) {
      break;
    }
    
    cursor = tags[tags.length - 1].$id;
  }
  
  return {
    rows: allTags,
    total: allTags.length
  };
}

export async function listTagsByUser(userId: string) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, [Query.equal('userId', userId)]);
}

// Internal helper: adjust tag usage count (best-effort, non-atomic)



export async function createComment(noteId: string, content: string, parentCommentId: string | null = null, metadata: string | null = null, isVoice: boolean = false, isEncrypted: boolean = false) {
  const user = await getCurrentUser();
  if (!user || !user.$id) throw new Error("User not authenticated");
  
  // Inherit public status from note to ensure consistent visibility
  let isPublicNote = false;
  try {
    const note = await getNote(noteId);
    isPublicNote = !!note.isPublic;
  } catch (e: any) {
    console.warn('[createComment] Could not fetch note to inherit permissions:', e);
  }

  let finalMetadata = metadata;
  if (isVoice || content?.startsWith('__voice_note__:')) {
    let voiceFileId = null;
    if (content?.startsWith('__voice_note__:')) {
      voiceFileId = content.substring('__voice_note__:'.length);
    } else {
        try {
            const parsed = JSON.parse(content);
            if (parsed.voiceFileId) voiceFileId = parsed.voiceFileId;
        } catch {}
    }
    if (voiceFileId) {
        const metaObj = (() => { try { return JSON.parse(metadata || '{}'); } catch { return {}; } })();
        metaObj.voiceFileId = voiceFileId;
        finalMetadata = JSON.stringify(metaObj);
    }
  }

  const data = {
    noteId,
    content,
    userId: user.$id,
    createdAt: new Date().toISOString(),
    parentCommentId,
    metadata: finalMetadata,
    isVoice: isVoice || content?.startsWith('__voice_note__:'),
    isEncrypted
  };

  const permissions = [
    Permission.read(Role.user(user.$id))];

  if (isPublicNote) {
    permissions.push(Permission.read(Role.any()));
  }

  return databases.createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, ID.unique(), data, permissions);
}

async function getComment(commentId: string): Promise<Comments> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, commentId) as unknown as Promise<Comments>;
}

export async function updateComment(commentId: string, data: Partial<Comments>) {
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, commentId, cleanRowData(data));
}

export async function deleteComment(commentId: string) {
  await deleteReactionsForTarget(TargetType.COMMENT, commentId);
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, commentId);
}

export async function listComments(noteId: string) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, [Query.equal('noteId', noteId)]);
}

export async function createReaction(data: Partial<Reactions>) {
  // Duplicate guard: ensure single (userId,targetType,targetId,emoji)
  try {
    if (data && (data as any).userId && (data as any).targetId && (data as any).emoji) {
      const userId = (data as any).userId;
      const targetId = (data as any).targetId;
      const emoji = (data as any).emoji;
      const targetType = (data as any).targetType;
      try {
        const existing = await databases.listRows(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_REACTIONS,
          [
            Query.equal('userId', userId),
            Query.equal('targetId', targetId),
            Query.equal('emoji', emoji),
            Query.equal('targetType', targetType),
            Query.limit(1)
          ] as any
        );
        if (existing.rows.length) {
          // Idempotent return existing row
            return existing.rows[0] as any;
        }
      } catch (listErr) {
        console.error('createReaction duplicate guard list failed', listErr);
      }
      // Attach createdAt if not present
      if (!(data as any).createdAt) {
        (data as any).createdAt = new Date().toISOString();
      }
    }
  } catch (guardErr) {
    console.error('createReaction duplicate guard failed', guardErr);
  }
  const userId = (data as any)?.userId as string | undefined;
  
  // Inherit public status if reacting to a note
  let isTargetPublic = false;
  const targetId = (data as any)?.targetId;
  const targetType = (data as any)?.targetType;

  if (targetId && targetType === TargetType.NOTE) {
    try {
      const note = await getNote(targetId);
      isTargetPublic = !!note.isPublic;
    } catch {}
  } else if (targetId && targetType === TargetType.COMMENT) {
    // For comments, inherit visibility from the parent note
    try {
      const comment = await getComment(targetId as string);
      if (comment?.noteId) {
        const note = await getNote(comment.noteId);
        isTargetPublic = !!note.isPublic;
      }
    } catch {
      isTargetPublic = true;
    }
  } else {
    // For other targets, default to public read if no specific logic
    isTargetPublic = true; 
  }

  const permissions = userId
    ? [
        Permission.read(isTargetPublic ? Role.any() : Role.user(userId))]
    : [Permission.read(Role.any())];
  return databases.createRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_REACTIONS,
    ID.unique(),
    cleanRowData(data),
    permissions
  );
}

export async function deleteReaction(reactionId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_REACTIONS, reactionId);
}

export async function listReactions(queries: any[] = []) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_REACTIONS, queries);
}

export async function deleteReactionsForTarget(targetType: TargetType, targetId: string | string[]) {
  const ids = Array.isArray(targetId) ? targetId.filter(Boolean) : [targetId];
  if (!ids.length) return;
  try {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    
    const res = await db.listRows<any>(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_REACTIONS,
      [
        Query.equal('targetType', targetType),
        Query.equal('targetId', ids),
        Query.limit(Math.min(1000, Math.max(50, ids.length * 10)))
      ] as any,
      { forceSystem: true }
    );
    
    await Promise.all(
      (res.rows || []).map((doc: any) =>
        db.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_REACTIONS, doc.$id, { forceSystem: true })
      )
    );
  } catch (err: any) {
    console.error('deleteReactionsForTarget failed:', err);
  }
}

export async function listCollaborators(noteId: string) {
  const res = await databases.listRows(
    FLOW_DATABASE_ID,
    POLYMORPHIC_COLLABORATORS_TABLE,
    [
      Query.equal('resourceId', noteId),
      Query.equal('resourceType', 'note')
    ]
  );
  res.rows = res.rows.map((doc: any) => ({
    ...doc,
    noteId: doc.resourceId}));
  return res;
}


// --- ACTIVITY LOG CRUD ---

export async function listActivityLogs() {
  const user = await getCurrentUser();
  if (!user || !user.$id) {
    return { total: 0, rows: [] };
  }
  const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_ACTIVITYLOG, [Query.equal('userId', user.$id)]);
  return {
      ...res,
      rows: res.rows // Ensure legacy alias is present
  };
}

// --- SETTINGS CRUD ---

export async function createSettings(data: Pick<Settings, 'userId' | 'settings'> & { mode?: string }) {
  if (!data.userId) throw new Error("userId is required to create settings");
  return databases.createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_SETTINGS, data.userId, data);
}

export async function getSettings(settingsId: string): Promise<Settings> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_SETTINGS, settingsId) as unknown as Promise<Settings>;
}

export async function updateSettings(settingsId: string, data: any) {
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_SETTINGS, settingsId, data);
}


// --- CROSS-ECOSYSTEM ACTIONS ---

/**
 * Creates a task in Kylrix Flow based on a note.
 * Stores the task ID in the note's metadata for linking.
 */
export async function createTaskFromNote(note: Notes) {
  const user = await getCurrentUser();
  if (!user || !user.$id) throw new Error("User not authenticated");

  if (!hasPaidKylrixPlan(user)) {
    throw new Error("AI Actions are available for PRO subscribers only.");
  }

  const taskId = ID.unique();
  const now = new Date().toISOString();

  // Create row in Kylrix Flow tasks table
  // Table schema: title, description, status, priority, userId, parentId, etc.
  const taskDoc = await databases.createRow(
    FLOW_DATABASE_ID,
    FLOW_TABLE_ID_TASKS,
    taskId,
    {
      title: note.title || 'Task from Note',
      status: 'todo',
      priority: 'medium',
      userId: user.$id,
      tags: buildSourceNoteTags([note.$id]),
      createdAt: now,
      updatedAt: now,
      // No metadata column in tasks table, using description to reference note
      description: `${note.content || ''}\n\n--- Origin: Kylrix Note (${note.$id}) ---`
    }
  );

  // Link the task back to the note
  await updateNote(note.$id, {
    linkedTaskId: taskId,
    linkedSource: 'kylrixflow'
  });

  return taskDoc;
}

// --- UTILITY ---


// All subscription logic is now handled by the modular subscription provider.
// See src/lib/subscriptions/

export async function getNotesByTag(tagId: string): Promise<Notes[]> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.$id) {
      return [];
    }

    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const pivotRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('tagId', tagId), Query.equal('resourceType', 'note'), Query.limit(1000)] as any
    );

    const noteIds = pivotRes.rows.map((p: any) => p.resourceId).filter(Boolean);
    if (!noteIds.length) {
      return [];
    }

    const notesRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      [
        Query.equal('$id', noteIds), 
        Query.equal('userId', user.$id), 
        Query.orderDesc('$createdAt')
      ] as any
    );

    const notes = notesRes.rows as unknown as Notes[];

    try {
      if (notes.length) {
        const pivotResForHydration = await databases.listRows(
          APPWRITE_DATABASE_ID,
          noteTagsTable,
          [
            Query.equal('resourceId', notes.map((n: any) => n.$id || (n as any).id).filter(Boolean)),
            Query.equal('resourceType', 'note'),
            Query.limit(Math.min(1000, notes.length * 10))
          ] as any
        );
        const tagsByNoteId: { [noteId: string]: Set<string> } = {};
        pivotResForHydration.rows.forEach((p: any) => {
          const noteId = p.resourceId;
          if (noteId) {
            if (!tagsByNoteId[noteId]) {
              tagsByNoteId[noteId] = new Set();
            }
            if (p.tag) {
              tagsByNoteId[noteId].add(p.tag);
            }
          }
        });
        notes.forEach((note: any) => {
          const noteId = note.$id || (note as any).id;
          if (noteId && tagsByNoteId[noteId]) {
            note.tags = Array.from(tagsByNoteId[noteId]);
          }
        });
      }
    } catch (e: any) {
      console.error('Error hydrating tags:', e);
    }

    return notes;
  } catch (error: any) {
    console.error('Error fetching notes by tag:', error);
    throw error;
  }
}

export async function listNotesByUser(userId: string) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, [
    Query.equal('userId', userId)
  ]);
}



export async function getSharedNotes(): Promise<{ rows: Notes[], total: number }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { rows: [], total: 0 };

    // 1. Fetch all rows where I am NOT the owner but have access.
    // Appwrite automatically filters to rows I have READ access to.
    const notesRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      [
        Query.notEqual('userId', currentUser.$id),
        Query.isNotNull('userId'),
        Query.orderDesc('$createdAt'),
        Query.limit(500)
      ]
    );

    const sharedNotes: Notes[] = [];
    const safeRows = (notesRes as any)?.rows ?? (notesRes as any)?.documents ?? [];
    if (!Array.isArray(safeRows)) {
      return { rows: [], total: 0 };
    }
    for (const doc of safeRows as any[]) {
      const note = doc as any;
      
      // 2. STRICT VALIDATION: 
      // Only include if the user is EXPLICITLY named in the permissions.
      // This excludes "public" notes where access is granted via Role.any().
      const perms = note.$permissions || [];
      const userRole = `user:${currentUser.$id}`;
      const isExplicitCollaborator = perms.some((p: string) => p.includes(userRole));

      if (!isExplicitCollaborator) continue;

      // Determine permission level for the current user
      let myPerm = 'read';
      if (perms.includes(`delete("${userRole}")`)) myPerm = 'admin';
      else if (perms.includes(`update("${userRole}")`)) myPerm = 'write';

      note.sharedPermission = myPerm;
      note.sharedAt = note.$updatedAt || note.$createdAt;
      
      if (!(note as any).attachments || !Array.isArray((note as any).attachments)) {
        note.attachments = [];
      }
      
      sharedNotes.push(note as Notes);
    }

    return {
      rows: sharedNotes,
      total: sharedNotes.length
    };
  } catch (error: any) {
    console.error('getSharedNotes error:', error);
    return { rows: [], total: 0 };
  }
}

interface EmbeddedAttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  createdAt: string;
}

function parseAttachmentMeta(raw: unknown): EmbeddedAttachmentMeta | null {
  if (!raw) return null;
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as EmbeddedAttachmentMeta;
    if (typeof raw === 'object' && raw !== null && 'id' in raw) return raw as EmbeddedAttachmentMeta;
  } catch {}
  return null;
}

function normalizeNoteAttachmentsField(note: { attachments?: unknown[] }): EmbeddedAttachmentMeta[] {
  const arr = Array.isArray(note.attachments) ? note.attachments : [];
  const metas: EmbeddedAttachmentMeta[] = [];
  for (const entry of arr) {
    const meta = parseAttachmentMeta(entry);
    if (meta?.id) metas.push(meta);
  }
  return metas;
}

export async function listNoteAttachments(noteId: string, currentUserId?: string): Promise<EmbeddedAttachmentMeta[]> {
  // Optional access guard: if currentUserId provided, ensure user is owner or collaborator.
  try {
    if (currentUserId) {
      const note = await getNote(noteId) as any;
      if (note.userId !== currentUserId) {
        try {
          const collabRes: any = await databases.listRows(
            FLOW_DATABASE_ID,
            POLYMORPHIC_COLLABORATORS_TABLE,
            [
              Query.equal('resourceId', noteId),
              Query.equal('resourceType', 'note'),
              Query.equal('userId', currentUserId)
            ] as any
          );
          const isCollab = Array.isArray(collabRes?.rows) && collabRes.rows.length > 0;
          if (!isCollab) return [];
        } catch {
          return [];
        }
      }
    }
  } catch (_authErr) {
    return [];
  }
  const note = await getNote(noteId) as any;
  const embedded = normalizeNoteAttachmentsField(note);
  // If table enabled, merge records (favor table metadata if conflicts by fileId)
  if (APPWRITE_TABLE_ID_ATTACHMENTS) {
    try {
      const tableRecords = await listAttachmentsForNote(noteId);
      if (tableRecords.length) {
        const byId: Record<string, EmbeddedAttachmentMeta> = {};
        for (const m of embedded) byId[m.id] = m;
        for (const rec of tableRecords) {
          const existing = byId[rec.fileId];
          const merged: EmbeddedAttachmentMeta = {
            id: rec.fileId,
            name: rec.filename || existing?.name || 'attachment',
            size: rec.sizeBytes || existing?.size || 0,
            mime: rec.mimetype || existing?.mime || null,
            createdAt: existing?.createdAt || rec.createdAt || new Date().toISOString()};
          byId[rec.fileId] = merged;
        }
        return Object.values(byId).sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt));
      }
    } catch (e: any) {
      console.error('listNoteAttachments merge failed', e);
    }
  }
  return embedded;
}



// --- NEW ATTACHMENTS TABLE MODEL ---
// Progressive enhancement: supports richer metadata beyond embedded JSON strings.
// If NEXT_PUBLIC_APPWRITE_TABLE_ID_ATTACHMENTS is set, we will dual-write to that table.

const APPWRITE_TABLE_ID_ATTACHMENTS = process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID_ATTACHMENTS || undefined;

interface AttachmentRecord {
  id: string;
  noteId: string;
  ownerId: string;
  fileId: string; // underlying storage file id
  filename: string;
  mimetype: string | null;
  sizeBytes: number;
  createdAt: string;
  metadata?: any;
}


async function listAttachmentsForNote(noteId: string): Promise<AttachmentRecord[]> {
  if (!APPWRITE_TABLE_ID_ATTACHMENTS) return [];
  try {
    const res: any = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_ATTACHMENTS,
      [Query.equal('noteId', noteId), Query.limit(200), Query.orderDesc('$createdAt')] as any
    );
    return res.rows as unknown as AttachmentRecord[];
  } catch (e: any) {
    console.error('listAttachmentsForNote failed', e);
    return [];
  }
}


// --- SIGNED ATTACHMENT URL HELPERS ---
// Short-lived HMAC signed URLs that point to a proxy download route.
// These are generated server-side only. If secret missing, returns null (feature disabled).
const ATTACHMENT_URL_SIGNING_SECRET = process.env.ATTACHMENT_URL_SIGNING_SECRET || '';
export async function verifySignedAttachmentURL(params: { noteId: string; ownerId: string; fileId: string; exp: number | string; sig: string; }): Promise<{ valid: boolean; reason?: string }> {
  if (!ATTACHMENT_URL_SIGNING_SECRET) return { valid: false, reason: 'signing_disabled' };
  const { noteId, ownerId, fileId } = params;
  const expNum = typeof params.exp === 'string' ? parseInt(params.exp, 10) : params.exp;
  if (!expNum || isNaN(expNum)) return { valid: false, reason: 'invalid_exp' };
  const now = Math.floor(Date.now() / 1000);
  if (expNum < now) return { valid: false, reason: 'expired' };
  const expected = await generateAttachmentSignature(noteId, ownerId, fileId, expNum);
  if (!expected) return { valid: false, reason: 'signature_unavailable' };
  if (expected !== params.sig) return { valid: false, reason: 'invalid_signature' };
  return { valid: true };
}



export interface ListNotesPaginatedOptions {
  limit?: number;
  cursor?: string | null;
  sinceUpdatedAt?: string | null;
  userId?: string; // override current user (admin/future use)
  queries?: any[]; // additional custom queries (overrides userId logic if provided)
  hydrateTags?: boolean; // default true
  includeStories?: boolean;
  includeThreads?: boolean;
}

