'use client';

import { account } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  createNoteSecure,
  updateNoteSecure,
  deleteNoteSecure,
  listTagsSecure,
  grantPermissionSecure,
  createProjectSecure,
  updateProjectSecure,
  deleteProjectSecure,
  addProjectCollaboratorSecure,
  removeProjectCollaboratorSecure,
  createFormSecure,
  listUserFormsSecure,
  updateFormSecure,
  deleteFormSecure,
  addFormCollaboratorSecure,
  removeFormCollaboratorSecure,
  createEventSecure,
  updateEventSecure,
  deleteEventSecure,
  addEventManagerSecure,
  removeEventManagerSecure,
  runTokenOperationSecure,
  addObjectToProjectSecure,
  removeObjectFromProjectSecure,
  createthreadNoteSecure,
  createSendthreadObjectSecure,
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  convertResponseToGoalSecure,
  createthreadNoteForProjectSecure,
  createthreadNoteForResourceSecure,
  promotethreadResourceThreadToStorySecure,
  getResourceCollaboratorsSecure,
  createthreadNoteChatSecure,
  listthreadNoteChatsSecure,
  getCrossSuggestionsSecure,
  initGoalDiscussionSecure,
  toggleResourcePublicGuestSecure,
  getGlobalProfileStatusSecure,
  attachObjectSecure,
  detachObjectByRelationSecure,
  getObjectsByParentSecure,
  approveProjectJoinRequestSecure,
  getOrCreateThreadSecure,
  findThreadSecure,
  listThreadMessagesSecure,
  postThreadMessageSecure,
} from './secure-ops';
import { PublicResourceType } from '@/lib/share/resource-types';

// Helper to fetch JWT securely from client-side SDK
async function getJwt(): Promise<string | undefined> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return undefined;
  }
  try {
    const res = await account.createJWT().catch(() => null);
    return res?.jwt;
  } catch (_e) {
    return undefined;
  }
}

// --- Notes CRUD ---
export async function createNote(data: any) {
  const jwt = await getJwt();
  return createNoteSecure(data, jwt);
}

export async function updateNote(noteId: string, data: any) {
  const jwt = await getJwt();
  return updateNoteSecure(noteId, data, jwt);
}

export async function deleteNote(noteId: string) {
  const jwt = await getJwt();
  return deleteNoteSecure(noteId, jwt);
}

// --- Goals CRUD ---
export async function createGoal(data: any) {
  const jwt = await getJwt();
  const { createGoalSecure } = await import('./secure-ops');
  return createGoalSecure(data, jwt);
}

export async function updateGoal(goalId: string, data: any) {
  const jwt = await getJwt();
  const { updateGoalSecure } = await import('./secure-ops');
  return updateGoalSecure(goalId, data, jwt);
}

export async function deleteGoal(goalId: string) {
  const jwt = await getJwt();
  const { deleteGoalSecure } = await import('./secure-ops');
  return deleteGoalSecure(goalId, jwt);
}

export async function listTags(userId?: string) {
  const jwt = await getJwt();
  return listTagsSecure(userId, jwt);
}

export async function getSharedNoteData(noteId: string) {
  const jwt = await getJwt();
  const { getSharedNoteDataSecure } = await import('./secure-ops');
  return getSharedNoteDataSecure(noteId, jwt);
}

export async function getNoteSecondaryObjectPreview(input: {
  noteId: string;
  childKind: string;
  childId: string;
  bucketId?: string;
  label?: string;
  href?: string;
  mimeType?: string;
}) {
  const jwt = await getJwt();
  const { getNoteSecondaryObjectPreviewSecure } = await import('./secure-ops');
  return getNoteSecondaryObjectPreviewSecure(input, jwt);
}

export async function getNoteInheritedFileBlob(
  noteId: string,
  fileId: string,
  bucketId: string) {
  const jwt = await getJwt();
  const { getNoteInheritedFileBlobSecure } = await import('./secure-ops');
  return getNoteInheritedFileBlobSecure(noteId, fileId, bucketId, jwt);
}

export async function grantPermission(input: any) {
  const jwt = await getJwt();
  return grantPermissionSecure({ ...input, jwt });
}


// --- Projects CRUD ---
export async function createProject(data: any) {
  const jwt = await getJwt();
  return createProjectSecure(data, jwt);
}

export async function updateProject(projectId: string, data: any, permissions?: string[]) {
  const jwt = await getJwt();
  return updateProjectSecure(projectId, data, permissions, jwt);
}

