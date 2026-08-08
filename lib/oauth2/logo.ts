'use client';

import { ID, Permission, Role } from 'appwrite';
import { account, storage } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { compressImageToWebP, validateFileUploadLimit } from '@/lib/storage/framework';

const BUCKET = APPWRITE_CONFIG.BUCKETS.APP_LOGOS;
const MAX_BYTES = 1 * 1024 * 1024;

/**
 * Compress an OAuth app logo on the client, gate at 1MB, upload to `app_logos`,
 * and return a public view URL for Appwrite Apps `logoUri`.
 */
export async function uploadOAuthAppLogo(file: File): Promise<{
  fileId: string;
  logoUri: string;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Logo must be an image');
  }

  let compressed = await compressImageToWebP(file, 512, 0.72);
  if (compressed.size > MAX_BYTES) {
    compressed = await compressImageToWebP(file, 256, 0.55);
  }
  if (compressed.size > MAX_BYTES) {
    throw new Error('Logo is still over 1MB after compression. Try a smaller image.');
  }

  validateFileUploadLimit(compressed, BUCKET);

  const user = await account.get();
  const fileId = ID.unique();
  await storage.createFile(BUCKET, fileId, compressed, [
    Permission.read(Role.any()),
    Permission.read(Role.user(user.$id)),
  ]);

  const view = storage.getFileView(BUCKET, fileId);
  const logoUri = typeof view === 'string' ? view : String(view);

  return { fileId, logoUri };
}
