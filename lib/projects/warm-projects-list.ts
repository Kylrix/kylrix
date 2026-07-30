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

/**
 * Session → RxDB → network. Returns instantly when any warm layer has data.
 */
export async function warmProjectsList(deps: NexusDeps): Promise<Projects[]> {
  const session = getSessionProjectsList();
  if (session?.length) return session;

  const cached = await deps.getCachedDataAsync<Projects[]>(
    projectsListCacheKey(deps.userId),
    PROJECTS_LIST_TTL);
  if (cached?.length) {
    setSessionProjectsList(cached);
    return cached;
  }

  const rows = await deps.fetchOptimized(
    projectsListCacheKey(deps.userId),
    async () => (await ProjectsService.listProjects(true)).rows,
    PROJECTS_LIST_TTL);
  setSessionProjectsList(rows);
  return rows;
}
