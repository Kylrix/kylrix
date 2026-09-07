/**
 * Local-only import batch earmarks + high-priority outbox.
 * Never written to Appwrite — LocalEngine substrate only.
 */

import { LocalEngine } from '@/lib/services/LocalEngine';
import { ID } from 'appwrite';

export type ImportEarmarkStatus = 'local' | 'syncing' | 'synced' | 'error';

export type ImportEarmark = {
  batchId: string;
  kind: 'credential' | 'totp';
  status: ImportEarmarkStatus;
  rowId: string;
  userId: string;
  error?: string;
  updatedAt: string;
};

export type ImportOutboxItem = {
  rowId: string;
  kind: 'credential' | 'totp';
  batchId: string;
  userId: string;
  /** Higher = sooner (import batches start high) */
  priority: number;
  enqueuedAt: string;
};

export type ImportBatchMeta = {
  batchId: string;
  userId: string;
  createdAt: string;
  itemIds: string[];
  sealed: number;
  synced: number;
  errors: number;
};

const EARMARK_KEY = (rowId: string) => `import_earmark_${rowId}`;
const OUTBOX_KEY = (userId: string) => `import_outbox_${userId}`;
const BATCH_KEY = (batchId: string) => `import_batch_${batchId}`;
const BATCH_INDEX_KEY = (userId: string) => `import_batches_${userId}`;

/** Import sync priority — above casual background work. */
export const IMPORT_SYNC_PRIORITY = 10_000;

const flushLocks = new Map<string, Promise<void>>();
const kickInflight = new Set<string>();

export async function startImportBatch(userId: string): Promise<string> {
  const batchId = ID.unique();
  const meta: ImportBatchMeta = {
    batchId,
    userId,
    createdAt: new Date().toISOString(),
    itemIds: [],
    sealed: 0,
    synced: 0,
    errors: 0,
  };
  await LocalEngine.cacheSet(BATCH_KEY(batchId), meta);
  const idx = ((await LocalEngine.cacheGet<string[]>(BATCH_INDEX_KEY(userId))) || []) as string[];
  await LocalEngine.cacheSet(BATCH_INDEX_KEY(userId), [batchId, ...idx.filter((id) => id !== batchId)].slice(0, 40));
  return batchId;
}

export async function getImportEarmark(rowId: string): Promise<ImportEarmark | null> {
  return (await LocalEngine.cacheGet<ImportEarmark>(EARMARK_KEY(rowId))) || null;
}

export async function setImportEarmark(earmark: ImportEarmark): Promise<void> {
  await LocalEngine.cacheSet(EARMARK_KEY(earmark.rowId), {
    ...earmark,
    updatedAt: new Date().toISOString(),
  });
}

async function patchBatch(
  batchId: string,
  patch: Partial<ImportBatchMeta> & { addItemId?: string },
): Promise<void> {
  const prev = ((await LocalEngine.cacheGet<ImportBatchMeta>(BATCH_KEY(batchId))) || {
    batchId,
    userId: '',
    createdAt: new Date().toISOString(),
    itemIds: [],
    sealed: 0,
    synced: 0,
    errors: 0,
  }) as ImportBatchMeta;
  const itemIds = patch.addItemId
    ? Array.from(new Set([...(prev.itemIds || []), patch.addItemId]))
    : prev.itemIds;
  await LocalEngine.cacheSet(BATCH_KEY(batchId), {
    ...prev,
    ...patch,
    itemIds,
    addItemId: undefined,
  } as any);
}

export async function enqueueImportOutbox(item: ImportOutboxItem): Promise<void> {
  const key = OUTBOX_KEY(item.userId);
  const prev = ((await LocalEngine.cacheGet<ImportOutboxItem[]>(key)) || []) as ImportOutboxItem[];
  const next = [item, ...prev.filter((p) => p.rowId !== item.rowId)];
  // Highest priority first
  next.sort((a, b) => b.priority - a.priority || a.enqueuedAt.localeCompare(b.enqueuedAt));
  await LocalEngine.cacheSet(key, next);
  await setImportEarmark({
    batchId: item.batchId,
    kind: item.kind,
    status: 'local',
    rowId: item.rowId,
    userId: item.userId,
    updatedAt: new Date().toISOString(),
  });
  await patchBatch(item.batchId, {
    addItemId: item.rowId,
    sealed: undefined,
  });
  const meta = await LocalEngine.cacheGet<ImportBatchMeta>(BATCH_KEY(item.batchId));
  if (meta) {
    await LocalEngine.cacheSet(BATCH_KEY(item.batchId), {
      ...meta,
      sealed: (meta.itemIds || []).length,
    });
  }
}

