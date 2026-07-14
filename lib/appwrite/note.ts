import { ID, Query, Permission, Role, OAuthProvider } from 'appwrite';
import { account, databases, storage, functions, realtime, client, getCurrentUser, invalidateCurrentUserCache } from './client';
import { AppwriteService } from './auth';
import type {
  Users,
  Notes,
  Tags,
  ApiKeys,
  Comments,
  Extensions,
  Reactions,
  Collaborators,
  ActivityLog,
  Settings,
} from '@/types/appwrite';
import { TargetType } from '@/types/appwrite';
// Removed static import of secure-ops to prevent Next.js isomorphic bundling errors.

import { APPWRITE_CONFIG } from './config';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { sendKylrixEmailNotification } from '@/lib/email-notifications';
import { createNoteCreationService } from '@/lib/sdk';
import { buildAutoTitleFromContent, clampNoteTitle } from '@/constants/noteTitle';
import { buildSourceNoteTags } from '@/lib/sdk/crosslinks';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { invalidateTablesDbRowCache } from '@/lib/ecosystem/tablesdb-row-cache';
import { publishNexusInvalidate } from '@/lib/ecosystem/nexus-bridge';
export const APPWRITE_ENDPOINT = APPWRITE_CONFIG.ENDPOINT;
export const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

export const activeNoteKeys = new Map<string, CryptoKey>();

