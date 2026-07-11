import * as shared from './shared';
import {
  ID, Permission, Query, Role, Databases, TablesDB, Account
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import {
  allowsCollaboratorSharing,
  getCollaboratorCap,
  getContainerObjectCap,
  getProjectCap
} from '@/lib/entitlements';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { Registry } from '@/lib/core/di/registry';
import { createServerClient } from '@/lib/appwrite/server';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { trackEngagementView, type TrackEngagementInput } from '@/lib/services/internal/engagement-views';
import { deleteCallIfExpired } from '@/lib/services/internal/calls';
import { applyPermissionMutation, revokePermissionMutation } from '@/lib/services/internal/permissions';
import { normalizeTargetUserIds, upsertLockboxRows, provisionHybridTeamExpansionSecure } from '@/lib/api/permission-updater';
import { reconcileStaleLiveCallPresenceForUser } from '@/lib/services/internal/live-call-presence-reconcile';
import { executeSessionRuntimeJob, isSessionRuntimeJobId } from '@/lib/runtime-functions/session-jobs';
import { isMfaRequiredError } from '@/lib/mfa';
import { getNoteAttachmentIdFromMomentFileId } from '@/lib/moment-file-meta';
import { permissionsInternal } from '@/lib/services/internal/permissions';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { dispatchSecureNotification } from '@/lib/services/internal/notification-dispatcher';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import { verifyCreatorDeletionProof } from '@/lib/ephemeral/ephemeral-proof';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { validatePublicNoteAccess } from '@/lib/appwrite/note';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { inferAttachmentMimeType, resolveAttachmentVisualKind } from '@/lib/note-object-visual';
import { PublicResourceType } from '@/lib/share/resource-types';
import {
  MutatePermissionsSchema,
  IDSchema,
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema,
  NoteSchema,
  ProjectSchema,
  EventSchema,
  FormSchema,
  TokenOperationSchema,
  TelemetrySchema,
  EphemeralNoteSchema,
  SuggestionParamsSchema
} from '@/lib/validations/schemas';

// Import interfaces / types from shared
import { PermissionChangeInput, PermissionLevel, TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  hasWriteAccess,
  serializeMomentRow,
  verifyResourcePermissionSecure,
  verifyNotePermission,
  verifyProjectPermission,
  verifyFormPermission,
  verifyEventPermission,
  sanitizeEventData,
  serializeTokenMintResult,
  rowCache,
  CACHE_TTL_MS,
  VIEWER_COOKIE,
  isViewerTokenValid,
  issueViewerToken,
  cookies
} = shared;

export async function mintNoteShareMomentSecure(input: { momentId: string }) {
  const momentId = String(input?.momentId || '').trim();
  if (!momentId) throw new Error('momentId is required');

  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const momentsTable = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
  const tables = createSystemTablesDB();
  let moment: Record<string, unknown>;
  try {
    moment = (await tables.getRow({
      databaseId: chatDb,
      tableId: momentsTable,
      rowId: momentId,
    })) as Record<string, unknown>;
  } catch {
    return { tokenMint: { accepted: false, reason: 'MOMENT_NOT_FOUND' } };
  }

  const creatorId = String(moment?.userId || '').trim();
  if (!creatorId) return { tokenMint: { accepted: false, reason: 'INVALID_MOMENT' } };

  const noteId = getNoteAttachmentIdFromMomentFileId(moment?.fileId);
  if (!noteId) return { tokenMint: { accepted: false, reason: 'NO_NOTE_ATTACHMENT' } };

  let note: Record<string, unknown>;
  try {
    const tables = createSystemTablesDB();
    note = (await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: noteId,
    })) as Record<string, unknown>;
  } catch {
    return { tokenMint: { accepted: false, reason: 'NOTE_NOT_FOUND' } };
  }

  if (!Boolean(note?.isPublic)) return { tokenMint: { accepted: false, reason: 'NOTE_NOT_PUBLIC' } };
  if (!hasWriteAccess(note, creatorId)) return { tokenMint: { accepted: false, reason: 'FORBIDDEN' } };

  let tokenMint: Record<string, unknown> = { accepted: false, reason: 'MINT_FAILED' };
  try {
    const rawMint = await InternalKylrixTokenService.mintForActivity({
      userId: creatorId,
      idempotencyKey: `mint:share_public_note_moment:${momentId}`,
      activityType: 'share_public_note_moment',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'moment_share_note',
      sourceId: momentId,
      metadata: { noteId, momentId },
    });
    tokenMint = serializeTokenMintResult(rawMint);
  } catch (error: unknown) {
    tokenMint = { accepted: false, reason: String((error as { message?: string })?.message || 'MINT_FAILED') };
  }

  return { tokenMint };
}

