import { ID, Query, Permission, Role } from 'appwrite';
import { databases, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';
import type { Projects, ProjectObjects } from '@/types/appwrite';

import { getNamedListCache } from '@/lib/services/list-cache';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECTS_COLLECTION_ID = 'projects';
const PROJECT_OBJECTS_COLLECTION_ID = 'project_objects';

const projectsCache = getNamedListCache<any[]>('projects', 60000); // 1 minute cache

export const ProjectsService = {
  async listProjects(force = false) {
    return {
      rows: await projectsCache.fetch(async () => {
        if (typeof window !== 'undefined') {
          const { account } = await import('./client');
          const { jwt } = await account.createJWT();
          const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
          return await listProjectsWithCollaborationsSecure(jwt);
        }
        const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
        return await listProjectsWithCollaborationsSecure();
      }, force)
    };
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
    if (typeof window !== 'undefined') {
      const { updateProject } = await import('@/lib/actions/client-ops');
      return await updateProject(projectId, data, permissions);
    }
    const { updateProjectSecure } = await import('@/lib/actions/secure-ops');
    return await updateProjectSecure(projectId, data, permissions);
  },

  async deleteProject(projectId: string, deleteMode: 'detach' | 'created_within' | 'all' = 'detach') {
    projectsCache.invalidate();
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

  async listTaggedResources(tagIds: string[]) {
    if (!tagIds || tagIds.length === 0) {
      return { 
        notes: [], 
        tasks: [], 
        credentials: [], 
        totps: [], 
        events: [], 
        forms: [], 
        moments: [] 
      };
    }

    const databaseId = APPWRITE_CONFIG.DATABASES.NOTE;
    const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';

    try {
      const pivotRes = await databases.listRows(
        databaseId,
        pivotTable,
        [
          Query.equal('tagId', tagIds),
          Query.limit(5000)
        ]
      );

      const resourceIdsByType: Record<string, string[]> = {};
      pivotRes.rows.forEach((p: any) => {
        const type = p.resourceType;
        const id = p.resourceId;
        if (!type || !id) return;
        if (!resourceIdsByType[type]) resourceIdsByType[type] = [];
        resourceIdsByType[type].push(id);
      });

      // Deduplicate IDs per type
      Object.keys(resourceIdsByType).forEach(type => {
        resourceIdsByType[type] = Array.from(new Set(resourceIdsByType[type]));
      });

      // Fetch actual objects in parallel
      const { 
        listNotes, 
        listFlowTasks, 
        listKeepCredentials 
      } = await import('./index');

      const notesPromise = resourceIdsByType['note']?.length 
        ? listNotes([Query.equal('$id', resourceIdsByType['note'])]).then(r => r.rows).catch(() => []) 
        : Promise.resolve([]);

      const tasksPromise = (resourceIdsByType['goal']?.length || resourceIdsByType['task']?.length)
        ? listFlowTasks([Query.equal('$id', [...(resourceIdsByType['goal'] || []), ...(resourceIdsByType['task'] || [])])]).then(r => r.rows).catch(() => [])
        : Promise.resolve([]);

      const credentialsPromise = resourceIdsByType['password']?.length || resourceIdsByType['credential']?.length
        ? listKeepCredentials([Query.equal('$id', [...(resourceIdsByType['password'] || []), ...(resourceIdsByType['credential'] || [])])]).then(r => r.rows).catch(() => [])
        : Promise.resolve([]);

      const totpsPromise = resourceIdsByType['totp']?.length
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, 'totpSecrets', [Query.equal('$id', resourceIdsByType['totp'])]).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      const eventsPromise = resourceIdsByType['event']?.length
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, 'events', [Query.equal('$id', resourceIdsByType['event'])]).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      const formsPromise = resourceIdsByType['form']?.length
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', resourceIdsByType['form'])]).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      const momentsPromise = resourceIdsByType['moment']?.length
        ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.MOMENTS, [Query.equal('$id', resourceIdsByType['moment'])]).then((r: any) => r.rows).catch(() => [])
        : Promise.resolve([]);

      const [
        notes,
        tasks,
        credentials,
        totps,
        events,
        forms,
        moments
      ] = await Promise.all([
        notesPromise,
        tasksPromise,
        credentialsPromise,
        totpsPromise,
        eventsPromise,
        formsPromise,
        momentsPromise
      ]);

      return {
        notes,
        tasks,
        credentials,
        totps,
        events,
        forms,
        moments
      };

    } catch (err) {
      console.error('[ProjectsService] Failed to list tagged resources:', err);
      return { 
        notes: [], 
        tasks: [], 
        credentials: [], 
        totps: [], 
        events: [], 
        forms: [], 
        moments: [] 
      };
    }
  }
};
