import { Client, Account, Databases, Storage, ID, Query, Realtime, TablesDB } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

// --- Ecosystem Constants ---
export const KYLRIX_AUTH_URI = APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN ? `https://${APPWRITE_CONFIG.SYSTEM.AUTH_SUBDOMAIN}.${APPWRITE_CONFIG.SYSTEM.DOMAIN}` : 'https://accounts.kylrix.space';
export const KYLRIX_DOMAIN = APPWRITE_CONFIG.SYSTEM.DOMAIN;


export const APPWRITE_ENDPOINT = 'https://api.kylrix.space/v1';
export const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const realtime = new Realtime(client);
export const tablesDB = new TablesDB(client);

export async function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId, width, height);
}

export { client, ID, Query, Realtime };
// --- Database & Collection IDs ---
// Note Database
export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
export const APPWRITE_TABLE_ID_PROFILES = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const APPWRITE_TABLE_ID_USERS = APPWRITE_TABLE_ID_PROFILES; // legacy alias
export const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
export const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
export const APPWRITE_TABLE_ID_APIKEYS = APPWRITE_CONFIG.TABLES.NOTE.APIKEYS;
export const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
export const APPWRITE_TABLE_ID_EXTENSIONS = APPWRITE_CONFIG.TABLES.NOTE.EXTENSIONS;
export const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
export const APPWRITE_TABLE_ID_COLLABORATORS = APPWRITE_CONFIG.TABLES.NOTE.COLLABORATORS;
export const APPWRITE_TABLE_ID_ACTIVITYLOG = APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG;
export const APPWRITE_TABLE_ID_SETTINGS = APPWRITE_CONFIG.TABLES.NOTE.SETTINGS;
export const APPWRITE_TABLE_ID_SUBSCRIPTIONS = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
export const APPWRITE_TABLE_ID_NOTETAGS = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS;

// Flow Database
export const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
export const FLOW_COLLECTION_ID_TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
export const FLOW_COLLECTION_ID_EVENTS = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;

// Vault (Keep) Database
export const KEEP_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const KEEP_COLLECTION_ID_CREDENTIALS = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const KEEP_COLLECTION_ID_KEYCHAIN = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

// Vault Collection IDs
export const APPWRITE_COLLECTION_CREDENTIALS_ID = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const APPWRITE_COLLECTION_TOTPSECRETS_ID = APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS;
export const APPWRITE_COLLECTION_FOLDERS_ID = APPWRITE_CONFIG.TABLES.VAULT.FOLDERS;
export const APPWRITE_COLLECTION_SECURITYLOGS_ID = APPWRITE_CONFIG.TABLES.VAULT.SECURITY_LOGS;
export const APPWRITE_COLLECTION_USER_ID = APPWRITE_CONFIG.TABLES.VAULT.USER;
export const APPWRITE_COLLECTION_KEYCHAIN_ID = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;
export const APPWRITE_COLLECTION_KEY_MAPPING_ID = APPWRITE_CONFIG.TABLES.VAULT.KEY_MAPPING;
export const APPWRITE_COLLECTION_IDENTITIES_ID = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES;

// Connect Database
export const CONNECT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CONNECT_COLLECTION_ID_USERS = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const CONNECT_COLLECTION_ID_MOMENTS = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;

// --- Storage Buckets ---
export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;
export const APPWRITE_BUCKET_NOTES_ATTACHMENTS = APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;
export const APPWRITE_BUCKET_EXTENSION_ASSETS = APPWRITE_CONFIG.BUCKETS.EXTENSION_ASSETS;
export const APPWRITE_BUCKET_BACKUPS = APPWRITE_CONFIG.BUCKETS.BACKUPS;
export const APPWRITE_BUCKET_TEMP_UPLOADS = APPWRITE_CONFIG.BUCKETS.TEMP_UPLOADS;
export const APPWRITE_BUCKET_BACKUPS_ID = "backups";
export const APPWRITE_BUCKET_ENCRYPTED_BACKUPS_ID = "encryptedDataBackups";
export const APPWRITE_BUCKET_SECURE_DOCUMENTS_ID = "secureDocuments";

