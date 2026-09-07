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
export async function listNotesPaginated(options: ListNotesPaginatedOptions = {}) {
  const {
    limit = 50,
    cursor = null,
    sinceUpdatedAt = null,
    userId,
    queries,
    hydrateTags = true,
    includeStories = false,
    includeThreads = false} = options;

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
    ...(!includeThreads ? ideaListExclusionQueries() : []),
    Query.limit(limit),
    Query.orderDesc('$updatedAt')];
  if (sinceUpdatedAt) finalQueries.push(Query.greaterThan('$updatedAt', sinceUpdatedAt));
  if (cursor) finalQueries.push(Query.cursorAfter(cursor));

  let res: any;
  try {
    res = await databases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      finalQueries
    );
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const user = await getCurrentUser().catch(() => null);
        effectiveUserId = user?.$id;
      }
      try {
        const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
        const db = await getRxDB().catch(() => null);
        if (db?.notes) {
          const selector: any = { _deleted: { $ne: true } };
          if (effectiveUserId && effectiveUserId !== 'guest') {
            selector.$or = [{ userId: effectiveUserId }, { userId: 'guest' }, { userId: { $exists: false } }];
          }
          const docs = await db.notes.find({ selector }).exec().catch(() => []);
          const sortedDocs = docs
            .map((d: any) => (d.toJSON ? d.toJSON() : d))
            .sort((a: any, b: any) => new Date(b.updatedAt || b.$updatedAt || 0).getTime() - new Date(a.updatedAt || a.$updatedAt || 0).getTime());

          const rows = sortedDocs
            .map((doc: any) => ({
              $id: doc.id || doc.$id,
              $createdAt: doc.updatedAt || doc.createdAt || doc.$createdAt || new Date().toISOString(),
              $updatedAt: doc.updatedAt || doc.$updatedAt || new Date().toISOString(),
              title: doc.title,
              content: doc.content,
              format: doc.format || 'text',
              tags: doc.tags || [],
              userId: doc.userId || effectiveUserId || 'guest',
              isPublic: Boolean(doc.isPublic),
              isGuest: Boolean(doc.isGuest),
              metadata: doc.metadata || '{}',
            }))
            .filter((doc: any) => includeThreads || !isExcludedNote(doc)) as any[];

          if (rows.length > 0) {
            return {
              rows,
              total: rows.length,
              nextCursor: null,
              hasMore: false,
            };
          }
        }

        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cachedList =
          (await LocalEngine.cacheGet<any[]>(`f_notes_list_${effectiveUserId || 'guest'}`).catch(() => null)) ||
          (await LocalEngine.cacheGet<any[]>(`f_ideas_${effectiveUserId || 'guest'}`).catch(() => null));
        const candidateRows = (Array.isArray(cachedList) ? cachedList : (cachedList as any)?.rows) || [];
        if (candidateRows.length > 0) {
          return {
            rows: candidateRows,
            total: candidateRows.length,
            nextCursor: null,
            hasMore: false,
          };
        }
      } catch {}
      return { rows: [], total: 0, nextCursor: null, hasMore: false };
    }
    throw err;
  }

  let notes = (res?.rows as any[] || []).map((doc: any) => hydrateVirtualAttributes(doc)) as unknown as Notes[];

  // Merge any local-only / unsynced RxDB notes with remote notes so local creations are never lost
  if (typeof window !== 'undefined') {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const user = await getCurrentUser().catch(() => null);
        effectiveUserId = user?.$id;
      }
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);
      if (db?.notes) {
        const selector: any = { _deleted: { $ne: true } };
        if (effectiveUserId && effectiveUserId !== 'guest') {
          selector.$or = [{ userId: effectiveUserId }, { userId: 'guest' }, { userId: { $exists: false } }];
        }
        const localDocs = (await db.notes.find({ selector }).exec().catch(() => []))
          .map((d: any) => (d.toJSON ? d.toJSON() : d));
        const existingIds = new Set(notes.map((n: any) => n.$id || (n as any).id));
        const missingLocalRows = localDocs
          .filter((d: any) => !existingIds.has(d.id || d.$id))
          .map((doc: any) => ({
            $id: doc.id || doc.$id,
            $createdAt: doc.updatedAt || doc.createdAt || doc.$createdAt || new Date().toISOString(),
            $updatedAt: doc.updatedAt || doc.$updatedAt || new Date().toISOString(),
            title: doc.title,
            content: doc.content,
            format: doc.format || 'text',
            tags: doc.tags || [],
            userId: doc.userId || effectiveUserId || 'guest',
            isPublic: Boolean(doc.isPublic),
            isGuest: Boolean(doc.isGuest),
            metadata: doc.metadata || '{}',
          }))
          .filter((doc: any) => includeThreads || !isExcludedNote(doc));

        if (missingLocalRows.length > 0) {
          notes = [...missingLocalRows, ...notes] as unknown as Notes[];
        }
      }
    } catch {}
  }

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
    filteredNotes = filteredNotes.filter((n: any) => n && n.isTrash !== true && n.isDeleted !== true && String(n.isTrash) !== 'true' && String(n.isDeleted) !== 'true');
  }
  if (!includeStories) {
    filteredNotes = filteredNotes.filter((n: any) => !(n as any).isStory);
  }
  if (!includeThreads) {
    filteredNotes = filteredNotes.filter((n: any) => !isExcludedNote(n));
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
    if (rawDek) {
      if (!ecosystemSecurity.status.isUnlocked) {
        return note; // cannot decrypt locked note, leave as encrypted
      }
      try {
        const { decryptField } = await import('../masterpass-crypto');
        let dekBase64: string;
        try {
          dekBase64 = await decryptField(rawDek);
        } catch {
          const decryptedDekRaw = await ecosystemSecurity.decrypt(rawDek);
          try { dekBase64 = JSON.parse(decryptedDekRaw); } catch { dekBase64 = decryptedDekRaw; }
        }
        const rawKey = base64ToBytes(dekBase64);
        const dek = await crypto.subtle.importKey(
          "raw",
          rawKey as any,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const decryptedTitle = await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || note.title || '', dek);
        const decryptedContent = await ecosystemSecurity.decryptWithKey(note.content || '', dek);
        activeNoteKeys.set(note.$id, dek);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
          title: decryptedTitle,
          content: decryptedContent};
      } catch (err: any) {
        console.error('DEK decryption failed, attempting self-healing fallback:', err);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true })};
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
          content: decryptedContent};
    } catch (err: any) {
        console.error('T4 decryption failed, attempting self-healing fallback:', err);
        cachePublicNoteDecryptionKey(note.$id, keyBase64);
        activeNoteKeys.set(note.$id, key);
        return {
          ...note,
          metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
          title: decryptedTitle};
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
        isThread: false,
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

    if (meta.isEncrypted || meta.encryptionVersion === 'T4' || liveNote.dek) {
      // Lock (dek column): unwrap MEK-wrapped DEK into URL fragment
      if (liveNote.dek) {
        try {
          const { getNoteShareUrlWithDek } = await import('@/lib/appwrite/goal-crypto');
          return await getNoteShareUrlWithDek(liveNote.$id, liveNote.dek);
        } catch {
          /* fall through to T4 path */
        }
      }

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

