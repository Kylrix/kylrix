/**
 * Modular Transactions helper — system SDK / server actions only.
 * Wraps Appwrite TablesDB Transactions API for atomic multi-table writes.
 * Docs: https://appwrite.io/docs/products/databases/transactions
 *
 * Usage:
 *   import { withSystemTransaction } from '@/lib/services/internal/transaction';
 *   await withSystemTransaction(async (txId) => {
 *     await tables.createRow({ databaseId, tableId, rowId, data, permissions, transactionId: txId });
 *   });
 *
 * All operations staged with transactionId are held in-memory until commit.
 * On commit Appwrite replays in order inside a real DB transaction (read-own-writes, conflict detection).
 * If any staged op fails or commit conflicts, entire transaction rolls back.
 */

import { createSystemTablesDB } from '@/lib/appwrite-admin';

export type TransactionCallback<T> = (txId: string) => Promise<T>;

export async function withSystemTransaction<T>(
  fn: TransactionCallback<T>,
  opts?: { ttl?: number }
): Promise<T> {
  const tables: any = createSystemTablesDB();
  if (typeof tables?.createTransaction !== 'function') {
    return await fn(`tx_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  }
  const tx = await tables.createTransaction(opts?.ttl ? { ttl: opts.ttl } : {});
  const txId: string = tx.$id;
  try {
    const result = await fn(txId);
    await tables.updateTransaction({ transactionId: txId, commit: true });
    return result;
  } catch (e) {
    try {
      await tables.updateTransaction({ transactionId: txId, rollback: true });
    } catch {}
    throw e;
  }
}

/**
 * Batch stage helper — stages many operations at once via createOperations.
 * Operations shape per docs: { action, databaseId, tableId, rowId?, data?, permissions? }
 * Requires transactionId.
 */
export async function stageOperations(
  txId: string,
  operations: Array<{
    action: 'create' | 'update' | 'upsert' | 'delete' | 'increment' | 'decrement';
    databaseId: string;
    tableId: string;
    rowId?: string;
    data?: Record<string, unknown>;
    permissions?: string[];
  }>
): Promise<void> {
  if (!operations.length) return;
  const tables: any = createSystemTablesDB();
  await tables.createOperations({ transactionId: txId, operations } as any);
}
