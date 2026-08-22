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
    let raw: any = null;
    try {
      raw = await (databases as any).listRows(
        DATABASE_ID,
        PROJECT_OBJECTS_COLLECTION_ID,
        [Query.equal('projectId', projectId)]
      );
    } catch {
      try {
        raw = await (databases as any).listDocuments(
          DATABASE_ID,
          PROJECT_OBJECTS_COLLECTION_ID,
          [Query.equal('projectId', projectId)]
        );
      } catch (err) {
        console.warn('[ProjectsService] listProjectObjects failed:', err);
      }
    }

    const rows: any[] = Array.isArray(raw?.rows)
      ? raw.rows
      : Array.isArray(raw?.documents)
        ? raw.documents
        : Array.isArray(raw)
          ? raw
          : [];

    // Warm the local copy for offline / workspace-switch reads
    if (typeof window !== 'undefined' && rows.length > 0) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { projectObjectsCacheKey, projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
        void LocalEngine.cacheSet(projectObjectsCacheKey(projectId), rows);
        // Partition by kind so kind-specific reads hit cache immediately
        const byKind: Record<string, any[]> = {};
        for (const row of rows) {
          const k = row.entityKind as string;
          if (k) { (byKind[k] = byKind[k] || []).push(row); }
        }
        for (const [kind, kindRows] of Object.entries(byKind)) {
          void LocalEngine.cacheSet(projectObjectsKindCacheKey(projectId, kind), kindRows);
        }
      } catch {}
    }
    return { rows };
  },

  /**
   * Fetch project_objects filtered by entityKind — collapsed to LocalEngine gateway with Realtime for workspace cards
   * UI never calls Appwrite directly; LocalEngine handles RxDB → Realtime → fetch
   */
  async listProjectObjectsByKind(projectId: string, entityKind: string) {
    const rawKind = String(entityKind).toLowerCase().trim();
    const normKind = (rawKind === 'idea' || rawKind === 'ideas' || rawKind === 'notes' || rawKind === 'note')
      ? 'note'
      : (rawKind === 'task' || rawKind === 'tasks' || rawKind === 'goals' || rawKind === 'goal')
        ? 'goal'
        : (rawKind === 'password' || rawKind === 'secret' || rawKind === 'credentials' || rawKind === 'credential')
          ? 'credential'
          : (rawKind === 'totp' || rawKind === 'totps')
            ? 'totp'
            : (rawKind === 'event' || rawKind === 'events')
              ? 'event'
              : (rawKind === 'form' || rawKind === 'forms')
                ? 'form'
                : (rawKind === 'agent_session' || rawKind === 'agentic_session' || rawKind === 'session' || rawKind === 'sessions')
                  ? 'agent_session'
                  : rawKind;

    const { projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
    const cacheKey = projectObjectsKindCacheKey(projectId, normKind);
    const { LocalEngine } = await import('@/lib/services/LocalEngine');

    const res = await LocalEngine.query<any>(
      cacheKey,
      async () => {
        const poRes = await this.listProjectObjects(projectId).catch(() => null);
        const allRows: any[] = Array.isArray(poRes?.rows) ? poRes.rows : [];
        return allRows.filter((r: any) => {
          const k = String(r.entityKind || '').toLowerCase().trim();
          if (normKind === 'note') return k === 'note' || k === 'idea' || k === 'notes' || k === 'ideas';
          if (normKind === 'goal') return k === 'goal' || k === 'task' || k === 'goals' || k === 'tasks';
          if (normKind === 'credential') return k === 'credential' || k === 'password' || k === 'secret' || k === 'credentials';
          if (normKind === 'totp') return k === 'totp' || k === 'totps';
          if (normKind === 'event') return k === 'event' || k === 'events';
          if (normKind === 'form') return k === 'form' || k === 'forms';
          if (normKind === 'agent_session') return k === 'agent_session' || k === 'agentic_session' || k === 'session' || k === 'sessions';
          return k === normKind;
        });
      },
      { realtimeChannel: `databases.${DATABASE_ID}.collections.${PROJECT_OBJECTS_COLLECTION_ID}.documents` }
    );
    const rows = Array.isArray(res) ? res : Array.isArray(res?.rows) ? res.rows : [];
    return { rows };
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
          let normalized = String(type).toLowerCase().trim();
          if (normalized === 'idea' || normalized === 'ideas' || normalized === 'note' || normalized === 'notes') normalized = 'note';
          else if (normalized === 'productivity.task' || normalized === 'goal' || normalized === 'goals' || normalized === 'task' || normalized === 'tasks') normalized = 'task';
          else if (normalized === 'password' || normalized === 'secret' || normalized === 'credential' || normalized === 'credentials') normalized = 'credential';
          else if (normalized === 'totp' || normalized === 'totps') normalized = 'totp';
          else if (normalized === 'event' || normalized === 'events') normalized = 'event';
          else if (normalized === 'form' || normalized === 'forms') normalized = 'form';
          else if (normalized === 'moment' || normalized === 'moments') normalized = 'moment';
          else if (normalized === 'agent_session' || normalized === 'agentic_session' || normalized === 'session' || normalized === 'sessions') normalized = 'agent_session';
          if (!resourceIdsByType[normalized]) resourceIdsByType[normalized] = new Set();
          resourceIdsByType[normalized].add(id);
        }

        const [notes, tasks, credentials, totps, events, forms, moments, sessions] = await Promise.all([
          resourceIdsByType['note']?.size 
            ? Promise.all(
                Array.from(resourceIdsByType['note']).map(async (id) => {
                  try {
                    const { getNote } = await import('./note');
                    return await getNote(id);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['task']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['task']).map(async (id) => {
                  try {
                    const { getTask } = await import('./task');
                    return await getTask(id);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['credential']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['credential']).map(async (id) => {
                  try {
                    const { getKeepCredential } = await import('./index');
                    return await getKeepCredential(id);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['totp']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['totp']).map(async (id) => {
                  try {
                    const { getTotpSecret } = await import('./index');
                    return await getTotpSecret(id);
                  } catch {
                    return (databases as any).getRow(APPWRITE_CONFIG.DATABASES.VAULT, APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, id).catch(() => null);
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['event']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['event']).map(async (id) => {
                  try {
                    return await (databases as any).getRow(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, id);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['form']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['form']).map(async (id) => {
                  try {
                    return await (databases as any).getRow(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, id);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
          resourceIdsByType['moment']?.size
            ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CONNECT, APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS, [Query.equal('$id', Array.from(resourceIdsByType['moment']))], 500).then((r: any) => r.rows || []).catch(() => [])
            : Promise.resolve([]),
          resourceIdsByType['agent_session']?.size
            ? Promise.all(
                Array.from(resourceIdsByType['agent_session']).map(async (id) => {
                  try {
                    return await (databases as any).getRow(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.SESSION_OBJECTS, id).catch(() => null);
                  } catch {
                    return null;
                  }
                })
              ).then((res) => res.filter(Boolean))
            : Promise.resolve([]),
        ]);

        if (!tagIds.length) {
          return { notes, tasks, credentials, totps, events, forms, moments, sessions };
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
