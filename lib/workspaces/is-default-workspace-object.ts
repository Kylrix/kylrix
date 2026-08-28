/**
 * Default (personal / virtual) view excludes rows tagged for or assigned to a named workspace.
 * Named workspace views filter via project_objects or projectId instead.
 */
export function isDefaultWorkspaceObject(row: {
  isWorkspace?: boolean | string | number | null;
  is_workspace?: boolean | string | number | null;
  projectId?: string | null;
  project_id?: string | null;
  workspaceId?: string | null;
  workspace_id?: string | null;
  tags?: string[] | string | null;
  [key: string]: any;
}): boolean {
  if (!row) return true;

  // Check isWorkspace variations (boolean, string, number)
  const isWs = row.isWorkspace ?? row.is_workspace ?? (row as any).isWorkspaceItem;
  if (isWs === true || isWs === 'true' || isWs === 1 || isWs === '1') {
    return false;
  }

  // Check project / workspace ID
  const pid = row.projectId ?? row.project_id ?? row.workspaceId ?? row.workspace_id;
  if (pid && typeof pid === 'string' && pid !== 'inbox' && pid !== 'personal' && pid !== 'default') {
    return false;
  }

  // Check tags (array or string)
  if (Array.isArray(row.tags)) {
    if (
      row.tags.some(
        (t: unknown) =>
          typeof t === 'string' &&
          (t.startsWith('workspace:') ||
            t.startsWith('project:') ||
            t.startsWith('ws:') ||
            t === 'isWorkspace' ||
            t === 'workspace'),
      )
    ) {
      return false;
    }
  } else if (typeof row.tags === 'string') {
    if (
      row.tags.includes('workspace:') ||
      row.tags.includes('project:') ||
      row.tags.includes('ws:')
    ) {
      return false;
    }
  }

  return true;
}
