import { Query } from 'appwrite';
import { databases, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';
import type { Projects } from '@/types/appwrite';

import { getNamedListCache } from '@/lib/services/list-cache';
import {
  clearSessionProjectsList,
  clearSessionProjectDetail} from '@/lib/projects/projects-cache';
import { invalidateCache } from '@/lib/ecosystem/nexus-fetcher';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECTS_COLLECTION_ID = 'projects';
const PROJECT_OBJECTS_COLLECTION_ID = 'project_objects';

const projectsCache = getNamedListCache<any[]>('projects', 60000); // 1 minute cache

export const ProjectsService = {
  async listProjects(force = false) {
    if (typeof window !== 'undefined') {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<any[]>('f_projects_list');
        if (cached && cached.length > 0 && !force) {
          this.fetchRemoteProjects(force).then(async (remoteRows) => {
            if (remoteRows && remoteRows.length > 0) {
              await LocalEngine.cacheSet('f_projects_list', remoteRows);
            }
          }).catch(() => {});
          return { rows: cached };
        }
      } catch {}
    }

    const rows = await this.fetchRemoteProjects(force);
    if (typeof window !== 'undefined' && rows && rows.length > 0) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        void LocalEngine.cacheSet('f_projects_list', rows);
      } catch {}
    }
    return { rows };
  },

  async fetchRemoteProjects(_force = false) {
    let result: any[] = [];
    if (typeof window !== 'undefined') {
      let jwt: string | undefined = undefined;
      if (typeof navigator === 'undefined' || navigator.onLine) {
        try {
          const { account } = await import('./client');
          const res = await account.createJWT().catch(() => null);
          jwt = res?.jwt;
        } catch {}
      }
      const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
      result = await listProjectsWithCollaborationsSecure(jwt);
    } else {
      const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
      result = await listProjectsWithCollaborationsSecure();
    }
    return result;
  },
  async getProject(projectId: string) {
    return  (databases as any).getRow(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      projectId
    );
  },

  async createProject(data: Partial<Projects>) {
    projectsCache.invalidate();
    clearSessionProjectsList();
    void invalidateCache('projects_list_*');

    const user = await getCurrentUser().catch(() => null);
    if (!user?.$id) {
      const id = `project-${crypto.randomUUID()}`;
      return { $id: id, title: data.title || 'Untitled Project', summary: data.summary || '', status: data.status || 'active', ownerId: 'guest' } as any;
    }

    if (typeof window !== 'undefined') {
      const { createProject } = await import('@/lib/actions/client-ops');
      return await createProject(data);
    }
    const { createProjectSecure } = await import('@/lib/actions/secure-ops');
    return await createProjectSecure(data);
  },

  async listProjectCollaborators(projectId: string) {
    return (databases as any).listRows(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [
          Query.equal('projectId', projectId),
          Query.equal('entityKind', 'collaborator')
      ]
    );
  },

  async addCollaborator(projectId: string, userId: string, role: string = 'member') {
    if (typeof window !== 'undefined') {
      const { addProjectCollaborator } = await import('@/lib/actions/client-ops');
      return await addProjectCollaborator(projectId, userId, role);
    }
    const { addProjectCollaboratorSecure } = await import('@/lib/actions/secure-ops');
    return await addProjectCollaboratorSecure(projectId, userId, role);
  },

  async approveJoinRequest(projectId: string, userId: string, role: 'admin' | 'editor' | 'viewer' = 'viewer') {
    if (typeof window !== 'undefined') {
      const { approveProjectJoinRequest } = await import('@/lib/actions/client-ops');
      return await approveProjectJoinRequest(projectId, userId, role);
    }
    const { approveProjectJoinRequestSecure } = await import('@/lib/actions/secure-ops');
    return await approveProjectJoinRequestSecure(projectId, userId, role);
  },

  async requestProjectAccess(projectId: string) {
    const { requestProjectAccessSecure } = await import('@/lib/actions/secure-ops');
    const { account } = await import('@/lib/appwrite/client');
    const { jwt } = await account.createJWT();
    return await requestProjectAccessSecure(projectId, jwt);
  },

  async removeCollaborator(projectId: string, userId: string) {
    if (typeof window !== 'undefined') {
      const { removeProjectCollaborator } = await import('@/lib/actions/client-ops');
      return await removeProjectCollaborator(projectId, userId);
    }
    const { removeProjectCollaboratorSecure } = await import('@/lib/actions/secure-ops');
    return await removeProjectCollaboratorSecure(projectId, userId);
  },

  async updateProject(projectId: string, data: Partial<Projects>, permissions?: string[]) {
    projectsCache.invalidate();
    clearSessionProjectsList();
    clearSessionProjectDetail(projectId);
    void invalidateCache('projects_list_*');
    void invalidateCache(`project_detail_${projectId}`);
    void invalidateCache(`project_meta_${projectId}`);
    void invalidateCache(`project_objects_${projectId}`);
    if (typeof window !== 'undefined') {
      const { updateProject } = await import('@/lib/actions/client-ops');
      return await updateProject(projectId, data, permissions);
    }
    const { updateProjectSecure } = await import('@/lib/actions/secure-ops');
    return await updateProjectSecure(projectId, data, permissions);
  },

  async deleteProject(projectId: string, deleteMode: 'detach' | 'created_within' | 'all' = 'detach') {
    projectsCache.invalidate();
    clearSessionProjectsList();
    clearSessionProjectDetail(projectId);
    void invalidateCache('projects_list_*');
    void invalidateCache(`project_detail_${projectId}*`);
    if (typeof window !== 'undefined') {
      const { deleteProject } = await import('@/lib/actions/client-ops');
      return await deleteProject(projectId, deleteMode);
    }
    const { deleteProjectSecure } = await import('@/lib/actions/secure-ops');
    return await deleteProjectSecure(projectId, deleteMode);
  },

  async listProjectObjects(projectId: string) {
    const result = await (databases as any).listRows(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [Query.equal('projectId', projectId)]
    );
    // Warm the local copy for offline / workspace-switch reads
    if (typeof window !== 'undefined' && result?.rows?.length) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { projectObjectsCacheKey, projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
        void LocalEngine.cacheSet(projectObjectsCacheKey(projectId), result.rows);
        // Partition by kind so kind-specific reads hit cache immediately
        const byKind: Record<string, any[]> = {};
        for (const row of result.rows) {
          const k = row.entityKind as string;
          if (k) { (byKind[k] = byKind[k] || []).push(row); }
        }
        for (const [kind, rows] of Object.entries(byKind)) {
          void LocalEngine.cacheSet(projectObjectsKindCacheKey(projectId, kind), rows);
        }
      } catch {}
    }
    return result;
  },

  /**
   * Fetch project_objects filtered by entityKind (e.g. 'note', 'goal', 'credential').
   * The unique index (projectId, entityKind, entityId) covers this query efficiently.
   * Results are written to LocalEngine so subsequent calls resolve instantly from cache.
   */
  async listProjectObjectsByKind(projectId: string, entityKind: string) {
    const { projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
    const cacheKey = projectObjectsKindCacheKey(projectId, entityKind);

    // Helper: paginated fetch all (Appwrite default 25 would truncate workspaces >25)
    const fetchAllRemote = async (): Promise<any[]> => {
      const all: any[] = [];
      let cursor: string | null = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const queries: string[] = [
          Query.equal('projectId', projectId),
          Query.equal('entityKind', entityKind),
          Query.limit(100),
          Query.orderDesc('$createdAt'),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const page: any = await (databases as any).listRows(
          DATABASE_ID,
          PROJECT_OBJECTS_COLLECTION_ID,
          queries,
        );
        const rows: any[] = page?.rows || [];
        if (rows.length === 0) break;
        all.push(...rows);
        if (rows.length < 100) break;
        cursor = rows[rows.length - 1].$id;
        // Safety cap for workspaces — 500 objects per kind covers current caps
        if (all.length >= 500) break;
      }
      return all;
    };

    // 1. Serve from local copy immediately (background refresh below — merge, never replace)
    if (typeof window !== 'undefined') {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<any[]>(cacheKey);
        if (cached && cached.length > 0) {
          // Fire background refresh to keep local copy warm — merge into cache, never wipe
          fetchAllRemote()
            .then(async (remoteRows: any[]) => {
              if (!remoteRows?.length) return;
              const existing = (await LocalEngine.cacheGet<any[]>(cacheKey)) || cached;
              const byId = new Map<string, any>();
              existing.forEach((r: any) => {
                const k = r.entityId || r.$id || (r as any).id;
                if (k) byId.set(k, r);
              });
              remoteRows.forEach((r: any) => {
                const k = r.entityId || r.$id || (r as any).id;
                if (k) byId.set(k, r);
              });
              const merged = Array.from(byId.values());
              await LocalEngine.cacheSet(cacheKey, merged);
            })
            .catch(() => {});
          return { rows: cached };
        }
      } catch {}
    }

    // 2. No local copy — fetch remote (paginated) and persist
    const allRows = await fetchAllRemote();
    const result = { rows: allRows, total: allRows.length } as any;

    if (typeof window !== 'undefined' && result?.rows?.length) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        void LocalEngine.cacheSet(cacheKey, result.rows);
      } catch {}
    }

    return result;
  },


  async addObjectToProject(projectId: string, entityKind: string, entityId: string, role?: string, metadata?: any) {
    clearSessionProjectDetail(projectId);
    void invalidateCache(`project_detail_${projectId}`);
    void invalidateCache(`project_objects_${projectId}`);
    void invalidateCache(`project_objects_${projectId}_kind_${entityKind}`);
    void invalidateCache(`project_entities_${projectId}_*`);
    void invalidateCache(`project_tagged_${projectId}_*`);

    let res: any;
    if (typeof window !== 'undefined') {
      const { addObjectToProject } = await import('@/lib/actions/client-ops');
      res = await addObjectToProject(projectId, entityKind, entityId, role, metadata);
    } else {
      const { addObjectToProjectSecure } = await import('@/lib/actions/secure-ops');
      res = await addObjectToProjectSecure(projectId, entityKind, entityId, role, metadata);
    }

    // Instantly persist new attachment into LocalEngine cache
    if (typeof window !== 'undefined' && res) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
        const cacheKey = projectObjectsKindCacheKey(projectId, entityKind);
        const existing = (await LocalEngine.cacheGet<any[]>(cacheKey)) || [];
        const filtered = existing.filter((item: any) => item.$id !== res.$id && item.entityId !== entityId);
        await LocalEngine.cacheSet(cacheKey, [res, ...filtered]);
      } catch {}
    }
    return res;
  },

  async removeObjectFromProject(objectId: string) {
    if (typeof window !== 'undefined') {
      const { removeObjectFromProject } = await import('@/lib/actions/client-ops');
      return await removeObjectFromProject(objectId);
    }
    const { removeObjectFromProjectSecure } = await import('@/lib/actions/secure-ops');
    return await removeObjectFromProjectSecure(objectId);
  },

  async listTaggedResources(tagIds: string[], projectId?: string) {
    if (!tagIds || tagIds.length === 0) {
      return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
    }

    if (typeof window !== 'undefined' && projectId) {
      const { account } = await import('./client');
      const { jwt } = await account.createJWT();
      const { listProjectTaggedResourcesSecure } = await import('@/lib/actions/secure-ops');
      return listProjectTaggedResourcesSecure(projectId, tagIds, jwt);
    }

    const databaseId = APPWRITE_CONFIG.DATABASES.NOTE;
    const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

    try {
      // 0. Resolve tag names for fallback name-based sweeping
      const { listTags } = await import('./index');
      const tagsRes = await listTags([Query.equal('$id', tagIds)]);
      const tagNames = tagsRes.rows.map((t: any) => t.name).filter(Boolean);

      // 1. Fetch ALL pivot records for these tags (by ID and by Name)
      // We do this in parallel to be exhaustive
      const [pivotById, pivotByName] = await Promise.all([
        databases.listRows(databaseId, pivotTable, [Query.equal('tagId', tagIds), Query.limit(5000)]),
        tagNames.length 
          ? databases.listRows(databaseId, pivotTable, [Query.equal('tag', tagNames), Query.limit(5000)])
          : Promise.resolve({ rows: [] })
      ]);

      const allPivotRows = [...pivotById.rows, ...pivotByName.rows];

      if (!allPivotRows.length) {
        return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
      }

      const resourceIdsByType: Record<string, Set<string>> = {};
      allPivotRows.forEach((p: any) => {
        const type = p.resourceType;
        const id = p.resourceId;
        if (!type || !id) return;
        
        // Normalize types
        let normalized = type;
        if (type === 'productivity.task' || type === 'goal') normalized = 'task';
        if (type === 'password' || type === 'secret') normalized = 'credential';
        
        if (!resourceIdsByType[normalized]) resourceIdsByType[normalized] = new Set();
        resourceIdsByType[normalized].add(id);
      });

      // Fetch actual objects in parallel
      const { listNotes, listFlowTasks, listKeepCredentials } = await import('./index');

      // Notes
      const notesPromise = resourceIdsByType['note']?.size 
        ? listNotes([Query.equal('$id', Array.from(resourceIdsByType['note']))], 500).then(r => r.rows).catch(() => []) 
        : Promise.resolve([]);

      // Tasks
      const tasksPromise = resourceIdsByType['task']?.size
        ? listFlowTasks([Query.equal('$id', Array.from(resourceIdsByType['task'])), Query.limit(500)]).then(r => r.rows).catch(() => [])
        : Promise.resolve([]);

      // Credentials
      const credentialsPromise = resourceIdsByType['credential']?.size
        ? listKeepCredentials([Query.equal('$id', Array.from(resourceIdsByType['credential'])), Query.limit(500)]).then(r => r.rows).catch(() => [])
        : Promise.resolve([]);

      // TOTPs
      const totpsPromise = resourceIdsByType['totp']?.size
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, [Query.equal('$id', Array.from(resourceIdsByType['totp']))], 500).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      // Events
      const eventsPromise = resourceIdsByType['event']?.size
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, [Query.equal('$id', Array.from(resourceIdsByType['event']))], 500).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      // Forms
      const formsPromise = resourceIdsByType['form']?.size
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', Array.from(resourceIdsByType['form']))], 500).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      // Moments
      const momentsPromise = resourceIdsByType['moment']?.size
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CONNECT, APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS, [Query.equal('$id', Array.from(resourceIdsByType['moment']))], 500).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      const [notes, tasks, credentials, totps, events, forms, moments] = await Promise.all([
        notesPromise, tasksPromise, credentialsPromise, totpsPromise, eventsPromise, formsPromise, momentsPromise
      ]);

      return { notes, tasks, credentials, totps, events, forms, moments };

    } catch (err) {
      console.error('[ProjectsService] Failed to list tagged resources:', err);
      return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
    }
  }
};
