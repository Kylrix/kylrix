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
export const APPWRITE_TABLE_ID_ACTIVITYLOG = APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG;
const APPWRITE_TABLE_ID_SETTINGS = APPWRITE_CONFIG.TABLES.NOTE.SETTINGS;

// Ecosystem: Kylrix Flow
const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const FLOW_TABLE_ID_TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
const FLOW_TABLE_ID_EVENTS = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;

// Ecosystem: Kylrix Vault
const KEEP_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
const KEEP_TABLE_ID_CREDENTIALS = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;

export const APPWRITE_BUCKET_NOTES_ATTACHMENTS = APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;

// Removed redundant exports to prevent ES6 module naming collisions with client.ts
export {  Query};

import { fetchOptimized, invalidateCache } from '@/lib/ecosystem/nexus-fetcher';

async function generateAttachmentSignature(noteId: string, ownerId: string, fileId: string, exp: number) {
  if (!ATTACHMENT_URL_SIGNING_SECRET) return null;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ATTACHMENT_URL_SIGNING_SECRET);
  const data = encoder.encode(`${noteId}.${ownerId}.${fileId}.${exp}`);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const LIST_TTL = 1000 * 60 * 15; // 15 mins

const noteRowClientCache = new Map<string, { payload: Notes; at: number }>();
const noteRowClientInflight = new Map<string, Promise<Notes>>();
const NOTE_ROW_CLIENT_TTL_MS = 1000 * 60 * 5; // 5 minutes

const queryCache = new Map<string, { data: any; expiresAt: number }>();
function isCacheExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}




function cloneNoteForCacheReturn(doc: Notes): Notes {
  const d = doc as any;
  const next: any = { ...d };
  if (Array.isArray(d.tags)) next.tags = [...d.tags];
  if (Array.isArray(d.attachments)) next.attachments = [...d.attachments];
  return next as Notes;
}

export function invalidateNoteRowClientCache(noteId?: string | null) {
  if (!noteId) return;
  noteRowClientCache.delete(noteId);
  noteRowClientInflight.delete(noteId);
  invalidateTablesDbRowCache({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    rowId: noteId});
  publishNexusInvalidate(`note_${noteId}`);
}

async function loadNoteRowFromOrigin(noteId: string): Promise<Notes> {
  const doc = await databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId) as any;
  if (!doc || doc.isTrash === true || doc.isDeleted === true) {
    throw new Error(`Note not found: ${noteId}`);
  }

  hydrateVirtualAttributes(doc);

  try {
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const pivot = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any
    );
    if (pivot.rows.length) {
      const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
      (doc as any).tags = tags;
    }
  } catch (_e: any) {
    // Non-fatal
  }
  if (!(doc as any).attachments || !Array.isArray((doc as any).attachments)) {
    (doc as any).attachments = [];
  }

  const out = doc as Notes;
  if (typeof window !== 'undefined') {
    noteRowClientCache.set(noteId, { payload: cloneNoteForCacheReturn(out), at: Date.now() });
  }
  return out;
}