export async function sharePublicNoteAsMomentSecure(input: { noteId: string; text?: string; jwt?: string }) {
  const actor = await getActor(input.jwt);
  if (!actor) throw new Error('Unauthorized');

  const noteId = String(input?.noteId || '').trim();
  const text = String(input?.text || '').trim();
  if (!noteId) throw new Error('noteId is required');

  const tables = createSystemTablesDB();
  const note = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: noteId,
    });

  if (!Boolean(note?.isPublic)) throw new Error('Only public notes can be shared as moments');
  if (!hasWriteAccess(note, actor.$id)) throw new Error('Forbidden');

  const noteTitle = String(note?.title || 'Untitled Note').trim();
  const metadata = { type: 'post', attachments: [{ type: 'note', id: noteId }] };
  const now = new Date().toISOString();
  const chatDb = APPWRITE_CONFIG.DATABASES.CHAT;
  const momentsTable = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;
  const perms = [
    `read("user:${actor.$id}")`];

  const moment = await tables.createRow({
      databaseId: chatDb,
      tableId: momentsTable,
      rowId: ID.unique(),
      data: {
    userId: actor.$id,
    caption: text,
    type: 'image',
    momentKind: 'post',
    sourceId: null,
    searchTitle: noteTitle,
    fileId: JSON.stringify(metadata),
    createdAt: now,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
      permissions: perms,
    });

  let tokenMint: Record<string, unknown> = { accepted: false, reason: 'MINT_FAILED' };
  try {
    const rawMint = await InternalKylrixTokenService.mintForActivity({
      userId: actor.$id,
      idempotencyKey: `mint:share_public_note_moment:${moment.$id}`,
      activityType: 'share_public_note_moment',
      uniqueActors: 1,
      trustScore: 85,
      sourceType: 'moment_share_note',
      sourceId: moment.$id,
      metadata: { noteId, momentId: moment.$id },
    });
    tokenMint = serializeTokenMintResult(rawMint);
  } catch (error: unknown) {
    tokenMint = { accepted: false, reason: String((error as { message?: string })?.message || 'MINT_FAILED') };
  }

  return {
    moment: serializeMomentRow(moment as Record<string, unknown>),
    tokenMint,
  };
}

export async function burnEphemeralNoteSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = EphemeralNoteSchema.parse({ noteId: params.noteId, secret: params.deletionSecret });
  const validatedJwt = JWTSchema.parse(jwt);

  const noteId = validated.noteId;
  const deletionSecret = validated.secret;

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // Parallel Fetch: Actor identity + Note document
  const [actor, doc] = await Promise.all([
    getActor(validatedJwt),
    databases.getRow(dbId, tableId, noteId).catch(() => null)
  ]);

  // We don't strictly REQUIRE actor for burning as it's often done anonymously via secret link
  // but we should log it if they ARE logged in.
  console.log(`[burnEphemeralNoteSecure] Burn requested for note ${noteId} by actor ${actor?.$id || 'anonymous'}`);

  if (!doc) {
    throw new Error('Note not found');
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String((doc as any).metadata || '{}'));
  } catch {
    meta = {};
  }

  if (!meta.isGhost) {
    throw new Error('Not an ephemeral note');
  }

  const expectedHash = String(meta.creatorDeletionProofHash || '').trim();
  if (!expectedHash) {
    throw new Error('This note cannot be burned remotely');
  }

  if (!verifyCreatorDeletionProof(meta, deletionSecret)) {
    throw new Error('Invalid deletion proof');
  }

  // Recursive cleanup for storage files, comments, reactions, etc.
  await executeCascadeDeleteSecure(dbId, tableId, noteId);

  await databases.deleteRow(dbId, tableId, noteId);
  return { success: true };
}

