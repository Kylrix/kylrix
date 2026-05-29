import { ID, Query, Permission, Role } from 'appwrite';
import { databases, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';
import type { Projects, ProjectObjects } from '@/types/appwrite';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECTS_COLLECTION_ID = 'projects';
const PROJECT_OBJECTS_COLLECTION_ID = 'project_objects';

export const ProjectsService = {
  async listProjects() {
    if (typeof window !== 'undefined') {
      const { account } = await import('./client');
      const { jwt } = await account.createJWT();
      const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
      const rows = await listProjectsWithCollaborationsSecure(jwt);
      return { rows };
    }
    const { listProjectsWithCollaborationsSecure } = await import('@/lib/actions/secure-ops');
    const rows = await listProjectsWithCollaborationsSecure();
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
    if (typeof window !== 'undefined') {
      const { updateProject } = await import('@/lib/actions/client-ops');
      return await updateProject(projectId, data, permissions);
    }
    const { updateProjectSecure } = await import('@/lib/actions/secure-ops');
    return await updateProjectSecure(projectId, data, permissions);
  },

  async deleteProject(projectId: string) {
    if (typeof window !== 'undefined') {
      const { deleteProject } = await import('@/lib/actions/client-ops');
      return await deleteProject(projectId);
    }
    const { deleteProjectSecure } = await import('@/lib/actions/secure-ops');
    return await deleteProjectSecure(projectId);
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
  }
};