// --- App URI ---
export const APP_URI = process.env.NEXT_PUBLIC_APP_URI ?? `https://app.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;


// --- UNIFIED DOMAIN PULSE (CROSS-SUBDOMAIN INSTANT IDENTITY) ---
const PULSE_COOKIE_NAME = 'kylrix_pulse_v2';
const AVATAR_CACHE_PREFIX = 'kylrix_avatar_pulse_v2_';

export interface KylrixPulse {
    $id: string;
    name: string;
    profilePicId?: string | null;
    avatarBase64?: string | null;
}

export function getKylrixPulse(): KylrixPulse | null {
    if (typeof window === 'undefined') return null;
    if ((window as any).__KYLRIX_PULSE__) return (window as any).__KYLRIX_PULSE__;
    
    try {
        const match = document.cookie.match(new RegExp('(^| )' + PULSE_COOKIE_NAME + '=([^;]+)'));
        if (match) {
            const basic = JSON.parse(decodeURIComponent(match[2]));
            const avatar = localStorage.getItem(AVATAR_CACHE_PREFIX + basic.$id);
            return { ...basic, avatarBase64: avatar };
        }
    } catch (e) {}
    return null;
}

export function setKylrixPulse(user: any, avatarBase64?: string | null) {
    if (typeof window === 'undefined') return;
    try {
        const pulse = {
            $id: user.$id,
            name: user.name || user.username || 'User',
            profilePicId: user.prefs?.profilePicId || user.profilePicId || null
        };
        const domain = 'kylrix.space';
        document.cookie = `${PULSE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(pulse))}; path=/; domain=.${domain}; max-age=31536000; SameSite=Lax`;
        if (avatarBase64) localStorage.setItem(AVATAR_CACHE_PREFIX + user.$id, avatarBase64);
        (window as any).__KYLRIX_PULSE__ = { ...pulse, avatarBase64: avatarBase64 || localStorage.getItem(AVATAR_CACHE_PREFIX + user.$id) };
    } catch (e) {}
}

export function clearKylrixPulse() {
    if (typeof window === 'undefined') return;
    const domain = 'kylrix.space';
    document.cookie = `${PULSE_COOKIE_NAME}=; path=/; domain=.${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    delete (window as any).__KYLRIX_PULSE__;
    document.documentElement.removeAttribute('data-kylrix-pulse');
}

// Initialize session only if there's an existing session cookie (avoid auth errors for guests)
export const globalSessionPromise = typeof window !== 'undefined' 
  ? (async () => {
      try {
        // Check if there's an active session cookie before calling account.get()
        const hasCookie = document.cookie.includes('a_session');
        if (!hasCookie) return null;
        return await account.get();
      } catch (error) {
        // Silently fail for unauthenticated users
        return null;
      }
    })()
  : Promise.resolve(null);

export async function getCurrentUser(): Promise<any | null> {
    return await globalSessionPromise;
}

export async function getCurrentUserFromRequest(req: { headers: { get(k: string): string | null } } | null | undefined): Promise<any | null> {
    try {
        if (!req) return null;
        const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
        if (!cookieHeader) return null;
        const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
            method: 'GET',
            headers: { 'X-Appwrite-Project': APPWRITE_PROJECT_ID, 'Cookie': cookieHeader, 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data && data.$id) ? data : null;
    } catch { return null; }
}


// --- AppwriteService Utility Class ---
export class AppwriteService {
  static async getGlobalProfileStatus(userId: string) {
    try {
      const res = await databases.listDocuments(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, [
        Query.equal('userId', userId),
        Query.limit(1)
      ]);
      if (res.total > 0) {
        return { exists: true, profile: res.documents[0] };
      }
      return { exists: false, error: 'Not Found' };
    } catch (e: unknown) {
      return { exists: false, error: (e as any).message };
    }
  }

