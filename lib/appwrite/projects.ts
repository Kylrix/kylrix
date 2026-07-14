import { ID, Query, Permission, Role } from 'appwrite';
import { databases, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';
import type { Projects, ProjectObjects } from '@/types/appwrite';

import { getNamedListCache } from '@/lib/services/list-cache';
import {
  clearSessionProjectsList,
  clearSessionProjectDetail,
  setSessionProjectsList,
} from '@/lib/projects/projects-cache';
import { invalidateCache } from '@/lib/ecosystem/nexus-fetcher';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECTS_COLLECTION_ID = 'projects';
const PROJECT_OBJECTS_COLLECTION_ID = 'project_objects';

const projectsCache = getNamedListCache<any[]>('projects', 60000); // 1 minute cache

export const ProjectsService = {
  async listProjects(force = false) {
    if (!force) {
      const { getSessionProjectsList } = await import('@/lib/projects/projects-cache');
      const warm = getSessionProjectsList();
      if (warm?.length) {
        return { rows: warm };
      }
    }

    const rows = await projectsCache.fetch(async () => {
      let result: any[];
      if (typeof window !== 'undefined') {
        const { account } = await import('./client');
        const { jwt } = await account.createJWT();
        const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
        result = await listProjectsWithCollaborationsSecure(jwt);
      } else {
        const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
        result = await listProjectsWithCollaborationsSecure();
      }
      setSessionProjectsList(result);
      return result;
    }, force);

    return { rows };
  },
  async getProject(projectId: string) {
    return databases.getRow<any>(
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
      const id = `ghost-project-${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const metadata = JSON.stringify({
        isGhost: true,
        send_object: { kind: 'project' }
      });
      
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      if (!Array.isArray(history)) history = [];
      
      history.unshift({
        id,
        title: data.title || 'Untitled Project',
        content: JSON.stringify({
          description: data.summary || '',
          status: data.status || 'active'
        }),
        metadata,
        createdAt: new Date().toISOString(),
        expiresAt
      });
      
      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
      import('react-hot-toast').then(t => t.default.success('Project saved locally.'));
      return { $id: id, title: data.title, summary: data.summary, status: data.status } as any;
    }

    if (typeof window !== 'undefined') {
      const { createProject } = await import('@/lib/actions/client-ops');
      return await createProject(data);
    }
    const { createProjectSecure } = await import('@/lib/actions/secure-ops');
    return await createProjectSecure(data);
  },

  async listProjectCollaborators(projectId: string) {
    return databases.listRows<any>(
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
    return databases.listRows<any>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [Query.equal('projectId', projectId)]
    );
  },

  async addObjectToProject(projectId: string, entityKind: string, entityId: string, role?: string, metadata?: any) {
    clearSessionProjectDetail(projectId);
    void invalidateCache(`project_detail_${projectId}`);
    void invalidateCache(`project_objects_${projectId}`);
    void invalidateCache(`project_entities_${projectId}_*`);
    void invalidateCache(`project_tagged_${projectId}_*`);
    if (typeof window !== 'undefined') {
      const { addObjectToProject } = await import('@/lib/actions/client-ops');
      return await addObjectToProject(projectId, entityKind, entityId, role, metadata);
    }
    const { addObjectToProjectSecure } = await import('@/lib/actions/secure-ops');
    return await addObjectToProjectSecure(projectId, entityKind, entityId, role, metadata);
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