// Cleanup old cache entries every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    for (const [key, entry] of queryCache.entries()) {
      if (isCacheExpired(entry.expiresAt)) {
        queryCache.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export function cleanRowData<T>(data: Partial<T>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as any)) {
    if (key.startsWith('$')) continue;
    // We allow userId and id if they are custom attributes, but usually they shouldn't be changed after creation.
    // However, we allow them here so they can be filtered by filterNoteData later if needed (e.g. for migration).
    if (key === 'updated_at' || key === 'created_at' || key === 'owner_id') continue;
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

/**
 * True for notes that must NEVER appear in the Ideas list.
 * Covers thread / chat / discussion shells (flag columns + metadata),
 * and object-linked empty shells that historically leaked when flags were missing.
 */
export function isExcludedNote(note: any): boolean {
  if (!note) return false;
  // 1. Direct Column Check (thread, chat, discussion) — legacy isThread handled via alias
  if (note.isThread || note.isChat || note.isDiscussion) {
    return true;
  }
  // 2. Legacy Metadata Fallback
  if (note.metadata) {
    try {
      const parsed = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      if (parsed && typeof parsed === 'object') {
        if (parsed.isThread || parsed.isChat || parsed.isDiscussion) {
          return true;
        }
        // Linked discussion carrier spun for another object
        if (parsed.linkedResourceType && parsed.linkedResourceId) {
          return true;
        }
      }
    } catch {}
  }
  // 3. Object-linked shell (resourceType set to a host object, empty body)
  const rt = String(note.resourceType || '').toLowerCase();
  const SHELL_HOSTS = new Set(['project', 'workspace', 'goal', 'task', 'chat', 'call', 'event', 'form']);
  if (rt && SHELL_HOSTS.has(rt) && note.resourceId) {
    const content = String(note.content ?? '').trim();
    if (!content) return true;
  }
  // 4. Userless Fallback (legacy thread notes used null userId)
  return !note.userId;
}

/** Alias — use at every Ideas / note discovery surface. */
export const isIdeaListExcludedNote = isExcludedNote;
// Back-compat alias for callers still importing isThreadNote
export const isThreadNote = isExcludedNote;

/**
 * Appwrite query fragments that shrink discussion shells before client filter.
 * Safe additive filters; still apply isExcludedNote client-side (null flags).
 */
export function ideaListExclusionQueries(): any[] {
  return [
    Query.notEqual('isThread', true),
    Query.notEqual('isChat', true),
    Query.notEqual('isDiscussion', true),
  ];
}

function hydrateVirtualAttributes(doc: any): any {
  if (!doc) return doc;
  if (doc && doc.metadata) {
    try {
      const extra = JSON.parse(doc.metadata);
      if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach((key: any) => {
          if (doc[key] === undefined || doc[key] === null) {
            doc[key] = extra[key];
          }
        });
      }
    } catch { /* ignore */ }
  }
  // Ensure isThread is normalized (using direct, metadata, or legacy userId fallback)
  doc.isThread = isExcludedNote(doc);
  // legacy alias for readers still checking isThread lowercased
  (doc as any).isThread = doc.isThread;
  return doc;
}

export function getNotePermissions(userId: string, isPublic: boolean) {
  // Owner may update/delete via session client (avoids Vercel Server Actions on every keystroke).
  // Collaborators remain read-only at ACL; cross-owner writes still use secure-ops.
  return ownerRowPermissions(userId, { isPublic });
}

/** Hydrated client-side fields that must never be written back on update. */
const NOTE_VIRTUAL_ATTRIBUTE_KEYS = new Set([
  'linkedTaskId',
  'linkedTaskIds',
  'linkedEventId',
  'linkedEventIds',
  'linkedCredentialId',
  'linkedCredentialIds',
  'linkedSource',
  'isEncrypted',
  'isArticle',
  'clientDecrypted',
  'decryptionKey',
  'dek',
  'sharedFrom',
  'keepPermission',
  'source',
  // Client-only: never sent to Appwrite (on-device amber / pending flush).
  'pendingSync',
]);


const NOTE_UPDATE_BLOCKED_KEYS = new Set([
  'attachments',
  'comments',
  'collaborators',
  'extensions',
  'userId',
  'creatorId',
  'id',
  'createdAt',
  'updatedAt',
]);
export function pickNoteAutosavePayload(data: {
  title?: string | null;
  content?: string | null;
  format?: string | null;
  tags?: string[] | null;
  isPublic?: boolean | null;
  isGuest?: boolean | null;
  isAgentic?: boolean | null;
  isWorkspace?: boolean | null;
  projectId?: string | null;
  dek?: string | null;
}): Partial<Notes> {
  const content = data.content ?? '';
  const trimmedTitle = clampNoteTitle(data.title);

  const payload: Partial<Notes> = {
    title: trimmedTitle || buildAutoTitleFromContent(content) || 'Untitled Thought',
    content,
    format: data.format || 'markdown',
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : []};

  if (typeof data.isPublic === 'boolean') {
    payload.isPublic = data.isPublic;
  }
  if (typeof data.isGuest === 'boolean') {
    payload.isGuest = data.isGuest;
  }
  if (typeof data.isWorkspace === 'boolean') {
    (payload as any).isWorkspace = data.isWorkspace;
  }
  if (typeof data.projectId === 'string' && data.projectId) {
    (payload as any).projectId = data.projectId;
  }
  if (typeof data.isAgentic === 'boolean') {
    (payload as any).isAgentic = data.isAgentic;
  }
  if (typeof data.dek === 'string' && data.dek.trim()) {
    (payload as any).dek = data.dek.trim().slice(0, 1000);
  }

  return payload;
}