export async function consumeEphemeralNoteSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = EphemeralNoteSchema.parse({ noteId: params.noteId, secret: params.claimSecret });
  const validatedJwt = JWTSchema.parse(jwt);

  const noteId = validated.noteId;
  const claimSecret = validated.secret;

  const { databases, storage } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // Parallel Fetch: Actor identity + Note document
  const [actor, doc] = await Promise.all([
    getActor(validatedJwt),
    databases.getRow(dbId, tableId, noteId).catch(() => null)
  ]);

  if (!actor?.$id) {
    throw new Error('Unauthorized');
  }

  if (!doc) {
    throw new Error('Note not found');
  }

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(String((doc as any).metadata || '{}'));
  } catch {
    meta = {};
  }

  if (!meta.isGhost) {
    throw new Error('Not an ephemeral note');
  }

  if (!verifyCreatorDeletionProof(meta, claimSecret)) {
    throw new Error('Invalid claim proof');
  }

  const sendObj = meta.send_object as { kind?: string; bucketId?: string; fileId?: string } | undefined;
  if (sendObj?.kind === 'file' && !hasPaidKylrixPlan(actor)) {
    const err = new Error('Kylrix Pro is required to claim Send files into your library.');
    (err as any).code = 'PRO_REQUIRED';
    throw err;
  }

  if (sendObj?.kind === 'file' && sendObj.bucketId && sendObj.fileId) {
    await storage.deleteFile(sendObj.bucketId, sendObj.fileId).catch(() => undefined);
  }

  await databases.deleteRow(dbId, tableId, noteId);
  return { success: true };
}

const NOTE_DB_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTES_TABLE_ID = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

