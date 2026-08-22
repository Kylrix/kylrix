/**
 * Default (personal / virtual) view excludes rows tagged for or assigned to a named workspace.
 * Named workspace views filter via project_objects or projectId instead.
 */
export function isDefaultWorkspaceObject(row: {
  isWorkspace?: boolean | string | null;
  projectId?: string | null;
  tags?: string[] | null;
  [key: string]: any;
}): boolean {
  if (!row) return true;
  if (row.isWorkspace === true || row.isWorkspace === 'true') return false;
  if (row.projectId && row.projectId !== 'inbox' && row.projectId !== 'personal' && row.projectId !== 'default') {
    return false;
  }
  if (Array.isArray(row.tags) && row.tags.some((t: string) => typeof t === 'string' && (t.startsWith('workspace:') || t.startsWith('project:')))) {
    return false;
  }
  return true;
}
