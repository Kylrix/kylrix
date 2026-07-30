import { ID, Query, Permission, Role, OAuthProvider } from 'appwrite';
import { account, databases, storage, functions, realtime, client, getCurrentUser, invalidateCurrentUserCache } from './client';
import { AppwriteService } from './auth';
import type {
  Notes,
  Tags,
  Comments,
  Reactions,
  ActivityLog,
  Settings} from '@/types/appwrite';
import { TargetType } from '@/types/appwrite';
// Removed static import of secure-ops to prevent Next.js isomorphic bundling errors.

import { APPWRITE_CONFIG } from './config';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { createNoteCreationService } from '@/lib/sdk';
import { buildAutoTitleFromContent, clampNoteTitle } from '@/constants/noteTitle';
import { buildSourceNoteTags } from '@/lib/sdk/crosslinks';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { invalidateTablesDbRowCache } from '@/lib/ecosystem/tablesdb-row-cache';
import { publishNexusInvalidate } from '@/lib/ecosystem/nexus-bridge';

const activeNoteKeys = new Map<string, CryptoKey>();

// export app public uri

// NOTE database ID (internal, not exported to avoid conflict with vault's APPWRITE_DATABASE_ID)
const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;

// Appwrite config IDs from constants
export const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
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
export {  Query, Permission, Role};

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

export function isGhostNote(note: any): boolean {
  if (!note) return false;
  // 1. Direct Column Check (Ghost, Thread, Chat, Discussion)
  if (note.isGhost || note.isThread || note.isChat || note.isDiscussion) {
    return true;
  }
  // 2. Legacy Metadata Fallback
  if (note.metadata) {
    try {
      const parsed = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      if (parsed && typeof parsed === 'object') {
        if (parsed.isGhost || parsed.isThread || parsed.isChat || parsed.isDiscussion) {
          return true;
        }
      }
    } catch {}
  }
  // 3. Userless Fallback (Ghost notes used to use null/empty userId)
  return !note.userId;
}

function hydrateVirtualAttributes(doc: any): any {
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
  // Ensure isGhost is normalized (using direct, metadata, or legacy userId fallback)
  doc.isGhost = isGhostNote(doc);
  return doc;
}

export function getNotePermissions(userId: string, isPublic: boolean) {
  const permissions = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];

  if (isPublic) {
    // Role.any() includes guests, so Role.guests() is redundant.
    permissions.push(Permission.read(Role.any()));
  }

  return permissions;
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
    'isGhost', 'isThread', 'isPinned', 'creatorId', 'isChat', 'resourceId',
    'resourceType', 'isEncrypted', 'isPass', 'isTask', 'isFile', 'isTotp',
    'isDiscussion', 'source', 'keepPermission', 'crdt', 'dek', 'isDeleted'
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

async function setNotePinned(noteId: string, pinned: boolean): Promise<string[]> {
  const user = await account.get();
  const note = await databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId);
  const ownerId = (note as any).creatorId || (note as any).userId || user.$id;
  const { toggleResourcePin } = await import('@/lib/services/resource-pin-coordinator');
  const { UserResourcePinService, resolveEffectivePinned } = await import('@/lib/services/user-resource-pins');
  const pinRows = await UserResourcePinService.listForUser(user.$id, 'note');
  const pinSet = new Set(pinRows.map((row: any) => row.resourceId));
  const currentlyPinned = resolveEffectivePinned(
    user.$id,
    ownerId,
    noteId,
    (note as any).isPinned,
    pinSet,
    'note',
  );
  if (currentlyPinned !== pinned) {
    await toggleResourcePin({
      actorId: user.$id,
      ownerId,
      resourceType: 'note',
      resourceId: noteId,
      currentlyPinned,
      setOwnerRowPin: async (nextPinned) => {
        await updateNote(noteId, { isPinned: nextPinned } as any);
      },
    });
  }
  return getPinnedNoteIds(user.$id);
}


export { createNoteCreationService };


export async function createNote(data: Partial<Notes>, jwt?: string) {
  if (typeof window !== 'undefined') {
    const { createNote } = await import('@/lib/actions/client-ops');
    return await createNote(data);
  }
  const { createNoteSecure } = await import('@/lib/actions/secure-ops');
  return createNoteSecure(data, jwt);
}


