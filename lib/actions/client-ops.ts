'use client';

import { account } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  createNoteSecure,
  updateNoteSecure,
  deleteNoteSecure,
  sharePublicNoteAsMomentSecure,
  grantPermissionSecure,
  revokePermissionSecure,
  createProjectSecure,
  updateProjectSecure,
  deleteProjectSecure,
  addProjectCollaboratorSecure,
  removeProjectCollaboratorSecure,
  createFormSecure,
  updateFormSecure,
  deleteFormSecure,
  addFormCollaboratorSecure,
  removeFormCollaboratorSecure,
  createEventSecure,
  updateEventSecure,
  deleteEventSecure,
  addEventManagerSecure,
  removeEventManagerSecure,
  addCallCohostSecureAction,
  endCallSecureAction,
  updateCallMetadataSecureAction,
  runTokenOperationSecure,
  trackEngagementViewSecure,
  addObjectToProjectSecure,
  removeObjectFromProjectSecure,
  createCallSecure,
  createGhostNoteSecure,
  createSendGhostObjectSecure,
  createGhostNoteForCallSecure,
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  convertResponseToGoalSecure,
  createGhostNoteForProjectSecure,
  promoteGhostThreadToStorySecure,
  createEncryptedGroupForProjectSecure,
  createGhostNoteForResourceSecure,
  promoteGhostResourceThreadToStorySecure,
  tagResourceSecure,
  untagResourceSecure,
  getResourceTagsSecure,
  getResourceCollaboratorsSecure,
  createGhostNoteChatSecure,
  listGhostNoteChatsSecure,
  getCrossSuggestionsSecure,
  initGoalDiscussionSecure,
  toggleResourcePublicGuestSecure,
  getResourcePublicGuestSecure,
  getPublicGoalDataSecure,
  getGlobalProfileStatusSecure,
  attachObjectSecure,
  detachObjectSecure,
  detachObjectByRelationSecure,
  getObjectsByParentSecure,
  approveProjectJoinRequestSecure,
} from './secure-ops';
import { PublicResourceType } from '@/lib/share/resource-types';

