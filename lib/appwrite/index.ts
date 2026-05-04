// Re-export appwrite clients and utilities
export { account, databases, tablesDB, storage, realtime, client } from './client';
export { APPWRITE_CONFIG } from './config';
export { AppwriteService, KeychainService } from './keychain';

// Profile picture preview helper
import { storage } from './client';

const APPWRITE_BUCKET_PROFILE_PICTURES = 'profile-pictures';

/**
 * Get a preview of a profile picture from Appwrite storage
 */
export async function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64): Promise<string | null> {
  try {
    if (!fileId) return null;
    
    const preview = storage.getFilePreview(
      APPWRITE_BUCKET_PROFILE_PICTURES,
      fileId,
      width,
      height
    );
    return preview;
  } catch (error) {
    console.error('Failed to get profile picture preview:', error);
    return null;
  }
}