export async function getNote(noteId: string): Promise<Notes> {
  if (noteId.startsWith('ghost-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const match = history.find((n: any) => n.id === noteId);
      if (match) {
        let decryptedTitle = match.title;
        let decryptedContent = match.content || '';
        if (match.decryptionKey) {
          try {
            const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
            decryptedTitle = await decryptGhostData(match.title, match.decryptionKey);
            decryptedContent = await decryptGhostData(match.content || '', match.decryptionKey);
          } catch (e) {
            console.error('Failed to decrypt ghost note in getNote:', e);
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
          userId: 'ghost',
          isPublic: false,
          isGuest: false,
          metadata: match.metadata || '{}',
        } as any;
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
  if (noteId.startsWith('ghost-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const index = history.findIndex((n: any) => n.id === noteId);
      if (index !== -1) {
        const match = history[index];
        
        let decryptedTitle = match.title;
        let decryptedContent = match.content || '';
        if (match.decryptionKey) {
          try {
            const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
            decryptedTitle = await decryptGhostData(match.title, match.decryptionKey);
            decryptedContent = await decryptGhostData(match.content || '', match.decryptionKey);
          } catch (e) {
            console.error('Failed to decrypt ghost note for update:', e);
          }
        }

        const nextTitle = data.title !== undefined ? data.title : decryptedTitle;
        const nextContent = data.content !== undefined ? data.content : decryptedContent;

        let encTitle = nextTitle;
        let encContent = nextContent;
        let decryptionKey = match.decryptionKey;

        if (match.decryptionKey) {
          try {
            const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
            const resTitle = await encryptGhostData(nextTitle, match.decryptionKey);
            encTitle = resTitle.encrypted;
            const resContent = await encryptGhostData(nextContent, match.decryptionKey);
            encContent = resContent.encrypted;
          } catch (e) {
            console.error('Failed to encrypt ghost note for update:', e);
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
        localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
        window.dispatchEvent(new Event('storage'));
        return {
          $id: updatedRef.id,
          $createdAt: updatedRef.createdAt,
          $updatedAt: new Date().toISOString(),
          title: nextTitle,
          content: nextContent,
          format: 'text',
          tags: [],
          userId: 'ghost',
          isPublic: false,
          isGuest: false,
          metadata: updatedRef.metadata || '{}',
        } as any;
      }
    }
  }

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

  if (noteId.startsWith('ghost-') && typeof window !== 'undefined') {
    const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      const filtered = history.filter((n: any) => n.id !== noteId);
      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      return { success: true };
    }
  }

  if (typeof window !== 'undefined') {
    invalidateNoteRowClientCache(noteId);
    
    const isOffline = !window.navigator.onLine;
    if (isOffline) {
      console.log('[deleteNote] Offline. Saving deletion as a ghost note...');
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      if (historyRaw) {
        try {
          const history = JSON.parse(historyRaw);
          const filtered = history.filter((n: any) => n.id !== noteId);

          // Save deletion as a ghost note with _deleted: true
          const newRef = {
            id: noteId,
            title: '',
            content: '',
            metadata: JSON.stringify({
              isGhost: true,
              _deleted: true,
              send_object: { kind: 'note' }
            }),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            decryptionKey: '',
            deletionSecret: '',
          };
          filtered.unshift(newRef);

          localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(filtered));
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
        console.log('[deleteNote] Network error. Saving deletion as a ghost note...');
        const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
        if (historyRaw) {
          try {
            const history = JSON.parse(historyRaw);
            const filtered = history.filter((n: any) => n.id !== noteId);

            // Save deletion as a ghost note with _deleted: true
            const newRef = {
              id: noteId,
              title: '',
              content: '',
              metadata: JSON.stringify({
                isGhost: true,
                _deleted: true,
                send_object: { kind: 'note' }
              }),
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              decryptionKey: '',
              deletionSecret: '',
            };
            filtered.unshift(newRef);

            localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(filtered));
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

export async function listNotes(queries: any[] = [], limit: number = 100, options: { includeStories?: boolean; includeGhosts?: boolean } = {}) {
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
      Query.limit(limit),
      Query.orderDesc('$createdAt')
    ];

    const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, finalQueries);
    const notes = (res.rows as any[]).map((doc: any) => hydrateVirtualAttributes(doc)) as unknown as Notes[];

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
    if (!options.includeGhosts) {
      filteredNotes = filteredNotes.filter((n: any) => !isGhostNote(n));
    }

    return { ...res, rows: filteredNotes };
  }, LIST_TTL);
}



export async function createTag(data: Partial<Tags & { isPublic?: boolean; isGuest?: boolean }>, jwt?: string) {
  if (typeof window !== 'undefined') {
    const { createRow } = await import('@/lib/actions/client-ops');
    
    const name = data.name?.trim();
    if (!name) throw new Error("Tag name is required");

    const metadata = { color: data.color, description: data.description };
    const payload = {
      name,
      nameLower: name.toLowerCase(),
      metadata: JSON.stringify(metadata),
      isPublic: !!data.isPublic,
      isGuest: !!data.isGuest,
      usageCount: 0
    };

    const doc = await createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, payload);
    try {
      const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
      if (doc?.$id) autonomicSyncEngine.markPending(doc.$id);
    } catch {}
    invalidateCache('list:tags');
    return hydrateTagMetadata(doc as unknown as Tags);
  }

  const { createRowSecure } = await import('@/lib/actions/secure-ops');
  const name = data.name?.trim();
  if (!name) throw new Error("Tag name is required");

  const metadata = { color: data.color, description: data.description };
  const payload = {
    name,
    nameLower: name.toLowerCase(),
    metadata: JSON.stringify(metadata),
    isPublic: !!data.isPublic,
    isGuest: !!data.isGuest,
    usageCount: 0
  };

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
      isGuest: data.isGuest !== undefined ? !!data.isGuest : !!(existing as Tags & { isGuest?: boolean }).isGuest,
    };

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
    isGuest: data.isGuest !== undefined ? !!data.isGuest : !!(existing as Tags & { isGuest?: boolean }).isGuest,
  };

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

async function uploadFile(bucketId: string, file: File, userId?: string) {
  try {
    const user = userId ? { $id: userId } : await getCurrentUser();
    if (!user?.$id) {
      throw new Error('User not authenticated for file upload');
    }


    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucketId', bucketId);
    const { secureUploadFile } = await import('@/lib/actions/client-ops');
    const result = await secureUploadFile(formData);
    return result;
  } catch (e: any) {
    console.error('[uploadFile] error', {
      bucketId,
      fileName: (file as any)?.name,
      fileSize: (file as any)?.size,
      fileType: (file as any)?.type,
      message: e?.message,
      code: e?.code,
      statusCode: e?.statusCode,
      type: e?.type
    });
    throw e;
  }
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
    
    for (const doc of notesRes.rows as any[]) {
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
  userId?: string; // override current user (admin/future use)
  queries?: any[]; // additional custom queries (overrides userId logic if provided)
  hydrateTags?: boolean; // default true
  includeStories?: boolean;
  includeGhosts?: boolean;
}

export async function listNotesPaginated(options: ListNotesPaginatedOptions = {}) {
  const {
    limit = 50,
    cursor = null,
    userId,
    queries,
    hydrateTags = true,
    includeStories = false,
    includeGhosts = false} = options;

  let baseQueries: any[] = [];
  if (Array.isArray(queries) && queries.length) {
    baseQueries = [...queries];
  } else {
    // Optimization: avoid redundant account.get() if userId is provided
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const user = await getCurrentUser();
      effectiveUserId = user?.$id;
    }

    if (!effectiveUserId) {
      return { rows: [], total: 0, nextCursor: null, hasMore: false };
    }
    
    baseQueries = [
      Query.or([
        Query.equal('userId', effectiveUserId),
        Query.equal('creatorId', effectiveUserId),
      ])
    ];
  }

  const hasIsTrashFilter = baseQueries.some((q: any) => String(q).includes('isTrash'));

  const finalQueries: any[] = [
    ...baseQueries,
    Query.limit(limit),
    Query.orderDesc('$createdAt')];
  if (cursor) finalQueries.push(Query.cursorAfter(cursor));

  let res: any;
  try {
    res = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      finalQueries
    );
  } catch (err: any) {
    const isNetworkError = !err.status || err.code === 'network_error' || err.message?.includes('fetch') || err.message?.includes('NetworkError');
    if (isNetworkError && typeof window !== 'undefined') {
        console.log('[listNotesPaginated] Network error detected. Falling back to RxDB local notes...');
        let effectiveUserId = userId;
        if (!effectiveUserId) {
          const user = await getCurrentUser();
          effectiveUserId = user?.$id;
        }
        if (effectiveUserId) {
          const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
          const db = await getRxDB();
          const docs = await db.notes.find({
            selector: {
              userId: effectiveUserId,
              _deleted: { $ne: true }
            }
          }).exec();
          
          const sortedDocs = docs.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          
          const rows = sortedDocs.map((doc: any) => ({
            $id: doc.id,
            $createdAt: doc.updatedAt,
            $updatedAt: doc.updatedAt,
            title: doc.title,
            content: doc.content,
            format: 'text',
            tags: [],
            userId: doc.userId,
            isPublic: false,
            isGuest: false,
            metadata: doc.metadata || '{}',
          })).filter((doc: any) => includeGhosts || !isGhostNote(doc)) as any[];
          
          return {
            rows,
            total: rows.length,
            nextCursor: null,
            hasMore: false
          };
        }
    }
    throw err;
  }

  const notes = (res.rows as any[]).map((doc: any) => hydrateVirtualAttributes(doc)) as unknown as Notes[];

  if (hydrateTags && notes.length) {
    try {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const noteIds = notes.map((n: any) => n.$id || (n as any).id).filter(Boolean);
      if (noteIds.length) {
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
    } catch {/* non-fatal */}
  }

  let filteredNotes = notes;
  if (!hasIsTrashFilter) {
    filteredNotes = filteredNotes.filter((n) => (n as any).isTrash !== true);
  }
  if (!includeStories) {
    filteredNotes = filteredNotes.filter((n: any) => !(n as any).isStory);
  }
  if (!includeGhosts) {
    filteredNotes = filteredNotes.filter((n: any) => !isGhostNote(n));
  }

  const batchLength = filteredNotes.length;
  const hasMore = batchLength === limit; // heuristic
  const nextCursor = hasMore && batchLength ? (filteredNotes[batchLength - 1] as any).$id || null : null;

  return {
    rows: filteredNotes,
    total: typeof res.total === 'number' ? res.total : filteredNotes.length,
    nextCursor,
    hasMore};

}

// --- PERMISSIONS HELPERS ---

function isNotePublic(note: Notes): boolean {
  return note ? (note.isPublic === true || (note as any).isGuest === true) : false;
}

export function getNotePublicState(note: Notes): boolean {
  return note ? (note.isPublic === true || (note as any).isGuest === true) : false;
}

export function isNoteEditableByAnyone(note: Notes): boolean {
  if (!note) return false;
  const permissions = (note as any).$permissions as string[] | undefined;
  if (!permissions) return false;

  return permissions.some((permission) =>
    permission.includes('update("any")') ||
    permission.includes('update("guests")') ||
    permission.includes('update("role:all")')
  );
}

async function isNoteOwner(note: Notes): Promise<boolean> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return false;
  
  // Direct check against custom userId attribute (modern notes)
  if (note.userId === currentUser.$id) return true;
  
  // Fallback for notes where userId attribute is missing but $id matches current user
  if (note.$id === currentUser.$id) return true;

  // Fallback for legacy notes where userId attribute might be missing,
  // but the user clearly has administrative (delete/update) permission.
  if ((note as any).$permissions) {
    const permissions = (note as any).$permissions as string[];
    const userRole = `user:${currentUser.$id}`;
    return permissions.some(p => p.includes(userRole) && (p.includes('delete') || p.includes('update')));
  }
  
  return false;
}

export function getShareableUrl(noteId: string, key?: string): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URI || 'http://localhost:3000';
  return `${baseUrl}/idea/${noteId}${key ? `/${key}` : ''}`;
}

const publicNoteDecryptionKeyCache = new Map<string, string>();

function importUrlSafeAesKey(keyBase64: string): Promise<CryptoKey> {
  const normalized = keyBase64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const raw = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

function cachePublicNoteDecryptionKey(noteId: string, key: string) {
  publicNoteDecryptionKeyCache.set(noteId, key);
}

function getCachedPublicNoteDecryptionKey(noteId: string): string | null {
  return publicNoteDecryptionKeyCache.get(noteId) || null;
}
function toUrlSafeBase64(buffer: ArrayBuffer): string {
  const standardBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return standardBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function exportUrlSafeCryptoKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toUrlSafeBase64(raw);
}

async function getT4NoteKeyMapping(noteId: string, ownerId: string) {
  return await databases.listRows(
    APPWRITE_CONFIG.DATABASES.VAULT,
    'key_mapping',
    [
      Query.equal('resourceType', 'note'),
      Query.equal('resourceId', noteId),
      Query.equal('grantee', `user:${ownerId}`),
      Query.limit(1)] as any
  );
}

async function loadT4NoteKey(noteId: string, ownerId: string): Promise<CryptoKey> {
  const keyMappingRes = await getT4NoteKeyMapping(noteId, ownerId);

  const mapping = keyMappingRes.rows[0] as any;
  if (!mapping?.wrappedKey) {
    throw new Error('Missing encryption key mapping for this note');
  }

  // 1. Try Owner Flow: Direct MEK unwrap (fast, reliable)
  const mek = ecosystemSecurity.getMasterKey();
  if (mek) {
    try {
      const rawKey = await ecosystemSecurity.decryptBinaryWithKey(mapping.wrappedKey, mek, true);
      return await crypto.subtle.importKey(
        'raw',
        rawKey as any,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (_e) {
      // Fallback to ECDH
    }
  }

  // 2. Try Shared Flow: ECDH unwrap
  const ownerPublicKey = await ecosystemSecurity.ensureE2EIdentity(ownerId);
  if (!ownerPublicKey) {
    throw new Error('Failed to load owner public key');
  }
  return await ecosystemSecurity.unwrapKeyWithECDH(mapping.wrappedKey, ownerPublicKey);
}

export async function decryptPublicEncryptedNote(note: Notes, forceKeyRefresh = false): Promise<Notes | null> {
  try {
    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    if (meta.clientDecrypted) return note;

    const rawDek = note.dek || meta.dek;
    if (rawDek && (meta.encryptionVersion === 'T5' || !meta.encryptionVersion)) {
      if (!ecosystemSecurity.status.isUnlocked) {
        return note; // cannot decrypt locked note, leave as encrypted
      }
      try {
        const decryptedDekRaw = await ecosystemSecurity.decrypt(rawDek);
        const dekBase64 = (() => {
          try { return JSON.parse(decryptedDekRaw); } catch { return decryptedDekRaw; }
        })();
        const rawKey = base64ToBytes(dekBase64);
        const dek = await crypto.subtle.importKey(
          "raw",
          rawKey as any,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const decryptedTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || '', dek);
        const decryptedContent = await ecosystemSecurity.decryptWithKey(note.content || '', dek);
        activeNoteKeys.set(note.$id, dek);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
          title: decryptedTitle,
          content: decryptedContent,
        };
      } catch (err: any) {
        console.error('T5 decryption failed, attempting self-healing fallback:', err);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
        };
      }
    }

    if (!meta.isEncrypted || meta.encryptionVersion !== 'T4') return note;

    let keyBase64 = forceKeyRefresh ? null : getCachedPublicNoteDecryptionKey(note.$id);
    
    if (!keyBase64) {
      // Unwrapping logic: attempt MEK (owner) then public route
      const tryUnwrap = async () => {
          const mek = ecosystemSecurity.getMasterKey();
          if (mek) {
              try {
                  const currentUser = await getCurrentUser();
                  if (currentUser && (note.userId === currentUser.$id || (note as any).owner_id === currentUser.$id)) {
                      const keyMappingRes = await getT4NoteKeyMapping(note.$id, currentUser.$id);
                      const mapping = keyMappingRes.rows[0] as any;
                      if (mapping?.wrappedKey) {
                          const rawKey = await ecosystemSecurity.decryptBinaryWithKey(mapping.wrappedKey, mek, true);
                          return await exportUrlSafeCryptoKey(await crypto.subtle.importKey('raw', rawKey as any, { name: 'AES-GCM', length: 256 }, true, ['decrypt']));
                      }
                  }
              } catch (_e) { /* silent fallback */ }
          }
          return await getCurrentPublicNoteDecryptionKey(note.$id);
      };
      keyBase64 = await tryUnwrap();
    }

    if (!keyBase64) return null;

    const key = await importUrlSafeAesKey(keyBase64);
    let decryptedTitle = note.title || '';
    
    try {
      if (meta.encryptedTitle) {
        decryptedTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle, key, true);
      } else if (note.title === '🔒 Encrypted Note' || note.title?.includes('🔒')) {
        decryptedTitle = 'Untitled Note';
      }
    } catch (_err) {
      decryptedTitle = note.title || 'Untitled Note';
    }

    try {
        const decryptedContent = await ecosystemSecurity.decryptWithKey(note.content || '', key, true);
        cachePublicNoteDecryptionKey(note.$id, keyBase64);
        activeNoteKeys.set(note.$id, key);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
          title: decryptedTitle,
          content: decryptedContent,
        };
    } catch (err: any) {
        console.error('T4 decryption failed, attempting self-healing fallback:', err);
        cachePublicNoteDecryptionKey(note.$id, keyBase64);
        activeNoteKeys.set(note.$id, key);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
          title: decryptedTitle,
        };
    }
  } catch (_error) {
    return null;
  }
}


