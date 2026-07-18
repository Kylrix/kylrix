/**
 * Namespaced pending keys so notes and goals share one engine queue without collisions.
 */

export const GOAL_PENDING_PREFIX = 'goal:';

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

export function isGoalPendingKey(pendingId: string): boolean {
  return parseGoalPendingKey(pendingId) !== null;
}
