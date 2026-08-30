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
  if (getProjectKind(project) === 'project') return true;
  if (getParentProjectId(project)) return true;
  const meta = parseProjectMetadata(project.metadata);
  return meta.isSubProject === true || Boolean(meta.parentWorkspaceId);
}

export function isWorkspaceRecord(project: Partial<Projects> | null | undefined): boolean {
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
