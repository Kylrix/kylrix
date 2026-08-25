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
  createthreadNoteSecure,
  createthreadNoteForCallSecure,
  createthreadNoteForProjectSecure,
  createthreadNoteForResourceSecure,
  createthreadNoteChatSecure,
  listthreadNoteChatsSecure,
  listTagsSecure} from './secure-ops/notes';

import {
  getOrCreateThreadSecure,
  findThreadSecure,
  listThreadMessagesSecure,
  postThreadMessageSecure,
} from './secure-ops/threads';

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
  initGoalDiscussionSecure,
  approveProjectJoinRequestSecure,
  createGoalSecure,
  updateGoalSecure,
  deleteGoalSecure,
  resolveWorkspaceShareAccessSecure,
  getSharedWorkspaceEntitiesSecure,
} from './secure-ops/projects';

import {
  mintDailyLoginSecure,
  runTokenOperationSecure,
  recordAnonymizedTelemetrySecure,
  dispatchEmailSecure,
  getSharedProfilesSecure,
  executeMasterPurgeSecure,
  createReportSecure,
  getUsersByIdsSecure,
  createSendthreadObjectSecure,
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  batchTrashFormSubmissionsSecure,
  searchGlobalUsersSecure,
  getProfileByUsernameSecure,
  listRowsSecure,
  getRowSecure,
  promotethreadResourceThreadToStorySecure,
  deletethreadThreadSecure,
  getGlobalProfileStatusSecure,
  toggleResourcePublicGuestSecure,
  attachObjectSecure,
  detachObjectByRelationSecure,
  getProfilePicturePreviewSecure,
  getObjectsByParentSecure,
  syncMasterpassToAccountPasswordAction,
  createStandaloneTagSecure,
  toggleTaskReminderSecure,
  purgeExpiredTrashSecure} from './secure-ops/misc';

import {
  installFlowSecure,
  listMyFlowInstallsSecure,
  revokeFlowInstallSecure,
  requestFlowPublishSecure,
} from './secure-ops/flows';

import {
  createPatSecure,
  listPatsSecure,
  revokePatSecure,
  listOAuthAppInstallsSecure,
} from './secure-ops/pats';

import {
  getNostrIdentityAction,
  listNostrIdentitiesAction,
  registerNostrIdentityAction,
  setActiveNostrIdentityAction,
  deleteNostrIdentityAction,
  resolveNostrPubkeysAction} from './secure-ops/nostr';

import {
  listAgentByokKeysAction,
  saveAgentByokKeyAction,
  deleteAgentByokKeyAction,
  enableConvenienceModeAction,
  disableConvenienceModeAction,
  resolveConvenienceMekAction} from './secure-ops/byok-convenience';

export {
  
  
  getActor,
  
  
  
  
  
  
  
  
  
  
  
  
  
  grantPermissionSecure,
  revokePermissionSecure,
  getResourceCollaboratorsSecure,
  addProjectCollaboratorSecure,
  removeProjectCollaboratorSecure,
  addFormCollaboratorSecure,
  removeFormCollaboratorSecure,
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
  createthreadNoteSecure,
  createthreadNoteForCallSecure,
  createthreadNoteForProjectSecure,
  createthreadNoteForResourceSecure,
  createthreadNoteChatSecure,
  listthreadNoteChatsSecure,
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
  initGoalDiscussionSecure,
  getOrCreateThreadSecure,
  findThreadSecure,
  listThreadMessagesSecure,
  postThreadMessageSecure,
  approveProjectJoinRequestSecure,
  mintDailyLoginSecure,
  runTokenOperationSecure,
  recordAnonymizedTelemetrySecure,
  dispatchEmailSecure,
  
  getSharedProfilesSecure,
  
  
  executeMasterPurgeSecure,
  createReportSecure,
  getUsersByIdsSecure,
  createSendthreadObjectSecure,
  
  createRowSecure,
  updateRowSecure,
  deleteRowSecure,
  createGoalSecure,
  updateGoalSecure,
  deleteGoalSecure,
  resolveWorkspaceShareAccessSecure,
  getSharedWorkspaceEntitiesSecure,
  batchTrashFormSubmissionsSecure,
  searchGlobalUsersSecure,
  getProfileByUsernameSecure,
  listRowsSecure,
  getRowSecure,
  promotethreadResourceThreadToStorySecure,
  deletethreadThreadSecure,
  
  getGlobalProfileStatusSecure,
  toggleResourcePublicGuestSecure,
  attachObjectSecure,
  detachObjectByRelationSecure,
  getProfilePicturePreviewSecure,
  getObjectsByParentSecure,
  syncMasterpassToAccountPasswordAction,
  
  createStandaloneTagSecure,
  toggleTaskReminderSecure,
  purgeExpiredTrashSecure,
  installFlowSecure,
  listMyFlowInstallsSecure,
  revokeFlowInstallSecure,
  requestFlowPublishSecure,
  createPatSecure,
  listPatsSecure,
  revokePatSecure,
  listOAuthAppInstallsSecure,
  getNostrIdentityAction,
  listNostrIdentitiesAction,
  registerNostrIdentityAction,
  setActiveNostrIdentityAction,
  deleteNostrIdentityAction,
  resolveNostrPubkeysAction,
  listAgentByokKeysAction,
  saveAgentByokKeyAction,
  deleteAgentByokKeyAction,
  enableConvenienceModeAction,
  disableConvenienceModeAction,
  resolveConvenienceMekAction};

export type { PermissionLevel } from './secure-ops/shared';
export type { AgentByokKeySummary } from './secure-ops/byok-convenience';
