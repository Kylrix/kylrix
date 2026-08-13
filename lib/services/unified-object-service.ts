'use client';
/**
 * Unified Object Service — single modular interface for all Kylrix objects.
 * Read: client SDK (databases.listRows/getRow) — relies on create-granted read.
 * Create/Update/Delete: server SDK via secure-ops (node-appwrite) — wrapped.
 * System variants: admin SDK for system-level tables (no user owner).
 * Used directly by LocalEngine; UI never touches backend.
 */

import { Query, ID, Permission, Role, Models } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

// ── Kind → table config (extend without touching service logic) ──
export type ObjectKind =
  | 'note' | 'goal' | 'task' | 'form' | 'event' | 'tag'
  | 'secret' | 'credential' | 'totp' | 'totpSecret'
  | 'project' | 'workspace' | 'moment' | 'chat' | 'message'
  | 'folder' | string;

type TableConfig = {
  databaseId: string;
  tableId: string;
  ownerField: string; // e.g. userId, creatorId, ownerId
  system?: boolean;
};

const OBJECT_TABLES: Record<string, TableConfig> = {
  note:        { databaseId: APPWRITE_CONFIG.DATABASES.NOTE,      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,       ownerField: 'userId' },
  goal:        { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,       ownerField: 'userId' },
  task:        { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,       ownerField: 'userId' },
  form:        { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,       ownerField: 'userId' },
  event:       { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,      ownerField: 'userId' },
  tag:         { databaseId: APPWRITE_CONFIG.DATABASES.NOTE,      tableId: APPWRITE_CONFIG.TABLES.NOTE.TAGS,        ownerField: 'userId' },
  secret:     { databaseId: APPWRITE_CONFIG.DATABASES.VAULT,     tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,ownerField: 'userId' },
  credential: { databaseId: APPWRITE_CONFIG.DATABASES.VAULT,     tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,ownerField: 'userId' },
  totp:       { databaseId: APPWRITE_CONFIG.DATABASES.VAULT,     tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS,ownerField: 'userId' },
  totpSecret: { databaseId: APPWRITE_CONFIG.DATABASES.VAULT,     tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTPSECRETS,ownerField: 'userId' },
  project:    { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.PROJECTS || (APPWRITE_CONFIG.TABLES as any).PROJECTS, ownerField: 'userId' },
  workspace:  { databaseId: APPWRITE_CONFIG.DATABASES.FLOW,      tableId: APPWRITE_CONFIG.TABLES.FLOW.PROJECTS || (APPWRITE_CONFIG.TABLES as any).PROJECTS, ownerField: 'userId' },
  folder:     { databaseId: APPWRITE_CONFIG.DATABASES.VAULT,     tableId: APPWRITE_CONFIG.TABLES.VAULT.FOLDERS,    ownerField: 'userId' },
  // system-level (admin)
  token_registry: { databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, tableId: 'token_registry', ownerField: 'userId', system: true },
};

function resolveConfig(kind: ObjectKind): TableConfig {
  const key = String(kind).toLowerCase();
  const cfg = OBJECT_TABLES[key] || OBJECT_TABLES[key.replace(/s$/, '')];
  if (!cfg) throw new Error(`[unified] unknown kind: ${kind}`);
  return cfg;
}

// ── Read (client SDK only) ──
export async function unifiedRead<T extends Models.Row = Models.Row>(
  kind: ObjectKind,
  queries: string[] = [],
  opts?: { bypassCache?: boolean }
): Promise<{ total: number; rows: T[] }> {
  const { databaseId, tableId } = resolveConfig(kind);
  try {
    const { databases } = await import('@/lib/appwrite/client');
    const res = await databases.listRows(databaseId, tableId, queries);
    return { total: res.total, rows: res.rows as unknown as T[] };
  } catch (e: any) {
    // Failsafe: missing index / throttled — fallback to unfiltered fetch + client filter
    console.warn(`[unified] read ${kind} filtered failed, falling back:`, e?.message || e);
    try {
      const { databases } = await import('@/lib/appwrite/client');
      const res = await databases.listRows(databaseId, tableId, []);
      // client-side filter for owner if queries contained userId
      const ownerQ = queries.find(q => { try { const p = JSON.parse(q); return p.attribute === 'userId' || p.attribute === 'ownerId' || p.attribute === 'creatorId'; } catch { return false; } });
      if (ownerQ) {
        try {
          const parsed = JSON.parse(ownerQ);
          const ownerVal = Array.isArray(parsed.value) ? parsed.value[0] : parsed.value;
          if (ownerVal) {
            const filtered = (res.rows as any[]).filter(r => r.userId === ownerVal || r.ownerId === ownerVal || r.creatorId === ownerVal);
            return { total: filtered.length, rows: filtered as unknown as T[] };
          }
        } catch {}
      }
      return { total: res.total, rows: res.rows as unknown as T[] };
    } catch (e2) {
      console.error(`[unified] read ${kind} fallback failed:`, e2);
      return { total: 0, rows: [] };
    }
  }
}

