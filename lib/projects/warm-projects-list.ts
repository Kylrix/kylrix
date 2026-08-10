import { ProjectsService } from '@/lib/appwrite/projects';
import type { Projects } from '@/types/appwrite';
import {
  getSessionProjectsList,
  setSessionProjectsList,
  projectsListCacheKey,
  PROJECTS_LIST_TTL} from '@/lib/projects/projects-cache';

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
 * Session → RxDB f_projects_list → DataNexus → network.
 * Prefer LocalEngine cache used by attach-object so workspace switcher stays in sync.
 */
export async function warmProjectsList(deps: NexusDeps): Promise<Projects[]> {
  const session = getSessionProjectsList();
  if (session?.length) return session;

  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const local = normalizeProjectsList(await LocalEngine.cacheGet(`f_projects_list_${deps.userId}`));
    if (local.length) {
      setSessionProjectsList(local);
      return local;
    }
  } catch {
    /* optional */
  }

  const cached = normalizeProjectsList(
    await deps.getCachedDataAsync<Projects[]>(
      projectsListCacheKey(deps.userId),
      PROJECTS_LIST_TTL));
  if (cached.length) {
    setSessionProjectsList(cached);
    return cached;
  }

  const rows = normalizeProjectsList(
    await deps.fetchOptimized(
      projectsListCacheKey(deps.userId),
      async () => (await ProjectsService.listProjects(true)).rows,
      PROJECTS_LIST_TTL));
  setSessionProjectsList(rows);
  try {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    void LocalEngine.cacheSet(`f_projects_list_${deps.userId}`, rows);
  } catch {
    /* optional */
  }
  return rows;
}
