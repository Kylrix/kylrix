'use client';

/**
 * useProjectObjects — local-first hook for project_objects filtered by entityKind.
 *
 * Pattern (per sync skill):
 *   1. Serve instantly from LocalEngine cache (if warm).
 *   2. Fire a background remote fetch → merge into local copy.
 *   3. Never replace local copy with an empty remote result.
 *
 * Usage:
 *   const { rows, loading, refetch } = useProjectObjects(projectId, 'note');
 *   const { rows: goalRows } = useProjectObjects(projectId, 'goal');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { projectObjectsKindCacheKey, PROJECT_OBJECTS_TTL } from '@/lib/projects/projects-cache';
import type { ProjectObjects } from '@/types/appwrite';

interface UseProjectObjectsResult {
  /** All project_object rows of the requested entityKind for the given project. */
  rows: ProjectObjects[];
  loading: boolean;
  /** Force a fresh remote fetch and update the local copy. */
  refetch: () => Promise<void>;
  /** Invalidate the local cached slice (call after adding/removing an object). */
  invalidate: () => void;
}

export function useProjectObjects(
  projectId: string | null | undefined,
  entityKind: string,
): UseProjectObjectsResult {
  const { invalidate: nexusInvalidate } = useDataNexus();
  const [rows, setRows] = useState<ProjectObjects[]>([]);
  const [loading, setLoading] = useState(false);

  // Track mounted state to prevent stale state updates
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!projectId) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 1. Try local copy first (LocalEngine cache) for instant display
      if (!force) {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cached = await LocalEngine.cacheGet<any>(
            projectObjectsKindCacheKey(projectId, entityKind),
          );
          const cachedList = Array.isArray(cached) ? cached : Array.isArray(cached?.rows) ? cached.rows : [];
          if (cachedList.length > 0 && mountedRef.current) {
            setRows(cachedList);
            setLoading(false);
          } else {
            if (mountedRef.current) setRows([]);
            setLoading(true);
          }
        } catch {
          if (mountedRef.current) setRows([]);
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // 2. Unified LocalEngine query — single gateway with Realtime, no duplicate DataNexus tower
      try {
        const cacheKey = projectObjectsKindCacheKey(projectId, entityKind);
        if (force) nexusInvalidate(cacheKey);
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const remote = await LocalEngine.query<any>(
          cacheKey,
          async () => {
            const result = await ProjectsService.listProjectObjectsByKind(projectId, entityKind);
            return result?.rows ?? [];
          },
          { ttl: PROJECT_OBJECTS_TTL, realtimeChannel: `databases.${(await import('@/lib/appwrite/config')).APPWRITE_CONFIG.DATABASES.CHAT}.collections.project_objects.documents` }
        );
        const remoteList: ProjectObjects[] = Array.isArray(remote)
          ? remote
          : Array.isArray(remote?.rows)
            ? remote.rows
            : [];
        if (mountedRef.current) {
          setRows((prev) => {
            const byId = new Map<string, ProjectObjects>();
            const prevList = Array.isArray(prev) ? prev : [];
            // Load existing local rows first
            prevList.forEach((r) => {
              const key = r.entityId || r.$id || (r as any).id;
              if (key) byId.set(key, r);
            });
            // Merge remote rows
            remoteList.forEach((r: ProjectObjects) => {
              const key = r.entityId || r.$id || (r as any).id;
              if (key) byId.set(key, r);
            });
            const merged = Array.from(byId.values());
            // Persist merged set to LocalEngine
            if (typeof window !== 'undefined' && merged.length > 0) {
              import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
                void LocalEngine.cacheSet(cacheKey, merged);
              }).catch(() => {});
            }
            return merged;
          });
        }
      } catch (err) {
        console.warn('[useProjectObjects] remote fetch failed:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [projectId, entityKind],
  );

  // Reset and reload whenever projectId or entityKind changes
  useEffect(() => {
    setRows([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, entityKind]);

  const refetch = useCallback(() => load(true), [load]);

  const invalidate = useCallback(() => {
    if (!projectId) return;
    nexusInvalidate(projectObjectsKindCacheKey(projectId, entityKind));
    // Also bust the LocalEngine entry so next read hits remote
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        await LocalEngine.cacheSet(
          projectObjectsKindCacheKey(projectId, entityKind),
          [],
        );
      } catch {}
    })();
  }, [projectId, entityKind, nexusInvalidate]);

  return { rows, loading, refetch, invalidate };
}