async function preparePublicNoteUpdate(
  note: Notes,
  ownerId: string,
  rotateLink: boolean
): Promise<{ updatePayload: Record<string, any>; decryptionKey: string }> {
  if (!ecosystemSecurity.status.isUnlocked) {
    throw new Error('VAULT_LOCKED');
  }

  const ownerPublicKey = await ecosystemSecurity.ensureE2EIdentity(ownerId);
  if (!ownerPublicKey) {
    throw new Error('Failed to load owner public key');
  }
  const existingMappings = await getT4NoteKeyMapping(note.$id, ownerId);
  const hasExistingKey = existingMappings.total > 0;
  let symmetricKey: CryptoKey;
  let decryptionKey: string;

  if (!rotateLink && hasExistingKey) {
    const mapping = existingMappings.rows[0] as any;
    symmetricKey = await ecosystemSecurity.unwrapKeyWithECDH(mapping.wrappedKey, ownerPublicKey);
    decryptionKey = await exportUrlSafeCryptoKey(symmetricKey);
  } else {
    symmetricKey = await ecosystemSecurity.generateRandomMEK();
    decryptionKey = await exportUrlSafeCryptoKey(symmetricKey);
    
    // Wrap for owner using MEK (high-fidelity flow)
    const mek = ecosystemSecurity.getMasterKey();
    let wrappedKey: string;
    if (mek) {
        const rawSymmetric = await crypto.subtle.exportKey('raw', symmetricKey);
        wrappedKey = await ecosystemSecurity.encryptBinaryWithKey(new Uint8Array(rawSymmetric), mek);
    } else {
        // Fallback to ECDH
        wrappedKey = await ecosystemSecurity.wrapKeyWithECDH(symmetricKey, ownerPublicKey);
    }

    const mappingData = {
      resourceId: note.$id,
      resourceType: 'note',
      grantee: `user:${ownerId}`,
      wrappedKey,
      metadata: JSON.stringify({ algorithm: 'AES-GCM', version: 'T4' })
    };
    const mappingPermissions = [
      Permission.read(Role.user(ownerId))];

    if (hasExistingKey) {
      await databases.updateRow(
        APPWRITE_CONFIG.DATABASES.VAULT,
        'key_mapping',
        (existingMappings.rows[0] as any).$id,
        mappingData,
        mappingPermissions
      );
    } else {
      await databases.createRow(
        APPWRITE_CONFIG.DATABASES.VAULT,
        'key_mapping',
        ID.unique(),
        mappingData,
        mappingPermissions
      );
    }
  }

  let meta: Record<string, any> = {};
  try { meta = JSON.parse(note.metadata || '{}'); } catch {}

  let sourceTitle = note.title || '';
  let sourceContent = note.content || '';
  const shouldDecryptSource = note.isPublic || rotateLink || meta.isEncrypted || meta.encryptionVersion === 'T4';
  if (shouldDecryptSource) {
    if (!hasExistingKey) {
      throw new Error('Missing encryption key mapping for this note');
    }
    const existingKey = await loadT4NoteKey(note.$id, ownerId);
    sourceTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || note.title || '', existingKey);
    sourceContent = await ecosystemSecurity.decryptWithKey(note.content || '', existingKey);
  }

  const encryptedTitle = await ecosystemSecurity.encryptWithKey(sourceTitle, symmetricKey);
  const encryptedContent = await ecosystemSecurity.encryptWithKey(sourceContent, symmetricKey);

  return {
    decryptionKey,
    updatePayload: {
      isPublic: true,
      updatedAt: new Date().toISOString(),
      userId: ownerId,
      id: note.$id,
      title: '🔒 Encrypted Note',
      content: encryptedContent,
      metadata: JSON.stringify({
        ...meta,
        isGhost: false,
        isEncrypted: true,
        encryptionVersion: 'T4',
        encryptedTitle
      })
    }
  };
}

