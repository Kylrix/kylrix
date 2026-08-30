'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProjectsService } from '@/lib/appwrite/projects';
import type { Projects } from '@/types/appwrite';

/**
 * Sub-projects under a parent workspace (projects.kind=project + parentProjectId).
 */
export function useSubProjects(workspaceId: string | null | undefined) {
  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await ProjectsService.listSubProjects(workspaceId);
      setProjects(Array.isArray(rows) ? (rows as unknown as Projects[]) : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    projects,
    loading,
    refetch: load,
    invalidate: () => {},
  };
}
