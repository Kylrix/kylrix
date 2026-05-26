'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { getActor } from './secure-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { ID } from 'node-appwrite';
import { Registry } from '@/lib/core/di/registry';
import { InputFile } from 'node-appwrite/file';

/**
 * Securely handles file uploads on the server.
 * Enforces Pro subscription checks for all buckets except profile pictures and voice messages.
 */
export async function secureUploadFile(formData: FormData, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const file = formData.get('file') as File;
  const bucketId = formData.get('bucketId') as string;
  const fileId = (formData.get('fileId') as string) || ID.unique();
  if (!file || !bucketId) {
    throw new Error('Bad Request: Missing file or bucketId');
  }

  // 1. Enforce strict server-side bucket size limits and 10MB upward guideline ceiling
  const SERVER_BUCKET_LIMITS: Record<string, number> = {
    profile_pictures: 1 * 1024 * 1024,   // 1 MB
    messages: 1 * 1024 * 1024,           // 1 MB
    notes_attachments: 5 * 1024 * 1024,   // 5 MB
    vault_attachments: 5 * 1024 * 1024,   // 5 MB
    form_media: 10 * 1024 * 1024,        // 10 MB
    chat_uploads: 10 * 1024 * 1024,      // 10 MB
    default: 10 * 1024 * 1024,           // 10 MB Guideline ceiling
  };

  const currentLimit = SERVER_BUCKET_LIMITS[bucketId] || SERVER_BUCKET_LIMITS.default;
  if (file.size > currentLimit) {
    const limitMb = currentLimit / (1024 * 1024);
    throw new Error(`Forbidden: File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed threshold of ${limitMb}MB for this bucket.`);
  }

  // 2. Enforce Pro subscription for restricted buckets
  const allowedFreeBuckets = [
    APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES,
    // Using string literal 'voice' as it's defined in lib/services/storage.ts
    'voice', 
  ];

  if (!allowedFreeBuckets.includes(bucketId)) {
    if (!hasPaidKylrixPlan(actor)) {
      throw new Error('Forbidden: Pro subscription required for this upload operation.');
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadedFile = await Registry.getStorage().uploadFile(bucketId, fileId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    });
    
    return JSON.parse(JSON.stringify(uploadedFile));
  } catch (error: any) {
    console.error('[secureUploadFile] Error:', error);
    throw new Error(error.message || 'Failed to upload file');
  }
}
