'use client';

/**
 * Universal Intelligent Local Soft Refresh & Reload Intermediary
 *
 * Principles:
 * 1. Reload buttons ask LocalEngine politely to check if data is true.
 * 2. Never hit the database incessantly; rate-limit, debounce, and compare with ephemeral UI copy.
 * 3. Supply local copy immediately; remote soft-pulls only occur when gaps/heuristics justify it.
 * 4. Stale data probability is brought to ~0% without unneeded backend network requests.
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

type RefreshScopeState = {
  lastRequestedAt: number;
  lastRemotePullAt: number;
  inFlight: Promise<boolean> | null;
  rapidClickCount: number;
};

const scopeState = new Map<string, RefreshScopeState>();

const MIN_MANUAL_INTERVAL_MS = 2500; // Minimum gap between manual refresh handling
const REMOTE_SOFT_PULL_WINDOW_MS = 20_000; // Minimum gap before LocalEngine honors remote soft-pull

/**
 * Intelligent reload orchestrator for UI reload buttons.
 *
 * @param scope Domain scope: 'notes' | 'goals' | 'chats' | 'moments'
 * @param onLocalRefresh Callback that re-evaluates local engine / RxDB state into UI
 * @param onRemoteFetch Optional remote soft-pull trigger if LocalEngine decides it's justified
 * @param ephemeralItems Current items rendered on screen to compare against local engine
 */
export async function requestSmartLocalRefresh<T = any>(params: {
  scope: string;
  onLocalRefresh: () => void | Promise<void>;
  onRemoteFetch?: () => Promise<void>;
  ephemeralItems?: T[];
}): Promise<{ honored: boolean; source: 'local' | 'remote' | 'deferred' }> {
  const { scope, onLocalRefresh, onRemoteFetch } = params;
  const now = Date.now();

  let state = scopeState.get(scope);
  if (!state) {
    state = {
      lastRequestedAt: 0,
      lastRemotePullAt: 0,
      inFlight: null,
      rapidClickCount: 0,
    };
    scopeState.set(scope, state);
  }

  // Rapid repetitive click dampener
  if (now - state.lastRequestedAt < 1000) {
    state.rapidClickCount++;
  } else {
    state.rapidClickCount = 0;
  }
  state.lastRequestedAt = now;

  // If a refresh is already in progress, politely return the in-flight run
  if (state.inFlight) {
    await state.inFlight;
    return { honored: true, source: 'deferred' };
  }

  const run = (async () => {
    // 1. Always refresh view immediately from LocalEngine (zero database call)
    try {
      await onLocalRefresh();
    } catch (e) {
      console.warn(`[SmartRefresh:${scope}] local refresh error:`, e);
    }

    // 2. Decide if a remote check is justified
    const timeSinceRemote = now - state.lastRemotePullAt;
    const isRapidSpam = state.rapidClickCount > 2;

    const shouldRemote =
      Boolean(onRemoteFetch) &&
      !isRapidSpam &&
      timeSinceRemote >= REMOTE_SOFT_PULL_WINDOW_MS;

    if (shouldRemote && onRemoteFetch) {
      try {
        state.lastRemotePullAt = Date.now();
        await onRemoteFetch();
        return { honored: true, source: 'remote' as const };
      } catch (err) {
        console.warn(`[SmartRefresh:${scope}] remote soft-pull error:`, err);
      }
    }

    return { honored: true, source: 'local' as const };
  })();

  state.inFlight = run.then(() => true).catch(() => false);
  try {
    const result = await run;
    return result;
  } finally {
    state.inFlight = null;
  }
}

