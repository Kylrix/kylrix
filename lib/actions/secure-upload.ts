'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { getActor } from './secure-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { InputFile, ID } from 'node-appwrite';

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

  // 1. Enforce Pro subscription for restricted buckets
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
    const { storage } = createSystemClient();
    
    // We need to convert the Web File API object to something node-appwrite accepts
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Use InputFile from node-appwrite
    const inputFile = InputFile.fromBuffer(buffer, file.name);

    // 2. We do NOT pass permissions here, as the user instructed:
    // "every other thing is updated by server side... the max permission ever for anything is read"
    // Wait, storage files don't use document-level permissions in the same way, but 
    // Appwrite storage uses Bucket-level permissions. We let the server executor create it securely.
    
    const uploadedFile = await storage.createFile(bucketId, fileId, inputFile);
    
    // Convert to plain object to return to client
    return JSON.parse(JSON.stringify(uploadedFile));
  } catch (error: any) {
    console.error('[secureUploadFile] Error:', error);
    throw new Error(error.message || 'Failed to upload file');
  }
}
