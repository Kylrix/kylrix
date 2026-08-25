'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProjectObjects } from '@/hooks/useProjectObjects';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';
import { getSharedWorkspaceEntitiesSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';

export interface WorkspaceItemLike {
  $id?: string | null;
  id?: string | null;
  projectId?: string | null;
  isWorkspace?: boolean | null;
  [key: string]: any;
}

/**
 * Loads shared workspace entities directly via Server SDK action and caches
 * them in a dedicated LocalEngine pocket for 0ms loads and offline resilience.
 */
export function useSharedWorkspaceEntities<T = any>(
  workspaceId: string | null | undefined,
  entityKind: string,
  isSharedWorkspace: boolean,
): { rows: T[]; loading: boolean; refetch: () => Promise<void> } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cacheKey = workspaceId ? `f_shared_ws_${workspaceId}_${entityKind}` : null;

  const load = useCallback(
    async (force = false) => {
      if (!workspaceId || !isSharedWorkspace || !cacheKey) {
        if (mountedRef.current) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      // 1. Try local copy first (LocalEngine pocket) for instant 0ms display
      if (!force) {
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cached = await LocalEngine.cacheGet<T[]>(cacheKey);
          if (Array.isArray(cached) && cached.length > 0 && mountedRef.current) {
            setRows(cached);
            setLoading(false);
          } else {
            if (mountedRef.current) setLoading(true);
          }
        } catch {
          if (mountedRef.current) setLoading(true);
        }
      } else {
        if (mountedRef.current) setLoading(true);
      }

      // 2. Fetch from privileged Server Action using Server SDK
      try {
        let jwt: string | undefined = undefined;
        try {
          const res = await Promise.race([
            account.createJWT(),
            new Promise<null>((r) => setTimeout(() => r(null), 800)),
          ]);
          jwt = res?.jwt;
        } catch {}

        const res = await getSharedWorkspaceEntitiesSecure(workspaceId, entityKind, jwt);
        if (res.success && Array.isArray(res.rows) && mountedRef.current) {
          setRows(res.rows);
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          void LocalEngine.cacheSet(cacheKey, res.rows);
        }
      } catch (err) {
        console.warn('[useSharedWorkspaceEntities] fetch failed:', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [workspaceId, isSharedWorkspace, cacheKey, entityKind],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);

  return { rows, loading, refetch };
}

/**
 * Centralized Workspace Item Filter Hook
 * 
 * Filters any list of items (notes, goals, events, forms, credentials, totp, agent_session)
 * based on the active workspace context:
 * 
 * 1. Personal Workspace:
 *    - Uses `isDefaultWorkspaceObject(item)` (i.e. `isWorkspace !== true`).
 * 
 * 2. Owned Custom Workspace (`projectId`):
 *    - Uses the `project_objects` join table (`useProjectObjects(projectId, entityKind)`).
 *    - Includes items if their ID exists in `project_objects` or if `item.projectId === activeWorkspace.id`.
 * 
 * 3. Shared Workspace:
 *    - Uses `useSharedWorkspaceEntities` (Server SDK + LocalEngine pocket) to load shared items
 *      that the visitor does not own in Appwrite, seamlessly merging them into the grid.
 */
export function useWorkspaceFilteredItems<T extends WorkspaceItemLike>(
  items: T[],
  entityKind: 'note' | 'goal' | 'event' | 'form' | 'credential' | 'totp' | 'agent_session' | string,
): { filteredItems: T[]; isCustomWorkspace: boolean; loadingWorkspaceObjects: boolean } {
  const { activeWorkspace, isEntityPendingInActiveWorkspace } = useWorkspace();
  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const isSharedWorkspace = Boolean(isCustomWorkspace && activeWorkspace?.isShared);
  const customWorkspaceId = isCustomWorkspace ? activeWorkspace?.id : null;

  const { rows: workspaceProjectObjects, loading: loadingWorkspaceObjects } = useProjectObjects(
    customWorkspaceId,
    entityKind,
  );

  const { rows: sharedWorkspaceRows, loading: loadingSharedRows } = useSharedWorkspaceEntities<T>(
    customWorkspaceId,
    entityKind,
    isSharedWorkspace,
  );

  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];

    if (!activeWorkspace || activeWorkspace.isPersonal) {
      return list.filter(isDefaultWorkspaceObject);
    }

    const pid = activeWorkspace.id;
    const registeredIds = new Set(
      workspaceProjectObjects.map((po) => po.entityId).filter(Boolean) as string[],
    );

    const localMatching = list.filter((item) => {
      const id = item.$id || item.id;
      if (!id && !item.projectId) return false;
      if (id && registeredIds.has(id)) return true;
      if (item.projectId === pid) return true;
      if ((item as any).isWorkspace === true && item.projectId === pid) return true;
      if (Array.isArray(item.tags) && item.tags.some((t: string) => t === `workspace:${pid}` || t === `project:${pid}`)) return true;
      if (id && isEntityPendingInActiveWorkspace(entityKind, id)) return true;
      return false;
    });

    if (isSharedWorkspace) {
      const byId = new Map<string, T>();
      // Add shared workspace rows from Server SDK
      sharedWorkspaceRows.forEach((r) => {
        const id = (r as any).$id || (r as any).id;
        if (id) byId.set(id, r);
      });
      // Merge local items
      localMatching.forEach((r) => {
        const id = (r as any).$id || (r as any).id;
        if (id) byId.set(id, r);
      });
      return Array.from(byId.values());
    }

    return localMatching;
  }, [
    items,
    activeWorkspace,
    workspaceProjectObjects,
    sharedWorkspaceRows,
    isSharedWorkspace,
    isEntityPendingInActiveWorkspace,
    entityKind,
  ]);

  return {
    filteredItems,
    isCustomWorkspace,
    loadingWorkspaceObjects: loadingWorkspaceObjects || (isSharedWorkspace && loadingSharedRows),
  };
}

