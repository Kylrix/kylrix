/**
 * Notes local-copy hydration — same cascade spirit as attach-object drawer / goals.
 * Context notes → RxDB notes → LocalEngine f_notes_list → Nexus initial_notes_{userId}.
 */

import type { Notes } from '@/types/appwrite';

export type InitialNotesCachePayload = {
  notes: Notes[];
  totalNotes: number;
  cursor: string | null;
  hasMore: boolean;
};

function asNotesArray(value: unknown): Notes[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as Notes[];
  if (typeof value === 'object' && Array.isArray((value as any).notes)) {
    return (value as any).notes as Notes[];
  }
  if (typeof value === 'object' && Array.isArray((value as any).rows)) {
    return (value as any).rows as Notes[];
  }
  return [];
}

function normalizeNoteRow(row: any): Notes | null {
  if (!row || typeof row !== 'object') return null;
  if (row.isTrash === true || row.isDeleted === true || String(row.isTrash) === 'true' || String(row.isDeleted) === 'true') {
    return null;
  }
  const id = String(row.$id || row.id || '').trim();
  if (!id) return null;
  return {
    ...row,
    $id: id} as Notes;
}

export async function loadNotesFromLocalCopy(opts: {
  userId: string;
  existingNotes?: Notes[];
  getCachedDataSync?: (key: string) => unknown;
  getCachedDataAsync?: (key: string) => Promise<unknown>;
}): Promise<InitialNotesCachePayload | null> {
  if (opts.existingNotes?.length) {
    return {
      notes: opts.existingNotes,
      totalNotes: opts.existingNotes.length,
      cursor: null,
      hasMore: true};
  }

  const userId = String(opts.userId || '').trim() || 'guest';
  const nexusKeys = [`initial_notes_${userId}`];

  // 1) Sync Nexus memory (0ms)
  for (const key of nexusKeys) {
    const syncHit = opts.getCachedDataSync?.(key);
    const notes = asNotesArray(syncHit)
      .map(normalizeNoteRow)
      .filter((n): n is Notes => !!n);
    if (notes.length) {
      const payload = syncHit as InitialNotesCachePayload;
      return {
        notes,
        totalNotes: payload?.totalNotes || notes.length,
        cursor: payload?.cursor ?? null,
        hasMore: payload?.hasMore ?? true};
    }
  }

  // 2) RxDB notes collection — check for active user, guest, and local offline creations
  try {
    const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
    const db = await getRxDB().catch(() => null);
    if (db?.notes) {
      const selector: any = { _deleted: { $ne: true } };
      if (userId && userId !== 'guest') {
        selector.$or = [{ userId: { $eq: userId } }, { userId: { $eq: 'guest' } }, { userId: { $exists: false } }];
      }
      const rxRows = (await db.notes.find({ selector }).exec().catch(() => []))
        .map((d: any) => (d.toJSON ? d.toJSON() : d));
      const notes = rxRows.map(normalizeNoteRow).filter((n): n is Notes => !!n);
      if (notes.length) {
        return {
          notes,
          totalNotes: notes.length,
          cursor: null,
          hasMore: true};
      }
    }
  } catch {
    /* non-fatal */
  }

  // 3) LocalEngine flat list — check f_notes_list_${userId} and f_ideas_${userId}
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const [list, ideasObj] = await Promise.all([
      LocalEngine.cacheGet<any[]>(`f_notes_list_${userId}`).catch(() => null),
      LocalEngine.cacheGet<{ rows?: any[] } | any[]>(`f_ideas_${userId}`).catch(() => null),
    ]);
    const ideasList = Array.isArray(ideasObj) ? ideasObj : ideasObj?.rows;
    const candidates = (list && list.length > 0 ? list : ideasList) || [];
    const notes = candidates.map(normalizeNoteRow).filter((n): n is Notes => !!n);
    if (notes.length) {
      return {
        notes,
        totalNotes: notes.length,
        cursor: null,
        hasMore: true};
    }
  } catch {
    /* non-fatal */
  }

  // 4) Async Nexus / RxDB cache bag
  if (opts.getCachedDataAsync) {
    for (const key of nexusKeys) {
      try {
        const asyncHit = await opts.getCachedDataAsync(key);
        const notes = asNotesArray(asyncHit)
          .map(normalizeNoteRow)
          .filter((n): n is Notes => !!n);
        if (notes.length) {
          const payload = asyncHit as InitialNotesCachePayload;
          return {
            notes,
            totalNotes: payload?.totalNotes || notes.length,
            cursor: payload?.cursor ?? null,
            hasMore: payload?.hasMore ?? true};
        }
      } catch {
        /* try next key */
      }
    }
  }

  return null;
}

/** Warm LocalEngine so attach-object drawer / other surfaces hit the same SoT. */
export async function warmNotesLocalCopy(userId: string, notes: Notes[]): Promise<void> {
  if (!userId || !notes?.length) return;
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    // Only write to userId-keyed cache — never write to shared 'f_notes_list' to prevent cross-account bleed
    await LocalEngine.cacheSet(`f_notes_list_${userId}`, notes);
  } catch {
    /* non-fatal */
  }
}
