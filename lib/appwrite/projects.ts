import { ID, Query, Permission, Role } from 'appwrite';
import { databases, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';
import type { Projects, ProjectObjects } from '@/types/appwrite';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const PROJECTS_COLLECTION_ID = 'projects';
const PROJECT_OBJECTS_COLLECTION_ID = 'project_objects';

export const ProjectsService = {
  async listProjects() {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    return databases.listDocuments<any>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      [
        Query.equal('ownerId', user.$id),
        Query.orderDesc('updatedAt'),
      ]
    );
  },

  async getProject(projectId: string) {
    return databases.getDocument<any>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      projectId
    );
  },

  async createProject(data: Partial<Projects>) {
    const { createProjectSecure } = await import('@/lib/actions/secure-ops');
    return await createProjectSecure(data);
  },

  async listProjectCollaborators(projectId: string) {
    return databases.listDocuments<any>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [
          Query.equal('projectId', projectId),
          Query.equal('entityKind', 'collaborator')
      ]
    );
  },

  async addCollaborator(projectId: string, userId: string, role: string = 'member') {
    const { addProjectCollaboratorSecure } = await import('@/lib/actions/secure-ops');
    return await addProjectCollaboratorSecure(projectId, userId, role);
  },

  async removeCollaborator(projectId: string, userId: string) {
    const { removeProjectCollaboratorSecure } = await import('@/lib/actions/secure-ops');
    return await removeProjectCollaboratorSecure(projectId, userId);
  },

  async updateProject(projectId: string, data: Partial<Projects>, permissions?: string[]) {
    const { updateProjectSecure } = await import('@/lib/actions/secure-ops');
    return await updateProjectSecure(projectId, data, permissions);
  },

  async deleteProject(projectId: string) {
    const { deleteProjectSecure } = await import('@/lib/actions/secure-ops');
    return await deleteProjectSecure(projectId);
  },

  async listProjectObjects(projectId: string) {
    return databases.listDocuments<any>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [Query.equal('projectId', projectId)]
    );
  },

  async addObjectToProject(projectId: string, entityKind: string, entityId: string, role?: string, metadata?: any) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    return databases.createDocument<any>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      ID.unique(),
      {
        projectId,
        entityKind,
        entityId,
        role: role || 'member',
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: now,
        updatedAt: now,
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ]
    );
  },

  async removeObjectFromProject(objectId: string) {
    return databases.deleteDocument(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      objectId
    );
  }
};