async function syncNoteVisibilityChildren(noteId: string, ownerId: string, isPublic: boolean) {
  try {
    const commentsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_COMMENTS,
      [Query.equal('noteId', noteId), Query.limit(1000)] as any
    );
    const commentDocs = commentsRes.rows as any[];
    const commentIds = commentDocs.map((c: any) => c.$id).filter(Boolean);

    await Promise.all(
      commentDocs.map(async (comment) => {
        const permissions = [
          Permission.read(Role.user(ownerId)),
          ...(isPublic ? [Permission.read(Role.any())] : [])];
        try {
          await databases.updateRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_TABLE_ID_COMMENTS,
            comment.$id,
            { content: comment.content },
            permissions
          );
        } catch (err: any) {
          console.error('syncNoteVisibilityChildren comment update failed:', err);
        }
      })
    );

    const noteReactionsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_REACTIONS,
      [
        Query.equal('targetType', TargetType.NOTE),
        Query.equal('targetId', noteId),
        Query.limit(1000)
      ] as any
    );

    await Promise.all(
      (noteReactionsRes.rows as any[]).map(async (reaction) => {
        const permissions = [
          Permission.read(Role.user(ownerId)),
          ...(isPublic ? [Permission.read(Role.any())] : [])];
        try {
          await databases.updateRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_TABLE_ID_REACTIONS,
            reaction.$id,
            { emoji: reaction.emoji },
            permissions
          );
        } catch (err: any) {
          console.error('syncNoteVisibilityChildren note reaction update failed:', err);
        }
      })
    );

    if (commentIds.length) {
      const commentReactionsRes = await databases.listRows(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_REACTIONS,
        [
          Query.equal('targetType', TargetType.COMMENT),
          Query.equal('targetId', commentIds),
          Query.limit(Math.min(1000, Math.max(50, commentIds.length * 10)))
        ] as any
      );

      await Promise.all(
        (commentReactionsRes.rows as any[]).map(async (reaction) => {
          const permissions = [
            Permission.read(Role.user(ownerId)),
            ...(isPublic ? [Permission.read(Role.any())] : [])];
          try {
            await databases.updateRow(
              APPWRITE_DATABASE_ID,
              APPWRITE_TABLE_ID_REACTIONS,
              reaction.$id,
              { emoji: reaction.emoji },
              permissions
            );
          } catch (err: any) {
            console.error('syncNoteVisibilityChildren comment reaction update failed:', err);
          }
        })
      );
    }
  } catch (err: any) {
    console.error('syncNoteVisibilityChildren failed:', err);
  }
}

