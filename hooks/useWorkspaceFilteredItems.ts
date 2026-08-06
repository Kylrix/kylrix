'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useProjectObjects } from '@/hooks/useProjectObjects';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';

export interface WorkspaceItemLike {
  $id?: string | null;
  id?: string | null;
  projectId?: string | null;
  isWorkspace?: boolean | null;
  [key: string]: any;
}

/**
 * Centralized Workspace Item Filter Hook
 * 
 * Filters any list of items (notes, goals, events, forms, credentials, totp)
 * based on the active workspace context:
 * 
 * 1. Personal Workspace:
 *    - Uses `isDefaultWorkspaceObject(item)` (i.e. `isWorkspace !== true`).
 * 
 * 2. Real / Custom Workspace (`projectId`):
 *    - Uses the `project_objects` join table (`useProjectObjects(projectId, entityKind)`).
 *    - Includes items if their ID exists in `project_objects` or if `item.projectId === activeWorkspace.id`.
 */
export function useWorkspaceFilteredItems<T extends WorkspaceItemLike>(
  items: T[],
  entityKind: 'note' | 'goal' | 'event' | 'form' | 'credential' | 'totp' | string
): { filteredItems: T[]; isCustomWorkspace: boolean; loadingWorkspaceObjects: boolean } {
  const { activeWorkspace, isEntityPendingInActiveWorkspace } = useWorkspace();
  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const customWorkspaceId = isCustomWorkspace ? activeWorkspace?.id : null;

  const { rows: workspaceProjectObjects, loading: loadingWorkspaceObjects } = useProjectObjects(
    customWorkspaceId,
    entityKind
  );

  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];

    if (!activeWorkspace || activeWorkspace.isPersonal) {
      return list.filter(isDefaultWorkspaceObject);
    }

    // While project_objects are still loading for this workspace/entityKind, don't hide items
    // that might belong — keep optimistic items. While we have no join rows yet,
    // don't filter by join at all (prevents "only new card" flash when cache is
    // still truncated and remote hasn't merged). Local copy is SoT per sync.
    if (loadingWorkspaceObjects && workspaceProjectObjects.length === 0) {
      // If we truly have no join rows, fall back to projectId/pending but don't
      // hide everything — return the list's workspace-tagged items so older
      // cards don't disappear during the replenish window.
      const hasAnyWorkspaceTagged = list.some((it) => (it as any).isWorkspace);
      if (!hasAnyWorkspaceTagged) {
        return list.filter((item) => {
          const pid = activeWorkspace.id;
          const id = item.$id || item.id;
          if (item.projectId === pid) return true;
          if (id && isEntityPendingInActiveWorkspace(entityKind, id)) return true;
          return false;
        });
      }
      // At least one item is already marked isWorkspace — show those to avoid "only new" flash
      return list.filter((item) => {
        const pid = activeWorkspace.id;
        const id = item.$id || item.id;
        if (item.projectId === pid) return true;
        if ((item as any).isWorkspace) return true;
        if (id && isEntityPendingInActiveWorkspace(entityKind, id)) return true;
        return false;
      });
    }

    const registeredIds = new Set(
      workspaceProjectObjects.map((po) => po.entityId).filter(Boolean)
    );
    const pid = activeWorkspace.id;

    return list.filter((item) => {
      const id = item.$id || item.id;
      return (id && registeredIds.has(id)) || item.projectId === pid || (id && isEntityPendingInActiveWorkspace(entityKind, id));
    });
  }, [items, activeWorkspace, workspaceProjectObjects, loadingWorkspaceObjects, isEntityPendingInActiveWorkspace, entityKind]);

  return {
    filteredItems,
    isCustomWorkspace,
    loadingWorkspaceObjects,
  };
}