async function hydrateSharedNoteRow(noteId: string) {
  const tables = createSystemTablesDB();
  const doc = await tables.getRow({
    databaseId: NOTE_DB_ID,
    tableId: NOTES_TABLE_ID,
    rowId: noteId,
  }) as any;

  try {
    const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
    const pivot = await tables.listRows({
      databaseId: NOTE_DB_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
    });
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

export async function canReadSharedNoteSecure(noteId: string, actorId?: string | null) {
  if (actorId) {
    const allowed = await verifyNotePermission(noteId, actorId, 'viewer');
    if (allowed) return true;
  }
  const publicNote = await validatePublicNoteAccess(noteId);
  return !!publicNote;
}

export async function getSharedNoteDataSecure(noteId: string, jwt?: string) {
  const validatedJwt = JWTSchema.parse(jwt);
  const actor = await getActor(validatedJwt).catch(() => null);

  const canRead = await canReadSharedNoteSecure(noteId, actor?.$id);
  if (!canRead) return null;

  const note = await hydrateSharedNoteRow(noteId);

  const metadata = JSON.parse(String((note as any).metadata || '{}'));
  const huddleCallId = (note as any).huddleCallId || metadata.huddleCallId;
  if (huddleCallId) {
    try {
      const { databases } = createSystemClient();
      await deleteCallIfExpired(databases as any, huddleCallId);
    } catch {}
  }

  return note;
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
    const bucketId = input.bucketId || (childKind === 'voice' ? 'voice' : APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE);
    const { getFilePreviewSecure } = await import('./misc');
    let previewDataUrl: string | null = null;

    const needsRasterPreview = visualKind === 'image' || visualKind === 'video' || childKind === 'image';
    if (needsRasterPreview) {
      previewDataUrl = await getFilePreviewSecure(bucketId, childId, 960, 540);
    }

    const needsFullBlob =
      !previewDataUrl &&
      (visualKind === 'image' || visualKind === 'pdf' || visualKind === 'video' || visualKind === 'audio');
    if (needsFullBlob) {
      try {
        const blob = await getNoteInheritedFileBlobSecure(input.noteId, childId, bucketId, validatedJwt);
        if (blob.dataUrl) previewDataUrl = blob.dataUrl;
      } catch {
        // best effort
      }
    }

    return {
      ok: true as const,
      title: fallbackTitle,
      href: null as string | null,
      previewDataUrl,
      childKind,
      bucketId,
      fileId: childId,
      mimeType: blobMimeFromPreview(previewDataUrl) || mimeType,
      visualKind,
    };
  }

  const map: Record<string, { db: string; table: string }> = {
    task: { db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.TASKS },
    form: { db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.FORMS },
    note: { db: NOTE_DB_ID, table: NOTES_TABLE_ID },
    vault: { db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS },
  };
  const target = map[childKind];
  if (!target) {
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

  try {
    const tables = createSystemTablesDB();
    const row = await tables.getRow({
      databaseId: target.db,
      tableId: target.table,
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

function blobMimeFromPreview(dataUrl: string | null | undefined): string | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const semi = dataUrl.indexOf(';');
  if (semi <= 5) return null;
  return dataUrl.slice(5, semi);
}

export async function getNoteInheritedFileBlobSecure(
  noteId: string,
  fileId: string,
  bucketId: string,
  jwt?: string,
) {
  const validatedJwt = JWTSchema.parse(jwt);
  const actor = await getActor(validatedJwt).catch(() => null);
  const canRead = await canReadSharedNoteSecure(noteId, actor?.$id);
  if (!canRead) {
    throw new Error('Forbidden');
  }

  const { storage } = createSystemClient();
  const [buffer, fileMeta] = await Promise.all([
    storage.getFileDownload(bucketId, fileId),
    storage.getFile(bucketId, fileId).catch(() => null),
  ]);
  const mimeType = fileMeta?.mimeType || 'application/octet-stream';
  const base64 = Buffer.from(buffer).toString('base64');
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
    name: fileMeta?.name || fileId,
  };
}

export async function getPublicNoteDataSecure(noteId: string, jwt?: string) {
  return getSharedNoteDataSecure(noteId, jwt);
}

export async function getPublicNoteCommentsSecure(noteId: string) {
  const note = await validatePublicNoteAccess(noteId);
  if (!note) throw new Error('Note not found or not public');

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    [
      Query.equal('noteId', noteId),
      Query.orderAsc('$createdAt'),
      Query.limit(200)
    ]
  );
  return { rows: res.rows };
}

export async function getPublicNoteReactionsSecure(noteId: string, targetId?: string, targetType?: string) {
  const note = await validatePublicNoteAccess(noteId);
  if (!note) throw new Error('Note not found or not public');

  const { databases } = createSystemClient();
  const res = await databases.listRows(
    APPWRITE_CONFIG.DATABASES.NOTE,
    APPWRITE_CONFIG.TABLES.NOTE.REACTIONS,
    [
      Query.equal('targetType', targetType || 'note'),
      Query.equal('targetId', targetId || noteId),
      Query.orderAsc('$createdAt'),
      Query.limit(500)
    ]
  );
  return { rows: res.rows };
}

export async function getCrossSuggestionsSecure(params: any, jwt?: string) {
  // Rigorous runtime validation
  const validated = SuggestionParamsSchema.parse(params);
  const validatedJwt = JWTSchema.parse(jwt);

  const actor = await getActor(validatedJwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { sourceApp, sourceType, sourceId } = validated;
  const baseId = sourceId || 'unknown';

  let suggestions = [
    { id: `note:${baseId}`, label: 'Attach Note', description: 'Expose a note-link action.' },
    { id: `event:${baseId}`, label: 'Create Event', description: 'Expose an event creation action.' }
  ];

  if (sourceApp === 'note' || sourceType === 'note') {
    suggestions = [
      { id: `task:${baseId}`, label: 'Create Task', description: 'Convert the note into an actionable task.' },
      { id: `event:${baseId}`, label: 'Create Event', description: 'Turn the note into a scheduled event.' },
      { id: `followup:${baseId}`, label: 'Add Follow-up', description: 'Generate a follow-up action from this note.' }
    ];
  } else if (sourceType === 'task' || sourceApp === 'flow') {
    suggestions = [
      { id: `note:${baseId}`, label: 'Attach Note', description: 'Link a source note to this task.' },
      { id: `event:${baseId}`, label: 'Calendar Event', description: 'Map this task onto a calendar surface.' }
    ];
  }

  return { sourceApp, sourceType, sourceId, suggestions };
}

export async function syncNotesDeltaSecure(localManifest: { id: string; updatedAt: string }[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  // 1. Fetch all server-side note IDs and their updatedAt timestamps for this user
  // This is a lightweight metadata-only fetch
  const serverRows = await databases.listRows(dbId, tableId, [
    Query.equal('userId', actor.$id),
    Query.select(['$id', '$updatedAt']),
    Query.limit(5000)
  ]);

  const serverManifest = new Map(serverRows.rows.map(d => [d.$id, d.$updatedAt]));
  const localMap = new Map(localManifest.map(m => [m.id, m.updatedAt]));

  const toFetch: string[] = [];
  const toDelete: string[] = [];

  // Check for updates or new items
  for (const [sId, sUpdated] of serverManifest.entries()) {
    const lUpdated = localMap.get(sId);
    if (!lUpdated || new Date(sUpdated) > new Date(lUpdated)) {
      toFetch.push(sId);
    }
  }

  // Check for deletions
  for (const lId of localMap.keys()) {
    if (!serverManifest.has(lId)) {
      toDelete.push(lId);
    }
  }

  // 2. Surgical Fetch: Only get the full records that have changed
  let patches: any[] = [];
  if (toFetch.length > 0) {
    // Chunk requests if there are too many (Appwrite limit)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
        const chunk = toFetch.slice(i, i + CHUNK_SIZE);
        const res = await databases.listRows(dbId, tableId, [
            Query.equal('$id', chunk),
            Query.limit(CHUNK_SIZE)
        ]);
        patches.push(...res.rows);
    }
  }

  return {
    success: true,
    patches,
    deletedIds: toDelete,
    serverTime: new Date().toISOString()
  };
}

export async function pullNotesDeltaSecure(params: { lastCheckpoint: string | null; limit: number }, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const queries = [
    Query.or([
      Query.equal('userId', actor.$id),
      Query.equal('creatorId', actor.$id),
    ]),
    Query.orderAsc('$updatedAt'),
    Query.limit(params.limit || 50)
  ];

  if (params.lastCheckpoint) {
    queries.push(Query.greaterThan('$updatedAt', params.lastCheckpoint));
  }

  const res = await databases.listRows(dbId, tableId, queries);

  const documents = res.rows.map(doc => ({
    id: doc.$id,
    title: doc.title,
    content: doc.content,
    userId: doc.userId,
    metadata: doc.metadata,
    updatedAt: doc.$updatedAt,
    crdt: doc.crdt || null,
    _deleted: doc.isDeleted || false
  }));

  const lastDoc = documents[documents.length - 1];
  const checkpoint = lastDoc ? { updatedAt: lastDoc.updatedAt, id: lastDoc.id } : null;

  return { documents, checkpoint };
}

export async function pushNotesDeltaSecure(rows: any[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
  const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const conflicts: any[] = [];

  for (const row of rows) {
    const { newDocumentState, assumedMasterState } = row;
    const noteId = newDocumentState.id;

    // 1. Fetch current master state
    const currentMaster = await databases.getRow(dbId, tableId, noteId).catch(() => null);

    if (currentMaster) {
      // 2. Authorization: Verify ownership
      const ownerId = String(currentMaster.userId || currentMaster.creatorId || currentMaster.ownerId || '').trim();
      if (ownerId !== actor.$id) {
          // Check shared access if not owner
          const hasAccess = await verifyResourcePermissionSecure({
              databaseId: dbId,
              tableId: tableId,
              rowId: noteId,
              actorId: actor.$id,
              action: 'update'
          });
          if (!hasAccess) {
              console.warn(`[PushDelta] Unauthorized write attempt for ${noteId} by ${actor.$id}`);
              continue; 
          }
      }

      // 3. Conflict Detection
      if (!assumedMasterState || currentMaster.$updatedAt !== assumedMasterState.updatedAt) {
        console.log(`[PushDelta] Conflict detected for ${noteId}. Server: ${currentMaster.$updatedAt}, Client assumed: ${assumedMasterState?.updatedAt}`);
        conflicts.push({
            id: currentMaster.$id,
            title: currentMaster.title,
            content: currentMaster.content,
            userId: currentMaster.userId,
            metadata: currentMaster.metadata,
            updatedAt: currentMaster.$updatedAt,
            crdt: currentMaster.crdt || null,
            _deleted: false
        });
        continue;
      }

      // 4. No conflict: Update
      await databases.updateRow(dbId, tableId, noteId, {
        title: newDocumentState.title,
        content: newDocumentState.content,
        metadata: newDocumentState.metadata,
        crdt: typeof newDocumentState.crdt === 'string' ? newDocumentState.crdt : JSON.stringify(newDocumentState.crdt),
      });
    } else {
      // 5. New document: Create
      await databases.createRow(dbId, tableId, noteId || ID.unique(), {
        title: newDocumentState.title,
        content: newDocumentState.content,
        userId: actor.$id,
        metadata: newDocumentState.metadata,
        crdt: typeof newDocumentState.crdt === 'string' ? newDocumentState.crdt : JSON.stringify(newDocumentState.crdt),
      });
    }
  }

  return conflicts;
}

export async function createNoteSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Rigorous runtime validation
  const validated = NoteSchema.parse(data);

  // Mathematically tie the create operation to the current user
  const noteData: any = {
    ...validated,
    userId: actor.$id,
    creatorId: actor.$id,
  };

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data: noteData,
  });
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const contentLength = (noteData.content || '').length;
  const STANDARD_LIMIT = 65535;
  const ARTICLE_LIMIT = 655300000;
  const limit = noteData.article === true ? ARTICLE_LIMIT : STANDARD_LIMIT;

  if (contentLength > limit) {
    throw new Error(`Content exceeds maximum allowed limit for ${noteData.article === true ? 'articles' : 'standard notes'}`);
  }

  const tables = createSystemTablesDB();
  const { databases } = createSystemClient();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const { 
    cleanRowData, 
    filterNoteData, 
    getNotePermissions,
    createNoteCreationService,
  } = await import('@/lib/appwrite/note');

  const syncTags = async ({ noteId, rawTags, userId, now }: any) => {
    try {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const unique = Array.from(new Set(rawTags.map((tag: any) => tag.trim()))).filter(Boolean) as string[];
      if (!unique.length) return;

      const existingTagRows: Record<string, any> = {};
      try {
        const existingTagsRes = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', unique.map((tag: any) => tag.toLowerCase())), Query.limit(unique.length)] as any,
    });
        for (const td of existingTagsRes.rows as any[]) {
          if (td.nameLower) existingTagRows[td.nameLower] = td;
        }
      } catch (tagListErr) {
        console.error('tag preload failed on server', tagListErr);
      }

      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        if (!existingTagRows[key]) {
          try {
            const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId, createdAt: now, usageCount: 0 },
    });
            existingTagRows[key] = created;
          } catch (createTagErr: any) {
            try {
              const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
              if (retry.rows.length) existingTagRows[key] = retry.rows[0];
            } catch {}
          }
        }
      }

      const existingPivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any,
    });
      const existingPairs = new Set(existingPivot.rows.map((p: any) => `${p.tagId || ''}::${p.tag || ''}`));
      for (const tagName of unique) {
        const key = tagName.toLowerCase();
        const tagRow = existingTagRows[key];
        const tagId = tagRow ? (tagRow.$id || tagRow.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        
        try {
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', userId), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        if (existingPairs.has(pairKey)) continue;
        try {
          await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: ID.unique(),
      data: { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId, createdAt: now },
    });
        } catch (e: any) {
          console.error('note_tags create failed on server', e?.message || e);
        }
      }
    } catch (e: any) {
      console.error('dual-write note_tags error on server', e);
    }
  };

  const noteCreationServiceServer = createNoteCreationService({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    generateId: () => ID.unique(),
    getCurrentUser: async () => ({ $id: actor.$id }),
    createRow: async (databaseId, tableId, data, rowId, permissions) => {
      return tables.createRow({
      databaseId: databaseId,
      tableId: tableId,
      rowId: rowId || ID.unique(),
      data: data as any,
      permissions: permissions,
    }) as any;
    },
    getNote: async (noteId) => {
      const row = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
    }) as any;
      try {
        const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
        const pivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
    });
        if (pivot.rows.length) {
          const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
          (row as any).tags = tags;
        }
      } catch {}
      if (!row.attachments || !Array.isArray(row.attachments)) {
        row.attachments = [];
      }
      return row;
    },
    getNotePermissions,
    cleanRowData,
    filterNoteData,
    syncTags,
  });

  const note = await noteCreationServiceServer.createNote(noteData);
  return JSON.parse(JSON.stringify(note));
}

