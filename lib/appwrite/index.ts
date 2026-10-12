// Re-export appwrite clients and utilities
export * from './client';
export * from './config';
export * from './auth';
export * from './note';
export * from './goal-crypto';
export * from './vault';
export * from './projects';
export { updateRow } from '@/lib/actions/client-ops';

import { AppwriteService as SharedService } from './auth';
import { VaultService } from './vault';
import { ProjectsService } from './projects';
import { UsersService } from '../services/users';

export const getUsersByIds = UsersService.getUsersByIds.bind(UsersService);

// Merge AppwriteService methods from all domains into a robust unified interface
export const AppwriteService = {
  // --- Global Identity & Profiles ---
  ensureGlobalProfile: SharedService.ensureGlobalProfile,
  getGlobalProfileStatus: SharedService.getGlobalProfileStatus,
  getProfile: UsersService.getProfileById,
  getProfileByUsername: UsersService.getProfile,
  searchGlobalProfiles: SharedService.searchGlobalProfiles,
  getUsersByIds: UsersService.getUsersByIds,
  recordProfileEvent: SharedService.recordProfileEvent,

  // --- Security & Keychain (enclave-backed; local-first for offline unlock) ---
  listKeychainEntries: VaultService.listKeychainEntries.bind(VaultService),
  createKeychainEntry: VaultService.createKeychainEntry.bind(VaultService),
  updateKeychainEntry: VaultService.updateKeychainEntry.bind(VaultService),
  deleteKeychainEntry: VaultService.deleteKeychainEntry.bind(VaultService),
  setMasterpassFlag: VaultService.setMasterpassFlag.bind(VaultService),
  hasMasterpass: VaultService.hasMasterpass.bind(VaultService),
  hasPasskey: VaultService.hasPasskey.bind(VaultService),
  createSecurityLog: VaultService.createSecurityLog.bind(VaultService),
  listSecurityLogs: VaultService.listSecurityLogs.bind(VaultService),
  getSecurityLog: VaultService.getSecurityLog.bind(VaultService),

  // --- Vault & User State ---
  getUserDoc: VaultService.getUserDoc,
  
  // --- Referrals ---
  getReferralStatus: SharedService.getReferralStatus,
  applyReferral: SharedService.applyReferral,

  // --- thread/Ephemeral Objects ---
  createthreadNote: SharedService.createthreadNote,
  createSendthreadObject: SharedService.createSendthreadObject,

  // --- Project Service Integration ---
  ...ProjectsService
} as any;
