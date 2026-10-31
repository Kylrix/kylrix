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

  // A record is a valid root workspace if !p.parentProjectId (or parentProjectId === null / "")
  const parentId = p.parentProjectId ?? p.parentId ?? null;
  if (parentId !== null && parentId !== undefined && String(parentId).trim() !== '') {
    return false;
  }

  // Do NOT require p.kind === 'workspace'; accept records where p.kind == null or p.kind === 'workspace'
  if (p.kind !== undefined && p.kind !== null && p.kind !== 'workspace') {
    return false;
  }

  const meta = parseProjectMetadata(p.metadata);
  if (meta && typeof meta === 'object') {
    if (meta.isSubProject === true || meta.kind === 'subproject') {
      return false;
    }
  }

  // Must have either p.title or p.name or p.$id / p.id
  const hasIdentifierOrTitle = Boolean(
    (typeof p.title === 'string' && p.title.trim()) ||
    (typeof p.name === 'string' && p.name.trim()) ||
    id
  );
  if (!hasIdentifierOrTitle) return false;

  // Ensure p.title defaults to p.title || p.name || 'Untitled Workspace'
  if (!p.title) {
    p.title = p.title || p.name || 'Untitled Workspace';
  }

  return true;
}

export function filterRootWorkspaceProjects<T extends Partial<Projects>>(projects: T[]): T[] {
  return Array.isArray(projects) ? projects : [];
}