export async function updateNoteSecure(noteId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
  if (!isValidAppwriteRowId(noteId)) {
    throw new Error('This idea is saved offline only. Sign in and wait for sync, or save it again while online.');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this note');
  }

  const contentLength = (data.content || '').length;
  const STANDARD_LIMIT = 65535;
  const ARTICLE_LIMIT = 655300000;
  const limit = data.article === true ? ARTICLE_LIMIT : STANDARD_LIMIT;

  if (contentLength > limit) {
    throw new Error(`Content exceeds maximum allowed limit for ${data.article === true ? 'articles' : 'standard notes'}`);
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const { 
    cleanRowData, 
    filterNoteData, 
    getNotePermissions,
    createNoteCreationService,
    sanitizeNoteUpdatePatch,
  } = await import('@/lib/appwrite/note');

  const noteRow = await tables.getRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    rowId: noteId,
  }) as { creatorId?: string | null; userId?: string | null };

  const noteOwnerId = noteRow.creatorId || noteRow.userId || '';
  const patch = sanitizeNoteUpdatePatch({ ...data }, { actorId: actor.$id, noteOwnerId });

  const hydrateNoteRow = async (rowId: string) => {
    const hydrated = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId,
    }) as any;
    try {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const pivot = await tables.listRows({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: noteTagsTable,
        queries: [Query.equal('resourceId', rowId), Query.equal('resourceType', 'note'), Query.limit(200)] as any,
      });
      if (pivot.rows.length) {
        const tags = Array.from(new Set(pivot.rows.map((p: any) => p.tag).filter(Boolean)));
        hydrated.tags = tags;
      }
    } catch {}
    if (!hydrated.attachments || !Array.isArray(hydrated.attachments)) {
      hydrated.attachments = [];
    }
    return hydrated;
  };

  const noteService = createNoteCreationService({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ID_NOTES,
    getCurrentUser: async () => ({ $id: actor.$id }),
    createRow: async () => {
      throw new Error('createRow is not available in updateNoteSecure');
    },
    updateRow: async (_databaseId, _tableId, rowId, rowData, permissions) => {
      return tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ID_NOTES,
        rowId,
        data: rowData as any,
        permissions,
      }) as any;
    },
    getNote: hydrateNoteRow,
    getNotePermissions,
    cleanRowData,
    filterNoteData,
  });

  const updatedAt = new Date().toISOString();
  const row = await noteService.updateNote(noteId, patch, { ownerId: noteOwnerId || actor.$id });

  try {
    if (Array.isArray(patch.tags)) {
      const noteTagsTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
      const tagsTable = APPWRITE_TABLE_ID_TAGS;
      const incomingRaw: string[] = patch.tags.filter(Boolean).map((t: string) => t.trim());
      const normalizedIncoming = Array.from(new Set(incomingRaw)).filter(Boolean);
      const incomingSet = new Set(normalizedIncoming);

      const tagRows: Record<string, any> = {};
      if (normalizedIncoming.length) {
        try {
          const existingTagsRes = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', normalizedIncoming.map(t => t.toLowerCase())), Query.limit(normalizedIncoming.length)] as any,
    });
          for (const td of existingTagsRes.rows as any[]) {
            if (td.nameLower) tagRows[td.nameLower] = td;
          }
        } catch (preErr) {
          console.error('updateNoteSecure tag preload failed', preErr);
        }
        for (const tagName of normalizedIncoming) {
          const key = tagName.toLowerCase();
          if (!tagRows[key]) {
            try {
              const created = await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      rowId: ID.unique(),
      data: { name: tagName, nameLower: key, userId: actor.$id, createdAt: updatedAt, usageCount: 0 },
    });
              tagRows[key] = created;
            } catch (createErr) {
              try {
                const retry = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tagsTable,
      queries: [Query.equal('userId', actor.$id), Query.equal('nameLower', key), Query.limit(1)] as any,
    });
                if (retry.rows.length) tagRows[key] = retry.rows[0];
              } catch {}
            }
          }
        }
      }

      const existingPivot = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      queries: [Query.equal('resourceId', noteId), Query.equal('resourceType', 'note'), Query.limit(500)] as any,
    });
      const existingByTag: Record<string, any> = {};
      const existingPairs = new Set<string>();
      for (const p of existingPivot.rows as any[]) {
        if (p.tag) existingByTag[p.tag] = p;
        if (p.tagId && p.tag) existingPairs.add(`${p.tagId}::${p.tag}`);
      }

      for (const tagName of normalizedIncoming) {
        const key = tagName.toLowerCase();
        const tagRow = tagRows[key];
        const tagId = tagRow ? (tagRow.$id || tagRow.id) : undefined;
        if (!tagId) continue;
        const pairKey = `${tagId}::${tagName}`;
        if (existingPairs.has(pairKey)) continue;

        try {
          const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
          if (res.rows.length) {
            const tRow: any = res.rows[0];
            const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
            await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: current + 1 },
    });
          }
        } catch {}

        try {
          await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: ID.unique(),
      data: { resourceId: noteId, resourceType: 'note', tagId, tag: tagName, userId: actor.$id, createdAt: updatedAt },
    });
          existingPairs.add(pairKey);
        } catch (ie) {
          console.error('note_tags create (updateNoteSecure) failed', ie);
        }
      }

      for (const [tagName, pivotRow] of Object.entries(existingByTag)) {
        if (!incomingSet.has(tagName)) {
          try {
            const res = await tables.listRows({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      queries: [Query.equal('userId', actor.$id), Query.equal('name', tagName), Query.limit(1)] as any,
    });
            if (res.rows.length) {
              const tRow: any = res.rows[0];
              const current = typeof tRow.usageCount === 'number' && !isNaN(tRow.usageCount) ? tRow.usageCount : 0;
              await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_TAGS,
      rowId: tRow.$id,
      data: { usageCount: Math.max(0, current - 1) },
    });
            }
          } catch {}

          try {
            await tables.deleteRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: noteTagsTable,
      rowId: (pivotRow as any).$id,
    });
          } catch (de) {
            console.error('note_tags stale delete failed in updateNoteSecure', de);
          }
        }
      }
    }
  } catch (e: any) {
    console.error('dual-write note_tags update error in updateNoteSecure', e);
  }

  return JSON.parse(JSON.stringify(row));
}

