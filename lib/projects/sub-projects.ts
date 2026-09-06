/**
 * Sub-projects — nested projects tied to a parent workspace via `parentProjectId` + `kind`.
 * Legacy rows may still use metadata / project_objects until backfilled.
 */

import type { Projects } from '@/types/appwrite';

export type ProjectKind = 'workspace' | 'project';

export type SubProjectMetadata = {
  isSubProject?: boolean;
  parentWorkspaceId?: string;
};

export function parseProjectMetadata(raw: unknown): SubProjectMetadata & Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as SubProjectMetadata & Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as SubProjectMetadata & Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getProjectKind(project: Partial<Projects> | null | undefined): ProjectKind | null {
  const kind = String((project as any)?.kind || '').trim().toLowerCase();
  if (kind === 'workspace' || kind === 'project') return kind;
  return null;
}

export function getParentProjectId(project: Partial<Projects> | null | undefined): string | null {
  const column = String((project as any)?.parentProjectId || '').trim();
  if (column) return column;
  const meta = parseProjectMetadata(project?.metadata);
  const legacy = String(meta.parentWorkspaceId || '').trim();
  return legacy || null;
}

export function isSubProjectRecord(project: Partial<Projects> | null | undefined): boolean {
  if (!project) return false;
  const kind = getProjectKind(project);
  const parentId = getParentProjectId(project);
  const meta = parseProjectMetadata(project.metadata);

  // Canonical nested project: kind=project AND parent workspace id
  if (kind === 'project' && parentId) return true;

  // Legacy metadata sub-project flag (requires a parent pointer)
  if (meta.isSubProject === true && (parentId || meta.parentWorkspaceId)) return true;

  // parentProjectId set on a non-workspace row → nested
  if (parentId && kind !== 'workspace') return true;

  // kind=project with NO parent is a mis-tagged legacy workspace (schema default) — NOT a sub-project
  return false;
}

export function isWorkspaceRecord(project: Partial<Projects> | null | undefined): boolean {
  if (!project) return false;
  // Explicit workspace kind always counts (even if stale parentProjectId noise)
  if (getProjectKind(project) === 'workspace') return true;
  return !isSubProjectRecord(project);
}

export function buildSubProjectCreatePayload(parentWorkspaceId: string) {
  return {
    kind: 'project' as const,
    parentProjectId: parentWorkspaceId,
  };
}

/** Exclude nested projects from root workspace switcher lists. */
export function filterRootWorkspaceProjects<T extends Partial<Projects>>(projects: T[]): T[] {
  return projects.filter((p) => isWorkspaceRecord(p));
}