export function sanitizeNoteUpdatePatch(
  data: Record<string, unknown>,
  options?: { actorId?: string; noteOwnerId?: string }
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...data };

  for (const key of NOTE_UPDATE_BLOCKED_KEYS) {
    delete patch[key];
  }

  for (const key of Object.keys(patch)) {
    if (key.startsWith('$') || NOTE_VIRTUAL_ATTRIBUTE_KEYS.has(key)) {
      delete patch[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'isPinned') && options?.noteOwnerId && options?.actorId) {
    if (options.noteOwnerId !== options.actorId) {
      delete patch.isPinned;
    }
  }

  if (typeof patch.isPublic !== 'boolean') {
    delete patch.isPublic;
  }

  return patch;
}

export function filterNoteData(data: Record<string, any>): Record<string, any> {
  const schemaKeys = [
    'id', 'createdAt', 'updatedAt', 'userId', 'isPublic', 'isGuest', 'status', 
    'parentNoteId', 'title', 'content', 'tags', 'comments', 
    'extensions', 'collaborators', 'metadata', 'attachments', 'format',
    'isThread', 'isPinned', 'creatorId', 'isChat', 'resourceId',
    'resourceType', 'isEncrypted', 'isPass', 'isTask', 'isFile', 'isTotp',
    'isDiscussion', 'isWorkspace', 'source', 'keepPermission', 'crdt', 'dek', 'isDeleted'
  ];
  
  const filtered: Record<string, any> = {};
  const extra: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (schemaKeys.includes(key)) {
      filtered[key] = value;
    } else if (
      !key.startsWith('$') &&
      value !== undefined &&
      !NOTE_VIRTUAL_ATTRIBUTE_KEYS.has(key)
    ) {
      // Extra fields go to metadata if they are not system fields
      extra[key] = value;
    }
  }

  // Merge extra fields into metadata string
  if (Object.keys(extra).length > 0) {
    let currentMetadata: Record<string, any> = {};
    try {
      if (filtered.metadata) {
        currentMetadata = typeof filtered.metadata === 'string' 
          ? JSON.parse(filtered.metadata) 
          : filtered.metadata;
      }
    } catch {
      currentMetadata = { _raw: filtered.metadata };
    }
    
    filtered.metadata = JSON.stringify({ ...currentMetadata, ...extra });
  }

  return filtered;
}
export async function getPinnedNoteIds(userId?: string): Promise<string[]> {
  try {
    const user = userId ? { $id: userId } : await account.get();
    const uid = user.$id;
    const ids = new Set<string>();

    const { UserResourcePinService } = await import('@/lib/services/user-resource-pins');
    const collaboratorPins = await UserResourcePinService.listForUser(uid, 'note');
    collaboratorPins.forEach((row) => ids.add(row.resourceId));

    try {
      const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, [
        Query.equal('userId', uid),
        Query.equal('isPinned', true),
        Query.limit(100),
        Query.select(['$id']),
      ]);
      res.rows.forEach((row: any) => ids.add(row.$id));
    } catch (dbErr) {
      console.warn('[getPinnedNoteIds] Owner pin fetch failed:', dbErr);
    }

    return Array.from(ids);
  } catch {
    return [];
  }
}



export { createNoteCreationService };


