/** Dispatches cross-layer Nexus invalidation (e.g. note.ts → DataNexusProvider memory + localStorage). */
export const NEXUS_INVALIDATE_EVENT = 'kylrix:nexus-invalidate';

export function publishNexusInvalidate(key: string) {
  if (typeof window === 'undefined' || !key) return;
  window.dispatchEvent(new CustomEvent(NEXUS_INVALIDATE_EVENT, { detail: { key } }));
}
