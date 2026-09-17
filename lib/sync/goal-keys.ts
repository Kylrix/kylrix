/**
 * Namespaced pending keys so notes and goals share one engine queue without collisions.
 */

const GOAL_PENDING_PREFIX = 'goal:';

export function goalPendingKey(goalId: string): string {
  const id = String(goalId || '').trim();
  if (!id) return '';
  if (id.startsWith(GOAL_PENDING_PREFIX)) return id;
  return `${GOAL_PENDING_PREFIX}${id}`;
}

export function parseGoalPendingKey(pendingId: string): string | null {
  const raw = String(pendingId || '').trim();
  if (!raw.startsWith(GOAL_PENDING_PREFIX)) return null;
  const id = raw.slice(GOAL_PENDING_PREFIX.length).trim();
  return id || null;
}

/**
 * Normalizes any namespaced key (e.g. `goal:123`, `event:123`, `note:123`, `form:123`, `tag:123`)
 * to its canonical Appwrite document ID (`123`).
 */
export function toCanonicalDocumentId(key: string): string {
  const raw = String(key || '').trim();
  if (raw.startsWith('goal:')) return raw.slice(5).trim();
  if (raw.startsWith('event:')) return raw.slice(6).trim();
  if (raw.startsWith('note:')) return raw.slice(5).trim();
  if (raw.startsWith('form:')) return raw.slice(5).trim();
  if (raw.startsWith('tag:')) return raw.slice(4).trim();
  return raw;
}
