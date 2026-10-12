import { LocalEngine } from '@/lib/services/LocalEngine';

/** Canonical LocalEngine key for user tag lists. */
export function tagsCacheKey(userId: string) {
  return `f_tags_${userId}`;
}

export type TagCachePayload = { rows: any[]; total: number };

export function normalizeTagCachePayload(cached: TagCachePayload | any[] | null | undefined): any[] {
  if (!cached) return [];
  if (Array.isArray(cached)) return cached;
  if (cached.rows && Array.isArray(cached.rows)) return cached.rows;
  return [];
}

export async function readLocalTagRows(userId: string | null | undefined): Promise<any[]> {
  if (!userId || typeof window === 'undefined') return [];
  const cached = await LocalEngine.cacheGet<TagCachePayload | any[]>(tagsCacheKey(userId)).catch(() => null);
  return normalizeTagCachePayload(cached);
}

export async function writeLocalTagRows(userId: string, rows: any[]): Promise<void> {
  if (!userId || typeof window === 'undefined') return;
  await LocalEngine.cacheSet(tagsCacheKey(userId), { rows, total: rows.length });
}

export function mergeTagIntoRows(rows: any[], tag: any): any[] {
  const id = tag?.$id || tag?.id;
  const nameLower = String(tag?.nameLower || tag?.name || '').toLowerCase();
  return [
    tag,
    ...rows.filter((t) => {
      if (id && (t.$id === id || t.id === id)) return false;
      const rowName = String(t?.nameLower || t?.name || '').toLowerCase();
      return rowName !== nameLower;
    }),
  ];
}

export async function upsertLocalTag(userId: string, tag: any): Promise<void> {
  const rows = await readLocalTagRows(userId);
  await writeLocalTagRows(userId, mergeTagIntoRows(rows, tag));
}

export function findLocalTagByName(rows: any[], name: string): any | null {
  const nameLower = name.trim().toLowerCase();
  if (!nameLower) return null;
  return (
    rows.find(
      (t) =>
        (t.nameLower && String(t.nameLower).toLowerCase() === nameLower) ||
        (t.name && String(t.name).toLowerCase() === nameLower),
    ) || null
  );
}