export async function createNote(data: Partial<Notes>, jwt?: string) {
  // Unified path — create via server SDK (create grants read), UI never touches backend directly
  const { unifiedCreate } = await import('@/lib/services/unified-object-service');
  const row = await unifiedCreate('note', data as Record<string, any>);
  // keep legacy secure-ops path as fallback for jwt-scoped callers
  if ((row as any)?.$id) return row as unknown as Notes;
  if (typeof window !== 'undefined') {
    const { createNote } = await import('@/lib/actions/client-ops');
    return await createNote(data);
  }
  const { createNoteSecure } = await import('@/lib/actions/secure-ops');
  return createNoteSecure(data, jwt);
}


export async function getNote(noteId: string): Promise<Notes> {
  if (noteId.startsWith('thread-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const match = history.find((n: any) => n.id === noteId);
      if (match) {
        let decryptedTitle = match.title;
        let decryptedContent = match.content || '';
        if (match.decryptionKey) {
          try {
            const { decryptThreadData } = await import('@/lib/encryption/thread-crypto');
            decryptedTitle = await decryptThreadData(match.title, match.decryptionKey);
            decryptedContent = await decryptThreadData(match.content || '', match.decryptionKey);
          } catch (e) {
            console.error('Failed to decrypt thread note in getNote:', e);
          }
        }
        return {
          $id: match.id,
          $createdAt: match.createdAt,
          $updatedAt: match.createdAt,
          title: decryptedTitle,
          content: decryptedContent,
          format: 'text',
          tags: [],
          userId: 'thread',
          isPublic: false,
          isGuest: false,
          metadata: match.metadata || '{}'} as any;
      }
    }
  }

  let promise: Promise<Notes>;

  if (typeof window !== 'undefined') {
    const cached = noteRowClientCache.get(noteId);
    if (cached && Date.now() - cached.at < NOTE_ROW_CLIENT_TTL_MS) {
      return cloneNoteForCacheReturn(cached.payload);
    }
    const inflight = noteRowClientInflight.get(noteId);
    if (inflight) {
      const doc = await inflight;
      return cloneNoteForCacheReturn(doc);
    }
    promise = loadNoteRowFromOrigin(noteId);
    noteRowClientInflight.set(noteId, promise);
    promise.finally(() => noteRowClientInflight.delete(noteId));
  } else {
    promise = loadNoteRowFromOrigin(noteId);
  }

  const doc = await promise;
  return cloneNoteForCacheReturn(doc);
}

