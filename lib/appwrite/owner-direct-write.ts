/**
 * Sole-owner TablesDB writes via the session client (no Vercel Server Action).
 * Requires owner update ACL on the row (see ownerRowPermissions). Falls through to secure-ops on denial.
 */

import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { ownerRowPermissions } from '@/lib/appwrite/owner-acl';
import { getCurrentUserSnapshot } from '@/lib/appwrite/client';

const STANDARD_CONTENT_LIMIT = 65535;
const ARTICLE_CONTENT_LIMIT = 655300000;

/** Last note.tags signature written via owner-direct — tag pivots still need secure-ops on change. */
const lastNoteTagSig = new Map<string, string>();

async function sessionTablesDB() {
  const { getSessionTablesDB } = await import('@/lib/appwrite/client');
  return getSessionTablesDB();
}

function stripSystemKeys(data: Record<string, unknown>) {
  const next = { ...data };
  for (const key of Object.keys(next)) {
    if (key.startsWith('$')) delete next[key];
  }
  delete next.pendingSync;
  return next;
}

function claimedOtherOwner(data: any, actorId: string | undefined): boolean {
  if (!actorId) return true;
  const claimed = String(data?.userId || data?.creatorId || data?.ownerId || '').trim();
  return Boolean(claimed && claimed !== actorId && claimed !== 'guest');
}

function isAclMiss(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('permission') ||
    err?.code === 401 ||
    err?.code === 404
  );
}

/** Signed-in actor editing their own row (payload does not claim another owner). */
function canOwnerDirect(data: any): string | null {
  const actorId = getCurrentUserSnapshot()?.$id;
  if (!actorId || actorId === 'guest') return null;
  if (claimedOtherOwner(data, actorId)) return null;
  return actorId;
}

function tagSignature(tags: unknown): string {
  if (!Array.isArray(tags)) return '';
  return Array.from(
    new Set(tags.map((t) => String(t || '').trim()).filter(Boolean)),
  )
    .sort()
    .join('\0');
}

function assertNoteContentLimit(data: any) {
  const contentLength = String(data?.content || '').length;
  const limit = data?.article === true ? ARTICLE_CONTENT_LIMIT : STANDARD_CONTENT_LIMIT;
  if (contentLength > limit) {
    throw new Error(
      `Content exceeds maximum allowed limit for ${data?.article === true ? 'articles' : 'standard notes'}`,
    );
  }
}

export async function tryOwnerDirectUpdateNote(noteId: string, data: any): Promise<any | null> {
  const actorId = canOwnerDirect(data);
  if (!actorId) return null;

  // Tag pivot rows need create ACL via secure-ops — only when the tag set actually changes.
  if (Object.prototype.hasOwnProperty.call(data || {}, 'tags')) {
    const nextSig = tagSignature(data.tags);
    const prevSig = lastNoteTagSig.get(noteId);
    if (prevSig === undefined) {
      lastNoteTagSig.set(noteId, nextSig);
    } else if (prevSig !== nextSig) {
      lastNoteTagSig.set(noteId, nextSig);
      return null;
    }
  }

  try {
    assertNoteContentLimit(data);
    const { sanitizeNoteUpdatePatch, filterNoteData, getNotePermissions } = await import(
      '@/lib/appwrite/note'
    );
    const { clampNoteTitle } = await import('@/constants/noteTitle');
    const patch = sanitizeNoteUpdatePatch(
      {
        ...data,
        title:
          data.title !== undefined
            ? clampNoteTitle(data.title, 'Untitled Thought')
            : data.title,
        userId: actorId,
        creatorId: actorId,
      },
      { actorId, noteOwnerId: actorId },
    );
    const filtered = filterNoteData(stripSystemKeys(patch as any));
    const tables = await sessionTablesDB();
    const isPublic = filtered.isPublic === true;
    return await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: noteId,
      data: filtered as any,
      permissions: getNotePermissions(actorId, isPublic),
    });
  } catch (err: any) {
    if (isAclMiss(err)) return null;
    throw err;
  }
}

export async function tryOwnerDirectUpdateGoal(goalId: string, data: any): Promise<any | null> {
  const actorId = canOwnerDirect(data);
  if (!actorId) return null;

  try {
    const { pickGoalAutosavePayload } = await import('@/lib/goals/pick-goal-autosave-payload');
    const payload = pickGoalAutosavePayload({
      ...data,
      userId: actorId,
      creatorId: actorId,
    });
    const tables = await sessionTablesDB();
    return await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      rowId: goalId,
      data: stripSystemKeys(payload as any) as any,
      permissions: ownerRowPermissions(actorId, { isPublic: !!(data as any)?.isPublic }),
    });
  } catch (err: any) {
    if (isAclMiss(err)) return null;
    throw err;
  }
}

export async function tryOwnerDirectUpdateEvent(eventId: string, data: any): Promise<any | null> {
  const actorId = canOwnerDirect(data);
  if (!actorId) return null;

  try {
    const tables = await sessionTablesDB();
    return await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: stripSystemKeys(data) as any,
      permissions: ownerRowPermissions(actorId, { isPublic: !!(data as any)?.isPublic }),
    });
  } catch (err: any) {
    if (isAclMiss(err)) return null;
    throw err;
  }
}

export async function tryOwnerDirectUpdateForm(formId: string, data: any): Promise<any | null> {
  const actorId = canOwnerDirect(data);
  if (!actorId) return null;

  try {
    const tables = await sessionTablesDB();
    return await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: stripSystemKeys(data) as any,
      permissions: ownerRowPermissions(actorId, { isPublic: !!(data as any)?.isPublic }),
    });
  } catch (err: any) {
    if (isAclMiss(err)) return null;
    throw err;
  }
}

export async function tryOwnerDirectUpdateProject(projectId: string, data: any): Promise<any | null> {
  const actorId = canOwnerDirect(data);
  if (!actorId) return null;
  if (data?.isShared === true || data?.isAgentic === true) return null;

  try {
    const tables = await sessionTablesDB();
    return await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: stripSystemKeys(data) as any,
      permissions: ownerRowPermissions(actorId, { isPublic: !!(data as any)?.isPublic }),
    });
  } catch (err: any) {
    if (isAclMiss(err)) return null;
    throw err;
  }
}
