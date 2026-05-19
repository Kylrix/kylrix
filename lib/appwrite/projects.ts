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

    return databases.listDocuments<Projects>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      [
        Query.equal('ownerId', user.$id),
        Query.orderDesc('updatedAt'),
      ]
    );
  },

  async getProject(projectId: string) {
    return databases.getDocument<Projects>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      projectId
    );
  },

  async createProject(data: Partial<Projects>) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    return databases.createDocument<Projects>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      ID.unique(),
      {
        ...data,
        ownerId: user.$id,
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

  async listProjectCollaborators(projectId: string) {
    return databases.listDocuments<ProjectObjects>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [
          Query.equal('projectId', projectId),
          Query.equal('entityKind', 'collaborator')
      ]
    );
  },

  async addCollaborator(projectId: string, userId: string, role: string = 'member') {
      // 1. Add object link
      const obj = await this.addObjectToProject(projectId, 'collaborator', userId, role);
      
      // 2. Update project permissions (grant read/update if shared)
      const project = await this.getProject(projectId);
      const permissions = new Set(project.$permissions);
      permissions.add(Permission.read(Role.user(userId)));
      permissions.add(Permission.update(Role.user(userId)));
      
      await this.updateProject(projectId, { visibility: 'shared' }, Array.from(permissions));
      return obj;
  },

  async updateProject(projectId: string, data: Partial<Projects>, permissions?: string[]) {
    const now = new Date().toISOString();
    return databases.updateDocument<Projects>(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      projectId,
      {
        ...data,
        updatedAt: now,
      },
      permissions
    );
  },

  async deleteProject(projectId: string) {
    // Delete all objects linked to this project first
    const objects = await this.listProjectObjects(projectId);
    for (const obj of objects.documents) {
      await this.removeObjectFromProject(obj.$id);
    }

    return databases.deleteDocument(
      DATABASE_ID,
      PROJECTS_COLLECTION_ID,
      projectId
    );
  },

  async listProjectObjects(projectId: string) {
    return databases.listDocuments<ProjectObjects>(
      DATABASE_ID,
      PROJECT_OBJECTS_COLLECTION_ID,
      [Query.equal('projectId', projectId)]
    );
  },

  async addObjectToProject(projectId: string, entityKind: string, entityId: string, role?: string, metadata?: any) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    return databases.createDocument<ProjectObjects>(
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