export async function toggleNoteVisibility(noteId: string): Promise<(Notes & { decryptionKey?: string }) | null> {
  try {
    const note = await getNote(noteId);
    if (!(await isNoteOwner(note))) throw new Error('Permission denied');
    
    const newIsPublic = !getNotePublicState(note);
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');

    const ownerId = note.userId || currentUser.$id;
    let decryptionKey: string | undefined = undefined;
    const updatePayload: any = { 
        isPublic: newIsPublic, 
        updatedAt: new Date().toISOString(),
        userId: ownerId,
        id: note.$id
    };

    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    // Wipe off metadata dirt for public access, leaving metadata only for collaborators
    const cleanMeta: Record<string, any> = {};
    if (meta.collaborators) {
      cleanMeta.collaborators = meta.collaborators;
    }

    if (newIsPublic) {
        // Disable encrypting public note process!
        // We do NOT encrypt the note. We keep title and content in plaintext.
        updatePayload.metadata = JSON.stringify(cleanMeta);
        if (note.title) updatePayload.title = note.title;
        if (note.content) updatePayload.content = note.content;
    } else {
        // Toggle back to private
        // If it was encrypted historically, try to decrypt it to restore plaintext.
        if (meta.isEncrypted || meta.encryptionVersion === 'T4') {
          try {
            if (ecosystemSecurity.status.isUnlocked) {
              const symmetricKey = await loadT4NoteKey(note.$id, ownerId);
              const plaintextTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || '', symmetricKey);
              const plaintextContent = await ecosystemSecurity.decryptWithKey(note.content || '', symmetricKey);

              updatePayload.title = plaintextTitle;
              updatePayload.content = plaintextContent;
            }
          } catch (decErr) {
            console.error('Historical decryption failed on making private:', decErr);
          }
        }

        updatePayload.metadata = JSON.stringify(cleanMeta);
    }

    const permissions = [
      Permission.read(Role.user(ownerId))];
    if (newIsPublic) {
      permissions.push(Permission.read(Role.any()));
    }

    const updated = await databases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      noteId,
      filterNoteData(updatePayload),
      permissions
    );
    await syncNoteVisibilityChildren(noteId, ownerId, newIsPublic);
    
    return { ...(updated as unknown as Notes), decryptionKey };
  } catch (error: any) {
    console.error('toggleNoteVisibility error:', error);
    throw error;
  }
}

