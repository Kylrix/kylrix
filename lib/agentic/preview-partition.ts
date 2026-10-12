/**
 * Agentic preview partition — temporary local state for "show before commit" flows.
 * Uses LocalEngine keys prefixed with agentic_preview_ (never synced to remote).
 */

const PREFIX = 'agentic_preview_';

export interface PreviewEnvelope<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  createdAt: string;
  expiresAt: string;
}

const DEFAULT_TTL_MS = 1000 * 60 * 30;

export const AgenticPreviewPartition = {
  async set<T>(id: string, kind: string, payload: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const now = Date.now();
    const envelope: PreviewEnvelope<T> = {
      id,
      kind,
      payload,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString()};
    await LocalEngine.cacheSet(`${PREFIX}${id}`, envelope);
  },

  async get<T>(id: string): Promise<PreviewEnvelope<T> | null> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const row = await LocalEngine.cacheGet<PreviewEnvelope<T>>(`${PREFIX}${id}`);
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await this.clear(id);
      return null;
    }
    return row;
  },

  async clear(id: string): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    await LocalEngine.cacheSet(`${PREFIX}${id}`, null as any);
  }};
