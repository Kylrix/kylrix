import type { Projects, ProjectObjects, Notes } from '@/types/appwrite';

export const PROJECTS_LIST_TTL = 1000 * 60 * 30; // 30 min
export const PROJECT_DETAIL_TTL = 1000 * 60 * 10; // 10 min
export const PROJECT_OBJECTS_TTL = 1000 * 60 * 5; // 5 min
export const PROJECT_ENTITIES_TTL = 1000 * 60 * 10; // 10 min
export const PROJECT_TAGGED_TTL = 1000 * 60 * 10; // 10 min
export const PROJECT_META_TTL = 1000 * 60 * 10; // 10 min

export type ProjectTaggedResources = {
  notes: any[];
  tasks: any[];
  credentials: any[];
  totps: any[];
  events: any[];
  forms: any[];
  moments: any[];
};

export type ProjectDetailCache = {
  project: Projects;
  projectObjects: ProjectObjects[];
  collaborators: any[];
  ownerProfile: any | null;
  gitIntegration: any | null;
  notes: Notes[];
  tasks: any[];
  credentials: any[];
  subProjects: Projects[];
  forms: any[];
  events: any[];
  tags: any[];
  totps: any[];
  moments: any[];
  calls: any[];
  taggedResources: ProjectTaggedResources;
};

/** In-memory session — survives client navigations within the same tab. */
let sessionProjectsList: Projects[] | null = null;
const sessionProjectDetails = new Map<string, ProjectDetailCache>();

export function projectsListCacheKey(userId: string): string {
  return `projects_list_${userId}`;
}

export function projectDetailCacheKey(projectId: string): string {
  return `project_detail_${projectId}`;
}

export function projectObjectsCacheKey(projectId: string): string {
  return `project_objects_${projectId}`;
}

export function projectMetaCacheKey(projectId: string): string {
  return `project_meta_${projectId}`;
}

export function projectTaggedCacheKey(projectId: string, tagIds: string[]): string {
  const sorted = [...tagIds].sort().join(',');
  return `project_tagged_${projectId}_${sorted}`;
}

export function projectEntityCacheKey(
  projectId: string,
  kind: string,
  ids: string[],
): string {
  const sorted = [...ids].sort().join(',');
  if (sorted.length <= 120) {
    return `project_entities_${projectId}_${kind}_${sorted}`;
  }
  let hash = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    hash = (hash << 5) - hash + sorted.charCodeAt(i);
    hash |= 0;
  }
  return `project_entities_${projectId}_${kind}_${Math.abs(hash)}`;
}

export function getSessionProjectsList(): Projects[] | null {
  if (sessionProjectsList) return sessionProjectsList;
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('kylrix_session_projects_list');
    if (cached) {
      sessionProjectsList = JSON.parse(cached);
      return sessionProjectsList;
    }
  } catch {}
  return null;
}

export function setSessionProjectsList(rows: Projects[]): void {
  sessionProjectsList = rows;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('kylrix_session_projects_list', JSON.stringify(rows));
    } catch {}
  }
}

export function clearSessionProjectsList(): void {
  sessionProjectsList = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kylrix_session_projects_list');
  }
}

export function getSessionProjectDetail(projectId: string): ProjectDetailCache | null {
  const cached = sessionProjectDetails.get(projectId);
  if (cached) return cached;

  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(`project_cache_${projectId}`) || sessionStorage.getItem(`project_cache_${projectId}`);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as ProjectDetailCache;
    sessionProjectDetails.set(projectId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionProjectDetail(projectId: string, payload: ProjectDetailCache): void {
  sessionProjectDetails.set(projectId, payload);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`project_cache_${projectId}`, JSON.stringify(payload));
      sessionStorage.setItem(`project_cache_${projectId}`, JSON.stringify(payload));
    } catch {
      // Quota exceeded — memory mirror still holds the payload.
    }
  }
}

export function clearSessionProjectDetail(projectId: string): void {
  sessionProjectDetails.delete(projectId);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`project_cache_${projectId}`);
    sessionStorage.removeItem(`project_cache_${projectId}`);
  }
}

export const EMPTY_TAGGED_RESOURCES: ProjectTaggedResources = {
  notes: [],
  tasks: [],
  credentials: [],
  totps: [],
  events: [],
  forms: [],
  moments: [],
};
