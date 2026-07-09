'use server';

import { createSystemClient } from '@/lib/appwrite-admin';
import { getActor } from './secure-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlanServer } from '@/lib/services/internal/subscription-entitlement';
import { ID, Permission, Role } from 'node-appwrite';
import { Registry } from '@/lib/core/di/registry';
import { InputFile } from 'node-appwrite/file';
import { IDSchema, JWTSchema } from '@/lib/validations/schemas';

/**
 * Securely handles file uploads on the server.
 * Enforces Pro subscription checks and strict bucket whitelisting.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function secureUploadFile(formData: FormData, jwt?: string) {
  // Rigorous runtime validation
  const validatedJwt = JWTSchema.parse(jwt);
  const bucketId = IDSchema.parse(String(formData.get('bucketId') || '').trim());
  const file = formData.get('file') as File;
  const fileId = IDSchema.parse(String(formData.get('fileId') || ID.unique()).trim());

  // 1. Strict Bucket Whitelist
  const ALLOWED_BUCKETS = new Set([
    APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES,
    APPWRITE_CONFIG.BUCKETS.MESSAGES,
    APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS,
    APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE,
    APPWRITE_CONFIG.BUCKETS.VAULT_ATTACHMENTS,
    APPWRITE_CONFIG.BUCKETS.FORM_MEDIA,
    APPWRITE_CONFIG.BUCKETS.FORM_ATTACHMENTS,
    APPWRITE_CONFIG.BUCKETS.CHAT_UPLOADS,
    APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL,
    'voice'
  ]);

  if (!bucketId || !ALLOWED_BUCKETS.has(bucketId)) {
    throw new Error('Forbidden: Invalid or restricted bucket ID.');
  }

  if (!file) {
    throw new Error('Bad Request: Missing file component.');
  }

  let actor = null;
  try {
    actor = await getActor(validatedJwt);
  } catch {}

  const isAnonymousAllowedBucket = bucketId === APPWRITE_CONFIG.BUCKETS.FORM_ATTACHMENTS || bucketId === APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL;

  if (!actor && !isAnonymousAllowedBucket) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // 1. Enforce strict server-side bucket size limits and 10MB upward guideline ceiling
  const SERVER_BUCKET_LIMITS: Record<string, number> = {
    profile_pictures: 1 * 1024 * 1024,   // 1 MB
    messages: 1 * 1024 * 1024,           // 1 MB
    notes_attachments: 5 * 1024 * 1024,   // 5 MB
    general_storage: 10 * 1024 * 1024,    // 10 MB
    vault_attachments: 5 * 1024 * 1024,   // 5 MB
    form_media: 10 * 1024 * 1024,        // 10 MB
    form_attachments: 5 * 1024 * 1024,   // 5 MB
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
  ];

  if (!allowedFreeBuckets.includes(bucketId) && actor?.$id) {
    const isPro = await hasPaidKylrixPlanServer(actor.$id);
    if (!isPro) {
      throw new Error('Forbidden: Pro subscription required for this upload operation.');
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Delete existing file with the same ID if the actor owns it or if it matches user's eponymous ID
    if (fileId && actor?.$id) {
      try {
        let shouldDelete = false;
        if (fileId === actor.$id) {
          shouldDelete = true;
        } else {
          const { storage: adminStorage } = createSystemClient();
          const existing = await adminStorage.getFile(bucketId, fileId);
          if (existing && existing.$permissions) {
            shouldDelete = existing.$permissions.some((p: string) => p.includes(`user:${actor.$id}`));
          }
        }
        if (shouldDelete) {
          await Registry.getStorage().deleteFile(bucketId, fileId);
        }
      } catch (err) {
        // File may not exist or deletion failed, proceed with upload
      }
    }

    const permissions: string[] = [];
    if (actor?.$id) {
      permissions.push(Permission.read(Role.user(actor.$id)));
    }

    const uploadedFile = await Registry.getStorage().uploadFile(bucketId, fileId, {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    }, permissions);
    
    return JSON.parse(JSON.stringify(uploadedFile));
  } catch (error: any) {
    console.error('[secureUploadFile] Error:', error);
    throw new Error(error.message || 'Failed to upload file');
  }
}
