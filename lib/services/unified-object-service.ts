import { systemTables } from '@/lib/data/system-tables';
import { db } from '@/lib/db';

export type ObjectKind =
  | 'note' | 'goal' | 'task' | 'form' | 'event' | 'tag'
  | 'secret' | 'credential' | 'totp' | 'totpSecret'
  | 'project' | 'workspace' | 'moment' | 'chat' | 'message'
  | 'folder' | string;

export async function unifiedRead<T = any>(
  kind: ObjectKind,
  queries: string[] = [],
  _opts?: { bypassCache?: boolean }
): Promise<{ total: number; rows: T[] }> {
  try {
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: 'turso',
      tableId: String(kind),
      queries: queries as any,
    });
    return { total: res.total, rows: res.rows as unknown as T[] };
  } catch {
    return { total: 0, rows: [] };
  }
}

export async function unifiedGet<T = any>(kind: ObjectKind, id: string): Promise<T | null> {
  try {
    const tables = systemTables();
    const doc = await tables.getRow({
      databaseId: 'turso',
      tableId: String(kind),
      rowId: id,
    });
    return doc as unknown as T;
  } catch {
    return null;
  }
}

export async function unifiedCreate<T = any>(
  kind: ObjectKind,
  data: Record<string, any>,
  opts?: { permissions?: string[]; ownerId?: string }
): Promise<T> {
  const localId = data.$id || data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    if (typeof window !== 'undefined') {
      const { createRow } = await import('@/lib/actions/client-ops');
      return await createRow('turso', String(kind), data, opts?.permissions) as unknown as T;
    } else {
      const { createRowSecure } = await import('@/lib/actions/secure-ops');
      return await createRowSecure('turso', String(kind), data, opts?.permissions) as unknown as T;
    }
  } catch {
    return {
      $id: localId,
      id: localId,
      ...data,
      $createdAt: now,
      $updatedAt: now,
    } as unknown as T;
  }
}

export async function systemCreate<T = any>(kind: ObjectKind, data: Record<string, any>): Promise<T> {
  return unifiedCreate<T>(kind, data);
}

export async function unifiedUpdate<T = any>(
  kind: ObjectKind,
  id: string,
  data: Record<string, any>,
  opts?: { permissions?: string[] }
): Promise<T> {
  try {
    if (typeof window !== 'undefined') {
      const { updateRow } = await import('@/lib/actions/client-ops');
      return await updateRow('turso', String(kind), id, data, opts?.permissions) as unknown as T;
    } else {
      const { updateRowSecure } = await import('@/lib/actions/secure-ops');
      return await updateRowSecure('turso', String(kind), id, data, opts?.permissions) as unknown as T;
    }
  } catch {
    return {
      $id: id,
      id,
      ...data,
      $updatedAt: new Date().toISOString(),
    } as unknown as T;
  }
}

export async function systemUpdate<T = any>(kind: ObjectKind, id: string, data: Record<string, any>): Promise<T> {
  return unifiedUpdate(kind, id, data);
}

export async function unifiedDelete(
  kind: ObjectKind,
  id: string,
  _opts?: { recursive?: boolean; cascade?: Array<{ kind: ObjectKind; foreignField: string }> }
): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      const { deleteRow } = await import('@/lib/actions/client-ops');
      await deleteRow('turso', String(kind), id);
    } else {
      const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
      await deleteRowSecure('turso', String(kind), id);
    }
  } catch {}
}

export async function systemDelete(kind: ObjectKind, id: string): Promise<void> {
  return unifiedDelete(kind, id);
}

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
