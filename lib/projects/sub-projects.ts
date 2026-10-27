/**
 * Projects / Workspaces helpers.
 * Sub-projects are eliminated; all items are top-level workspaces.
 */

import type { Projects } from '@/lib/data';

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

export function isWorkspaceRecord(project: Partial<Projects> | null | undefined): boolean {
  if (!project || typeof project !== 'object') return false;
  const p = project as any;
  const id = String(p.$id || p.id || '').trim();
  if (!id) return false;

  const parentId = p.parentProjectId ?? p.parentId ?? null;
  if (parentId !== null && parentId !== undefined && String(parentId).trim() !== '') {
    return false;
  }

  const meta = parseProjectMetadata(p.metadata);
  if (meta && typeof meta === 'object') {
    if (meta.isSubProject === true || meta.kind === 'subproject') {
      return false;
    }
  }

  return true;
}

export function filterRootWorkspaceProjects<T extends Partial<Projects>>(projects: T[]): T[] {
  return Array.isArray(projects) ? projects : [];
}