export async function rotatePublicNoteLink(noteId: string): Promise<(Notes & { decryptionKey?: string }) | null> {
  try {
    const note = await getNote(noteId);
    if (!(await isNoteOwner(note))) throw new Error('Permission denied');
    if (!isNotePublic(note)) throw new Error('Note must be public before rotating its link');

    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    if (!(meta.isEncrypted || meta.encryptionVersion === 'T4')) {
      // Plaintext public notes do not use E2E keys, link rotation is a no-op
      return { ...(note as unknown as Notes) };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');

    const ownerId = note.userId || currentUser.$id;
    const prepared = await preparePublicNoteUpdate(note, ownerId, true);
    const permissions = [
      Permission.read(Role.user(ownerId)),
      Permission.read(Role.any())
    ];

    const updated = await databases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      noteId,
      filterNoteData(prepared.updatePayload),
      permissions
    );
    await syncNoteVisibilityChildren(noteId, ownerId, true);
    if (prepared.decryptionKey) cachePublicNoteDecryptionKey(noteId, prepared.decryptionKey);
    return { ...(updated as unknown as Notes), decryptionKey: prepared.decryptionKey };
  } catch (error: any) {
    console.error('rotatePublicNoteLink error:', error);
    throw error;
  }
}

export async function getCurrentPublicNoteShareUrl(noteId: string, note?: Notes): Promise<string | null> {
  try {
    const liveNote = note || await getNote(noteId);
    if (!isNotePublic(liveNote)) return null;

    const meta = (() => {
      try { return JSON.parse(liveNote.metadata || '{}'); } catch { return {}; }
    })();

    if (meta.isEncrypted || meta.encryptionVersion === 'T4') {
      const currentUser = await getCurrentUser();
      if (!currentUser) { return null; }

      const ownerId = liveNote.userId || currentUser.$id;
      const key = await loadT4NoteKey(liveNote.$id, ownerId);
      const exportedKey = await exportUrlSafeCryptoKey(key);
      
      return getShareableUrl(liveNote.$id, exportedKey);
    }

    return getShareableUrl(liveNote.$id);
  } catch (error) {
    console.error('getCurrentPublicNoteShareUrl error:', error);
    return null;
  }
}

