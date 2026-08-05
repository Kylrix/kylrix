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
  const { activeWorkspace } = useWorkspace();
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

    const registeredIds = new Set(
      workspaceProjectObjects.map((po) => po.entityId).filter(Boolean)
    );
    const pid = activeWorkspace.id;

    return list.filter((item) => {
      const id = item.$id || item.id;
      return (id && registeredIds.has(id)) || item.projectId === pid;
    });
  }, [items, activeWorkspace, workspaceProjectObjects]);

  return {
    filteredItems,
    isCustomWorkspace,
    loadingWorkspaceObjects,
  };
}
