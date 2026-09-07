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
export async function validatePublicNoteAccess(noteId: string): Promise<Notes | null> {
  try {
    if (typeof window === 'undefined') {
      const { systemTables } = await import('@/lib/data');
      const tables = systemTables();
      
      const doc = await tables.getRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID_NOTES,
        rowId: noteId,
      }) as any;
      
      // Safety check: isPublic or isGuest MUST be true
      if (doc && (doc.isPublic === true || doc.isGuest === true)) {
        hydrateVirtualAttributes(doc);
        try {
          const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
          const pivot = await tables.listRows({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: noteTagsTable,
            queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
          });
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

  if (note.dek || meta.dek) {
    return note;
  }

  const dek = await ecosystemSecurity.generateRandomMEK();
  const rawKey = await crypto.subtle.exportKey("raw", dek);
  const dekBase64 = bytesToBase64(new Uint8Array(rawKey));
  const wrappedDek = await encryptField(dekBase64);

  const encryptedTitle = await ecosystemSecurity.encryptWithKey(note.title || '', dek);
  const encryptedContent = await ecosystemSecurity.encryptWithKey(note.content || '', dek);

  // dek alone marks lock; encryptedTitle kept in metadata for display placeholder title
  const updatedMeta = {
    ...meta,
    encryptedTitle
  };
  delete updatedMeta.isEncrypted;
  delete updatedMeta.encryptionVersion;
  delete updatedMeta.dek;

  const updatePayload: any = {
    id: note.$id,
    userId: ownerId,
    title: 'Locked',
    content: encryptedContent,
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

  const { decryptField } = await import("../masterpass-crypto");
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
  return new Uint8Array(atob(value).split('').map((char) => char.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