export async function deleteProject(projectId: string, deleteMode: 'detach' | 'created_within' | 'all' = 'detach') {
  const jwt = await getJwt();
  return deleteProjectSecure(projectId, deleteMode, jwt);
}

export async function addProjectCollaborator(projectId: string, userId: string, roleLevel: string = 'viewer') {
  const jwt = await getJwt();
  return addProjectCollaboratorSecure(projectId, userId, roleLevel, jwt);
}

export async function removeProjectCollaborator(projectId: string, userId: string) {
  const jwt = await getJwt();
  return removeProjectCollaboratorSecure(projectId, userId, jwt);
}

export async function approveProjectJoinRequest(
  projectId: string,
  userId: string,
  roleLevel: 'admin' | 'editor' | 'viewer' = 'viewer'
) {
  const jwt = await getJwt();
  return approveProjectJoinRequestSecure(projectId, userId, roleLevel, jwt);
}

export async function addObjectToProject(projectId: string, entityKind: string, entityId: string, role?: string, metadata?: any) {
  const jwt = await getJwt();
  return addObjectToProjectSecure(projectId, entityKind, entityId, role, metadata, jwt);
}

export async function removeObjectFromProject(objectId: string) {
  const jwt = await getJwt();
  return removeObjectFromProjectSecure(objectId, jwt);
}

// --- Forms CRUD ---
export async function createForm(data: any) {
  const jwt = await getJwt();
  return createFormSecure(data, jwt);
}

export async function listUserForms(userId: string) {
  const jwt = await getJwt();
  return listUserFormsSecure(userId, jwt);
}

export async function updateForm(formId: string, data: any) {
  const jwt = await getJwt();
  return updateFormSecure(formId, data, jwt);
}

export async function deleteForm(formId: string) {
  const jwt = await getJwt();
  return deleteFormSecure(formId, jwt);
}

export async function addFormCollaborator(formId: string, userId: string, roleLevel: string = 'viewer') {
  const jwt = await getJwt();
  return addFormCollaboratorSecure(formId, userId, roleLevel, jwt);
}

export async function removeFormCollaborator(formId: string, userId: string) {
  const jwt = await getJwt();
  return removeFormCollaboratorSecure(formId, userId, jwt);
}

export async function batchTrashFormSubmissions(formId: string, submissionIds: string[]) {
  const jwt = await getJwt();
  const { batchTrashFormSubmissionsSecure } = await import('./secure-ops/misc');
  return batchTrashFormSubmissionsSecure(formId, submissionIds, jwt);
}

// --- Events CRUD ---
export async function createEvent(data: any) {
  const jwt = await getJwt();
  return createEventSecure(data, jwt);
}

export async function updateEvent(eventId: string, data: any) {
  const jwt = await getJwt();
  return updateEventSecure(eventId, data, jwt);
}

export async function deleteEvent(eventId: string) {
  const jwt = await getJwt();
  return deleteEventSecure(eventId, jwt);
}

export async function addEventManager(eventId: string, userId: string, roleLevel: string = 'viewer') {
  const jwt = await getJwt();
  return addEventManagerSecure(eventId, userId, roleLevel, jwt);
}

export async function removeEventManager(eventId: string, userId: string) {
  const jwt = await getJwt();
  return removeEventManagerSecure(eventId, userId, jwt);
}

// --- Operations & Engagement ---
export async function runTokenOperation(body: any) {
  // If JWT is needed inside body or operation, secure action can use getActor(jwt)
  return runTokenOperationSecure(body);
}


export async function secureUploadFile(formData: FormData) {
  const { secureUploadFile: secureUploadFileServer } = await import('./secure-upload');
  const jwt = await getJwt();
  return secureUploadFileServer(formData, jwt);
}

export async function createthreadNote(data: any) {
  return createthreadNoteSecure(data);
}

export async function createSendthreadObject(data: any) {
  const jwt = await getJwt();
  return createSendthreadObjectSecure({ ...data, jwt });
}

export async function createRow(databaseId: string, tableId: string, data: any, permissions?: string[]) {
  const jwt = await getJwt();
  return createRowSecure(databaseId, tableId, data, permissions, jwt);
}

export async function updateRow(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) {
  const jwt = await getJwt();
  return updateRowSecure(databaseId, tableId, rowId, data, permissions, jwt);
}

export async function deleteRow(databaseId: string, tableId: string, rowId: string) {
  const jwt = await getJwt();
  return deleteRowSecure(databaseId, tableId, rowId, jwt);
}

