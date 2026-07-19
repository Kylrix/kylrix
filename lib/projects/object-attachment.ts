import { ProjectsService } from '@/lib/appwrite/projects';

export type ProjectObjectKind =
  | 'note'
  | 'goal'
  | 'task'
  | 'password'
  | 'credential'
  | 'secret'
  | 'form'
  | 'event'
  | 'tag'
  | 'totp'
  | 'moment'
  | 'call'
  | 'project'
  | 'collaborator'
  | 'unverified_github'
  | string;

export interface AttachObjectToProjectInput {
  projectId: string;
  entityKind: ProjectObjectKind;
  entityId: string;
  role?: string;
  metadata?: Record<string, unknown> | string | null;
}

export function normalizeProjectObjectKind(kind: ProjectObjectKind): string {
  const lower = String(kind || '').toLowerCase().trim();
  if (lower === 'task') return 'goal';
  if (lower === 'credential' || lower === 'secret') return 'password';
  return lower;
}

export function isAlreadyAttachedProjectObjectError(error: unknown): boolean {
  const message = String((error as any)?.message || '').toLowerCase();
  return (
    message.includes('already linked') ||
    message.includes('already added') ||
    message.includes('already_attached') ||
    message.includes('already_exists')
  );
}

export async function attachObjectToProject(input: AttachObjectToProjectInput) {
  return ProjectsService.addObjectToProject(
    input.projectId,
    normalizeProjectObjectKind(input.entityKind),
    input.entityId,
    input.role,
    input.metadata
  );
}

