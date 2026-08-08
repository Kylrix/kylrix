'use client';

/**
 * Dynamic required-column detector for local-copy sync.
 * Derives required fields from appwrite.config.json code-generated specs,
 * not manual lists. Used to show red "cannot sync" dot when a live row
 * is missing required columns and will never flush.
 */

import appwriteConfig from '@/appwrite.config.json';

type ColumnSpec = { key: string; required: boolean };
type TableSpec = { $id: string; columns: ColumnSpec[] };

const tablesById = new Map<string, TableSpec>();
for (const t of (appwriteConfig as any).tables as TableSpec[]) {
  tablesById.set(t.$id, t);
}

// Map logical kinds to Appwrite tableIds (single DB passwordManagerDb)
export const TABLE_ID_FOR_KIND: Record<string, string> = {
  goal: 'tasks',
  task: 'tasks',
  idea: '67ff05f3002502ef239e', // notes
  note: '67ff05f3002502ef239e',
  event: 'events',
  form: 'forms',
  tag: '67ff06280034908cf08a', // tags
  secret: 'credentials',
  credential: 'credentials',
  totp: 'totpSecrets',
  totpSecret: 'totpSecrets',
};

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Returns missing required column keys for a live row, or [] if syncable.
 * Ignores columns that have a default (server will fill) — only truly required with no default.
 */
export function getMissingRequiredColumns(
  tableId: string,
  row: Record<string, unknown> | null | undefined,
): string[] {
  if (!row) return [];
  const spec = tablesById.get(tableId);
  if (!spec) return [];
  const missing: string[] = [];
  for (const col of spec.columns) {
    if (!col.required) continue;
    // Columns with a non-null default are not blocking — Appwrite will fill them
    const rawSpec: any = col as any;
    if (rawSpec.default != null) continue;
    const val = (row as any)[col.key];
    if (isEmptyValue(val)) missing.push(col.key);
  }
  return missing;
}

export function getMissingForKind(
  kind: string,
  row: Record<string, unknown> | null | undefined,
): string[] {
  const tableId = TABLE_ID_FOR_KIND[kind];
  if (!tableId) return [];
  return getMissingRequiredColumns(tableId, row);
}
