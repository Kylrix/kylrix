export interface SortableWorkspaceItem {
  id: string;
  isPersonal?: boolean;
  [key: string]: any;
}

/**
 * Sorts workspaces so that:
 * 1. The active workspace displays at the very top (index 0).
 * 2. The personal workspace is seconded (index 1), provided it is not already the active workspace.
 * 3. The rest of the workspaces follow in their relative order.
 */
export function sortWorkspacesByActive<T extends SortableWorkspaceItem>(
  workspaces: T[],
  activeWorkspaceId: string,
  personalWorkspaceId: string
): T[] {
  if (!workspaces || workspaces.length === 0) return [];

  const activeItem = workspaces.find(
    (w) =>
      w.id === activeWorkspaceId ||
      (Boolean(w.isPersonal) && (activeWorkspaceId === personalWorkspaceId || activeWorkspaceId === 'personal' || activeWorkspaceId === 'guest'))
  );

  const personalItem = workspaces.find(
    (w) => Boolean(w.isPersonal) || w.id === personalWorkspaceId
  );

  const rest = workspaces.filter((w) => {
    if (activeItem && w.id === activeItem.id) return false;
    if (personalItem && w.id === personalItem.id) return false;
    return true;
  });

  const sorted: T[] = [];

  if (activeItem) {
    sorted.push(activeItem);
  }

  if (personalItem && (!activeItem || personalItem.id !== activeItem.id)) {
    sorted.push(personalItem);
  }

  sorted.push(...rest);
  return sorted;
}