export async function updateNote(noteId: string, data: Partial<Notes>, jwt?: string) {
  if (noteId.startsWith('thread-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const index = history.findIndex((n: any) => n.id === noteId);
      if (index !== -1) {
        const match = history[index];
        
        let decryptedTitle = match.title;
        let decryptedContent = match.content || '';
        if (match.decryptionKey) {
          try {
            const { decryptThreadData } = await import('@/lib/encryption/thread-crypto');
            decryptedTitle = await decryptThreadData(match.title, match.decryptionKey);
            decryptedContent = await decryptThreadData(match.content || '', match.decryptionKey);
          } catch (e) {
            console.error('Failed to decrypt thread note for update:', e);
          }
        }

        const nextTitle = data.title !== undefined ? data.title : decryptedTitle;
        const nextContent = data.content !== undefined ? data.content : decryptedContent;

        let encTitle = nextTitle;
        let encContent = nextContent;
        let decryptionKey = match.decryptionKey;

        if (match.decryptionKey) {
          try {
            const { encryptThreadData } = await import('@/lib/encryption/thread-crypto');
            const resTitle = await encryptThreadData(nextTitle, match.decryptionKey);
            encTitle = resTitle.encrypted;
            const resContent = await encryptThreadData(nextContent, match.decryptionKey);
            encContent = resContent.encrypted;
          } catch (e) {
            console.error('Failed to encrypt thread note for update:', e);
          }
        }

        const updatedRef = {
          ...match,
          title: encTitle,
          content: encContent,
          metadata: data.metadata !== undefined ? data.metadata : match.metadata,
          createdAt: match.createdAt,
          expiresAt: match.expiresAt,
          decryptionKey,
          deletionSecret: match.deletionSecret};
        history[index] = updatedRef;
        localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify(history));
        window.dispatchEvent(new Event('storage'));
        return {
          $id: updatedRef.id,
          $createdAt: updatedRef.createdAt,
          $updatedAt: new Date().toISOString(),
          title: nextTitle,
          content: nextContent,
          format: 'text',
          tags: [],
          userId: 'thread',
          isPublic: false,
          isGuest: false,
          metadata: updatedRef.metadata || '{}'} as any;
      }
    }
  }

  // Unified update — server SDK (secure-ops) is SoT, client path as fallback
  try {
    const { unifiedUpdate } = await import('@/lib/services/unified-object-service');
    const row = await unifiedUpdate('note', noteId, data as Record<string, any>);
    if ((row as any)?.$id) { invalidateNoteRowClientCache(noteId); return row as unknown as Notes; }
  } catch {}

  if (typeof window !== 'undefined') {
    invalidateNoteRowClientCache(noteId);
    
    // Encrypt fields client-side if we hold the active encryption key
    const key = activeNoteKeys.get(noteId);
    const isArticle = data.article === true;
    if (key && !isArticle && (data.content !== undefined || data.title !== undefined)) {
      try {
        const titleText = data.title || 'Untitled Thought';
        const contentText = data.content || '';
        const encryptedTitle = await ecosystemSecurity.encryptWithKey(titleText, key);
        const encryptedContent = await ecosystemSecurity.encryptWithKey(contentText, key);
        
        let meta: Record<string, any> = {};
        try {
          meta = JSON.parse((data as any).metadata || '{}');
        } catch {}
        
        data = {
          ...data,
          title: '🔒 Encrypted Note',
          content: encryptedContent,
          metadata: JSON.stringify({
            ...meta,
            isEncrypted: true,
            encryptedTitle
          })
        };
      } catch (err) {
        console.error('Failed to encrypt note update client-side:', err);
      }
    }

    const { updateNote } = await import('@/lib/actions/client-ops');
    const result = await updateNote(noteId, data);
    invalidateNoteRowClientCache(noteId);
    return result as Notes;
  }
  const { updateNoteSecure } = await import('@/lib/actions/secure-ops');
  const result = await updateNoteSecure(noteId, data, jwt);
  return result as Notes;
}

export async function deleteNote(noteId: string, jwt?: string) {
  if (typeof window !== 'undefined') {
    const { isEphemeralComposeNoteId, markComposePersisted } = await import('@/lib/notes/compose-draft-registry');
    if (isEphemeralComposeNoteId(noteId)) {
      markComposePersisted(noteId);
      invalidateNoteRowClientCache(noteId);
      return { success: true };
    }
  }

  if (noteId.startsWith('thread-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const filtered = history.filter((n: any) => n.id !== noteId);
      localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      return { success: true };
    }
  }

  // Unified delete — recursive support, server SDK SoT
  try {
    const { unifiedDelete } = await import('@/lib/services/unified-object-service');
    await unifiedDelete('note', noteId, { recursive: true, cascade: [{ kind: 'comment', foreignField: 'noteId' }] });
    invalidateNoteRowClientCache(noteId);
    return { success: true };
  } catch {}

  if (typeof window !== 'undefined') {
    invalidateNoteRowClientCache(noteId);
    
    const isOffline = !window.navigator.onLine;
    if (isOffline) {
      console.log('[deleteNote] Offline. Saving deletion as a thread note...');
      const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
      if (historyRaw) {
        try {
          const history = JSON.parse(historyRaw);
          const filtered = history.filter((n: any) => n.id !== noteId);

          // Save deletion as a thread note with _deleted: true
          const newRef = {
            id: noteId,
            title: '',
            content: '',
            metadata: JSON.stringify({
              isThread: true,
              _deleted: true,
              send_object: { kind: 'note' }
            }),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            decryptionKey: '',
            deletionSecret: ''};
          filtered.unshift(newRef);

          localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify(filtered));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          console.error(e);
        }
      }
      return { success: true };
    }

    try {
      const { deleteNote } = await import('@/lib/actions/client-ops');
      const result = await deleteNote(noteId);
      invalidateNoteRowClientCache(noteId);
      return result;
    } catch (err: any) {
      const isNetworkError = !err.status || err.code === 'network_error' || err.message?.includes('fetch') || err.message?.includes('NetworkError');
      if (isNetworkError) {
        console.log('[deleteNote] Network error. Saving deletion as a thread note...');
        const historyRaw = localStorage.getItem('kylrix_thread_notes_v2');
        if (historyRaw) {
          try {
            const history = JSON.parse(historyRaw);
            const filtered = history.filter((n: any) => n.id !== noteId);

            // Save deletion as a thread note with _deleted: true
            const newRef = {
              id: noteId,
              title: '',
              content: '',
              metadata: JSON.stringify({
                isThread: true,
                _deleted: true,
                send_object: { kind: 'note' }
              }),
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              decryptionKey: '',
              deletionSecret: ''};
            filtered.unshift(newRef);

            localStorage.setItem('kylrix_thread_notes_v2', JSON.stringify(filtered));
            window.dispatchEvent(new Event('storage'));
          } catch (e) {
            console.error(e);
          }
        }
        return { success: true };
      }
      throw err;
    }
  }
  const { deleteNoteSecure } = await import('@/lib/actions/secure-ops');
  const result = await deleteNoteSecure(noteId, jwt);
  return result;
}

