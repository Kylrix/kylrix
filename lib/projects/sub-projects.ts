/**
 * Projects / Workspaces helpers.
 * Sub-projects are deprecated and killed off; all items are top-level workspaces.
 */

import type { Projects } from '@/types/appwrite';

export type ProjectKind = 'workspace';

export type SubProjectMetadata = Record<string, unknown>;

export function parseProjectMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getProjectKind(_project: Partial<Projects> | null | undefined): ProjectKind {
  return 'workspace';
}

export function getParentProjectId(_project: Partial<Projects> | null | undefined): string | null {
  return null;
}

export function isSubProjectRecord(_project: Partial<Projects> | null | undefined): boolean {
  return false;
}

export function isWorkspaceRecord(project: Partial<Projects> | null | undefined): boolean {
  return Boolean(project);
}

export function filterRootWorkspaceProjects<T extends Partial<Projects>>(projects: T[]): T[] {
  return Array.isArray(projects) ? projects : [];
}
