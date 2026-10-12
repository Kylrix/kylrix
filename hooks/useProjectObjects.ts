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
import { projectObjectsKindCacheKey } from '@/lib/projects/projects-cache';
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
        if (mountedRef.current) {
          setRows([]);
          setLoading(false);
        }
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
            return;
          } else {
            if (mountedRef.current) {
              setRows([]);
              setLoading(true);
            }
          }
        } catch {
          if (mountedRef.current) {
            setRows([]);
            setLoading(true);
          }
        }
      } else {
        if (mountedRef.current) setLoading(true);
      }

      // 2. Fetch project_objects via ProjectsService (backed by LocalEngine + Realtime)
      try {
        const cacheKey = projectObjectsKindCacheKey(projectId, entityKind);
        if (force) nexusInvalidate(cacheKey);
        const result = await ProjectsService.listProjectObjectsByKind(projectId, entityKind);
        const remoteList: ProjectObjects[] = Array.isArray(result?.rows)
          ? result.rows
          : Array.isArray(result)
            ? result
            : [];
        if (mountedRef.current) {
          setRows(remoteList);
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          void LocalEngine.cacheSet(cacheKey, remoteList);
        }
      } catch (err) {
        console.warn('[useProjectObjects] remote fetch failed:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [projectId, entityKind, nexusInvalidate],
  );

  // Instantly clear rows and reload whenever projectId or entityKind changes
  useEffect(() => {
    setRows([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, entityKind]);

  // Realtime subscription for project_objects
  useEffect(() => {
    if (!projectId) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        const channel = `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.project_objects.rows`;

        const cleanup = await LocalEngine.subscribeRealtime(channel, (payload: any) => {
          if (!payload || !payload.$id || cancelled) return;
          if (payload.projectId && payload.projectId !== projectId) return;

          const pKind = String(payload.entityKind || '').toLowerCase().trim();
          const eKind = String(entityKind || '').toLowerCase().trim();
          const isMatch =
            pKind === eKind ||
            (eKind === 'note' && (pKind === 'notes' || pKind === 'idea' || pKind === 'ideas')) ||
            (eKind === 'goal' && (pKind === 'goals' || pKind === 'task' || pKind === 'tasks')) ||
            (eKind === 'credential' && (pKind === 'credentials' || pKind === 'secret' || pKind === 'password')) ||
            (eKind === 'totp' && pKind === 'totps') ||
            (eKind === 'event' && pKind === 'events') ||
            (eKind === 'form' && pKind === 'forms');

          if (!isMatch) return;

          const isDeleted = payload.isDeleted === true || payload.isTrash === true;
          if (isDeleted) {
            setRows((prev) => prev.filter((r) => r.$id !== payload.$id && r.entityId !== payload.entityId));
            return;
          }

          setRows((prev) => {
            const idx = prev.findIndex((r) => r.$id === payload.$id || (r.entityId && r.entityId === payload.entityId));
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...payload };
              return updated;
            }
            return [payload, ...prev];
          });
        });
        if (cancelled) cleanup();
        else unsub = cleanup;
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
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
