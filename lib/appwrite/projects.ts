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
  // Collapsed: sole gateway is LocalEngine.query — this is now a thin delegating shim
  async listProjects(force = false) {
    const user = await getCurrentUser().catch(() => null);
    const uid = user?.$id && user.$id !== 'guest' ? user.$id : 'guest';
    const cacheKey = uid !== 'guest' ? `f_projects_list_${uid}` : 'f_projects_list';
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    // Use LocalEngine unified query with Realtime for list blocks (idea/goals page cards)
    return LocalEngine.query<{ rows: any[] }>(
      cacheKey,
      async (_jwt) => {
        const rows = await this.fetchRemoteProjects(force);
        return { rows } as any;
      },
      { ttl: force ? 0 : 30 * 60 * 1000, realtimeChannel: `databases.${APPWRITE_CONFIG.DATABASES.CHAT}.collections.projects.documents` }
    ).then((res: any) => {
      // LocalEngine.query returns {rows} or raw array — normalize
      if (Array.isArray(res)) return { rows: res };
      if (res && Array.isArray(res.rows)) return res;
      if (res && Array.isArray(res.data)) return { rows: res.data };
      return res as { rows: any[] };
    }).catch(async () => {
      // Fallback to direct fetch if LocalEngine path fails (never double-read)
      const rows = await this.fetchRemoteProjects(force);
      return { rows };
    });
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
   * Fetch project_objects filtered by entityKind — collapsed to LocalEngine gateway with Realtime for workspace cards
   * UI never calls Appwrite directly; LocalEngine handles RxDB → Realtime → fetch
   */
  async listProjectObjectsByKind(projectId: string, entityKind: string) {
    const { projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
    const cacheKey = projectObjectsKindCacheKey(projectId, entityKind);
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    return LocalEngine.query<{ rows: any[] }>(
      cacheKey,
      async () => {
        const all: any[] = [];
        let cursor: string | null = null;
        while (true) {
          const queries: string[] = [
            Query.equal('projectId', projectId),
            Query.equal('entityKind', entityKind),
            Query.limit(100),
            Query.orderDesc('$createdAt'),
          ];
          if (cursor) queries.push(Query.cursorAfter(cursor));
          const page: any = await (databases as any).listRows(DATABASE_ID, PROJECT_OBJECTS_COLLECTION_ID, queries);
          const rows: any[] = page?.rows || [];
          if (rows.length === 0) break;
          all.push(...rows);
          if (rows.length < 100) break;
          cursor = rows[rows.length - 1].$id;
          if (all.length >= 500) break;
        }
        return { rows: all } as any;
      },
      { realtimeChannel: `databases.${DATABASE_ID}.collections.${PROJECT_OBJECTS_COLLECTION_ID}.documents` }
    );
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

  async listTaggedResources(tagIdsOrProjectId: string[] | string, explicitProjectId?: string) {
    let tagIds: string[] = [];
    let projectId: string | undefined = explicitProjectId;

    if (typeof tagIdsOrProjectId === 'string') {
      projectId = tagIdsOrProjectId;
      tagIds = [];
    } else if (Array.isArray(tagIdsOrProjectId)) {
      tagIds = tagIdsOrProjectId;
    }

    // If projectId is provided, fetch project_objects directly
    if (projectId) {
      try {
        const poRes = await this.listProjectObjects(projectId).catch(() => null);
        const poRows: any[] = Array.isArray(poRes?.rows) ? poRes.rows : [];
        const resourceIdsByType: Record<string, Set<string>> = {};

        for (const p of poRows) {
          const type = p.entityKind;
          const id = p.entityId;
          if (!type || !id) continue;
          let normalized = type;
          if (type === 'productivity.task' || type === 'goal') normalized = 'task';
          if (type === 'password' || type === 'secret') normalized = 'credential';
          if (!resourceIdsByType[normalized]) resourceIdsByType[normalized] = new Set();
          resourceIdsByType[normalized].add(id);
        }

        const { listNotes, listFlowTasks, listKeepCredentials } = await import('./index');

        const [notes, tasks, credentials, totps, events, forms, moments] = await Promise.all([
          resourceIdsByType['note']?.size 
            ? listNotes([Query.equal('$id', Array.from(resourceIdsByType['note']))], 500).then(r => r.rows || []).catch(() => []) 
            : Promise.resolve([]),
          resourceIdsByType['task']?.size
            ? listFlowTasks([Query.equal('$id', Array.from(resourceIdsByType['task'])), Query.limit(500)]).then(r => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['credential']?.size
            ? listKeepCredentials([Query.equal('$id', Array.from(resourceIdsByType['credential'])), Query.limit(500)]).then(r => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['totp']?.size
            ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, [Query.equal('$id', Array.from(resourceIdsByType['totp']))], 500).then((r: any) => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['event']?.size
            ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, [Query.equal('$id', Array.from(resourceIdsByType['event']))], 500).then((r: any) => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['form']?.size
            ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', Array.from(resourceIdsByType['form']))], 500).then((r: any) => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['moment']?.size
            ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CONNECT, APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS, [Query.equal('$id', Array.from(resourceIdsByType['moment']))], 500).then((r: any) => r.rows || []).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (!tagIds.length) {
          return { notes, tasks, credentials, totps, events, forms, moments };
        }
      } catch (err) {
        console.warn('[ProjectsService] listProjectObjects in listTaggedResources failed:', err);
      }
    }

    if (!tagIds || tagIds.length === 0) {
      return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
    }

    if (typeof window !== 'undefined' && projectId) {
      try {
        const { account } = await import('./client');
        const { jwt } = await account.createJWT();
        const { listProjectTaggedResourcesSecure } = await import('@/lib/actions/secure-ops');
        const res = await listProjectTaggedResourcesSecure(projectId, tagIds, jwt);
        if (res) return res;
      } catch {}
    }

    const databaseId = APPWRITE_CONFIG.DATABASES.NOTE;
    const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

    try {
      // 0. Resolve tag names for fallback name-based sweeping
      const { listTags } = await import('./index');
      const tagsRes = await listTags([Query.equal('$id', tagIds)]).catch(() => ({ rows: [] }));
      const tagNames = (tagsRes?.rows || []).map((t: any) => t.name).filter(Boolean);

      // 1. Fetch ALL pivot records for these tags (by ID and by Name)
      const [pivotById, pivotByName] = await Promise.all([
        databases.listRows(databaseId, pivotTable, [Query.equal('tagId', tagIds), Query.limit(5000)]).catch(() => ({ rows: [] })),
        tagNames.length 
          ? databases.listRows(databaseId, pivotTable, [Query.equal('tag', tagNames), Query.limit(5000)]).catch(() => ({ rows: [] }))
          : Promise.resolve({ rows: [] })
      ]);

      const rowsById = Array.isArray(pivotById?.rows) ? pivotById.rows : [];
      const rowsByName = Array.isArray(pivotByName?.rows) ? pivotByName.rows : [];
      const allPivotRows = [...rowsById, ...rowsByName];

      if (!allPivotRows.length) {
        return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
      }

      const resourceIdsByType: Record<string, Set<string>> = {};
      allPivotRows.forEach((p: any) => {
        const type = p.resourceType;
        const id = p.resourceId;
        if (!type || !id) return;
        
        let normalized = type;
        if (type === 'productivity.task' || type === 'goal') normalized = 'task';
        if (type === 'password' || type === 'secret') normalized = 'credential';
        
        if (!resourceIdsByType[normalized]) resourceIdsByType[normalized] = new Set();
        resourceIdsByType[normalized].add(id);
      });

      // Fetch actual objects in parallel
      const { listNotes, listFlowTasks, listKeepCredentials } = await import('./index');

      const [notes, tasks, credentials, totps, events, forms, moments] = await Promise.all([
        resourceIdsByType['note']?.size 
          ? listNotes([Query.equal('$id', Array.from(resourceIdsByType['note']))], 500).then(r => r.rows || []).catch(() => []) 
          : Promise.resolve([]),
        resourceIdsByType['task']?.size
          ? listFlowTasks([Query.equal('$id', Array.from(resourceIdsByType['task'])), Query.limit(500)]).then(r => r.rows || []).catch(() => [])
          : Promise.resolve([]),
        resourceIdsByType['credential']?.size
          ? listKeepCredentials([Query.equal('$id', Array.from(resourceIdsByType['credential'])), Query.limit(500)]).then(r => r.rows || []).catch(() => [])
          : Promise.resolve([]),
        resourceIdsByType['totp']?.size
          ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, [Query.equal('$id', Array.from(resourceIdsByType['totp']))], 500).then((r: any) => r.rows || []).catch(() => [])
          : Promise.resolve([]),
        resourceIdsByType['event']?.size
          ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, [Query.equal('$id', Array.from(resourceIdsByType['event']))], 500).then((r: any) => r.rows || []).catch(() => [])
          : Promise.resolve([]),
        resourceIdsByType['form']?.size
          ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', Array.from(resourceIdsByType['form']))], 500).then((r: any) => r.rows || []).catch(() => [])
          : Promise.resolve([]),
        resourceIdsByType['moment']?.size
          ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CONNECT, APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS, [Query.equal('$id', Array.from(resourceIdsByType['moment']))], 500).then((r: any) => r.rows || []).catch(() => [])
          : Promise.resolve([]),
      ]);

      return { notes, tasks, credentials, totps, events, forms, moments };

    } catch (err) {
      console.error('[ProjectsService] Failed to list tagged resources:', err);
      return { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
    }
  }
};
