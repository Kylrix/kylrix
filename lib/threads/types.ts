/**
 * Canonical thread parent kinds + channels.
 * scopeKey = `${parentKind}:${parentId}:${channel}` — unique, prevents duplicate spins.
 */

export const THREAD_PARENT_KINDS = [
  'note',
  'goal',
  'workspace',
  'event',
  'form',
  'call',
  'dm',
  'agent',
  'object',
  'user',
] as const;

export type ThreadParentKind = (typeof THREAD_PARENT_KINDS)[number];

/** Default channel for object-level discussions (Discord-style #general). */
export const THREAD_CHANNEL_GENERAL = 'general';
/** Idea / goal “Discussions” surface. */
export const THREAD_CHANNEL_DISCUSS = 'discuss';

export type ThreadStatus = 'active' | 'archived';

export function buildThreadScopeKey(
  parentKind: string,
  parentId: string,
  channel: string = THREAD_CHANNEL_GENERAL,
): string {
  const kind = String(parentKind || '').trim().toLowerCase();
  const id = String(parentId || '').trim();
  const ch = String(channel || THREAD_CHANNEL_GENERAL).trim().toLowerCase() || THREAD_CHANNEL_GENERAL;
  if (!kind || !id) throw new Error('parentKind and parentId required');
  const key = `${kind}:${id}:${ch}`;
  if (key.length > 191) throw new Error('scopeKey too long');
  return key;
}

export function isThreadParentKind(v: string): v is ThreadParentKind {
  return (THREAD_PARENT_KINDS as readonly string[]).includes(v);
}