  static async hasMasterpass(userId: string): Promise<boolean> {
    try {
      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_USERS,
        [Query.equal('userId', userId), Query.limit(1)]
      );
      if (res.total > 0 && res.documents[0].hasMasterpass) {
        return true;
      }
      const entries = await this.listKeychainEntries(userId);
      return entries.some(e => e.type === 'password');
    } catch (e: any) {
      console.error('hasMasterpass error', e);
      return false;
    }
  }

  static async listKeychainEntries(userId: string): Promise<any[]> {
    try {
      const response = await databases.listDocuments(
        KEEP_DATABASE_ID,
        KEEP_COLLECTION_ID_KEYCHAIN,
        [Query.equal("userId", userId)],
      );
      return response.documents;
    } catch (e: any) {
      console.error('listKeychainEntries error', e);
      return [];
    }
  }

  static async createKeychainEntry(data: any): Promise<any> {
    return await databases.createDocument(
      KEEP_DATABASE_ID,
      KEEP_COLLECTION_ID_KEYCHAIN,
      ID.unique(),
      data
    );
  }

  /**
   * Create a Ghost Note (Anonymous)
   */
  static async createGhostNote(data: { title: string; content: string; format?: string; ghostSecret: string; expiresAt?: string; isEncrypted?: boolean }): Promise<any> {
    const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = JSON.stringify({
      isGhost: true,
      ghostSecret: data.ghostSecret,
      expiresAt: expiresAt,
      version: 'v2',
      isEncrypted: data.isEncrypted || false
    });

    const noteData = {
      title: data.title,
      content: data.content,
      format: data.format || 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'published',
      metadata: metadata,
      tags: [],
      comments: [],
      extensions: [],
      collaborators: [],
      attachments: null
    };

    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      ID.unique(),
      noteData,
      [
        Permission.read(Role.any()),
        // No update/delete for ghosts until claimed
      ]
    );
  }

  static async deleteKeychainEntry(id: string): Promise<boolean> {
    try {
      await databases.deleteDocument(
        KEEP_DATABASE_ID,
        KEEP_COLLECTION_ID_KEYCHAIN,
        id
      );
      return true;
    } catch (e: any) {
      console.error('deleteKeychainEntry error', e);
      return false;
    }
  }

  static async setMasterpassFlag(userId: string, email: string) {
    try {
      // Check if user doc exists in NOTE database
      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_USERS,
        [Query.equal('userId', userId), Query.limit(1)]
      );

      if (res.total > 0) {
        await databases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          res.documents[0].$id,
          { hasMasterpass: true }
        );
      } else {
        // Create user doc if it doesn't exist
        await databases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          ID.unique(),
          { userId, email, hasMasterpass: true }
        );
      }
    } catch (e: any) {
      console.error('setMasterpassFlag error', e);
    }
  }
}

export const appwriteDatabases = databases;
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
    const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const tagsCollection = APPWRITE_TABLE_ID_TAGS;
    // Fetch tag docs for user
    const tagDocsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      tagsCollection,
      [Query.equal('userId', currentUser.$id), Query.limit(500)] as any
    );
    const byNameLower: Record<string, any> = {};
    for (const td of tagDocsRes.documents as any[]) {
      if (td.nameLower) byNameLower[td.nameLower] = td;
      else if (td.name) byNameLower[String(td.name).toLowerCase()] = td;
    }
    // Fetch pivots missing tagId
    const pivotsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      noteTagsCollection,
      [Query.equal('userId', currentUser.$id), Query.isNull('tagId'), Query.limit(1000)] as any
    );
    let patched = 0;
    for (const p of pivotsRes.documents as any[]) {
      if (!p.tag || p.tagId) continue;
      const key = String(p.tag).toLowerCase();
      const tagDoc = byNameLower[key];
      if (tagDoc) {
        try {
          await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            noteTagsCollection,
            p.$id,
            { tagId: tagDoc.$id || tagDoc.id }
          );
          patched++;
        } catch (upErr) {
          console.error('backfill pivot update failed', upErr);
        }
      }
    }
    return { attempted: pivotsRes.documents.length, patched };
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
    const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const tagsCollection = APPWRITE_TABLE_ID_TAGS;
    // Fetch all user tag docs
    const tagDocsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      tagsCollection,
      [Query.equal('userId', currentUser.$id), Query.limit(500)] as any
    );
    const tagDocs = tagDocsRes.documents as any[];
    const tagIdToDoc: Record<string, any> = {};
    for (const td of tagDocs) tagIdToDoc[td.$id || td.id] = td;
    // Fetch all pivots for user
    const pivotsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      noteTagsCollection,
      [Query.equal('userId', currentUser.$id), Query.limit(5000)] as any
    );
    const counts: Record<string, number> = {};
    for (const p of pivotsRes.documents as any[]) {
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
          await databases.updateDocument(
            APPWRITE_DATABASE_ID,
            tagsCollection,
            td.$id,
            { usageCount: desired }
          );
          updated++;
        } catch (upErr) {
          console.error('reconcileTagUsage update failed', upErr);
        }
      }
    }
    return { tags: tagDocs.length, pivots: pivotsRes.documents.length, updated };
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
    const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';

    // Fetch pivots (bounded)
    const pivotsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      noteTagsCollection,
      [Query.equal('userId', currentUser.$id), Query.limit(5000)] as any
    );
    const pivots = pivotsRes.documents as any[];

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
      .filter(([, count]) => count > 1)
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
 * Returns: { documents, total, nextCursor, hasMore }
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
}

