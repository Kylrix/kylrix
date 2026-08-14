'use client';

/**
 * Universal Local Soft Refresh Event Channel
 *
 * Rite of passage when opening an object detail or card:
 * Triggers a non-blocking, zero-database local refresh from LocalEngine / RxDB
 * to ensure that all cards, detail hints, and properties render without staleness.
 */

type SoftRefreshListener = (kind?: string, id?: string) => void;
const listeners = new Set<SoftRefreshListener>();

export function subscribeLocalSoftRefresh(listener: SoftRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerLocalSoftRefresh(kind?: string, id?: string): void {
  if (typeof window === 'undefined') return;
  // Dispatch asynchronously so the immediate click / transition is 0ms non-blocking
  setTimeout(() => {
    for (const listener of listeners) {
      try {
        listener(kind, id);
      } catch (err) {
        console.warn('[LocalSoftRefresh] listener error:', err);
      }
    }
  }, 10);
}