// export app public uri
 export const APP_URI = process.env.NEXT_PUBLIC_APP_URI ?? `https://app.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;

// NOTE database ID (internal, not exported to avoid conflict with vault's APPWRITE_DATABASE_ID)
const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;

// Appwrite config IDs from constants
export const APPWRITE_TABLE_ID_PROFILES = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const APPWRITE_TABLE_ID_USERS = APPWRITE_TABLE_ID_PROFILES; // legacy alias
export const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
export const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
export const APPWRITE_TABLE_ID_APIKEYS = APPWRITE_CONFIG.TABLES.NOTE.APIKEYS;
export const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
export const APPWRITE_TABLE_ID_EXTENSIONS = APPWRITE_CONFIG.TABLES.NOTE.EXTENSIONS;
export const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
export const APPWRITE_TABLE_ID_COLLABORATORS = APPWRITE_CONFIG.TABLES.NOTE.COLLABORATORS;
export const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
export const APPWRITE_TABLE_ID_ACTIVITYLOG = APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG;
export const APPWRITE_TABLE_ID_SETTINGS = APPWRITE_CONFIG.TABLES.NOTE.SETTINGS;
export const APPWRITE_TABLE_ID_SUBSCRIPTIONS = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
export const APPWRITE_TABLE_ID_NOTETAGS = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS;

// Ecosystem: Kylrix Flow
const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
export const FLOW_TABLE_ID_TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
export const FLOW_TABLE_ID_EVENTS = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;

// Ecosystem: Kylrix Vault
export const KEEP_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const KEEP_TABLE_ID_CREDENTIALS = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const KEEP_TABLE_ID_KEYCHAIN = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;
export const APPWRITE_BUCKET_NOTES_ATTACHMENTS = APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;
export const APPWRITE_BUCKET_EXTENSION_ASSETS = APPWRITE_CONFIG.BUCKETS.EXTENSION_ASSETS;
export const APPWRITE_BUCKET_BACKUPS = APPWRITE_CONFIG.BUCKETS.BACKUPS;
export const APPWRITE_BUCKET_TEMP_UPLOADS = APPWRITE_CONFIG.BUCKETS.TEMP_UPLOADS;
export const CONNECT_TABLE_ID_MOMENTS = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;

// Removed redundant exports to prevent ES6 module naming collisions with client.ts
export { ID, Query, Permission, Role, OAuthProvider };

type PermissionUpdateAction = 'grant' | 'revoke';
type NoteCollaboratorPermission = 'read' | 'write' | 'admin';

async function updateNoteAccessForUser(
  noteId: string,
  targetUserId: string,
  permission: NoteCollaboratorPermission,
  action: PermissionUpdateAction = 'grant'
) {
  const { mutatePermissionsSecure, revokePermissionsSecure } = await import('@/lib/actions/secure-ops');
  const jwt = await account.createJWT();
  const payload = {
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    rowId: noteId,
    targetUserIds: [targetUserId],
    permission,
    action,
  };

  if (action === 'grant') {
    return mutatePermissionsSecure(payload, jwt.jwt);
  } else {
    return revokePermissionsSecure(payload, targetUserId, jwt.jwt);
  }
}

async function notifyNoteShare(params: {
  noteId: string;
  noteTitle: string;
  actorName: string;
  recipientId: string;
  permission: NoteCollaboratorPermission;
}) {
  await sendKylrixEmailNotification({
    eventType: 'note_collaborator_added',
    sourceApp: 'note',
    verificationMode: 'error',
    actorName: params.actorName,
    recipientIds: [params.recipientId],
    resourceId: params.noteId,
    resourceTitle: params.noteTitle,
    resourceType: 'note',
    rightsLabel: params.permission,
    templateKey: 'note:collaborator-added',
    ctaUrl: `${APP_URI}/notes/${params.noteId}`,
    ctaText: 'Open note',
  });
}


import { fetchOptimized, invalidateCache } from '@/lib/ecosystem/nexus-fetcher';

const LIST_TTL = 1000 * 60 * 15; // 15 mins
const DOC_TTL = 1000 * 60 * 60;  // 1 hour

const noteRowClientCache = new Map<string, { payload: Notes; at: number }>();
const noteRowClientInflight = new Map<string, Promise<Notes>>();
const NOTE_ROW_CLIENT_TTL_MS = 1000 * 60 * 5; // 5 minutes

const queryCache = new Map<string, { data: any; expiresAt: number }>();
function isCacheExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

function getCacheKey(...args: any[]): string {
  return args.join(':');
}

function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (isCacheExpired(entry.expiresAt)) {
    queryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached(key: string, data: any, ttlMs: number = LIST_TTL) {
  queryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
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
    rowId: noteId,
  });
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
    const now = Date.now();
    for (const [key, entry] of queryCache.entries()) {
      if (isCacheExpired(entry.expiresAt)) {
        queryCache.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

function cleanRowData<T>(data: Partial<T>): Record<string, unknown> {
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
 * Safe classification helper for identifying ghost notes.
 * Supports direct column value, metadata fallback, and legacy userless fallback.
 */
export function isGhostNote(note: any): boolean {
  if (!note) return false;
  // 1. Direct Column Check
  if (note.isGhost !== undefined && note.isGhost !== null) {
    return !!note.isGhost;
  }
  // 2. Legacy Metadata Fallback
  if (note.metadata) {
    try {
      const parsed = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
      if (parsed && typeof parsed === 'object' && parsed.isGhost !== undefined) {
        return !!parsed.isGhost;
      }
    } catch {}
  }
  // 3. Userless Fallback (Ghost notes used to use null/empty userId)
  return !note.userId;
}

/**
 * Filter note data to only include keys supported by the Appwrite table schema.
 * This prevents "invalid row structure" errors when sending extra client-side fields.
 * Matches the types in src/types/appwrite.d.ts
 */
function hydrateVirtualAttributes(doc: any): any {
  if (doc.metadata) {
    try {
      const extra = JSON.parse(doc.metadata);
      if (extra && typeof extra === 'object') {
        Object.keys(extra).forEach(key => {
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

/**
 * Atomic helper to generate standard note permissions.
 * Standardizes visibility across creation and updates.
 */
function getNotePermissions(userId: string, isPublic: boolean) {
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
]);

const NOTE_UPDATE_FIELD_KEYS = [
  'title',
  'content',
  'format',
  'tags',
  'isPublic',
  'metadata',
  'kind',
] as const;

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

export function pickNoteUpdatePayload(
  data: Partial<Notes> & Record<string, unknown>,
  options?: { includeVisibility?: boolean; includeMetadata?: boolean }
): Partial<Notes> {
  const payload: Record<string, unknown> = {};

  if (data.title !== undefined) {
    payload.title = clampNoteTitle(data.title);
  }
  if (data.content !== undefined) {
    payload.content = data.content;
  }
  if (data.format !== undefined) {
    payload.format = 'text';
  }
  if (data.tags !== undefined) {
    payload.tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  }
  if (options?.includeVisibility && typeof data.isPublic === 'boolean') {
    payload.isPublic = data.isPublic;
  }
  if (options?.includeMetadata && data.metadata !== undefined) {
    payload.metadata = data.metadata;
  }
  if (data.kind !== undefined) {
    payload.kind = data.kind;
  }

  return payload as Partial<Notes>;
}

/** Matches the create-note drawer write shape — never sends hydrated row baggage. */
export function pickNoteAutosavePayload(data: {
  title?: string | null;
  content?: string | null;
  format?: string | null;
  tags?: string[] | null;
}): Partial<Notes> {
  const content = data.content ?? '';
  const trimmedTitle = clampNoteTitle(data.title);

  return {
    title: trimmedTitle || buildAutoTitleFromContent(content) || 'Untitled Thought',
    content,
    format: data.format || 'markdown',
    tags: Array.isArray(data.tags) ? data.tags.filter(Boolean) : [],
  };
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

function filterNoteData(data: Record<string, any>): Record<string, any> {
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

/**
 * Helper to extract user IDs from Appwrite row permissions.
 * Useful for identifying collaborators directly from row metadata.
 */
export function extractUserIdsFromPermissions(permissions: string[]): string[] {
  const userIds = new Set<string>();
  // Match read("user:ID"), update("user:ID"), etc.
  const regex = /user:([a-zA-Z0-9_-]+)/;
  
  permissions.forEach(p => {
    const match = p.match(regex);
    if (match && match[1]) {
      userIds.add(match[1]);
    }
  });
  
  return Array.from(userIds);
}

export async function createUser(data: Partial<Users>) {
  const userData = {
    ...cleanRowData(data),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return databases.createRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    data.id || ID.unique(),
    userData
  );
}

export async function getUser(userId: string): Promise<Users> {
  return databases.getRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId
  ) as unknown as Promise<Users>;
}

export async function updateUser(userId: string, data: Partial<Users>) {
  return databases.updateRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId,
    cleanRowData(data)
  );
}

export async function deleteUser(userId: string) {
  return databases.deleteRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId
  );
}

export async function listUsers(queries: any[] = []) {
  const res = await databases.listRows(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    queries
  );
  return { ...res, rows: res.rows };
}

export async function getUserByUsername(username: string): Promise<Users | null> {
  const res = await databases.listRows(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    [Query.equal('username', username), Query.limit(1)]
  );
  return (res.rows[0] as unknown as Users) || null;
}

export async function getUsersByIds(userIds: string[]): Promise<Users[]> {
  if (userIds.length === 0) return [];
  const res = await databases.listRows(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    [Query.equal('$id', userIds)]
  );
  return res.rows as unknown as Users[];
}

// Search users by partial name or email with privacy constraints
export async function searchUsers(query: string, limit: number = 5) {
  try {
    if (!query.trim()) return [];

    const isEmail = /@/.test(query) && /\./.test(query);

    const queries: any[] = [Query.limit(limit)];

    if (isEmail) {
      // Exact email match only
      queries.push(Query.equal('email', query.toLowerCase()));
    } else {
      // Name search
      queries.push(Query.equal('name', query));
      // Only include users who have explicitly made their profile public
      queries.push(Query.equal('publicProfile', true));
    }

    const res = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_USERS,
      queries
    );

    return res.rows.map((doc: any) => ({
      id: doc.id || doc.$id,
      name: doc.name,
      email: isEmail ? doc.email : undefined,
      avatar: doc.profilePicId || (doc.prefs && (doc.prefs as any).profilePicId) || doc.avatar || null
    }));
  } catch (error: any) {
    console.error('searchUsers error:', error);
    return [];
  }
}

// --- EMAIL VERIFICATION ---

export async function sendEmailVerification(redirectUrl: string) {
  return account.createVerification(redirectUrl);
}

export async function completeEmailVerification(userId: string, secret: string) {
  return account.updateVerification(userId, secret);
}

export async function getEmailVerificationStatus(): Promise<boolean> {
  try {
    const user = await account.get();
    return !!user.emailVerification;
  } catch {
    return false;
  }
}

// --- PINNED NOTES ---

/** Owner row pins + per-user collaborator pins from user_resource_pins. */
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
      res.rows.forEach((row) => ids.add(row.$id));
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
  const pinSet = new Set(pinRows.map((row) => row.resourceId));
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

export async function pinNote(noteId: string): Promise<string[]> {
  return setNotePinned(noteId, true);
}

export async function unpinNote(noteId: string): Promise<string[]> {
  return setNotePinned(noteId, false);
}

export async function isNotePinned(noteId: string): Promise<boolean> {
  const pinnedIds = await getPinnedNoteIds();
  return pinnedIds.includes(noteId);
}

// --- PASSWORD RESET ---

export async function sendPasswordResetEmail(email: string, redirectUrl: string) {
  return account.createRecovery(email, redirectUrl);
}

export async function completePasswordReset(userId: string, secret: string, password: string) {
  return account.updateRecovery(userId, secret, password);
}

// --- NOTES CRUD ---

async function syncTagsForCreatedNote(noteId: string, rawTags: string[], userId: string, now: string) {
  try {
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const tagsTable = APPWRITE_TABLE_ID_TAGS;
    const unique = Array.from(new Set(rawTags.map((tag) => tag.trim()))).filter(Boolean);
    if (!unique.length) return;

    const existingTagDocs: Record<string, any> = {};
    try {
      const existingTagsRes = await databases.listRows(
        APPWRITE_DATABASE_ID,
        tagsTable,
        [Query.equal('userId', userId), Query.equal('nameLower', unique.map((tag) => tag.toLowerCase())), Query.limit(unique.length)] as any
      );
      for (const td of existingTagsRes.rows as any[]) {
        if (td.nameLower) existingTagDocs[td.nameLower] = td;
      }
    } catch (tagListErr) {
      console.error('tag preload failed', tagListErr);
    }

    for (const tagName of unique) {
      const key = tagName.toLowerCase();
      if (!existingTagDocs[key]) {
        try {
          const created = await databases.createRow(
            APPWRITE_DATABASE_ID,
            tagsTable,
            ID.unique(),
            { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 }
          );
          existingTagDocs[key] = created;
        } catch (createTagErr: any) {
          try {
            const retry = await databases.listRows(
              APPWRITE_DATABASE_ID,
              tagsTable,
              [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any
            );
            if (retry.rows.length) existingTagDocs[key] = retry.rows[0];
          } catch {}
        }
      }
    }

    const existingPivot = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any
    );
    const existingPairs = new Set(existingPivot.rows.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
    for (const tagName of unique) {
      const key = tagName.toLowerCase();
      const tagDoc = existingTagDocs[key];
      const tagId = tagDoc ? (tagDoc.$id || tagDoc.id) : undefined;
      if (!tagId) continue;
      const pairKey = `${tagId}::${tagName}`;
      adjustTagUsage(userId, tagName, 1);
      if (existingPairs.has(pairKey)) continue;
      try {
        await databases.createRow(
          APPWRITE_DATABASE_ID,
          noteTagsTable,
          ID.unique(),
          { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId, createdAt: now }
        );
      } catch (e: any) {
        console.error('note_tags create failed', e?.message || e);
      }
    }
  } catch (e: any) {
    console.error('dual-write note_tags error', e);
  }
}

const noteCreationService = createNoteCreationService({
  databaseId: APPWRITE_DATABASE_ID,
  tableId: APPWRITE_TABLE_ID_NOTES,
  generateId: () => ID.unique(),
  getCurrentUser,
  createRow: async (databaseId, tableId, data, rowId, permissions) => {
    return databases.createRow(databaseId, tableId, rowId || ID.unique(), data as any, permissions) as any;
  },
  getNote,
  getNotePermissions,
  cleanRowData,
  filterNoteData,
  syncTags: async ({ noteId, rawTags, userId, now }) => {
    await syncTagsForCreatedNote(noteId, rawTags, userId, now);
  },
});

export { createNoteCreationService, cleanRowData, filterNoteData, getNotePermissions };
export default AppwriteService;

export async function createNote(data: Partial<Notes>, jwt?: string) {
  if (typeof window !== 'undefined') {
    const isOffline = !window.navigator.onLine;
    if (isOffline) {
      console.log('[createNote] Offline. Saving note as a ghost note...');
      const secret = localStorage.getItem('kylrix_ghost_secret_v2') || crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const deletionSecret = crypto.randomUUID();
      const { sha256HexUtf8 } = await import('@/lib/crypto/sha256-hex');
      const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);
      
      const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
      const { encrypted: encTitle, key: noteKey } = await encryptGhostData(data.title || 'Untitled Thought');
      const { encrypted: encContent } = await encryptGhostData(data.content || '', noteKey);

      const id = data.$id || `ghost-${crypto.randomUUID()}`;
      
      const saved = {
        $id: id,
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: data.title || 'Untitled Thought',
        content: data.content || '',
        format: 'text',
        tags: data.tags || [],
        userId: 'ghost',
        isPublic: false,
        isGuest: false,
        metadata: JSON.stringify({
          isGhost: true,
          ghostSecret: secret,
          expiresAt,
          isEncrypted: true,
          creatorDeletionProofHash,
          send_object: { kind: 'note' }
        }),
      } as any;

      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      if (!Array.isArray(history)) history = [];

      const existingIndex = history.findIndex((n: any) => n.id === id);
      const newRef = {
        id,
        title: encTitle,
        content: encContent,
        metadata: saved.metadata,
        createdAt: new Date().toISOString(),
        expiresAt,
        decryptionKey: noteKey,
        deletionSecret,
      };

      if (existingIndex !== -1) {
        history[existingIndex] = newRef;
      } else {
        history.unshift(newRef);
      }

      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
      window.dispatchEvent(new Event('storage'));
      return saved;
    }

    try {
      const { createNote } = await import('@/lib/actions/client-ops');
      return await createNote(data);
    } catch (err: any) {
      const isNetworkError = !err.status || err.code === 'network_error' || err.message?.includes('fetch') || err.message?.includes('NetworkError');
      if (isNetworkError) {
        console.log('[createNote] Network error. Saving note as a ghost note...');
        const secret = localStorage.getItem('kylrix_ghost_secret_v2') || crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const deletionSecret = crypto.randomUUID();
        const { sha256HexUtf8 } = await import('@/lib/crypto/sha256-hex');
        const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);
        
        const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        const { encrypted: encTitle, key: noteKey } = await encryptGhostData(data.title || 'Untitled Thought');
        const { encrypted: encContent } = await encryptGhostData(data.content || '', noteKey);

        const id = data.$id || `ghost-${crypto.randomUUID()}`;
        
        const saved = {
          $id: id,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
          title: data.title || 'Untitled Thought',
          content: data.content || '',
          format: 'text',
          tags: data.tags || [],
          userId: 'ghost',
          isPublic: false,
          isGuest: false,
          metadata: JSON.stringify({
            isGhost: true,
            ghostSecret: secret,
            expiresAt,
            isEncrypted: true,
            creatorDeletionProofHash,
            send_object: { kind: 'note' }
          }),
        } as any;

        const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
        let history = historyRaw ? JSON.parse(historyRaw) : [];
        if (!Array.isArray(history)) history = [];

        const existingIndex = history.findIndex((n: any) => n.id === id);
        const newRef = {
          id,
          title: encTitle,
          content: encContent,
          metadata: saved.metadata,
          createdAt: new Date().toISOString(),
          expiresAt,
          decryptionKey: noteKey,
          deletionSecret,
        };

        if (existingIndex !== -1) {
          history[existingIndex] = newRef;
        } else {
          history.unshift(newRef);
        }

        localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
        window.dispatchEvent(new Event('storage'));
        return saved;
      }
      throw err;
    }
  }
  const { createNoteSecure } = await import('@/lib/actions/secure-ops');
  return createNoteSecure(data, jwt);
}


export async function createMomentFromNote(note: Pick<Notes, '$id'>) {
  if (typeof window !== 'undefined') {
    const { sharePublicNoteAsMoment } = await import('@/lib/actions/client-ops');
    return sharePublicNoteAsMoment(note.$id);
  }
  const { sharePublicNoteAsMomentSecure } = await import('@/lib/actions/secure-ops');
  return sharePublicNoteAsMomentSecure({ noteId: note.$id });
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
          deletionSecret: match.deletionSecret,
        };
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
    
    const isOffline = !window.navigator.onLine;
    if (isOffline) {
      console.log('[updateNote] Offline. Saving note update as a ghost note...');
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      if (!Array.isArray(history)) history = [];

      const index = history.findIndex((n: any) => n.id === noteId);
      
      const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
      const noteKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      
      const { encrypted: encTitle } = await encryptGhostData(data.title || 'Untitled Thought', noteKey);
      const { encrypted: encContent } = await encryptGhostData(data.content || '', noteKey);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const deletionSecret = crypto.randomUUID();

      const newRef = {
        id: noteId,
        title: encTitle,
        content: encContent,
        metadata: JSON.stringify({
          isGhost: true,
          expiresAt,
          isEncrypted: true,
          send_object: { kind: 'note' }
        }),
        createdAt: new Date().toISOString(),
        expiresAt,
        decryptionKey: noteKey,
        deletionSecret,
      };

      if (index !== -1) {
        history[index] = newRef;
      } else {
        history.unshift(newRef);
      }

      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
      window.dispatchEvent(new Event('storage'));

      return {
        $id: noteId,
        $createdAt: new Date().toISOString(),
        $updatedAt: new Date().toISOString(),
        title: data.title || 'Untitled Thought',
        content: data.content || '',
        format: 'text',
        tags: data.tags || [],
        userId: 'ghost',
        isPublic: false,
        isGuest: false,
        metadata: newRef.metadata,
      } as any;
    }

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

    try {
      const { updateNote } = await import('@/lib/actions/client-ops');
      const result = await updateNote(noteId, data);
      invalidateNoteRowClientCache(noteId);
      return result as Notes;
    } catch (err: any) {
      const isNetworkError = !err.status || err.code === 'network_error' || err.message?.includes('fetch') || err.message?.includes('NetworkError');
      if (isNetworkError) {
        console.log('[updateNote] Network error. Saving note update as a ghost note...');
        const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
        let history = historyRaw ? JSON.parse(historyRaw) : [];
        if (!Array.isArray(history)) history = [];

        const index = history.findIndex((n: any) => n.id === noteId);
        
        const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
        const noteKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
        
        const { encrypted: encTitle } = await encryptGhostData(data.title || 'Untitled Thought', noteKey);
        const { encrypted: encContent } = await encryptGhostData(data.content || '', noteKey);

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const deletionSecret = crypto.randomUUID();

        const newRef = {
          id: noteId,
          title: encTitle,
          content: encContent,
          metadata: JSON.stringify({
            isGhost: true,
            expiresAt,
            isEncrypted: true,
            send_object: { kind: 'note' }
          }),
          createdAt: new Date().toISOString(),
          expiresAt,
          decryptionKey: noteKey,
          deletionSecret,
        };

        if (index !== -1) {
          history[index] = newRef;
        } else {
          history.unshift(newRef);
        }

        localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
        window.dispatchEvent(new Event('storage'));

        return {
          $id: noteId,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
          title: data.title || 'Untitled Thought',
          content: data.content || '',
          format: 'text',
          tags: data.tags || [],
          userId: 'ghost',
          isPublic: false,
          isGuest: false,
          metadata: newRef.metadata,
        } as any;
      }
      throw err;
    }
  }
  const { updateNoteSecure } = await import('@/lib/actions/secure-ops');
  const result = await updateNoteSecure(noteId, data, jwt);
  return result as Notes;
}

export async function updateNoteIsomorphicLegacy(noteId: string, data: Partial<Notes>, jwt?: string) {
  const cleanData = cleanRowData(data);
  const updatedAt = new Date().toISOString();
  const updatedData = filterNoteData({ ...cleanData, updatedAt: updatedAt });


  const user = await getCurrentUser();
  
  let permissions = undefined;
  if (data.isPublic !== undefined && user?.$id) {
    permissions = getNotePermissions(user.$id, !!data.isPublic);
  }

  const doc = await databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId, updatedData, permissions) as any;
  
  // Handle tags if provided
  try {
    if (Array.isArray((data as any).tags)) {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const incomingRaw: string[] = (data as any).tags.filter(Boolean).map((t: string) => t.trim());
      const normalizedIncoming = Array.from(new Set(incomingRaw)).filter(Boolean);
      const incomingSet = new Set(normalizedIncoming);
      const currentUser = await getCurrentUser();

      // Preload or create tag rows for all incoming
      const tagDocs: Record<string, any> = {};
      if (normalizedIncoming.length && currentUser?.$id) {
        try {
          const existingTagsRes = await databases.listRows(
            APPWRITE_DATABASE_ID,
            tagsTable,
            [Query.equal('userId', currentUser.$id), Query.equal('nameLower', normalizedIncoming.map(t => t.toLowerCase())), Query.limit(normalizedIncoming.length)] as any
          );
          for (const td of existingTagsRes.rows as any[]) {
            if (td.nameLower) tagDocs[td.nameLower] = td;
          }
        } catch (preErr) {
          console.error('updateNote tag preload failed', preErr);
        }
        for (const tagName of normalizedIncoming) {
          const key = tagName.toLowerCase();
          if (!tagDocs[key]) {
            try {
              const created = await databases.createRow(
                APPWRITE_DATABASE_ID,
                tagsTable,
                ID.unique(),
                { name: tagName, nameLower: key, userId: currentUser?.$id, createdAt: updatedAt, usageCount: 0 }
              );
              tagDocs[key] = created;
            } catch (createErr) {
              // Race: re-fetch
              try {
                const retry = await databases.listRows(
                  APPWRITE_DATABASE_ID,
                  tagsTable,
                  [Query.equal('userId', currentUser?.$id), Query.equal('nameLower', key), Query.limit(1)] as any
                );
                if (retry.rows.length) tagDocs[key] = retry.rows[0];
              } catch {}
            }
          }
        }
      }

      // Fetch existing pivot rows
      const existingPivot = await databases.listRows(
        APPWRITE_DATABASE_ID,
        noteTagsTable,
        [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any
      );
      const existingByTag: Record<string, any> = {};
      const existingPairs = new Set<string>();
      for (const p of existingPivot.rows as any[]) {
        if (p.tag) existingByTag[p.tag] = p;
        if (p.tagId && p.tag) existingPairs.add(`${p.tagId}::${p.tag}`);
      }

      // Add missing pivots
      for (const tagName of normalizedIncoming) {
        const key = tagName.toLowerCase();
        const tagDoc = tagDocs[key];
        const tagId = tagDoc ? (tagDoc.$id || tagDoc.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        if (existingPairs.has(pairKey)) continue;
        // Increment usage for new association only if not already there
        adjustTagUsage(currentUser?.$id, tagName, 1);
        try {
          await databases.createRow(
            APPWRITE_DATABASE_ID,
            noteTagsTable,
            ID.unique(),
            { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId: currentUser?.$id || null, createdAt: updatedAt }
          );
          existingPairs.add(pairKey);
        } catch (ie) {
          console.error('note_tags create (updateNote) failed', ie);
        }
      }

      // Remove stale associations (those existingByTag where tag not in incoming)
      for (const [tagName, pivotDoc] of Object.entries(existingByTag)) {
        if (!incomingSet.has(tagName)) {
          // Decrement usage
          adjustTagUsage(currentUser?.$id, tagName, -1);
          try {
            await databases.deleteRow(
              APPWRITE_DATABASE_ID,
              noteTagsTable,
              (pivotDoc as any).$id
            );
          } catch (de) {
            console.error('note_tags stale delete failed', de);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('dual-write note_tags update error', e);
  }
  invalidateNoteRowClientCache(noteId);
  return doc as Notes;
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

export async function deleteNoteIsomorphicLegacy(noteId: string, jwt?: string) {
  try {
    // Remove reactions directly attached to the note
    await deleteReactionsForTarget(TargetType.NOTE, noteId);


    // Remove any note key mappings / decryption caches tied to this note
    try {
      const mappingsQuery = databases.listRows(
        APPWRITE_CONFIG.DATABASES.VAULT,
        'key_mapping',
        [
          Query.equal('resourceType', 'note'),
          Query.equal('resourceId', noteId),
          Query.limit(1000)] as any
      );
      const mappingsRes = await Promise.race([
        mappingsQuery,
        new Promise<{ rows: any[] }>((resolve) => setTimeout(() => resolve({ rows: [] }), 2500))]);
      await Promise.all(
        (mappingsRes.rows as any[]).map((mapping) =>
          databases.deleteRow(APPWRITE_CONFIG.DATABASES.VAULT, 'key_mapping', mapping.$id)
        )
      );
    } catch (err) {
      console.error('deleteNote key_mapping cleanup failed:', err);
    }
    invalidatePublicNoteDecryptionKey(noteId);

    // Remove comments and their reactions
    const commentsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_COMMENTS,
      [Query.equal('noteId', noteId), Query.limit(1000)] as any
    );
    const commentIds = (commentsRes.rows as any[]).map((c) => c.$id).filter(Boolean);
    if (commentIds.length) {
      await deleteReactionsForTarget(TargetType.COMMENT, commentIds);
      await Promise.all(
        commentIds.map((id) => databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_COMMENTS, id))
      );
    }
  } catch (err: any) {
    console.error('deleteNote cascade cleanup failed:', err);
  }
  try {
    return await databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId);
  } finally {
    invalidateNoteRowClientCache(noteId);
  }
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
    const notes = (res.rows as any[]).map(doc => hydrateVirtualAttributes(doc)) as unknown as Notes[];

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
    } catch (e: any) {
      // Non-fatal hydration error
    }

    let filteredNotes = notes;
    if (!options.includeStories) {
      filteredNotes = filteredNotes.filter(n => !(n as any).isStory);
    }
    if (!options.includeGhosts) {
      filteredNotes = filteredNotes.filter(n => !isGhostNote(n));
    }

    return { ...res, rows: filteredNotes };
  }, LIST_TTL);
}

// New function to get all notes with cursor pagination (memory efficient)
export async function getAllNotes(): Promise<{ rows: Notes[], total: number }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { rows: [], total: 0 };

    const notesRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      [Query.equal('userId', currentUser.$id), Query.limit(1000)]
    );

    return { rows: notesRes.rows as unknown as Notes[], total: notesRes.total };
  } catch (error: any) {
    console.error('getAllNotes error:', error);
    return { rows: [], total: 0 };
  }
}

// --- TAGS CRUD ---

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

export async function getTag(tagId: string): Promise<Tags> {
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

export async function listTags(queries: any[] = [], limit: number = 100) {
  const key = `list:tags:${JSON.stringify(queries)}:${limit}`;
  
  return await fetchOptimized(key, async () => {
    // By default, fetch all tags for the current user
    if (!queries.length) {
      const user = await getCurrentUser();
      if (!user || !user.$id) {
        return { rows: [], total: 0 };
      }
      queries = [
        Query.equal("userId", user.$id),
        Query.notEqual("isTrash", true)
      ];
    }
    
    const finalQueries = [
      ...queries,
      Query.limit(limit),
      Query.orderDesc("$createdAt")
    ];
    
    const res = await databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_TAGS, finalQueries);
    return { 
        ...res, 
        rows: (res.rows as unknown as Tags[]).map(t => hydrateTagMetadata(t)) 
    };
  }, LIST_TTL);
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
    const tags = (res.rows as unknown as Tags[]).map(t => hydrateTagMetadata(t));
    
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
async function adjustTagUsage(userId: string | null | undefined, tagName: string, delta: number) {
  try {
    if (!userId || !tagName) return;
    const res = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_TAGS,
      [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any
    );
    if (res.rows.length) {
      const doc: any = res.rows[0];
      const current = typeof doc.usageCount === 'number' && !isNaN(doc.usageCount) ? doc.usageCount : 0;
      const next = current + delta;
      if (next >= 0 && next !== current) {
        try {
          await databases.updateRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_TABLE_ID_TAGS,
            doc.$id,
            { usageCount: next }
          );
        } catch (upErr) {
          console.error('adjustTagUsage update failed', upErr);
        }
      }
    }
  } catch (e: any) {
    console.error('adjustTagUsage failed', e);
  }
}

// --- APIKEYS CRUD ---

export async function createApiKey(data: Partial<ApiKeys>) {
  return databases.createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, ID.unique(), cleanRowData(data));
}

export async function getApiKey(apiKeyId: string): Promise<ApiKeys> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, apiKeyId) as unknown as Promise<ApiKeys>;
}

export async function updateApiKey(apiKeyId: string, data: Partial<ApiKeys>) {
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, apiKeyId, cleanRowData(data));
}

export async function deleteApiKey(apiKeyId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, apiKeyId);
}

export async function listApiKeys(queries: any[] = []) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_APIKEYS, queries);
}

// --- COMMENTS CRUD ---

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

export async function getComment(commentId: string): Promise<Comments> {
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

// --- EXTENSIONS CRUD ---

export async function createExtension(data: Partial<Extensions>) {
  // Get current user for authorId
  const user = await getCurrentUser();
  if (!user || !user.$id) throw new Error("User not authenticated");
  
  // Create extension with proper timestamps
  const now = new Date().toISOString();
  const cleanData = cleanRowData(data);
  
  // Set initial permissions - private by default (only owner can access)
  const initialPermissions = [
    Permission.read(Role.user(user.$id))];
  
  const doc = await databases.createRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_EXTENSIONS,
    ID.unique(),
    {
      ...cleanData,
      authorId: user.$id,
      id: null, // id will be set after creation
      createdAt: now,
      updatedAt: now,
      isPublic: false // Default to private
    },
    initialPermissions
  );
  
  // Patch the extension to set id = $id (Appwrite does not set this automatically)
  await databases.updateRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_EXTENSIONS,
    doc.$id,
    { id: doc.$id }
  );
  
  // Return the updated row as Extensions type
  return await getExtension(doc.$id);
}

export async function getExtension(extensionId: string): Promise<Extensions> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_EXTENSIONS, extensionId) as unknown as Promise<Extensions>;
}

export async function updateExtension(extensionId: string, data: Partial<Extensions>) {
  // Use cleanRowData to remove Appwrite system fields and id/authorId
  const cleanData = cleanRowData(data);
  const { id, authorId, ...rest } = cleanData;
  
  // Add updatedAt timestamp
  const updatedData = {
    ...rest,
    updatedAt: new Date().toISOString()
  };
  
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_EXTENSIONS, extensionId, updatedData) as unknown as Promise<Extensions>;
}

export async function deleteExtension(extensionId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_EXTENSIONS, extensionId);
}

export async function listExtensions(queries: any[] = []) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_EXTENSIONS, queries);
}

// --- REACTIONS CRUD ---

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

export async function getReaction(reactionId: string): Promise<Reactions> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_REACTIONS, reactionId) as unknown as Promise<Reactions>;
}

export async function updateReaction(reactionId: string, data: Partial<Reactions>) {
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_REACTIONS, reactionId, cleanRowData(data));
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

// --- COLLABORATORS CRUD ---

export async function createCollaborator(data: Partial<Collaborators>) {
  const noteId = data.noteId || data.resourceId;
  const userId = data.userId;
  const permission = (data.permission as NoteCollaboratorPermission | undefined) ?? 'read';

  // Duplicate guard: unique per (resourceId,userId)
  try {
    if (noteId && userId) {
      try {
        const existing = await databases.listRows(
          FLOW_DATABASE_ID,
          POLYMORPHIC_COLLABORATORS_TABLE,
          [
            Query.equal('resourceId', noteId),
            Query.equal('resourceType', 'note'),
            Query.equal('userId', userId),
            Query.limit(1)
          ] as any
        );
        if (existing.rows.length) {
          const existingCollaborator = existing.rows[0] as unknown as Collaborators;
          const existingPermission = existingCollaborator.permission as unknown as NoteCollaboratorPermission;
          if (existingPermission !== permission) {
            await databases.updateRow(
              FLOW_DATABASE_ID,
              POLYMORPHIC_COLLABORATORS_TABLE,
              existingCollaborator.$id,
              { permission }
            );
          }
          await updateNoteAccessForUser(noteId, userId, permission, 'grant');
          return { ...existingCollaborator, permission } as unknown as Collaborators;
        }
      } catch (listErr) {
        console.error('createCollaborator duplicate guard list failed', listErr);
      }
      if (!data.invitedAt) {
        data.invitedAt = new Date().toISOString();
      }
      if (typeof data.accepted === 'undefined') {
        data.accepted = true;
      }
    }
  } catch (guardErr) {
    console.error('createCollaborator duplicate guard failed', guardErr);
  }

  const payload: any = {
    ...data,
    resourceId: noteId,
    resourceType: 'note',
    status: data.status || 'accepted',
  };
  delete payload.noteId;

  const created = await databases.createRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, ID.unique(), cleanRowData(payload));

  if (noteId && userId) {
    try {
      await updateNoteAccessForUser(noteId, userId, permission, 'grant');
    } catch (error) {
      await databases.deleteRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, created.$id);
      throw error;
    }
  }

  return {
    ...created,
    noteId: created.resourceId,
  } as unknown as Collaborators;
}

export async function getCollaborator(collaboratorId: string): Promise<Collaborators> {
  const doc = await databases.getRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, collaboratorId);
  return {
    ...doc,
    noteId: doc.resourceId,
  } as unknown as Collaborators;
}

export async function updateCollaborator(collaboratorId: string, data: Partial<Collaborators>) {
  const current = await getCollaborator(collaboratorId);
  const nextPermission = (data.permission as NoteCollaboratorPermission | undefined) ?? (current.permission as NoteCollaboratorPermission);

  const payload: any = {
    ...data,
  };
  if (payload.noteId) {
    payload.resourceId = payload.noteId;
    delete payload.noteId;
  }

  const updated = await databases.updateRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, collaboratorId, cleanRowData(payload));

  const noteId = current.resourceId || current.noteId;
  if (noteId && current.userId) {
    try {
      await updateNoteAccessForUser(noteId, current.userId, nextPermission, 'grant');
    } catch (error) {
      await databases.updateRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, collaboratorId, { permission: current.permission });
      throw error;
    }
  }

  return {
    ...updated,
    noteId: updated.resourceId,
  } as unknown as Collaborators;
}

export async function deleteCollaborator(collaboratorId: string) {
  const current = await getCollaborator(collaboratorId);

  const noteId = current.resourceId || current.noteId;
  if (noteId && current.userId) {
    await updateNoteAccessForUser(noteId, current.userId, current.permission as NoteCollaboratorPermission, 'revoke');
  }

  return databases.deleteRow(FLOW_DATABASE_ID, POLYMORPHIC_COLLABORATORS_TABLE, collaboratorId);
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
    noteId: doc.resourceId,
  }));
  return res;
}


// --- ACTIVITY LOG CRUD ---

export async function createActivityLog(data: Partial<ActivityLog>) {
  return databases.createRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_ACTIVITYLOG, ID.unique(), cleanRowData(data));
}

export async function getActivityLog(activityLogId: string): Promise<ActivityLog> {
  return databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_ACTIVITYLOG, activityLogId) as unknown as Promise<ActivityLog>;
}

export async function updateActivityLog(activityLogId: string, data: Partial<ActivityLog>) {
  return databases.updateRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_ACTIVITYLOG, activityLogId, cleanRowData(data));
}

export async function deleteActivityLog(activityLogId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_ACTIVITYLOG, activityLogId);
}

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

export async function deleteSettings(settingsId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_SETTINGS, settingsId);
}

export async function listSettings(queries: any[] = []) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_SETTINGS, queries);
}

// AI Mode specific functions
export async function updateAIMode(userId: string, mode: string) {
  try {
    await getSettings(userId);
    return await updateSettings(userId, { mode });
  } catch (error: any) {
    // If settings don't exist, create them with the AI mode
    return await createSettings({ 
      userId, 
      settings: JSON.stringify({ theme: 'light', notifications: true }),
      mode 
    });
  }
}

export async function getAIMode(userId: string): Promise<string | null> {
  try {
    const settings = await getSettings(userId);
    return (settings as any).mode || 'standard';
  } catch (error: any) {
    return 'standard'; // Default to standard mode
  }
}

// --- STORAGE/BUCKETS ---
export async function uploadFile(bucketId: string, file: File, userId?: string) {
  try {
    const user = userId ? { $id: userId } : await getCurrentUser();
    if (!user?.$id) {
      throw new Error('User not authenticated for file upload');
    }

    const permissions = [
      Permission.read(Role.user(user.$id))];

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

export async function getFile(bucketId: string, fileId: string) {
  return storage.getFile(bucketId, fileId);
}

export async function deleteFile(bucketId: string, fileId: string) {
  return storage.deleteFile(bucketId, fileId);
}

export async function listFiles(bucketId: string, queries: any[] = []) {
  return storage.listFiles(bucketId, queries);
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

export async function listRows(tableId: string, queries: any[] = []) {
  return databases.listRows(APPWRITE_DATABASE_ID, tableId, queries);
}

export async function getRow(tableId: string, rowId: string) {
  return databases.getRow(APPWRITE_DATABASE_ID, tableId, rowId);
}

export async function updateRow(tableId: string, rowId: string, data: any) {
  return databases.updateRow(APPWRITE_DATABASE_ID, tableId, rowId, data);
}

export async function deleteRow(tableId: string, rowId: string) {
  return databases.deleteRow(APPWRITE_DATABASE_ID, tableId, rowId);
}

// --- SUBSCRIPTIONS ---
// All subscription logic is now handled by the modular subscription provider.
// See src/lib/subscriptions/

// --- ADVANCED/SEARCH ---

export async function searchNotesByTitle(title: string) {
  return databases.listRows(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, [Query.search('title', title)]);
}

export async function searchNotesByTag(tagId: string) {
  return getNotesByTag(tagId);
}

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


export async function listPublicNotesByUser(userId: string) {
  return databases.listRows(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    [
      Query.equal('isPublic', true), 
      Query.equal('userId', userId)
    ]
  );
}

// --- PRIVATE SHARING ---

export async function shareNoteWithUser(noteId: string, email: string, permission: 'read' | 'write' | 'admin' = 'read') {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    // First check if note exists and user owns it
    const note = await getNote(noteId);
    if (note.userId !== currentUser.$id) {
      throw new Error("Only note owner can share notes");
    }

    // Find user by email (check in Users table)
    const usersList = await databases.listRows(
      APPWRITE_DATABASE_ID, 
      APPWRITE_TABLE_ID_USERS, 
      [Query.equal('email', email)]
    );

    if (usersList.rows.length === 0) {
      throw new Error(`No user found with email: ${email}`);
    }

    const targetUserId = usersList.rows[0].id || usersList.rows[0].$id;
    if (!targetUserId) throw new Error(`Invalid user data for email: ${email}`);

    return await shareNoteWithUserId(noteId, targetUserId, permission, email);
  } catch (error: any) {
    console.error('shareNoteWithUser error:', error);
    throw new Error(error.message || 'Failed to share note');
  }
}

// Share note directly with a known userId (used after search selection)
export async function shareNoteWithUserId(noteId: string, targetUserId: string, permission: 'read' | 'write' | 'admin' = 'read', emailForMessage?: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    const note = await getNote(noteId);
    const allowAnyoneEdit = isNoteEditableByAnyone(note);
    if (note.userId !== currentUser.$id) {
      throw new Error("Only note owner can share notes");
    }

    if (targetUserId === currentUser.$id) {
      throw new Error("Cannot share a note with yourself");
    }

    await updateNoteAccessForUser(noteId, targetUserId, permission, 'grant');

    if (allowAnyoneEdit) {
      await setAnyoneCanEdit(noteId, true);
    }

    await notifyNoteShare({
      noteId,
      noteTitle: note.title || 'Note',
      actorName: currentUser.name || currentUser.email || 'Someone',
      recipientId: targetUserId,
      permission,
    }).catch((error) => {
      console.error('Failed to queue note share email', error);
    });

    return { success: true, message: `Note shared${emailForMessage ? ' with ' + emailForMessage : ''}` };
  } catch (error: any) {
    console.error('shareNoteWithUserId error:', error);
    throw new Error(error.message || 'Failed to share note');
  }
}

export async function getSharedUsers(noteId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    // Check cache first (5-minute TTL)
    const cacheKey = getCacheKey('getSharedUsers', noteId);
    const cached = getCached<any[]>(cacheKey);
    if (cached) return cached;

    // Fetch the note to read its permissions
    const note = await getNote(noteId);
    if (!note || !note.$permissions) {
      return [];
    }

    // Extract user IDs and permissions from the row's $permissions array
    const sharedUsers: any[] = [];
    const targetUserIds = extractUserIdsFromPermissions(note.$permissions)
      .filter(id => id !== note.userId); // Exclude the owner

    if (targetUserIds.length === 0) {
      setCached(cacheKey, []);
      return [];
    }

    // Fetch user profiles from the Appwrite Users table
    const batchSize = 100;
    for (let i = 0; i < targetUserIds.length; i += batchSize) {
      const batch = targetUserIds.slice(i, i + batchSize);
      try {
        const usersRes = await databases.listRows(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          [Query.equal('$id', batch), Query.limit(batch.length)] as any
        );

        for (const user of usersRes.rows as any[]) {
          const profilePicId = (user?.prefs && user.prefs.profilePicId)
            ? user.prefs.profilePicId
            : (user?.avatar || null);

          // Determine highest permission level based on $permissions array
          let highestPermission = 'read';
          const userPermStr = `user:${user.$id}`;
          const hasDelete = (note.$permissions || []).some((p: string) => p.includes('delete') && p.includes(userPermStr));
          const hasUpdate = (note.$permissions || []).some((p: string) => p.includes('update') && p.includes(userPermStr)) ||
                            (note.$permissions || []).some((p: string) => p.includes('write') && p.includes(userPermStr));
          if (hasDelete) highestPermission = 'admin';
          else if (hasUpdate) highestPermission = 'write';

          sharedUsers.push({
            id: user.$id,
            name: user.name,
            email: user.email,
            permission: highestPermission,
            collaborationId: `${noteId}-${user.$id}`, // Fallback for UI keys
            profilePicId
          });
        }
      } catch (batchErr) {
        console.error('Batch user fetch failed:', batchErr);
      }
    }

    setCached(cacheKey, sharedUsers);
    return sharedUsers;
  } catch (error: any) {
    console.error('getSharedUsers error:', error);
    throw new Error(error.message || 'Failed to get shared users');
  }
}

export async function removeNoteSharing(noteId: string, targetUserId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User not authenticated");

    // Check if user owns the note
    const note = await getNote(noteId);
    const allowAnyoneEdit = isNoteEditableByAnyone(note);
    if (note.userId !== currentUser.$id) {
      throw new Error("Only note owner can remove sharing");
    }

    await updateNoteAccessForUser(noteId, targetUserId, 'read', 'revoke');

    if (allowAnyoneEdit) {
      await setAnyoneCanEdit(noteId, true);
    }

    return { success: true };
  } catch (error: any) {
    console.error('removeNoteSharing error:', error);
    throw new Error(error.message || 'Failed to remove sharing');
  }
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

export async function getNoteWithSharing(noteId: string): Promise<(Notes & { isSharedWithUser?: boolean, sharePermission?: string, sharedBy?: any }) | null> {
  try {
    const currentUser = await getCurrentUser();
    

    const note = await getNote(noteId);
    
    // Check if note is shared with current user
    const isSharedWithUser = note.userId !== currentUser.$id;

    let sharedBy = null;
    let sharePermission = undefined;

    if (isSharedWithUser && note.userId) {
      // Get details about who shared this note
      try {
        sharedBy = await databases.getRow(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          note.userId
        );
      } catch (error: any) {
        console.error('Error fetching note owner details:', error);
      }

      sharePermission = 'read';
      const perms = (note as any).$permissions || [];
      if (perms.includes()) sharePermission = 'admin';
      else if (perms.includes()) sharePermission = 'write';
      else if (isNoteEditableByAnyone(note)) sharePermission = 'write';
    }

    return {
      ...note,
      isSharedWithUser,
      sharePermission,
      sharedBy: sharedBy ? { name: sharedBy.name, email: sharedBy.email } : null
    };
  } catch (error: any) {
    console.error('getNoteWithSharing error:', error);
    return null;
  }
}

export async function getPublicNote(noteId: string): Promise<Notes | null> {
  try {
    const note = await databases.getRow(APPWRITE_DATABASE_ID, APPWRITE_TABLE_ID_NOTES, noteId) as unknown as Notes;
    
    // Only return note if it's public
    if (note.isPublic) {
      return note;
    }
    return null;
  } catch (error: any) {
    return null;
  }
}

// --- PROFILE PICTURE HELPERS ---

export async function uploadProfilePicture(file: File) {
  return uploadFile(APPWRITE_BUCKET_PROFILE_PICTURES, file);
}

export async function getProfilePicture(fileId: string) {
  return storage.getFileView(APPWRITE_BUCKET_PROFILE_PICTURES, fileId);
}


export async function deleteProfilePicture(fileId: string) {
  return deleteFile(APPWRITE_BUCKET_PROFILE_PICTURES, fileId);
}

// --- NOTES ATTACHMENTS HELPERS (Legacy embedded + new table) ---

// Basic upload wrapper (raw file upload only)
export async function uploadNoteAttachment(file: File, userId?: string) {
  const bucketId = APPWRITE_BUCKET_NOTES_ATTACHMENTS;
  const startedAt = Date.now();
  if (!bucketId) {
    const err: any = new Error('Missing notes attachments bucket id');
    err.code = 'MISSING_BUCKET_ID';
    console.error('[attachments] uploadNoteAttachment:config_error');
    throw err;
  }

  // Framework Gating and Compression integration
  const { validateFileUploadLimit, compressImageToWebP, getFileTypeCategory } = await import('@/lib/storage/framework');
  
  // 1. Strict size limit check BEFORE compression
  try {
    validateFileUploadLimit(file, 'notes_attachments');
  } catch (gateErr) {
    throw gateErr;
  }

  let activeFile = file;
  if (getFileTypeCategory(file.type, file.name) === 'image') {
    try {
      activeFile = await compressImageToWebP(file);
    } catch (compressErr) {
      console.warn('[attachments] Client-side image compression failed, falling back to original:', compressErr);
    }
  }

  try {
    const res: any = await uploadFile(bucketId, activeFile, userId);
    return res;
  } catch (e: any) {
    console.error('[attachments] uploadNoteAttachment:error', { bucketId, error: e?.message || String(e) });
    throw e;
  }
}

export async function getNoteAttachment(fileId: string) {
  return getFile(APPWRITE_BUCKET_NOTES_ATTACHMENTS, fileId);
}

export async function deleteNoteAttachment(fileId: string) {
  return deleteFile(APPWRITE_BUCKET_NOTES_ATTACHMENTS, fileId);
}

// Attachment metadata shape (lightweight, embedded in note.attachments array as JSON string)
// We avoid schema change for now; each entry: { id: fileId, name, size, mime, createdAt }
interface EmbeddedAttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  createdAt: string;
}

function serializeAttachmentMeta(meta: EmbeddedAttachmentMeta): string {
  return JSON.stringify(meta);
}

function parseAttachmentMeta(raw: any): EmbeddedAttachmentMeta | null {
  if (!raw) return null;
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (typeof raw === 'object' && raw.id) return raw as EmbeddedAttachmentMeta;
  } catch {}
  return null;
}

function normalizeNoteAttachmentsField(note: any): EmbeddedAttachmentMeta[] {
  const arr: any[] = Array.isArray(note.attachments) ? note.attachments : [];
  const metas: EmbeddedAttachmentMeta[] = [];
  for (const entry of arr) {
    const meta = parseAttachmentMeta(entry);
    if (meta && meta.id) metas.push(meta);
  }
  return metas;
}

async function enforceAttachmentPlanLimit(userId: string, _currentCount: number, fileSizeBytes?: number) {
  // Plan limit enforcement removed: notes are now unlimited across all plans.
  return;
}

// Public helpers to manage attachment association to a note
// Basic security: allow-list MIME types that align with bucket extension allowlist
// notes_attachments bucket allows: png, jpg, jpeg, webp, gif, pdf, md, txt
const ATTACHMENT_ALLOWED_MIME_PREFIXES = ['image/'];
const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  // Common variants for text files
  'text/x-markdown',
  // Allow generic octet-stream as fallback for text files; will rely on extension for safety
  'application/octet-stream'
];

function sanitizeAttachmentFilename(name: string): string {
  try {
    if (!name) return 'attachment';
    // Strip path components (just in case)
    name = name.split('\\').pop()!.split('/').pop()!;
    // Replace spaces with underscores
    name = name.replace(/\s+/g, '_');
    // Remove disallowed chars (allow alnum, dash, underscore, dot)
    name = name.replace(/[^A-Za-z0-9._-]/g, '');
    // Enforce length bounds
    if (!name || name.length < 1) name = 'attachment';
    if (name.length > 120) name = name.slice(0, 120);
    // Ensure has an extension (best-effort) for common images if missing
    if (!name.includes('.')) name = name + '.bin';
    return name;
  } catch {
    return 'attachment';
  }
}

function validateAttachmentMime(mime: string | null | undefined) {
  if (!mime) return; // Allow unknown mime (treated as application/octet-stream)
  const ok = ATTACHMENT_ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p)) || ATTACHMENT_ALLOWED_MIME_TYPES.includes(mime);
  if (!ok) {
    const err: any = new Error(`Unsupported MIME type: ${mime}`);
    err.code = 'UNSUPPORTED_MIME_TYPE';
    err.allowed = { prefixes: ATTACHMENT_ALLOWED_MIME_PREFIXES, types: ATTACHMENT_ALLOWED_MIME_TYPES };
    throw err;
  }
}

export async function addAttachmentToNote(noteId: string, file: File, userId?: string) {
  const user = userId ? { $id: userId } : await getCurrentUser();
  if (!user?.$id) throw new Error('User not authenticated');
  // Get existing note + attachments
  const note = await getNote(noteId) as any;
  if (!note) throw new Error('Note not found');
  if (note.userId !== user.$id) throw new Error('Only owner can add attachments currently');

  // Normalize current attachments (embedded metadata)
  const existingMetas = normalizeNoteAttachmentsField(note);
  await enforceAttachmentPlanLimit(user.$id, existingMetas.length);

  // 1. Client-side Framework Gating & Compression
  const { validateFileUploadLimit, compressImageToWebP, getFileTypeCategory } = await import('@/lib/storage/framework');
  
  // Strict size limit check BEFORE compression
  try {
    validateFileUploadLimit(file, 'notes_attachments');
  } catch (gateErr) {
    throw gateErr;
  }

  let activeFile = file;
  if (getFileTypeCategory(file.type, file.name) === 'image') {
    try {
      activeFile = await compressImageToWebP(file);
    } catch (compressErr) {
      console.warn('[attachments] Client-side image compression failed, falling back to original:', compressErr);
    }
  }

  // Enforce per-file size limit via plan policy on the active file
  try {
    await enforceAttachmentPlanLimit(user.$id, existingMetas.length, activeFile.size);
  } catch (e: any) {
    if (e?.code === 'ATTACHMENT_SIZE_LIMIT') throw e;
  }

  // MIME validation + filename sanitization on active file
  try {
    validateAttachmentMime((activeFile as any).type);
  } catch (mimeErr: any) {
    throw mimeErr; // bubble with code UNSUPPORTED_MIME_TYPE
  }
  const sanitizedName = sanitizeAttachmentFilename((activeFile as any).name || 'attachment');

  // Upload file
  let uploaded: any;
  try {
    uploaded = await uploadNoteAttachment(activeFile, user.$id);
  } catch (uploadErr: any) {
    console.error('[attachments] uploadNoteAttachment failed', {
      noteId,
      fileName: (activeFile as any)?.name,
      message: uploadErr?.message,
      code: uploadErr?.code
    });
    throw uploadErr;
  }

  // Build metadata
  const meta: EmbeddedAttachmentMeta = {
    id: uploaded.$id || uploaded.id,
    name: sanitizedName || uploaded.name || 'attachment',
    size: uploaded.sizeOriginal || (activeFile as any).size || 0,
    mime: uploaded.mimeType || (activeFile as any).type || null,
    createdAt: new Date().toISOString(),
  };

  const updatedMetas = [...existingMetas, meta];
  const serialized = updatedMetas.map(serializeAttachmentMeta);

  // Persist to note
  await updateNote(noteId, { attachments: serialized } as any);
  // Dual-write to attachments table if enabled (best-effort)
  try {
    await createAttachmentRecord({
      noteId,
      ownerId: user.$id,
      fileId: meta.id,
      filename: meta.name,
      mimetype: meta.mime,
      sizeBytes: meta.size,
    });
  } catch (e: any) {
    console.error('dual-write attachment record failed', e);
  }

  // Authoritative sync to polymorphic objects table
  try {
    const { attachObject } = await import('@/lib/actions/client-ops');
    await attachObject({
      parentId: noteId,
      parentKind: 'note',
      childId: meta.id,
      childKind: 'file',
      metadata: {
        filename: meta.name,
        mimetype: meta.mime,
        size: meta.size
      }
    });
  } catch (e: any) {
    console.warn('[attachments] Authoritative objects sync failed:', e);
  }

  return meta;
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
  } catch (authErr) {
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
            createdAt: existing?.createdAt || rec.createdAt || new Date().toISOString(),
          };
          byId[rec.fileId] = merged;
        }
        return Object.values(byId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      }
    } catch (e: any) {
      console.error('listNoteAttachments merge failed', e);
    }
  }
  return embedded;
}

export async function removeAttachmentFromNote(noteId: string, attachmentId: string) {
  const user = await getCurrentUser();
  if (!user?.$id) throw new Error('User not authenticated');
  const note = await getNote(noteId) as any;
  if (note.userId !== user.$id) throw new Error('Only owner can remove attachments currently');
  const existingMetas = normalizeNoteAttachmentsField(note);
  const remaining = existingMetas.filter(a => a.id !== attachmentId);
  if (remaining.length === existingMetas.length) return { removed: false };
  const serialized = remaining.map(serializeAttachmentMeta);
  await updateNote(noteId, { attachments: serialized } as any);
  
  // Authoritative sync: remove from polymorphic objects table
  try {
    const { detachObjectByRelation } = await import('@/lib/actions/client-ops');
    await detachObjectByRelation({
        parentId: noteId,
        childId: attachmentId
    });
  } catch (e) {
      console.warn('[attachments] Authoritative objects sync failed (detach):', e);
  }

  try { await deleteNoteAttachment(attachmentId); } catch (e: any) { /* non-fatal */ }
  return { removed: true };
}

// ...add similar helpers for other buckets as needed...

// --- NEW ATTACHMENTS TABLE MODEL ---
// Progressive enhancement: supports richer metadata beyond embedded JSON strings.
// If NEXT_PUBLIC_APPWRITE_TABLE_ID_ATTACHMENTS is set, we will dual-write to that table.

export const APPWRITE_TABLE_ID_ATTACHMENTS = process.env.NEXT_PUBLIC_APPWRITE_TABLE_ID_ATTACHMENTS || undefined;

export interface AttachmentRecord {
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

async function createAttachmentRecord(meta: { noteId: string; ownerId: string; fileId: string; filename: string; mimetype: string | null; sizeBytes: number; }): Promise<AttachmentRecord | null> {
  if (!APPWRITE_TABLE_ID_ATTACHMENTS) return null;
  try {
    const now = new Date().toISOString();
    const doc: any = await databases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_ATTACHMENTS,
      ID.unique(),
      {
        noteId: meta.noteId,
        ownerId: meta.ownerId,
        fileId: meta.fileId,
        filename: meta.filename,
        mimetype: meta.mimetype,
        sizeBytes: meta.sizeBytes,
        createdAt: now,
        id: null,
      }
    );
    await databases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_ATTACHMENTS,
      doc.$id,
      { id: doc.$id }
    );
    return {
      id: doc.$id,
      noteId: meta.noteId,
      ownerId: meta.ownerId,
      fileId: meta.fileId,
      filename: meta.filename,
      mimetype: meta.mimetype,
      sizeBytes: meta.sizeBytes,
      createdAt: now,
    };
  } catch (e: any) {
    console.error('createAttachmentRecord failed', e);
    return null;
  }
}

export async function listAttachmentsForNote(noteId: string): Promise<AttachmentRecord[]> {
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

export async function deleteAttachmentRecord(attachmentId: string) {
  if (!APPWRITE_TABLE_ID_ATTACHMENTS) return;
  try {
    await databases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_ATTACHMENTS,
      attachmentId
    );
  } catch (e: any) {
    console.error('deleteAttachmentRecord failed', e);
  }
}

// --- SIGNED ATTACHMENT URL HELPERS ---
// Short-lived HMAC signed URLs that point to a proxy download route.
// These are generated server-side only. If secret missing, returns null (feature disabled).
const ATTACHMENT_URL_SIGNING_SECRET = process.env.ATTACHMENT_URL_SIGNING_SECRET || '';
const ATTACHMENT_URL_TTL_SECONDS = parseInt(process.env.ATTACHMENT_URL_TTL_SECONDS || '300', 10);

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

export async function generateSignedAttachmentURL(noteId: string, ownerId: string, fileId: string, ttlSeconds?: number) {
  if (!ATTACHMENT_URL_SIGNING_SECRET) return null;
  const ttl = typeof ttlSeconds === 'number' && ttlSeconds > 0 ? ttlSeconds : ATTACHMENT_URL_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;
  const sig = await generateAttachmentSignature(noteId, ownerId, fileId, exp);
  if (!sig) return null;
  return {
    url: `/api/attachments/download?noteId=${encodeURIComponent(noteId)}&ownerId=${encodeURIComponent(ownerId)}&fileId=${encodeURIComponent(fileId)}&exp=${exp}&sig=${sig}`,
    expiresAt: exp * 1000,
    ttl,
  };
}

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


// --- MAINTENANCE HELPERS (Best-effort, on-demand) ---
// Backfill tagId on legacy note_tags rows missing tagId for a user's notes
export async function backfillNoteTagPivots(userId?: string) {
  try {
    const currentUser = userId ? { $id: userId } as any : await getCurrentUser();
    if (!currentUser?.$id) throw new Error('User not authenticated');
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const tagsTable = APPWRITE_TABLE_ID_TAGS;
    // Fetch tag docs for user
    const tagDocsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      tagsTable,
      [Query.equal('userId', currentUser.$id), Query.limit(500)] as any
    );
    const byNameLower: Record<string, any> = {};
    for (const td of tagDocsRes.rows as any[]) {
      if (td.nameLower) byNameLower[td.nameLower] = td;
      else if (td.name) byNameLower[String(td.name).toLowerCase()] = td;
    }
    // Fetch pivots missing tagId
    const pivotsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('userId', currentUser.$id), Query.isNull('tagId'), Query.limit(1000)] as any
    );
    let patched = 0;
    for (const p of pivotsRes.rows as any[]) {
      if (!p.tag || p.tagId) continue;
      const key = String(p.tag).toLowerCase();
      const tagDoc = byNameLower[key];
      if (tagDoc) {
        try {
          await databases.updateRow(
            APPWRITE_DATABASE_ID,
            noteTagsTable,
            p.$id,
            { tagId: tagDoc.$id || tagDoc.id }
          );
          patched++;
        } catch (upErr) {
          console.error('backfill pivot update failed', upErr);
        }
      }
    }
    return { attempted: pivotsRes.rows.length, patched };
  } catch (e: any) {
    console.error('backfillNoteTagPivots failed', e);
    return { attempted: 0, patched: 0, error: String(e) };
  }
}

// Recompute tag usageCount by counting pivot rows per tag for a user
export async function reconcileTagUsage(userId?: string) {
  try {
    const currentUser = userId ? { $id: userId } as any : await getCurrentUser();
    if (!currentUser?.$id) throw new Error('User not authenticated');
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const tagsTable = APPWRITE_TABLE_ID_TAGS;
    // Fetch all user tag docs
    const tagDocsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      tagsTable,
      [Query.equal('userId', currentUser.$id), Query.limit(500)] as any
    );
    const tagDocs = tagDocsRes.rows as any[];
    const tagIdToDoc: Record<string, any> = {};
    for (const td of tagDocs) tagIdToDoc[td.$id || td.id] = td;
    // Fetch all pivots for user
    const pivotsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('userId', currentUser.$id), Query.limit(5000)] as any
    );
    const counts: Record<string, number> = {};
    for (const p of pivotsRes.rows as any[]) {
      const tId = p.tagId;
      if (!tId) continue;
      counts[tId] = (counts[tId] || 0) + 1;
    }
    let updated = 0;
    for (const td of tagDocs) {
      const desired = counts[td.$id] || 0;
      const current = typeof td.usageCount === 'number' ? td.usageCount : 0;
      if (desired !== current) {
        try {
          await databases.updateRow(
            APPWRITE_DATABASE_ID,
            tagsTable,
            td.$id,
            { usageCount: desired }
          );
          updated++;
        } catch (upErr) {
          console.error('reconcileTagUsage update failed', upErr);
        }
      }
    }
    return { tags: tagDocs.length, pivots: pivotsRes.rows.length, updated };
  } catch (e: any) {
    console.error('reconcileTagUsage failed', e);
    return { tags: 0, pivots: 0, updated: 0, error: String(e) };
  }
}


// --- MAINTENANCE AUDIT HELPERS ---
// Analyze note_tags pivot health for a user without mutating data
export async function auditNoteTagPivots(userId?: string) {
  try {
    const currentUser = userId ? { $id: userId } as any : await getCurrentUser();
    if (!currentUser?.$id) throw new Error('User not authenticated');
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';

    // Fetch pivots (bounded)
    const pivotsRes = await databases.listRows(
      APPWRITE_DATABASE_ID,
      noteTagsTable,
      [Query.equal('userId', currentUser.$id), Query.limit(5000)] as any
    );
    const pivots = pivotsRes.rows as any[];

    let missingTagId = 0;
    const sampleMissing: string[] = [];
    const pairCounts: Record<string, number> = {};

    for (const p of pivots) {
      if (!p.tagId) {
        missingTagId++;
        if (sampleMissing.length < 10) sampleMissing.push(p.$id);
      }
      if (p.tagId && p.tag) {
        const key = `${p.tagId}::${p.tag}`;
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }

    const duplicatePairs = Object.entries(pairCounts)
      .filter(([_, count]) => count > 1)
      .map(([key, count]) => {
        const [tagId, tag] = key.split('::');
        return { tagId, tag, count };
      })
      .sort((a, b) => b.count - a.count);

    const suggested: string[] = [];
    if (missingTagId > 0) suggested.push('Run backfillNoteTagPivots to patch missing tagId values');
    if (duplicatePairs.length > 0) suggested.push('Consider enforcing unique constraint (noteId, tagId) and deduplicating');
    if (!missingTagId && !duplicatePairs.length) suggested.push('No action needed');

    return {
      userId: currentUser.$id,
      total: pivots.length,
      missingTagId,
      duplicatePairCount: duplicatePairs.length,
      duplicatePairs,
      sampleMissing,
      suggested
    };
  } catch (e: any) {
    console.error('auditNoteTagPivots failed', e);
    return { error: String(e) };
  }
}

// --- EXPORT DEFAULTS ---
/**
 * --- PAGINATED NOTES LISTING ---
 * Cursor-based pagination for notes with optional tag hydration.
 * Returns: { rows, total, nextCursor, hasMore }
 *
 * Example:
 *   const page1 = await listNotesPaginated({ limit: 50 });
 *   if (page1.hasMore) {
 *     const page2 = await listNotesPaginated({ limit: 50, cursor: page1.nextCursor });
 *   }
 *
 * Provide custom queries to override default user filter or a specific userId.
 * Set hydrateTags=false to skip tag pivot hydration for performance sensitive paths.
 */
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
    includeGhosts = false,
  } = options;

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
          
          const sortedDocs = docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          
          const rows = sortedDocs.map(doc => ({
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
          })) as any[];
          
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

  const notes = (res.rows as any[]).map(doc => hydrateVirtualAttributes(doc)) as unknown as Notes[];

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
    filteredNotes = filteredNotes.filter(n => !(n as any).isStory);
  }
  if (!includeGhosts) {
    filteredNotes = filteredNotes.filter(n => !isGhostNote(n));
  }

  const batchLength = filteredNotes.length;
  const hasMore = batchLength === limit; // heuristic
  const nextCursor = hasMore && batchLength ? (filteredNotes[batchLength - 1] as any).$id || null : null;

  return {
    rows: filteredNotes,
    total: typeof res.total === 'number' ? res.total : filteredNotes.length,
    nextCursor,
    hasMore,
  };

}

// --- PERMISSIONS HELPERS ---

export function isNotePublic(note: Notes): boolean {
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

export async function isNoteOwner(note: Notes): Promise<boolean> {
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

export function cachePublicNoteDecryptionKey(noteId: string, key: string) {
  publicNoteDecryptionKeyCache.set(noteId, key);
}

export function getCachedPublicNoteDecryptionKey(noteId: string): string | null {
  return publicNoteDecryptionKeyCache.get(noteId) || null;
}

export function invalidatePublicNoteDecryptionKey(noteId: string) {
  publicNoteDecryptionKeyCache.delete(noteId);
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
    } catch (e) {
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
              } catch (e) { /* silent fallback */ }
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
    } catch (err) {
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
  } catch (error) {
    return null;
  }
}

function stripT4Metadata(metadata: string | undefined | null): string {
  let parsed: Record<string, any> = {};
  try {
    parsed = metadata ? JSON.parse(metadata) : {};
  } catch {
    parsed = {};
  }

  delete parsed.isEncrypted;
  delete parsed.encryptionVersion;
  delete parsed.encryptedTitle;

  return JSON.stringify(parsed);
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
    const commentIds = commentDocs.map((c) => c.$id).filter(Boolean);

    await Promise.all(
      commentDocs.map(async (comment) => {
        const commentUserId = comment.userId || ownerId;
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
        const reactionUserId = reaction.userId || ownerId;
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
          const reactionUserId = reaction.userId || ownerId;
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
    const allowAnyoneEdit = isNoteEditableByAnyone(note);
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

export async function getCurrentPublicNoteDecryptionKey(noteId: string): Promise<string | null> {
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
      const { createSystemClient } = await import('@/lib/appwrite-admin');
      const { databases } = createSystemClient();
      
      const doc = await databases.getRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_NOTES,
        noteId
      ) as any;
      
      // Safety check: isPublic or isGuest MUST be true
      if (doc && (doc.isPublic === true || doc.isGuest === true)) {
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

export async function setAnyoneCanEdit(noteId: string, enabled: boolean): Promise<Notes> {
  const note = await getNote(noteId);
  if (!(await isNoteOwner(note))) throw new Error('Permission denied');

  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Not authenticated');

  const ownerId = note.userId || currentUser.$id;
  const permissions = new Set<string>((note as any).$permissions || []);

  permissions.add(Permission.read(Role.user(ownerId)));

  if (isNotePublic(note)) {
    permissions.add(Permission.read(Role.any()));
  }

  const updated = await databases.updateRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    noteId,
    {},
    Array.from(permissions)
  );

  return updated as unknown as Notes;
}


// Ecosystem Helpers
export async function listFlowTasks(queries: any[] = []) {
  return databases.listRows(FLOW_DATABASE_ID, FLOW_TABLE_ID_TASKS, queries);
}

export async function listFlowEvents(queries: any[] = []) {
  return databases.listRows(FLOW_DATABASE_ID, FLOW_TABLE_ID_EVENTS, queries);
}

export async function listKeepCredentials(queries: any[] = []) {
  return databases.listRows(KEEP_DATABASE_ID, KEEP_TABLE_ID_CREDENTIALS, queries);
}

export async function lockNote(noteId: string): Promise<Notes | null> {
  const note = await getNote(noteId);
  if (!(await isNoteOwner(note))) throw new Error('Permission denied');

  if (!ecosystemSecurity.status.isUnlocked) {
    throw new Error('VAULT_LOCKED');
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Not authenticated');
  const ownerId = note.userId || currentUser.$id;

  const { encryptField } = await import("../masterpass-crypto");

  const meta = (() => {
    try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
  })();

  if ((note.isEncrypted || meta.isEncrypted) && (note.dek || meta.dek)) {
    return note;
  }

  const dek = await ecosystemSecurity.generateRandomMEK();
  const rawKey = await crypto.subtle.exportKey("raw", dek);
  const dekBase64 = bytesToBase64(new Uint8Array(rawKey));
  const wrappedDek = await encryptField(dekBase64);

  const encryptedTitle = await ecosystemSecurity.encryptWithKey(note.title || '', dek);
  const encryptedContent = await ecosystemSecurity.encryptWithKey(note.content || '', dek);

  const updatedMeta = {
    ...meta,
    isEncrypted: true,
    encryptionVersion: 'T5',
    encryptedTitle
  };

  const updatePayload: any = {
    id: note.$id,
    userId: ownerId,
    title: '🔒 Locked Note',
    content: encryptedContent,
    isEncrypted: true,
    dek: wrappedDek,
    metadata: JSON.stringify(updatedMeta)
  };

  const permissions = [Permission.read(Role.user(ownerId))];

  const updated = await databases.updateRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    noteId,
    filterNoteData(updatePayload),
    permissions
  );

  return updated as unknown as Notes;
}

export async function unlockNote(noteId: string): Promise<Notes | null> {
  const note = await getNote(noteId);
  if (!(await isNoteOwner(note))) throw new Error('Permission denied');

  if (!ecosystemSecurity.status.isUnlocked) {
    throw new Error('VAULT_LOCKED');
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Not authenticated');
  const ownerId = note.userId || currentUser.$id;

  const meta = (() => {
    try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
  })();

  const rawDek = note.dek || meta.dek;
  if (!rawDek) {
    return note;
  }

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

  const plaintextTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || '', dek);
  const plaintextContent = await ecosystemSecurity.decryptWithKey(note.content || '', dek);

  const updatedMeta = { ...meta };
  delete updatedMeta.isEncrypted;
  delete updatedMeta.encryptionVersion;
  delete updatedMeta.dek;
  delete updatedMeta.encryptedTitle;

  const updatePayload: any = {
    id: note.$id,
    userId: ownerId,
    title: plaintextTitle,
    content: plaintextContent,
    isEncrypted: false,
    dek: null,
    metadata: JSON.stringify(updatedMeta)
  };

  const permissions = [Permission.read(Role.user(ownerId))];

  const updated = await databases.updateRow(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    noteId,
    filterNoteData(updatePayload),
    permissions
  );

  return updated as unknown as Notes;
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(atob(value).split("").map((char) => char.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