export async function listNotesPaginated(options: ListNotesPaginatedOptions = {}) {
  const {
    limit = 50,
    cursor = null,
    userId,
    queries,
    hydrateTags = true,
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
      return { documents: [], total: 0, nextCursor: null, hasMore: false };
    }
    
    baseQueries = [
      Query.equal('userId', effectiveUserId)
    ];
  }

  const finalQueries: any[] = [
    ...baseQueries,
    Query.limit(limit),
    Query.orderDesc('$createdAt'),
  ];
  if (cursor) finalQueries.push(Query.cursorAfter(cursor));

  const res: any = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    finalQueries
  );
  const notes = (res.documents as any[]).map(doc => hydrateVirtualAttributes(doc)) as unknown as Notes[];

  if (hydrateTags && notes.length) {
    try {
      const noteTagsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const noteIds = notes.map((n: any) => n.$id || (n as any).id).filter(Boolean);
      if (noteIds.length) {
        const pivotRes = await databases.listDocuments(
          APPWRITE_DATABASE_ID,
          noteTagsCollection,
          [Query.equal('noteId', noteIds), Query.limit(Math.min(1000, noteIds.length * 10))] as any
        );
        const tagMap: Record<string, Set<string>> = {};
        for (const p of pivotRes.documents as any[]) {
          if (!p.noteId || !p.tag) continue;
          if (!tagMap[p.noteId]) tagMap[p.noteId] = new Set();
          tagMap[p.noteId].add(p.tag);
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

  const batchLength = notes.length;
  const hasMore = batchLength === limit; // heuristic
  const nextCursor = hasMore && batchLength ? (notes[batchLength - 1] as any).$id || null : null;

  return {
    documents: notes,
    total: typeof res.total === 'number' ? res.total : notes.length,
    nextCursor,
    hasMore,
  };
}

// --- PERMISSIONS HELPERS ---

export function isNotePublic(note: Notes): boolean {
  // A note is public if the isPublic attribute is true
  // OR if it has a read permission for "any" or "guests" or "role:all"
  if (note.isPublic === true) return true;
  
  const permissions = (note as any).$permissions as string[] | undefined;
  if (!permissions) return false;

  return permissions.some(p => 
    p.includes('read("any")') || 
    p.includes('read("guests")') ||
    p.includes('read("role:all")')
  );
}

export function getNotePublicState(note: Notes): boolean {
  return typeof note.isPublic === 'boolean' ? note.isPublic : isNotePublic(note);
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
  return `${baseUrl}/shared/${noteId}${key ? `/${key}` : ''}`;
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
  return await databases.listDocuments(
    APPWRITE_CONFIG.DATABASES.VAULT,
    'key_mapping',
    [
      Query.equal('resourceType', 'note'),
      Query.equal('resourceId', noteId),
      Query.equal('grantee', `user:${ownerId}`),
      Query.limit(1),
    ] as any
  );
}

async function loadT4NoteKey(noteId: string, ownerId: string): Promise<CryptoKey> {
  const ownerPublicKey = await ecosystemSecurity.ensureE2EIdentity(ownerId);
  const keyMappingRes = await getT4NoteKeyMapping(noteId, ownerId);

  const mapping = keyMappingRes.documents[0] as any;
  if (!mapping?.wrappedKey) {
    throw new Error('Missing encryption key mapping for this note');
  }

  return await ecosystemSecurity.unwrapKeyForIdentity(mapping.wrappedKey, ownerPublicKey);
}

export async function decryptPublicEncryptedNote(note: Notes, forceKeyRefresh = false): Promise<Notes | null> {
  try {
    const meta = (() => {
      try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
    })();

    if (meta.clientDecrypted) {
      return note;
    }

    if (!(note.isPublic || isNotePublic(note)) || !meta.isEncrypted || meta.encryptionVersion !== 'T4') {
      return note;
    }

    let keyBase64 = forceKeyRefresh ? null : getCachedPublicNoteDecryptionKey(note.$id);
    if (!keyBase64) {
      keyBase64 = await getCurrentPublicNoteDecryptionKey(note.$id);
      if (!keyBase64) return null;
    }

    const key = await importUrlSafeAesKey(keyBase64);
    const decryptedTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || note.title || '', key);
    const decryptedContent = await ecosystemSecurity.decryptWithKey(note.content || '', key);
    cachePublicNoteDecryptionKey(note.$id, keyBase64);

    return {
      ...note,
      metadata: JSON.stringify({
        ...meta,
        clientDecrypted: true,
      }),
      title: decryptedTitle,
      content: decryptedContent,
    };
  } catch (error) {
    if (!forceKeyRefresh) {
      invalidatePublicNoteDecryptionKey(note.$id);
      return await decryptPublicEncryptedNote(note, true);
    }
    console.error('decryptPublicEncryptedNote failed:', error);
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
  const existingMappings = await getT4NoteKeyMapping(note.$id, ownerId);
  const hasExistingKey = existingMappings.total > 0;
  let symmetricKey: CryptoKey;
  let decryptionKey: string;

  if (!rotateLink && hasExistingKey) {
    const mapping = existingMappings.documents[0] as any;
    symmetricKey = await ecosystemSecurity.unwrapKeyForIdentity(mapping.wrappedKey, ownerPublicKey);
    decryptionKey = await exportUrlSafeCryptoKey(symmetricKey);
  } else {
    symmetricKey = await ecosystemSecurity.generateRandomMEK();
    decryptionKey = await exportUrlSafeCryptoKey(symmetricKey);
    const wrappedKey = await ecosystemSecurity.wrapKeyForIdentity(symmetricKey, ownerPublicKey);
    const mappingData = {
      resourceId: note.$id,
      resourceType: 'note',
      grantee: `user:${ownerId}`,
      wrappedKey,
      metadata: JSON.stringify({ algorithm: 'AES-GCM', version: 'T4' })
    };
    const mappingPermissions = [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId))
    ];

    if (hasExistingKey) {
      await databases.updateDocument(
        APPWRITE_CONFIG.DATABASES.VAULT,
        'key_mapping',
        (existingMappings.documents[0] as any).$id,
        mappingData,
        mappingPermissions
      );
    } else {
      await databases.createDocument(
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
    const commentsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_COMMENTS,
      [Query.equal('noteId', noteId), Query.limit(1000)] as any
    );
    const commentDocs = commentsRes.documents as any[];
    const commentIds = commentDocs.map((c) => c.$id).filter(Boolean);

    await Promise.all(
      commentDocs.map(async (comment) => {
        const commentUserId = comment.userId || ownerId;
        const permissions = [
          Permission.read(Role.user(ownerId)),
          ...(isPublic ? [Permission.read(Role.any())] : []),
          Permission.update(Role.user(commentUserId)),
          Permission.delete(Role.user(commentUserId))
        ];
        try {
          await databases.updateDocument(
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

    const noteReactionsRes = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_REACTIONS,
      [
        Query.equal('targetType', TargetType.NOTE),
        Query.equal('targetId', noteId),
        Query.limit(1000)
      ] as any
    );

    await Promise.all(
      (noteReactionsRes.documents as any[]).map(async (reaction) => {
        const reactionUserId = reaction.userId || ownerId;
        const permissions = [
          Permission.read(Role.user(ownerId)),
          ...(isPublic ? [Permission.read(Role.any())] : []),
          Permission.update(Role.user(reactionUserId)),
          Permission.delete(Role.user(reactionUserId))
        ];
        try {
          await databases.updateDocument(
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
      const commentReactionsRes = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_REACTIONS,
        [
          Query.equal('targetType', TargetType.COMMENT),
          Query.equal('targetId', commentIds),
          Query.limit(Math.min(1000, Math.max(50, commentIds.length * 10)))
        ] as any
      );

      await Promise.all(
        (commentReactionsRes.documents as any[]).map(async (reaction) => {
          const reactionUserId = reaction.userId || ownerId;
          const permissions = [
            Permission.read(Role.user(ownerId)),
            ...(isPublic ? [Permission.read(Role.any())] : []),
            Permission.update(Role.user(reactionUserId)),
            Permission.delete(Role.user(reactionUserId))
          ];
          try {
            await databases.updateDocument(
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

    if (newIsPublic) {
        const prepared = await preparePublicNoteUpdate(note, ownerId, false);
        decryptionKey = prepared.decryptionKey;
        if (decryptionKey) cachePublicNoteDecryptionKey(noteId, decryptionKey);
        Object.assign(updatePayload, prepared.updatePayload);
    } else {
        // Restore plaintext storage when moving back to private.
        if (!ecosystemSecurity.status.isUnlocked) {
            throw new Error('VAULT_LOCKED');
        }

        const meta = (() => {
          try { return JSON.parse(note.metadata || '{}'); } catch { return {}; }
        })();

        if (meta.isEncrypted || meta.encryptionVersion === 'T4') {
          const symmetricKey = await loadT4NoteKey(note.$id, ownerId);
          const plaintextTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || '', symmetricKey);
          const plaintextContent = await ecosystemSecurity.decryptWithKey(note.content || '', symmetricKey);

          updatePayload.title = plaintextTitle;
          updatePayload.content = plaintextContent;
        }

        updatePayload.metadata = stripT4Metadata(note.metadata);
    }

    const permissions = [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId))
    ];
    if (newIsPublic) {
      permissions.push(Permission.read(Role.any()));
    }
    if (allowAnyoneEdit) {
      permissions.push(Permission.update(Role.any()));
    }

    const updated = await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      noteId,
      filterNoteData(updatePayload),
      permissions
    );
    await syncNoteVisibilityChildren(noteId, ownerId, newIsPublic);
    if (!newIsPublic) {
      invalidatePublicNoteDecryptionKey(noteId);
    }
    
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

    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Not authenticated');

    const ownerId = note.userId || currentUser.$id;
    const prepared = await preparePublicNoteUpdate(note, ownerId, true);
    const permissions = [
      Permission.read(Role.user(ownerId)),
      Permission.update(Role.user(ownerId)),
      Permission.delete(Role.user(ownerId)),
      Permission.read(Role.any())
    ];

    const updated = await databases.updateDocument(
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

export async function getCurrentPublicNoteShareUrl(noteId: string): Promise<string | null> {
  try {
    const note = await getNote(noteId);
    if (!isNotePublic(note)) return null;
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;
    const ownerId = note.userId || currentUser.$id;
    const key = await loadT4NoteKey(noteId, ownerId);
    return getShareableUrl(noteId, await exportUrlSafeCryptoKey(key));
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
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;
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
    // We use getNote which uses the global guest-capable database client
    const note = await getNote(noteId);
    
    // Safety check: isPublic MUST be true
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
  permissions.add(Permission.update(Role.user(ownerId)));
  permissions.add(Permission.delete(Role.user(ownerId)));

  if (isNotePublic(note)) {
    permissions.add(Permission.read(Role.any()));
  }

  const editPermission = Permission.update(Role.any());
  if (enabled) {
    permissions.add(editPermission);
  } else {
    permissions.delete(editPermission);
  }

  const updated = await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_NOTES,
    noteId,
    {},
    Array.from(permissions)
  );

  return updated as unknown as Notes;
}

const appwrite = {
  client,
  account,
  databases,
  storage,
  // IDs
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID_USERS,
  APPWRITE_TABLE_ID_NOTES,
  APPWRITE_TABLE_ID_TAGS,
  APPWRITE_TABLE_ID_APIKEYS,
  APPWRITE_TABLE_ID_COMMENTS,
  APPWRITE_TABLE_ID_EXTENSIONS,
  APPWRITE_TABLE_ID_REACTIONS,
  APPWRITE_TABLE_ID_COLLABORATORS,
  APPWRITE_TABLE_ID_ACTIVITYLOG,
   APPWRITE_TABLE_ID_SETTINGS,
   APPWRITE_TABLE_ID_SUBSCRIPTIONS,
  APPWRITE_BUCKET_PROFILE_PICTURES,
  APPWRITE_BUCKET_NOTES_ATTACHMENTS,
  APPWRITE_BUCKET_EXTENSION_ASSETS,
  APPWRITE_BUCKET_BACKUPS,
  APPWRITE_BUCKET_TEMP_UPLOADS,
  // Methods
  getCurrentUser,
  sendEmailVerification,
  completeEmailVerification,
  getEmailVerificationStatus,
  sendPasswordResetEmail,
  completePasswordReset,
  createNote,
  getNote,
  getNotePublicState,
  isNoteEditableByAnyone,
  setAnyoneCanEdit,
  updateNote,
  deleteNote,
  toggleNoteVisibility,
  rotatePublicNoteLink,
  getCurrentPublicNoteShareUrl,
   listNotes,
   listNotesPaginated,
   getAllNotes,
  createTag,
  getTag,
  updateTag,
  deleteTag,
  listTags,
  getAllTags,
  listTagsByUser,
  createApiKey,
  getApiKey,
  updateApiKey,
  deleteApiKey,
  listApiKeys,
  createComment,
  getComment,
  updateComment,
  deleteComment,
  listComments,
  createExtension,
  getExtension,
  updateExtension,
  deleteExtension,
  listExtensions,
  createReaction,
  getReaction,
  updateReaction,
  deleteReaction,
  listReactions,
  deleteReactionsForTarget,
  createCollaborator,
  getCollaborator,
  updateCollaborator,
  deleteCollaborator,
  listCollaborators,
  createActivityLog,
  getActivityLog,
  updateActivityLog,
  deleteActivityLog,
  listActivityLogs,
  createSettings,
  getSettings,
  updateSettings,
  deleteSettings,
  listSettings,
  updateAIMode,
  getAIMode,
  uploadFile,
  getFile,
  deleteFile,
  listFiles,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  searchNotesByTitle,
  searchNotesByTag,
  getNotesByTag,
  listNotesByUser,
  listPublicNotesByUser,
  getPublicNote,
  shareNoteWithUser,
   shareNoteWithUserId,
   getSharedUsers,
   removeNoteSharing,
  getSharedNotes,
  getNoteWithSharing,
  uploadProfilePicture,
  getProfilePicture,
  deleteProfilePicture,
  uploadNoteAttachment,
  getNoteAttachment,
   deleteNoteAttachment,
   backfillNoteTagPivots,
   reconcileTagUsage,
   auditNoteTagPivots,
    // User profile functions
    createUser,
    getUser,
    updateUser,
    deleteUser,
    listUsers,
    searchUsers,
    generateSignedAttachmentURL,
    verifySignedAttachmentURL,
};

// Ecosystem: Flow
export async function listFlowTasks(queries: any[] = []) {
  return databases.listDocuments(FLOW_DATABASE_ID, FLOW_COLLECTION_ID_TASKS, queries);
}

export async function listFlowEvents(queries: any[] = []) {
  return databases.listDocuments(FLOW_DATABASE_ID, FLOW_COLLECTION_ID_EVENTS, queries);
}

// Ecosystem: Keep
export async function listKeepCredentials(queries: any[] = []) {
  return databases.listDocuments(KEEP_DATABASE_ID, KEEP_COLLECTION_ID_CREDENTIALS, queries);
}

export default appwrite;
