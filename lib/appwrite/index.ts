// Re-export appwrite clients and utilities
export * from './client';
export * from './config';
export * from './auth';
export * from './note';
export * from './vault';

import { AppwriteService as SharedService } from './auth';
import { VaultService } from './vault';

// Merge AppwriteService methods from all domains
export const AppwriteService = {
  // From Auth/Shared
  ensureGlobalProfile: SharedService.ensureGlobalProfile,
  getGlobalProfileStatus: SharedService.getGlobalProfileStatus,
  hasMasterpass: SharedService.hasMasterpass,
  listKeychainEntries: SharedService.listKeychainEntries,
  createKeychainEntry: SharedService.createKeychainEntry,
  deleteKeychainEntry: SharedService.deleteKeychainEntry,
  createGhostNote: SharedService.createGhostNote,
  
  // From Vault (Inject all static methods from VaultService)
  ...VaultService
} as any;