export async function listNotes(queries: any[] = [], limit: number = 100, options: { includeStories?: boolean; includeThreads?: boolean } = {}) {
  const key = `list:notes:${JSON.stringify(queries)}:${limit}:${JSON.stringify(options)}`;
  
  return await fetchOptimized(key, async () => {
    // Default: notes for current user
    if (!queries.length) {
      const user = await getCurrentUser();
      if (!user || !user.$id) {
        return { rows: [], total: 0 };
      }
      queries = [
        Query.equal('userId', user.$id)
      ];
    }

    const finalQueries = [
      ...queries,
      ...(!options.includeThreads ? ideaListExclusionQueries() : []),
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ];

    const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, finalQueries);
    let notes = (res.rows as any[]).map((doc: any) => hydrateVirtualAttributes(doc)) as unknown as Notes[];
    notes = notes.filter((n: any) => n && n.isTrash !== true && n.isDeleted !== true && String(n.isTrash) !== 'true' && String(n.isDeleted) !== 'true');

    // Hydrate tags from pivot table in batch (best-effort)
    try {
      if (notes.length) {
        const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const noteIds = notes.map((n: any) => n.$id || (n as any).id).filter(Boolean);
        if (noteIds.length) {
          // Appwrite supports passing array to Query.equal for multiple values
          const pivotRes = await databases.listRows(
            APPWRITE_DATABASE_ID,
            noteTagsTable,
            [Query.equal('resourceId', noteIds), Query.equal('resourceType', 'note'), Query.limit(Math.min(1000, noteIds.length * 10))] as any
          );
          const tagMap: Record<string, Set<string>> = {};
          for (const p of pivotRes.rows as any[]) {
            if (!p.resourceId || !p.tag) continue;
              if (!tagMap[p.resourceId]) tagMap[p.resourceId] = new Set();
            tagMap[p.resourceId].add(p.tag);
          }
          for (const n of notes as any[]) {
            const id = n.$id || n.id;
            if (id && tagMap[id] && tagMap[id].size) {
              n.tags = Array.from(tagMap[id]);
            }
            if (!(n as any).attachments || !Array.isArray((n as any).attachments)) {
              (n as any).attachments = [];
            }
          }
        }
      }
    } catch (_e: any) {
      // Non-fatal hydration error
    }

    let filteredNotes = notes;
    if (!options.includeStories) {
      filteredNotes = filteredNotes.filter((n: any) => !(n as any).isStory);
    }
    if (!options.includeThreads) {
      filteredNotes = filteredNotes.filter((n: any) => !isExcludedNote(n));
    }

    return { ...res, rows: filteredNotes };
  }, LIST_TTL);
}