async function getCurrentPublicNoteDecryptionKey(noteId: string): Promise<string | null> {
  try {
    const cachedKey = getCachedPublicNoteDecryptionKey(noteId);
    if (cachedKey) return cachedKey;

    const note = await getNote(noteId);
    if (!isNotePublic(note)) return null;

    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    if (!(meta.isEncrypted || meta.encryptionVersion === 'T4')) {
      return null;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) { return null; }
    
    const ownerId = note.userId || currentUser.$id;
    const key = await loadT4NoteKey(noteId, ownerId);
    const exported = await exportUrlSafeCryptoKey(key);
    cachePublicNoteDecryptionKey(noteId, exported);
    return exported;
  } catch (error) {
    console.error('getCurrentPublicNoteDecryptionKey error:', error);
    return null;
  }
}

export async function validatePublicNoteAccess(noteId: string): Promise<Notes | null> {
  try {
    if (typeof window === 'undefined') {
      const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
      const tables = createSystemTablesDB();
      
      const doc = await tables.getRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_NOTES,
        noteId
      ) as any;
      
      // Safety check: isPublic or isGuest MUST be true
      if (doc && (doc.isPublic === true || doc.isGuest === true)) {
        hydrateVirtualAttributes(doc);
        try {
          const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
          const pivot = await tables.listRows(
            APPWRITE_DATABASE_ID,
            noteTagsTable,
            [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any
          );
          if (pivot.rows.length) {
            const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
            doc.tags = tags;
          }
        } catch (_e) {
          // Non-fatal
        }
        if (!doc.attachments || !Array.isArray(doc.attachments)) {
          doc.attachments = [];
        }
        return doc as Notes;
      }
      return null;
    }
    
    // Fallback/Legacy client-side logic
    const note = await getNote(noteId);
    if (!isNotePublic(note)) return null;
    return note;
  } catch (err: any) {
    console.error(`validatePublicNoteAccess failed for ${noteId}:`, err);
    return null;
  }
}
export async function listFlowTasks(queries: any[] = []) {
  return databases.listRows(FLOW_DATABASE_ID, FLOW_TABLE_ID_TASKS, queries);
}

export async function listFlowEvents(queries: any[] = []) {
  return databases.listRows(FLOW_DATABASE_ID, FLOW_TABLE_ID_EVENTS, queries);
}

export async function listKeepCredentials(queries: any[] = []) {
  return databases.listRows(KEEP_DATABASE_ID, KEEP_TABLE_ID_CREDENTIALS, queries);
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(atob(value).split("").map((char: any) => char.charCodeAt(0)));
}