export async function convertResponseToGoal(submissionId: string) {
  const jwt = await getJwt();
  return convertResponseToGoalSecure(submissionId, jwt);
}

export async function createthreadNoteForProject(projectId: string, title?: string) {
  const jwt = await getJwt();
  return createthreadNoteForProjectSecure(projectId, title, jwt);
}

export async function deletethreadNoteForProject(noteId: string) {
  const jwt = await getJwt();
  return deleteRowSecure(APPWRITE_CONFIG.DATABASES.NOTE, APPWRITE_CONFIG.TABLES.NOTE.NOTES, noteId, jwt);
}



export async function createthreadNoteForResource(
  resourceId: string,
  resourceType: 'task' | 'project' | 'tag' | 'event' | 'form',
  title?: string
) {
  const jwt = await getJwt();
  return createthreadNoteForResourceSecure(resourceId, resourceType, title, jwt);
}

export async function initGoalDiscussion(taskId: string) {
  const jwt = await getJwt();
  return initGoalDiscussionSecure(taskId, jwt);
}

export async function getOrCreateThread(data: {
  parentKind: string;
  parentId: string;
  channel?: string;
  title?: string;
  isPublic?: boolean;
  legacyNoteId?: string | null;
}) {
  const jwt = await getJwt();
  return getOrCreateThreadSecure({ ...data, jwt });
}

export async function findThread(data: {
  parentKind: string;
  parentId: string;
  channel?: string;
}) {
  const jwt = await getJwt();
  return findThreadSecure({ ...data, jwt });
}

export async function listThreadMessages(
  threadId: string,
  opts?: { limit?: number; rootMessageId?: string; topLevelOnly?: boolean },
) {
  const jwt = await getJwt();
  return listThreadMessagesSecure(threadId, opts, jwt);
}

export async function postThreadMessage(data: {
  threadId: string;
  content: string;
  parentMessageId?: string | null;
}) {
  const jwt = await getJwt();
  return postThreadMessageSecure({ ...data, jwt });
}

export async function promotethreadResourceThreadToStory(resourceId: string, resourceType: string) {
  const jwt = await getJwt();
  return promotethreadResourceThreadToStorySecure(resourceId, resourceType, jwt);
}




export async function createthreadNoteChat(title: string, participants: string[], customRowId?: string) {
  const jwt = await getJwt();
  return createthreadNoteChatSecure({ title, participants, customRowId, jwt });
}

export async function listthreadNoteChats() {
  const jwt = await getJwt();
  return listthreadNoteChatsSecure(jwt);
}

export async function getResourceCollaborators(params: { resourceId: string; resourceType: string }) {
  const jwt = await getJwt();
  const normalizedType = (await import('@/lib/utils/resource-ids')).normalizeCollaboratorResourceType(params.resourceType);
  if (!normalizedType) {
    return { collaborators: [] };
  }
  return getResourceCollaboratorsSecure({
    resourceId: params.resourceId,
    resourceType: normalizedType,
    jwt});
}

export async function getCrossSuggestions(params: { sourceApp: string; sourceType: string; sourceId: string | null }) {
  const jwt = await getJwt();
  return getCrossSuggestionsSecure(params, jwt);
}


export async function deletethreadThread(threadId: string) {
    const jwt = await getJwt();
    const { deletethreadThreadSecure } = await import('./secure-ops');
    return deletethreadThreadSecure(threadId, jwt);
}

export async function recordAnonymizedTelemetry(params: {
  niche: any;
  app: string;
  action: string;
  intent?: string | null;
  metadata?: any | null;
}) {
  const { recordAnonymizedTelemetrySecure } = await import('./secure-ops');
  return recordAnonymizedTelemetrySecure(params);
}