export async function listImportOutbox(userId: string): Promise<ImportOutboxItem[]> {
  const rows = ((await LocalEngine.cacheGet<ImportOutboxItem[]>(OUTBOX_KEY(userId))) ||
    []) as ImportOutboxItem[];
  return [...rows].sort((a, b) => b.priority - a.priority || a.enqueuedAt.localeCompare(b.enqueuedAt));
}

async function removeFromOutbox(userId: string, rowId: string): Promise<void> {
  const key = OUTBOX_KEY(userId);
  const prev = ((await LocalEngine.cacheGet<ImportOutboxItem[]>(key)) || []) as ImportOutboxItem[];
  await LocalEngine.cacheSet(
    key,
    prev.filter((p) => p.rowId !== rowId),
  );
}

/**
 * Aggressive high-priority flush — parallel remote creates from LocalEngine ciphertext.
 * Does not read vault lists from the database; only writes createRow.
 */
export async function flushImportOutbox(
  userId: string,
  opts?: { concurrency?: number; maxItems?: number },
): Promise<{ flushed: number; errors: number }> {
  const existing = flushLocks.get(userId);
  if (existing) {
    await existing;
    return flushImportOutbox(userId, opts);
  }

  let resolveLock!: () => void;
  const lock = new Promise<void>((r) => {
    resolveLock = r;
  });
  flushLocks.set(userId, lock);

  let flushed = 0;
  let errors = 0;
  try {
    const concurrency = Math.max(2, Math.min(opts?.concurrency ?? 6, 12));
    const queue = await listImportOutbox(userId);
    const slice = typeof opts?.maxItems === 'number' ? queue.slice(0, opts.maxItems) : queue;
    if (!slice.length) return { flushed: 0, errors: 0 };

    const { VaultService } = await import('@/lib/appwrite/vault-service');

    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < slice.length) {
        const idx = cursor++;
        const item = slice[idx];
        if (!item) break;
        try {
          await setImportEarmark({
            batchId: item.batchId,
            kind: item.kind,
            status: 'syncing',
            rowId: item.rowId,
            userId,
            updatedAt: new Date().toISOString(),
          });
          await VaultService.pushStagedImportRow(item);
          await removeFromOutbox(userId, item.rowId);
          await setImportEarmark({
            batchId: item.batchId,
            kind: item.kind,
            status: 'synced',
            rowId: item.rowId,
            userId,
            updatedAt: new Date().toISOString(),
          });
          const meta = await LocalEngine.cacheGet<ImportBatchMeta>(BATCH_KEY(item.batchId));
          if (meta) {
            await LocalEngine.cacheSet(BATCH_KEY(item.batchId), {
              ...meta,
              synced: (meta.synced || 0) + 1,
            });
          }
          flushed++;
        } catch (e: any) {
          errors++;
          await setImportEarmark({
            batchId: item.batchId,
            kind: item.kind,
            status: 'error',
            rowId: item.rowId,
            userId,
            error: e?.message || 'Sync failed',
            updatedAt: new Date().toISOString(),
          });
          const meta = await LocalEngine.cacheGet<ImportBatchMeta>(BATCH_KEY(item.batchId));
          if (meta) {
            await LocalEngine.cacheSet(BATCH_KEY(item.batchId), {
              ...meta,
              errors: (meta.errors || 0) + 1,
            });
          }
        }
      }
    });
    await Promise.all(workers);
    return { flushed, errors };
  } finally {
    flushLocks.delete(userId);
    resolveLock();
  }
}

/** Fire-and-forget aggressive kick — keeps draining while outbox has work. */
export function kickImportSync(userId: string): void {
  if (!userId || typeof window === 'undefined') return;
  if (kickInflight.has(userId)) return;
  kickInflight.add(userId);
  void (async () => {
    try {
      for (let i = 0; i < 40; i++) {
        const left = await listImportOutbox(userId);
        if (!left.length) break;
        await flushImportOutbox(userId, { concurrency: 8, maxItems: 48 });
        await new Promise((r) => setTimeout(r, 16));
      }
    } finally {
      kickInflight.delete(userId);
      // One more pass if enqueue raced the drain
      const left = await listImportOutbox(userId);
      if (left.length) {
        kickImportSync(userId);
      }
    }
  })();
}
