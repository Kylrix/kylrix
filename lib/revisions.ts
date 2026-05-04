import { databases, APPWRITE_DATABASE_ID, Query, ID } from './appwrite';
import type { NoteRevisions } from '@/types/appwrite';
import { APPWRITE_CONFIG } from './appwrite/config';

const REVISION_LIMITS = {
  free: 3,
  paid: 10,
};

/**
 * Get user's subscription plan (free or paid)
 * TODO: Integrate with actual subscription system
 */
async function getUserPlan(_userId?: string): Promise<'free' | 'paid'> {
  // For now, everyone is on free plan
  // When subscription system is integrated, check here
  return 'free';
}

/**
 * Get revision limit based on user plan
 */
async function getRevisionLimit(_userId?: string): Promise<number> {
  const plan = await getUserPlan(_userId);
  return REVISION_LIMITS[plan];
}

/**
 * Prune old revisions, keeping only the latest N based on plan
 * Intelligently ignores very old revisions (outliers)
 */
export async function pruneRevisions(
  noteId: string,
  userId?: string
): Promise<void> {
  try {
    const limit = await getRevisionLimit(userId);
    const revisionsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_REVISIONS || 'note_revisions';

    // Get all revisions for this note, ordered by revision DESC
    const allRevisions = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      revisionsCollection,
      [
        Query.equal('noteId', noteId),
        Query.orderDesc('revision'),
        Query.limit(1000), // Fetch more to find outliers
      ] as any
    );

    if (allRevisions.documents.length <= limit) {
      return; // No pruning needed
    }

    const docs = allRevisions.documents as any[];

    // Keep the latest `limit` revisions
    const _toKeep = docs.slice(0, limit).map((d) => d.$id);
    const toDelete = docs.slice(limit).map((d) => d.$id);

    // Delete old revisions
    for (const revisionId of toDelete) {
      try {
        await databases.deleteDocument(
          APPWRITE_DATABASE_ID,
          revisionsCollection,
          revisionId
        );
      } catch (e: any) {
        console.error(`Failed to delete revision ${revisionId}:`, e);
      }
    }
  } catch (e: any) {
    console.error('pruneRevisions failed:', e);
    // Fail silently - don't break note updates
  }
}

/**
 * Get revision history for a note
 */
export async function getNoteRevisions(
  noteId: string,
  limit?: number
): Promise<NoteRevisions[]> {
  try {
    const revisionsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_REVISIONS || 'note_revisions';
    const effectiveLimit = limit || (await getRevisionLimit());

    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      revisionsCollection,
      [
        Query.equal('noteId', noteId),
        Query.orderDesc('revision'),
        Query.limit(effectiveLimit),
      ] as any
    );

    return res.documents as unknown as NoteRevisions[];
  } catch (e: any) {
    console.error('getNoteRevisions failed:', e);
    return [];
  }
}

/**
 * Get a specific revision by number
 */
export async function getNoteRevision(
  noteId: string,
  revisionNumber: number
): Promise<NoteRevisions | null> {
  try {
    const revisionsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_REVISIONS || 'note_revisions';

    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      revisionsCollection,
      [
        Query.equal('noteId', noteId),
        Query.equal('revision', revisionNumber),
        Query.limit(1),
      ] as any
    );

    return (res.documents[0] as unknown as NoteRevisions) || null;
  } catch (e: any) {
    console.error('getNoteRevision failed:', e);
    return null;
  }
}

/**
 * Check if content has changed significantly
 * Used for autosave - only save if changes are substantial
 */
export function hasSignificantChanges(
  prev: Record<string, any>,
  current: Record<string, any>,
  fieldsToCheck: string[] = ['title', 'content', 'tags']
): boolean {
  for (const field of fieldsToCheck) {
    const prevVal = prev[field];
    const currVal = current[field];

    // If either is missing, check if both are missing
    if (prevVal === undefined || currVal === undefined) {
      if (prevVal !== currVal) return true;
      continue;
    }

    // Compare serialized versions
    const prevSerialized = JSON.stringify(prevVal);
    const currSerialized = JSON.stringify(currVal);

    if (prevSerialized !== currSerialized) {
      // For content, check minimum change threshold (avoid single char changes)
      if (field === 'content') {
        const prevText = String(prevVal || '').trim();
        const currText = String(currVal || '').trim();
        const diff = Math.abs(prevText.length - currText.length);
        // Only consider it significant if diff > 5 chars or field was empty
        if (diff > 5 || (prevText === '' && currText !== '') || (prevText !== '' && currText === '')) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  return false;
}

/**
 * Create a revision for a note update
 * This is called internally by updateNote
 */
export async function createRevision(
  noteId: string,
  before: Record<string, any>,
  after: Record<string, any>,
  cause: 'manual' | 'ai' | 'collab' = 'manual'
): Promise<NoteRevisions | null> {
  try {
    const revisionsCollection = APPWRITE_CONFIG.TABLES.NOTE.NOTE_REVISIONS || 'note_revisions';
    const significantFields = ['title', 'content', 'tags', 'format'];

    // Check if anything actually changed
    const changes: Record<string, { before: any; after: any }> = {};
    let changed = false;

    for (const f of significantFields) {
      if (f in after) {
        const prevVal = before[f];
        const newVal = after[f];
        const prevSerialized = JSON.stringify(prevVal ?? null);
        const newSerialized = JSON.stringify(newVal ?? null);
        if (prevSerialized !== newSerialized) {
          changed = true;
          changes[f] = { before: prevVal ?? null, after: newVal ?? null };
        }
      }
    }

    if (!changed) {
      return null; // No revision needed
    }

    // Determine next revision number
    let revisionNumber = 1;
    try {
      const existing = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        revisionsCollection,
        [
          Query.equal('noteId', noteId),
          Query.orderDesc('revision'),
          Query.limit(1),
        ] as any
      );
      if (existing.documents.length) {
        revisionNumber = (existing.documents[0] as any).revision + 1;
      }
    } catch {}

    // Build diff JSON (bounded by 8000 size limit)
    let diffStr: string | null = null;
    if (after.format !== 'doodle') {
      try {
        const diffObj = { changes };
        const serialized = JSON.stringify(diffObj);
        if (serialized.length <= 8000) {
          diffStr = serialized;
        } else {
          // If too large, just note that changes occurred
          diffStr = JSON.stringify({
            summary: 'Changes made',
            fieldCount: Object.keys(changes).length,
          });
        }
      } catch {
        diffStr = null;
      }
    }

    // Create revision document
    const revision = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      revisionsCollection,
      ID.unique(),
      {
        noteId,
        revision: revisionNumber,
        userId: before.userId || null,
        title: after.title || null,
        content: after.content || null,
        createdAt: new Date().toISOString(),
        diff: diffStr,
        diffFormat: diffStr ? 'json' : null,
        fullSnapshot: true,
        cause,
      }
    );

    return revision as unknown as NoteRevisions;
  } catch (e: any) {
    console.error('createRevision failed:', e);
    return null;
  }
}
