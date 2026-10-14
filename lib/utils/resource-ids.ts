export function isLocalOnlyResourceId(id: string | null | undefined): boolean {
  const trimmed = String(id || '').trim();
  if (!trimmed || trimmed === 'thread' || trimmed.startsWith('thread-')) return true;
  if (trimmed.startsWith('live-')) return true;
  return false;
}

export function isValidResourceId(id: string | null | undefined): boolean {
  const trimmed = String(id || '').trim();
  if (!trimmed || isLocalOnlyResourceId(trimmed)) return false;
  if (trimmed.length > 36) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(trimmed);
}

export const isValidAppwriteRowId = isValidResourceId;

export type CollaboratorResourceType =
  | 'note'
  | 'task'
  | 'project'
  | 'event'
  | 'form'
  | 'huddle'
  | 'call'
  | 'secret'
  | 'totp';

export function normalizeCollaboratorResourceType(
  type: string | null | undefined
): CollaboratorResourceType | null {
  const normalized = String(type || '').trim().toLowerCase();
  switch (normalized) {
    case 'note':
      return 'note';
    case 'task':
    case 'goal':
      return 'task';
    case 'project':
      return 'project';
    case 'event':
      return 'event';
    case 'form':
      return 'form';
    case 'huddle':
      return 'huddle';
    case 'call':
      return 'call';
    case 'secret':
    case 'credential':
    case 'password':
      return 'secret';
    case 'totp':
      return 'totp';
    default:
      return null;
  }
}

export function resolveResourceOwnerId(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return String(row.userId || row.ownerId || row.creatorId || '').trim();
}
