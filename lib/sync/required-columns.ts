'use client';

/**
 * Dynamic required-column detector for local-copy sync.
 */

export const TABLE_ID_FOR_KIND: Record<string, string> = {
  goal: 'tasks',
  task: 'tasks',
  idea: 'notes',
  note: 'notes',
  event: 'events',
  form: 'forms',
  tag: 'tags',
  secret: 'credentials',
  credential: 'credentials',
  totp: 'totpSecrets',
  totpSecret: 'totpSecrets',
};

export function getMissingRequiredColumns(
  _tableId: string,
  _row: Record<string, unknown> | null | undefined,
): string[] {
  return [];
}

export function getMissingForKind(
  _kind: string,
  _row: Record<string, unknown> | null | undefined,
): string[] {
  return [];
}
