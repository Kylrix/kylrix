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
  /** Bypass LocalEngine TTL / session — used after sub-project classifier heal */
  force?: boolean;
};

/** Normalize LocalEngine / session payloads (array or `{ rows }`). */
export function normalizeProjectsList(raw: unknown): Projects[] {
  if (Array.isArray(raw)) return raw as Projects[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Projects[] }).rows;
  }
  return [];
}

/** Switcher WorkspaceItem[] was wrongly written into f_projects_list — treat as miss. */
function isProjectRowCache(rows: unknown[]): boolean {
  if (!rows.length) return false;
  const sample = rows.find((r) => r && typeof r === 'object') as Record<string, unknown> | undefined;
  if (!sample) return false;
  // Canonical Appwrite / Projects rows use $id
  if (sample.$id) return true;
  // WorkspaceItem pollution: id + isPersonal, no $id
  if (typeof sample.isPersonal === 'boolean' && sample.id && !sample.$id) return false;
  return true;
}

/**
 * Collapsed: sole gateway is LocalEngine — warmProjectsList now delegates to LocalEngine.query
 * Session → LocalEngine → network (with Realtime), DataNexus path removed to cut duplicate reads
 */
export async function warmProjectsList(deps: NexusDeps): Promise<Projects[]> {
  const force = deps.force === true;
  if (!force) {
    const session = getSessionProjectsList(deps.userId);
    if (session?.length) {
      const healed = filterRootWorkspaceProjects(normalizeProjectsList(session));
      if (healed.length > 0 && isProjectRowCache(healed)) return healed;
    }
  }

  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const cacheKey = `f_projects_list_${deps.userId}`;
  try {
    const raw = await LocalEngine.query(
      cacheKey,
      async () => {
        // Direct remote — avoid nested LocalEngine.query inside listProjects
        const rows = await ProjectsService.fetchRemoteProjects(true).catch(() => []);
        return rows as any;
      },
      {
        ttl: PROJECTS_LIST_TTL,
        force,
        realtimeChannel: `databases.${(await import('@/lib/appwrite/config')).APPWRITE_CONFIG.DATABASES.CHAT}.collections.projects.documents`,
      }
    );
    let rows = filterRootWorkspaceProjects(normalizeProjectsList(raw));
    // Empty [] is truthy to LocalEngine.query — force heal when cache was wiped by bad filter
    if ((!rows.length || !isProjectRowCache(rows)) && !force) {
      const healedRaw = await LocalEngine.query(
        cacheKey,
        async () => (await ProjectsService.fetchRemoteProjects(true).catch(() => [])) as any,
        {
          ttl: PROJECTS_LIST_TTL,
          force: true,
          realtimeChannel: `databases.${(await import('@/lib/appwrite/config')).APPWRITE_CONFIG.DATABASES.CHAT}.collections.projects.documents`,
        }
      );
      rows = filterRootWorkspaceProjects(normalizeProjectsList(healedRaw));
    }
    if (rows.length > 0 && isProjectRowCache(rows)) {
      setSessionProjectsList(rows, deps.userId);
      try {
        void LocalEngine.cacheSet(cacheKey, rows);
      } catch {}
      return rows;
    }
  } catch (err) {
    console.warn('[warmProjectsList] Remote query failed, falling back to local cache:', err);
  }

  // Fallback to local cache directly — also try kylrix_workspaces (switcher cache)
  try {
    const [userCached, globalCached, switcherCached] = await Promise.all([
      LocalEngine.cacheGet<any[]>(cacheKey).catch(() => null),
      LocalEngine.cacheGet<any[]>('f_projects_list').catch(() => null),
      LocalEngine.cacheGet<any[]>(`kylrix_workspaces_${deps.userId}`).catch(() => null),
    ]);
    const candidates = [userCached, globalCached, switcherCached].filter(
      (c): c is any[] => Array.isArray(c) && c.length > 0
    );
    for (const cached of candidates) {
      if (!isProjectRowCache(cached) && cached !== switcherCached) continue;
      const rows = filterRootWorkspaceProjects(normalizeProjectsList(cached));
      if (rows.length > 0) {
        setSessionProjectsList(rows, deps.userId);
        return rows;
      }
    }
  } catch {}

  return [];
}