export async function deleteNoteSecure(noteId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyNotePermission(noteId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this note');
  }

  const tables = createSystemTablesDB();
  const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
  const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

  const result = await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ID_NOTES,
      rowId: noteId,
      data: { isTrash: true }
    });
  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteSecure(data: {
  title: string;
  content: string;
  format?: string;
  ghostSecret: string;
  expiresAt?: string;
  isEncrypted?: boolean;
  creatorDeletionProofHash?: string;
}) {
  const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    ghostSecret: data.ghostSecret,
    expiresAt: expiresAt,
    version: 'v2',
    isEncrypted: data.isEncrypted || false,
    ...(data.creatorDeletionProofHash ? { creatorDeletionProofHash: data.creatorDeletionProofHash } : {}),
  });

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
      isGhost: true,
      isThread: false,
    },
    permissions: [`read("any")`],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteForCallSecure(callId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedSource: 'call',
    linkedTaskId: callId,
    expiresAt: expiresAt,
    version: 'v2',
  });

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
      isGhost: true,
      isThread: true,
    },
    permissions: [Permission.read(Role.user(actor.$id))],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteForProjectSecure(projectId: string, title?: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedResourceType: 'project',
    linkedResourceId: projectId,
    expiresAt: expiresAt,
    version: 'v2',
  });

  const tables = createSystemTablesDB();
  
  // Fetch parent project to mirror permissions
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId
  }).catch(() => null);

  if (!project) {
      throw new Error('Project not found');
  }

  // Derive permissions from the parent project
  const projectPermissions = project.$permissions || [];
  // We want to extract all 'read' roles from the parent project to mirror them on the thread
  const authorizedReadRoles = projectPermissions
      .filter((p: string) => p.startsWith('read('))
      .map((p: string) => p.substring(5, p.length - 1));

  // Build strict permissions: No read("any")!
  const threadPermissions = authorizedReadRoles.map(role => `read(${role})`);

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: ID.unique(),
    data: {
      title: title || 'Project Discussion',
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: project.ownerId,
      creatorId: project.ownerId,
      resourceId: projectId,
      resourceType: 'project',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: threadPermissions,
  });

  // Update parent project metadata with discussionNoteId
  let projMeta: any = {};
  try {
    projMeta = JSON.parse(project.metadata || '{}');
  } catch {}
  projMeta.discussionNoteId = result.$id;
  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(projMeta)
    }
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteForResourceSecure(
  resourceId: string,
  resourceType: 'task' | 'project' | 'tag' | 'event' | 'form',
  title?: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const metadata = JSON.stringify({
    isGhost: true,
    linkedResourceType: resourceType,
    linkedResourceId: resourceId,
    expiresAt: expiresAt,
    version: 'v2',
  });

  const tables = createSystemTablesDB();
  
  // Try to delete any existing Ghost Note for this resource to avoid duplicates
  try {
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    });
  } catch {}

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId, // RowId matches the resourceId directly!
    data: {
      title: title || `Discussion Thread`,
      content: '',
      format: 'markdown',
      isPublic: false,
      userId: actor.$id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      creatorId: actor.$id,
      resourceId: resourceId,
      resourceType: resourceType,
      metadata,
      isGhost: true,
      isThread: true,
    },
    permissions: [Permission.read(Role.user(actor.$id))],
  });

  return JSON.parse(JSON.stringify(result));
}

export async function createGhostNoteChatSecure(data: {
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
    isGhost: true,
    version: 'v2',
    isChat: true,
    expiresAt: expiresAt,
    linkedResourceType: 'chat',
    participants: data.participants,
  });

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
      isGhost: true,
      isThread: true,
      isChat: true,
      collaborators: data.participants,
    },
    permissions: data.participants.map(id => Permission.read(Role.user(id))),
  });

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
          accepted: true,
        },
        permissions: data.participants.map(id => Permission.read(Role.user(id))),
      });
    } catch (e) {
      console.error('[createGhostNoteChat] Failed to add collaborator row:', e);
    }
  }

  return JSON.parse(JSON.stringify(result));
}

export async function listGhostNoteChatsSecure(jwt?: string) {
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
