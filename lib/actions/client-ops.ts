'use client';

import { account } from '@/lib/appwrite/client';
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
  promoteGhostResourceThreadToStorySecure
} from './secure-ops';

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

export async function deleteProject(projectId: string) {
  const jwt = await getJwt();
  return deleteProjectSecure(projectId, jwt);
}

export async function addProjectCollaborator(projectId: string, userId: string, roleLevel: string = 'viewer') {
  const jwt = await getJwt();
  return addProjectCollaboratorSecure(projectId, userId, roleLevel, jwt);
}

export async function removeProjectCollaborator(projectId: string, userId: string) {
  const jwt = await getJwt();
  return removeProjectCollaboratorSecure(projectId, userId, jwt);
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
  return createSendGhostObjectSecure(data);
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

export async function promoteGhostResourceThreadToStory(resourceId: string, resourceType: string) {
  const jwt = await getJwt();
  return promoteGhostResourceThreadToStorySecure(resourceId, resourceType, jwt);
}