export async function unifiedGet<T extends Models.Row = Models.Row>(kind: ObjectKind, id: string): Promise<T | null> {
  const { databaseId, tableId } = resolveConfig(kind);
  try {
    const { databases } = await import('@/lib/appwrite/client');
    const doc = await databases.getRow(databaseId, tableId, id);
    return doc as unknown as T;
  } catch {
    return null;
  }
}

// ── Create (server SDK via secure-ops) ──
export async function unifiedCreate<T extends Models.Row = Models.Row>(
  kind: ObjectKind,
  data: Record<string, any>,
  opts?: { permissions?: string[]; ownerId?: string }
): Promise<T> {
  const { databaseId, tableId } = resolveConfig(kind);
  const ownerId = opts?.ownerId || (data.userId as string) || (data.ownerId as string) || '';
  const perms = opts?.permissions || (ownerId ? [Permission.read(Role.user(ownerId))] : []);
  if (typeof window !== 'undefined') {
    const { createRow } = await import('@/lib/actions/client-ops');
    // client-ops wraps to server via secure-ops even on client — single path
    return await createRow(databaseId, tableId, data, perms) as unknown as T;
  } else {
    const { createRowSecure } = await import('@/lib/actions/secure-ops');
    return await createRowSecure(databaseId, tableId, data, perms) as unknown as T;
  }
}

export async function systemCreate<T extends Models.Row = Models.Row>(kind: ObjectKind, data: Record<string, any>): Promise<T> {
  const { databaseId, tableId } = resolveConfig(kind);
  if (typeof window !== 'undefined') {
    const { createRow } = await import('@/lib/actions/client-ops');
    return await createRow(databaseId, tableId, data) as unknown as T;
  } else {
    const { createRowSecure } = await import('@/lib/actions/secure-ops');
    // system tables bypass owner perm — server will grant admin-scoped
    return await createRowSecure(databaseId, tableId, data) as unknown as T;
  }
}

// ── Update (server SDK) ──
export async function unifiedUpdate<T extends Models.Row = Models.Row>(
  kind: ObjectKind,
  id: string,
  data: Record<string, any>,
  opts?: { permissions?: string[] }
): Promise<T> {
  const { databaseId, tableId } = resolveConfig(kind);
  if (typeof window !== 'undefined') {
    const { updateRow } = await import('@/lib/actions/client-ops');
    return await updateRow(databaseId, tableId, id, data, opts?.permissions) as unknown as T;
  } else {
    const { updateRowSecure } = await import('@/lib/actions/secure-ops');
    return await updateRowSecure(databaseId, tableId, id, data, opts?.permissions) as unknown as T;
  }
}

export async function systemUpdate<T extends Models.Row = Models.Row>(kind: ObjectKind, id: string, data: Record<string, any>): Promise<T> {
  return unifiedUpdate(kind, id, data);
}

// ── Delete (server SDK, recursive) ──
export async function unifiedDelete(
  kind: ObjectKind,
  id: string,
  opts?: { recursive?: boolean; cascade?: Array<{ kind: ObjectKind; foreignField: string }> }
): Promise<void> {
  const { databaseId, tableId } = resolveConfig(kind);
  if (opts?.recursive && opts?.cascade?.length) {
    for (const c of opts.cascade) {
      try {
        const children = await unifiedRead(c.kind, [Query.equal(c.foreignField, id)]);
        await Promise.all(children.rows.map(r => unifiedDelete(c.kind, (r as any).$id || (r as any).id).catch(()=>{})));
      } catch {}
    }
  }
  if (typeof window !== 'undefined') {
    const { deleteRow } = await import('@/lib/actions/client-ops');
    await deleteRow(databaseId, tableId, id);
  } else {
    const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
    await deleteRowSecure(databaseId, tableId, id);
  }
}

export async function systemDelete(kind: ObjectKind, id: string): Promise<void> {
  return unifiedDelete(kind, id);
}

// ── LocalEngine bridge — UI calls only LocalEngine, LocalEngine calls unified ──
export const UnifiedHandles = {
  read: unifiedRead,
  get: unifiedGet,
  create: unifiedCreate,
  systemCreate,
  update: unifiedUpdate,
  systemUpdate,
  delete: unifiedDelete,
  systemDelete,
};
