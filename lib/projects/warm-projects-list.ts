import { ProjectsService } from '@/lib/appwrite/projects';
import type { Projects } from '@/types/appwrite';
import {
  getSessionProjectsList,
  setSessionProjectsList,
  PROJECTS_LIST_TTL} from '@/lib/projects/projects-cache';
import { filterRootWorkspaceProjects } from '@/lib/projects/sub-projects';

type NexusDeps = {
  userId: string;
  getCachedDataAsync: <T>(key: string, ttl?: number) => Promise<T | null>;
  fetchOptimized: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
};

/** Normalize LocalEngine / session payloads (array or `{ rows }`). */
export function normalizeProjectsList(raw: unknown): Projects[] {
  if (Array.isArray(raw)) return raw as Projects[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Projects[] }).rows;
  }
  return [];
}

/**
 * Collapsed: sole gateway is LocalEngine — warmProjectsList now delegates to LocalEngine.query
 * Session → LocalEngine → network (with Realtime), DataNexus path removed to cut duplicate reads
 */
export async function warmProjectsList(deps: NexusDeps): Promise<Projects[]> {
  const session = getSessionProjectsList(deps.userId);
  if (session?.length) return session;

  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const cacheKey = `f_projects_list_${deps.userId}`;
  try {
    const raw = await LocalEngine.query(
      cacheKey,
      async () => {
        const res = await ProjectsService.listProjects(true).catch(() => null);
        return (res?.rows || []) as any;
      },
      {
        ttl: PROJECTS_LIST_TTL,
        realtimeChannel: `databases.${(await import('@/lib/appwrite/config')).APPWRITE_CONFIG.DATABASES.CHAT}.collections.projects.documents`,
      }
    );
    const rows = filterRootWorkspaceProjects(normalizeProjectsList(raw));
    if (rows.length > 0) {
      setSessionProjectsList(rows, deps.userId);
      try {
        void LocalEngine.cacheSet(cacheKey, rows);
      } catch {}
      return rows;
    }
  } catch (err) {
    console.warn('[warmProjectsList] Remote query failed, falling back to local cache:', err);
  }

  // Fallback to local cache directly
  try {
    const [userCached, globalCached] = await Promise.all([
      LocalEngine.cacheGet<any[]>(cacheKey).catch(() => null),
      LocalEngine.cacheGet<any[]>('f_projects_list').catch(() => null),
    ]);
    const cached = (Array.isArray(userCached) && userCached.length > 0) ? userCached : globalCached;
    const rows = filterRootWorkspaceProjects(normalizeProjectsList(cached));
    if (rows.length > 0) {
      setSessionProjectsList(rows, deps.userId);
      return rows;
    }
  } catch {}

  return [];
}
