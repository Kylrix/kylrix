// Re-export appwrite clients and utilities
export * from './client';
export * from './config';
export * from './auth';
export * from './note';
export * from './vault';
export * from './projects';

import { AppwriteService as SharedService } from './auth';
import { VaultService } from './vault';
import { ProjectsService } from './projects';
import { UsersService } from '../services/users';

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

  // --- Security & Keychain ---
  listKeychainEntries: SharedService.listKeychainEntries,
  createKeychainEntry: SharedService.createKeychainEntry,
  updateKeychainEntry: SharedService.updateKeychainEntry,
  deleteKeychainEntry: SharedService.deleteKeychainEntry,
  setMasterpassFlag: SharedService.setMasterpassFlag,
  hasMasterpass: SharedService.hasMasterpass,

  // --- Vault & User State ---
  getUserDoc: VaultService.getUserDoc,
  getUserDocById: VaultService.getUserDocById,
  
  // --- Referrals ---
  getReferralStatus: SharedService.getReferralStatus,
  applyReferral: SharedService.applyReferral,

  // --- Ghost/Ephemeral Objects ---
  createGhostNote: SharedService.createGhostNote,
  createSendGhostObject: SharedService.createSendGhostObject,

  // --- Project Service Integration ---
  ...ProjectsService
} as any;
