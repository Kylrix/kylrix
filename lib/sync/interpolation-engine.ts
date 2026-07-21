import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { mergeServerPageWithLocalCopy, type SyncableRow } from './local-copy-sync';

export interface InterpolationOptions<T extends SyncableRow> {
  serverBatch: T[];
  localCopy: T[];
  deletedIds?: Set<string>;
  getId?: (row: T) => string;
}

/**
 * interpolationEngine
 * Intelligent UI-layer merge engine that blends incoming server data with local copy.
 * Key rule: If an item in local copy is pending in autonomicSyncEngine (user has un-flushed edits),
 * local copy strictly wins over incoming server payload to prevent overwriting user edits.
 */
export class InterpolationEngine {
  merge<T extends SyncableRow>(options: InterpolationOptions<T>): T[] {
    const { serverBatch, localCopy, deletedIds, getId = (r) => r.$id || (r as any).id || '' } = options;

    const localById = new Map<string, T>();
    for (const row of localCopy) {
      const id = getId(row);
      if (id) localById.set(id, row);
    }

    const mergedBatch = serverBatch.map((serverRow) => {
      const id = getId(serverRow);
      if (!id) return serverRow;

      const local = localById.get(id);
      if (local && (autonomicSyncEngine.isPending(id) || (local as any)._pending === true)) {
        // User has pending local edits — local copy strictly wins!
        return {
          ...serverRow,
          ...local,
        };
      }
      return serverRow;
    });

    return mergeServerPageWithLocalCopy({
      serverBatch: mergedBatch,
      localNotes: localCopy,
      deletedIds,
    });
  }
}

export const interpolationEngine = new InterpolationEngine();
