import { interpolationEngine } from './interpolation-engine';
import type { SyncableRow } from './local-copy-sync';

export interface OptimisticQueryConfig<T extends SyncableRow> {
  actionKey: string;
  localFetcher: () => Promise<T[]> | T[];
  remoteFetcher: () => Promise<T[]>;
  onResult: (interpolated: T[]) => void;
  deletedIds?: Set<string>;
}

/**
 * optimisticEngine
 * Proactive application context engine that handles speculative background fetches.
 * Serves 0ms local copy results immediately, then speculatively fetches remote data
 * and passes it to interpolationEngine for seamless UI merging.
 */
export class OptimisticEngine {
  private inflight = new Map<string, Promise<any>>();

  async query<T extends SyncableRow>(config: OptimisticQueryConfig<T>): Promise<T[]> {
    const { actionKey, localFetcher, remoteFetcher, onResult, deletedIds } = config;

    // 1. Instant 0ms local copy resolution
    const localCopy = await Promise.resolve(localFetcher());
    if (Array.isArray(localCopy) && localCopy.length > 0) {
      onResult(localCopy);
    }

    // 2. Background speculative fetch + interpolation merge
    if (this.inflight.has(actionKey)) {
      return localCopy;
    }

    const task = (async () => {
      try {
        const serverBatch = await remoteFetcher();
        const interpolated = interpolationEngine.merge({
          serverBatch: Array.isArray(serverBatch) ? serverBatch : [],
          localCopy: Array.isArray(localCopy) ? localCopy : [],
          deletedIds,
        });
        onResult(interpolated);
        return interpolated;
      } catch (err) {
        console.warn(`[OptimisticEngine] Speculative fetch failed for key: ${actionKey}`, err);
        return localCopy;
      } finally {
        this.inflight.delete(actionKey);
      }
    })();

    this.inflight.set(actionKey, task);
    return localCopy;
  }
}

export const optimisticEngine = new OptimisticEngine();
