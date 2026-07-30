'use server';

import {
  getActor} from './secure-ops/shared';

import {
  grantPermissionSecure,
  revokePermissionSecure,
  getResourceCollaboratorsSecure,
  addProjectCollaboratorSecure,
  removeProjectCollaboratorSecure,
  addFormCollaboratorSecure,
  removeFormCollaboratorSecure} from './secure-ops/permissions';

import {
  getPublicNoteDataSecure,
  getSharedNoteDataSecure,
  getNoteSecondaryObjectPreviewSecure,
  getNoteInheritedFileBlobSecure,
  getPublicNoteCommentsSecure,
  getPublicNoteReactionsSecure,
  getCrossSuggestionsSecure,
  syncNotesDeltaSecure,
  pullNotesDeltaSecure,
  pushNotesDeltaSecure,
  createNoteSecure,
  updateNoteSecure,
  deleteNoteSecure,
  createGhostNoteSecure,
  createGhostNoteForCallSecure,
  createGhostNoteForProjectSecure,
  createGhostNoteForResourceSecure,
  createGhostNoteChatSecure,
  listGhostNoteChatsSecure,
  listTagsSecure} from './secure-ops/notes';

import {
  getPublicGoalDataSecure,
  createAccountEventSecure,
  listProjectsWithCollaborationsSecure,
  createProjectSecure,
  updateProjectSecure,
  deleteProjectSecure,
  requestProjectAccessSecure,
  acceptProjectInviteSecure,
  addObjectToProjectSecure,
  listProjectTaggedResourcesSecure,
  getSweptConfigSecure,
  upsertSweptConfigSecure,
  removeObjectFromProjectSecure,
  createFormSecure,
  listUserFormsSecure,
  updateFormSecure,
  deleteFormSecure,
  createEventSecure,
  updateEventSecure,
  deleteEventSecure,
  addEventManagerSecure,
  removeEventManagerSecure,
  convertResponseToGoalSecure,
  createEncryptedGroupForProjectSecure,
  initGoalDiscussionSecure,
  approveProjectJoinRequestSecure} from './secure-ops/projects';

import {
  addCallCohostSecureAction,
  endCallSecureAction,
  updateCallMetadataSecureAction,
  createCallSecure} from './secure-ops/chats';

import {
  mintDailyLoginSecure,
  runTokenOperationSecure,
  trackEngagementViewSecure,
  recordAnonymizedTelemetrySecure,
  dispatchEmailSecure,
  getSharedProfilesSecure,
  executeMasterPurgeSecure,
  createReportSecure,
  getUsersByIdsSecure,
  createSendGhostObjectSecure,
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  searchGlobalUsersSecure,
  getProfileByUsernameSecure,
  listRowsSecure,
  getRowSecure,
  promoteGhostThreadToStorySecure,
  promoteGhostResourceThreadToStorySecure,
  tagResourceSecure,
  untagResourceSecure,
  getResourceTagsSecure,
  deleteGhostThreadSecure,
  getGlobalProfileStatusSecure,
  toggleResourcePublicGuestSecure,
  getResourcePublicGuestSecure,
  attachObjectSecure,
  detachObjectSecure,
  detachObjectByRelationSecure,
  getProfilePicturePreviewSecure,
  getObjectsByParentSecure,
  syncMasterpassToAccountPasswordAction,
  createStandaloneTagSecure,
  toggleTaskReminderSecure} from './secure-ops/misc';

import {
  getNostrIdentityAction,
  registerNostrIdentityAction,
  resolveNostrPubkeysAction} from './secure-ops/nostr';

export {
  
  
  getActor,
  
  
  
  
  
  
  
  
  
  
  
  
  
  grantPermissionSecure,
  revokePermissionSecure,
  getResourceCollaboratorsSecure,
  addProjectCollaboratorSecure,
  removeProjectCollaboratorSecure,
  addFormCollaboratorSecure,
  removeFormCollaboratorSecure,
  getPublicNoteDataSecure,
  getSharedNoteDataSecure,
  getNoteSecondaryObjectPreviewSecure,
  getNoteInheritedFileBlobSecure,
  
  getPublicNoteCommentsSecure,
  getPublicNoteReactionsSecure,
  getCrossSuggestionsSecure,
  syncNotesDeltaSecure,
  pullNotesDeltaSecure,
  pushNotesDeltaSecure,
  createNoteSecure,
  updateNoteSecure,
  deleteNoteSecure,
  createGhostNoteSecure,
  createGhostNoteForCallSecure,
  createGhostNoteForProjectSecure,
  createGhostNoteForResourceSecure,
  createGhostNoteChatSecure,
  listGhostNoteChatsSecure,
  listTagsSecure,
  getPublicGoalDataSecure,
  createAccountEventSecure,
  listProjectsWithCollaborationsSecure,
  createProjectSecure,
  updateProjectSecure,
  deleteProjectSecure,
  
  requestProjectAccessSecure,
  acceptProjectInviteSecure,
  addObjectToProjectSecure,
  listProjectTaggedResourcesSecure,
  getSweptConfigSecure,
  upsertSweptConfigSecure,
  removeObjectFromProjectSecure,
  createFormSecure,
  listUserFormsSecure,
  updateFormSecure,
  deleteFormSecure,
  createEventSecure,
  updateEventSecure,
  deleteEventSecure,
  addEventManagerSecure,
  removeEventManagerSecure,
  convertResponseToGoalSecure,
  createEncryptedGroupForProjectSecure,
  initGoalDiscussionSecure,
  approveProjectJoinRequestSecure,
  addCallCohostSecureAction,
  endCallSecureAction,
  updateCallMetadataSecureAction,
  createCallSecure,
  mintDailyLoginSecure,
  runTokenOperationSecure,
  trackEngagementViewSecure,
  recordAnonymizedTelemetrySecure,
  dispatchEmailSecure,
  
  getSharedProfilesSecure,
  
  
  executeMasterPurgeSecure,
  createReportSecure,
  getUsersByIdsSecure,
  createSendGhostObjectSecure,
  
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  searchGlobalUsersSecure,
  getProfileByUsernameSecure,
  listRowsSecure,
  getRowSecure,
  
  promoteGhostThreadToStorySecure,
  promoteGhostResourceThreadToStorySecure,
  tagResourceSecure,
  untagResourceSecure,
  getResourceTagsSecure,
  deleteGhostThreadSecure,
  
  getGlobalProfileStatusSecure,
  toggleResourcePublicGuestSecure,
  getResourcePublicGuestSecure,
  attachObjectSecure,
  detachObjectSecure,
  detachObjectByRelationSecure,
  getProfilePicturePreviewSecure,
  getObjectsByParentSecure,
  syncMasterpassToAccountPasswordAction,
  
  createStandaloneTagSecure,
  toggleTaskReminderSecure,
  getNostrIdentityAction,
  registerNostrIdentityAction,
  resolveNostrPubkeysAction};

export type { PermissionLevel} from './secure-ops/shared';