// Helper to fetch JWT securely from client-side SDK
async function getJwt(): Promise<string | undefined> {
  try {
    const res = await account.createJWT();
    return res.jwt;
  } catch (e) {
    console.warn('[client-ops] Failed to generate JWT:', e);
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

export async function sharePublicNoteAsMoment(noteId: string, text?: string) {
  const jwt = await getJwt();
  return sharePublicNoteAsMomentSecure({ noteId, text, jwt });
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
  bucketId: string,
) {
  const jwt = await getJwt();
  const { getNoteInheritedFileBlobSecure } = await import('./secure-ops');
  return getNoteInheritedFileBlobSecure(noteId, fileId, bucketId, jwt);
}

export async function grantPermission(input: any) {
  const jwt = await getJwt();
  return grantPermissionSecure({ ...input, jwt });
}

export async function revokePermission(input: any) {
  const jwt = await getJwt();
  return revokePermissionSecure({ ...input, jwt });
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

// --- Calls ---
export async function addCallCohost(callId: string, cohostId: string, allowEndCall: boolean = false) {
  const jwt = await getJwt();
  return addCallCohostSecureAction(callId, cohostId, allowEndCall, jwt);
}

export async function endCall(callId: string) {
  const jwt = await getJwt();
  return endCallSecureAction(callId, jwt);
}

export async function updateCallMetadata(callId: string, extraMetadata: any) {
  const jwt = await getJwt();
  return updateCallMetadataSecureAction(callId, extraMetadata, jwt);
}

// --- Operations & Engagement ---
export async function runTokenOperation(body: any) {
  const jwt = await getJwt();
  // If JWT is needed inside body or operation, secure action can use getActor(jwt)
  return runTokenOperationSecure(body);
}

export async function trackEngagementView(input: any) {
  return trackEngagementViewSecure(input);
}

export async function secureUploadFile(formData: FormData) {
  const { secureUploadFile: secureUploadFileServer } = await import('./secure-upload');
  const jwt = await getJwt();
  return secureUploadFileServer(formData, jwt);
}

export async function createCall(data: any) {
  const jwt = await getJwt();
  return createCallSecure(data, jwt);
}

export async function createGhostNote(data: any) {
  return createGhostNoteSecure(data);
}

export async function createSendGhostObject(data: any) {
  const jwt = await getJwt();
  return createSendGhostObjectSecure({ ...data, jwt });
}

export async function createGhostNoteForCall(callId: string, title?: string) {
  const jwt = await getJwt();
  return createGhostNoteForCallSecure(callId, title, jwt);
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

export async function createGhostNoteForProject(projectId: string, title?: string) {
  const jwt = await getJwt();
  return createGhostNoteForProjectSecure(projectId, title, jwt);
}

export async function deleteGhostNoteForProject(noteId: string) {
  const jwt = await getJwt();
  return deleteRowSecure(APPWRITE_CONFIG.DATABASES.NOTE, APPWRITE_CONFIG.TABLES.NOTE.NOTES, noteId, jwt);
}

export async function promoteGhostThreadToStory(projectId: string, noteId: string) {
  const jwt = await getJwt();
  return promoteGhostThreadToStorySecure(projectId, noteId, jwt);
}

export async function createEncryptedGroupForProject(projectId: string) {
  const jwt = await getJwt();
  return createEncryptedGroupForProjectSecure(projectId, jwt);
}

export async function createGhostNoteForResource(
  resourceId: string,
  resourceType: 'task' | 'project' | 'tag' | 'event' | 'form',
  title?: string
) {
  const jwt = await getJwt();
  return createGhostNoteForResourceSecure(resourceId, resourceType, title, jwt);
}

export async function initGoalDiscussion(taskId: string) {
  const jwt = await getJwt();
  return initGoalDiscussionSecure(taskId, jwt);
}

export async function promoteGhostResourceThreadToStory(resourceId: string, resourceType: string) {
  const jwt = await getJwt();
  return promoteGhostResourceThreadToStorySecure(resourceId, resourceType, jwt);
}

export async function tagResource(
  resourceId: string,
  resourceType: string,
  tagName: string,
  isPublic = false,
  isGuest = false
) {
  const { hasAuthSessionHint } = await import('@/lib/appwrite/client');
  if (!hasAuthSessionHint()) {
      const id = `ghost-tag-${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const metadata = JSON.stringify({
        isGhost: true,
        send_object: { kind: 'tag' }
      });
      
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      let history = historyRaw ? JSON.parse(historyRaw) : [];
      if (!Array.isArray(history)) history = [];
      
      history.unshift({
        id,
        title: tagName,
        content: '',
        metadata,
        createdAt: new Date().toISOString(),
        expiresAt
      });
      
      localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
      import('react-hot-toast').then(t => t.default.success('Tag saved locally.'));
      return { success: true, id };
  }

  const jwt = await getJwt();
  return tagResourceSecure(resourceId, resourceType, tagName, isPublic, isGuest, jwt);
}

export async function untagResource(
  resourceId: string,
  resourceType: string,
  tagName: string
) {
  const jwt = await getJwt();
  return untagResourceSecure(resourceId, resourceType, tagName, jwt);
}

export async function getResourceTags(
  resourceId: string,
  resourceType: string
) {
  const jwt = await getJwt();
  return getResourceTagsSecure(resourceId, resourceType, jwt);
}

export async function createGhostNoteChat(title: string, participants: string[], customRowId?: string) {
  const jwt = await getJwt();
  return createGhostNoteChatSecure({ title, participants, customRowId, jwt });
}

export async function listGhostNoteChats() {
  const jwt = await getJwt();
  return listGhostNoteChatsSecure(jwt);
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
    jwt,
  });
}

export async function getCrossSuggestions(params: { sourceApp: string; sourceType: string; sourceId: string | null }) {
  const jwt = await getJwt();
  return getCrossSuggestionsSecure(params, jwt);
}

export async function claimSendObject(payload: { noteId: string; claimSecret: string; decryptedData?: any }) {
  const jwt = await getJwt();
  if (!jwt) throw new Error('Unauthenticated');
  const { claimSendObjectSecure } = await import('./secure-ops');
  return claimSendObjectSecure({ ...payload, jwt });
}

export async function deleteGhostThread(threadId: string) {
    const jwt = await getJwt();
    const { deleteGhostThreadSecure } = await import('./secure-ops');
    return deleteGhostThreadSecure(threadId, jwt);
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

export async function getResourcePublicGuest(params: {
  resourceType: PublicResourceType;
  resourceId: string;
}) {
  const jwt = await getJwt();
  return getResourcePublicGuestSecure({ ...params, jwt });
}

export async function getPublicGoalData(goalId: string) {
  return getPublicGoalDataSecure(goalId);
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

export async function detachObject(objectId: string) {
  const jwt = await getJwt();
  return detachObjectSecure(objectId, jwt);
}

export async function detachObjectByRelation(params: {
  parentId: string;
  childId: string;
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

export async function checkEmailAuthMethod(email: string) {
  const { checkEmailAuthMethodAction } = await import('./secure-ops');
  return checkEmailAuthMethodAction({ email });
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



