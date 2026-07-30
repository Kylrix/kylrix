'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import type { Projects } from '@/types/appwrite';
import {
  getSessionProjectsList,
  setSessionProjectsList,
  projectsListCacheKey,
  PROJECTS_LIST_TTL} from '@/lib/projects/projects-cache';

export function useProjectsList(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { user } = useAuth();
  const { getCachedDataAsync, fetchOptimized, setCachedData } = useDataNexus();

  const [projects, setProjects] = useState<Projects[]>(() => getSessionProjectsList() ?? []);
  const [loading, setLoading] = useState(() => {
    if (!enabled) return false;
    const session = getSessionProjectsList();
    return !session || session.length === 0;
  });

  const syncProjects = useCallback(
    (rows: Projects[]) => {
      setSessionProjectsList(rows);
      setProjects(rows);
      if (user?.$id) {
        void setCachedData(projectsListCacheKey(user.$id), rows);
      }
    },
    [setCachedData, user?.$id],
  );

  const refetch = useCallback(
    async (force = false) => {
      if (!user?.$id) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const hasInstant = Boolean(getSessionProjectsList()?.length);
      if (!hasInstant) setLoading(true);

      try {
        const rows = force
          ? (await ProjectsService.listProjects(true)).rows
          : await fetchOptimized(
              projectsListCacheKey(user.$id),
              async () => (await ProjectsService.listProjects(true)).rows,
              PROJECTS_LIST_TTL,
            );
        syncProjects(rows);
      } catch (error) {
        console.error('[useProjectsList] fetch failed:', error);
      } finally {
        setLoading(false);
      }
    },
    [user?.$id, fetchOptimized, syncProjects],
  );

  useEffect(() => {
    if (!enabled || !user?.$id) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const hydrateAndRefresh = async () => {
      const session = getSessionProjectsList();
      if (session?.length) {
        setProjects(session);
        setLoading(false);
      } else {
        const cached = await getCachedDataAsync<Projects[]>(
          projectsListCacheKey(user.$id),
          PROJECTS_LIST_TTL,
        );
        if (!mounted) return;
        if (cached?.length) {
          setSessionProjectsList(cached);
          setProjects(cached);
          setLoading(false);
        }
      }

      try {
        const rows = await fetchOptimized(
          projectsListCacheKey(user.$id),
          async () => (await ProjectsService.listProjects(true)).rows,
          PROJECTS_LIST_TTL,
        );
        if (!mounted) return;
        syncProjects(rows);
      } catch (error) {
        console.error('[useProjectsList] background refresh failed:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void hydrateAndRefresh();

    return () => {
      mounted = false;
    };
  }, [enabled, user?.$id, getCachedDataAsync, fetchOptimized, syncProjects]);

  return { projects, loading, refetch, setProjects, syncProjects };
}