// --- Ruthless Sharing ---
export async function toggleResourcePublicGuest(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  mode: 'publish' | 'copy_only' | 'make_private' | 'guest_off' | 'guest_on';
  projectId?: string;
}) {
  const jwt = await getJwt();
  const res = await toggleResourcePublicGuestSecure({ ...params, jwt });

  try {
    if (typeof window !== 'undefined') {
      const { getCurrentUser } = await import('@/lib/appwrite/client');
      const currentUser = await getCurrentUser().catch(() => null);
      
      if (params.resourceType === 'note') {
        const { invalidateNoteRowClientCache } = await import('@/lib/appwrite/note');
        invalidateNoteRowClientCache(params.resourceId);
      } else if (params.resourceType === 'credential' || params.resourceType === 'totp') {
        const { VaultService } = await import('@/lib/appwrite/vault');
        if (currentUser?.$id) {
          (VaultService as any).clearCredentialCache(currentUser.$id);
        }
        const { invalidateCache } = await import('@/lib/ecosystem/nexus-fetcher');
        if (currentUser?.$id) {
          invalidateCache(`v_creds_total_${currentUser.$id}`);
          invalidateCache(`v_recent_creds_window_${currentUser.$id}`);
          invalidateCache(`v_totp_total_${currentUser.$id}`);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to invalidate sharing toggle cache:', err);
  }

  return res;
}



export async function getGlobalProfileStatus(userId: string) {
  return getGlobalProfileStatusSecure(userId);
}

export async function attachObject(params: {
  parentId: string;
  parentKind: string;
  childId: string;
  childKind: string;
  metadata?: any;
}) {
  const jwt = await getJwt();
  return attachObjectSecure({ ...params, jwt });
}


export async function detachObjectByRelation(params: {
  parentId: string;
  childId: string;
  childKind?: string;
  isSecondary?: boolean;
  bucketId?: string;
}) {
  const jwt = await getJwt();
  return detachObjectByRelationSecure({ ...params, jwt });
}

export async function getObjectsByParent(parentId: string, parentKind: string) {
  const jwt = await getJwt();
  return getObjectsByParentSecure(parentId, parentKind, jwt);
}

export async function syncMasterpassToAccountPassword(userId: string, masterpass: string) {
  const jwt = await getJwt();
  const { syncMasterpassToAccountPasswordAction } = await import('./secure-ops');
  return syncMasterpassToAccountPasswordAction({ userId, masterpass, jwt });
}


export async function createStandaloneTag(tagName: string) {
  const jwt = await getJwt();
  const { createStandaloneTagSecure } = await import('./secure-ops');
  return createStandaloneTagSecure(tagName, jwt);
}

export async function toggleTaskReminder(taskId: string, enabled: boolean) {
  const jwt = await getJwt();
  const { toggleTaskReminderSecure } = await import('./secure-ops');
  return toggleTaskReminderSecure(taskId, enabled, jwt);
}

export async function installFlow(params: {
  flowId: string;
  scope?: import('@/lib/flows/bindings').FlowScopeInput;
  grants?: Record<string, unknown> | null;
  bindObject?: boolean;
}) {
  const jwt = await getJwt();
  const { installFlowSecure } = await import('./secure-ops');
  return installFlowSecure({ ...params, jwt });
}

export async function listMyFlowInstalls() {
  const jwt = await getJwt();
  const { listMyFlowInstallsSecure } = await import('./secure-ops');
  return listMyFlowInstallsSecure(jwt);
}

export async function revokeFlowInstall(installId: string) {
  const jwt = await getJwt();
  const { revokeFlowInstallSecure } = await import('./secure-ops');
  return revokeFlowInstallSecure({ installId, jwt });
}

export async function requestFlowPublish(params: {
  flowId: string;
  confirmAware: boolean;
}) {
  const jwt = await getJwt();
  const { requestFlowPublishSecure } = await import('./secure-ops');
  return requestFlowPublishSecure({ ...params, jwt });
}

export async function createPat(params: {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  isWorkspace?: boolean;
  workspaceId?: string | null;
  keyCategory?: import('@/lib/services/pats').PatCategory;
  agentId?: string | null;
}) {
  const jwt = await getJwt();
  const { createPatSecure } = await import('./secure-ops');
  return createPatSecure({ ...params, jwt });
}

export async function listPats(opts?: { 
  isWorkspace?: boolean; 
  workspaceId?: string;
  category?: import('@/lib/services/pats').PatCategory;
  agentId?: string;
}) {
  const jwt = await getJwt();
  const { listPatsSecure } = await import('./secure-ops');
  return listPatsSecure({ ...opts, jwt });
}

export async function revokePat(patId: string) {
  const jwt = await getJwt();
  const { revokePatSecure } = await import('./secure-ops');
  return revokePatSecure({ patId, jwt });
}

export async function listOAuthAppInstalls() {
  const jwt = await getJwt();
  const { listOAuthAppInstallsSecure } = await import('./secure-ops');
  return listOAuthAppInstallsSecure(jwt);
}

export async function purgeExpiredTrash(retentionDays: number = 90) {
  const jwt = await getJwt();
  const { purgeExpiredTrashSecure } = await import('./secure-ops');
  return purgeExpiredTrashSecure({ retentionDays, jwt });
}

