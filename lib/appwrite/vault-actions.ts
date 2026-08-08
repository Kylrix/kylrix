import { ID, Query } from "appwrite";
import {
  VaultService,
  vaultDatabases as appwriteDatabases,
  APPWRITE_COLLECTION_CREDENTIALS_ID,
  APPWRITE_COLLECTION_TOTPSECRETS_ID,
  APPWRITE_COLLECTION_FOLDERS_ID,
  APPWRITE_COLLECTION_SECURITYLOGS_ID,
  APPWRITE_COLLECTION_USER_ID,
  APPWRITE_COLLECTION_IDENTITIES_ID,
  PASSWORD_MANAGER_DATABASE_ID,
  CHAT_DATABASE_ID,
  CHAT_COLLECTION_CONVERSATIONS_ID,
  CHAT_COLLECTION_MESSAGES_ID,
  CHAT_COLLECTION_USERS_ID,
} from "./vault-service";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_COLLECTION_KEYCHAIN_ID,
  appwriteAccount,
  invalidateCurrentUserCache,
} from "./client";
import type {
  Credentials,
  CredentialsCreate,
  TotpSecrets,
  TotpSecretsCreate,
  Folders,
  FoldersCreate,
} from "./types";

/**
 * Update a TOTP secret by row ID (encrypted).
 */
export async function updateTotpSecret(
  id: string,
  data: Partial<TotpSecrets>,
  options?: { linkedNoteIds?: string[] }) {
  return await VaultService.updateTOTPSecret(id, data, options);
}

// --- Standalone Service Functions ---

export async function listFolders(userId: string, queries: string[] = []) {
  const response = await appwriteDatabases.listRows(
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTION_FOLDERS_ID,
    [Query.equal("userId", userId), ...queries]);
  // Cast via unknown to avoid strict TS overlap errors from Appwrite DefaultRow
  return (response.rows ?? response) as unknown as Folders[];
}

/**
 * Create a new folder.
 */
export async function createFolder(
  data: FoldersCreate) {
  return await VaultService.createFolder(data);
}

/**
 * Create a new TOTP secret (encrypted).
 */
export async function createTotpSecret(
  data: TotpSecretsCreate,
  options?: { linkedNoteIds?: string[] }) {
  return await VaultService.createTOTPSecret(data, options);
}

/**
 * List TOTP secrets for a user (decrypted).
 */
export async function listTotpSecrets(userId: string, queries: string[] = []) {
  return await VaultService.listTOTPSecrets(userId, queries);
}

/**
 * Delete a TOTP secret by row ID.
 */
export async function deleteTotpSecret(id: string) {
  return await VaultService.deleteTOTPSecret(id);
}

/**
 * Set master password flag for user (after first setup).
 */
export async function setMasterpassFlag(
  userId: string,
  email: string): Promise<void> {
  return await VaultService.setMasterpassFlag(userId, email);
}

/**
 * Reset master password and wipe all user data.
 * This should be called after 2FA/email verification is successful.
 */
export async function resetMasterpassAndWipe(userId: string): Promise<void> {
  // Helper to delete all rows in a table for a user in parallel batches
  const deleteTableDocs = async (tableId: string, databaseId: string = APPWRITE_DATABASE_ID, customQueries: string[] = []) => {
    try {
      let hasMore = true;
      const baseQueries = customQueries.length > 0 ? customQueries : [Query.equal("userId", userId)];

      while (hasMore) {
        const response = await appwriteDatabases.listRows(
          databaseId,
          tableId,
          [...baseQueries, Query.limit(50)]);

        if (response.rows.length === 0) {
          hasMore = false;
          break;
        }

        // Delete in parallel
        await Promise.all(
          response.rows.map((doc: any) =>
            appwriteDatabases
              .deleteRow(databaseId, tableId, doc.$id)
              .catch((e: any) => console.warn(`Failed to delete doc ${doc.$id} in ${tableId}`, e))
          )
        );

        // If we got fewer than limit, we're done
        if (response.rows.length < 50) {
          hasMore = false;
        }
      }
    } catch (e: unknown) {
      console.error(`Failed to wipe table ${tableId} in database ${databaseId}`, e);
    }
  };

  // Execute deletions for all core vault tables in parallel
  const wipePromises = [
    deleteTableDocs(APPWRITE_COLLECTION_USER_ID),
    deleteTableDocs(APPWRITE_COLLECTION_CREDENTIALS_ID),
    deleteTableDocs(APPWRITE_COLLECTION_TOTPSECRETS_ID),
    deleteTableDocs(APPWRITE_COLLECTION_FOLDERS_ID),
    deleteTableDocs(APPWRITE_COLLECTION_SECURITYLOGS_ID),
    deleteTableDocs(APPWRITE_COLLECTION_KEYCHAIN_ID),
    deleteTableDocs(APPWRITE_COLLECTION_IDENTITIES_ID, PASSWORD_MANAGER_DATABASE_ID)];

  // Ecosystem Chat Wipe: Personal/Saved Messages
  const wipeChatData = async () => {
    try {
      // 1. Find self-chats (direct chats where the user is the only participant or repeated)
      const memberRows = await appwriteDatabases.listRows(
        CHAT_DATABASE_ID,
        "conversationMembers",
        [
          Query.equal("userId", userId),
          Query.limit(1000)
        ]
      );
      const conversationIds = Array.from(new Set((memberRows.rows || []).map((row: any) => row.conversationId).filter(Boolean)));
      const selfChats = conversationIds.length ? await appwriteDatabases.listRows(
        CHAT_DATABASE_ID,
        CHAT_COLLECTION_CONVERSATIONS_ID,
        [
          Query.equal("$id", conversationIds),
          Query.equal("type", "direct")
        ]
      ) : { rows: [] as any[] };

      for (const conv of selfChats.rows) {
        const participants = Array.isArray(conv.participants) ? conv.participants : [userId];
        const isSelf = participants.length === 1 || participants.every((p: string) => p === userId);

        if (isSelf) {
          // Cascade delete messages in this self-chat (irreversible)
          await deleteTableDocs(CHAT_COLLECTION_MESSAGES_ID, CHAT_DATABASE_ID, [Query.equal("conversationId", conv.$id)]);
          // Delete the conversation itself
          await appwriteDatabases.deleteRow(CHAT_DATABASE_ID, CHAT_COLLECTION_CONVERSATIONS_ID, conv.$id).catch(() => null);
        }
      }

      // 2. Clear publicKey in Chat Users (this makes existing encrypted chats un-addressable with old identity)
      const chatUserDoc = await appwriteDatabases.listRows(CHAT_DATABASE_ID, CHAT_COLLECTION_USERS_ID, [Query.equal("$id", userId)]).then((res: any) => res.rows[0]).catch(() => null);
      if (chatUserDoc) {
        await appwriteDatabases.updateRow(CHAT_DATABASE_ID, CHAT_COLLECTION_USERS_ID, userId, {
          publicKey: ""
        }).catch(err => console.warn("Failed to clear chat public key:", err));
      }
    } catch (err) {
      console.error("Ecosystem chat wipe failed:", err);
    }
  };

  await Promise.all([...wipePromises, wipeChatData()]);
}

/**
 * Fetches ALL credentials for a user, handling pagination automatically.
 * Use this for operations that require the full dataset, like search or export.
 */
export async function listAllCredentials(
  userId: string,
  queries: string[] = []): Promise<Credentials[]> {
  return await VaultService.listAllCredentials(userId, queries);
}

export async function listRawCredentials(
  userId: string,
  queries: string[] = []): Promise<Credentials[]> {
  return await VaultService.listRawCredentials(userId, queries);
}

export async function listRawTotpSecrets(
  userId: string,
  queries: string[] = []) {
  return await VaultService.listRawTOTPSecrets(userId, queries);
}

/**
 * Create a new credential (encrypted).
 */
export async function createCredential(
  data: CredentialsCreate,
  options?: { linkedNoteIds?: string[] }) {
  return await VaultService.createCredential(data, options);
}

/**
 * Update a credential by row ID (encrypted).
 */
export async function updateCredential(
  id: string,
  data: Partial<Credentials>,
  options?: { linkedNoteIds?: string[] }) {
  return await VaultService.updateCredential(id, data, options);
}

/**
 * Delete a credential by row ID.
 */
export async function deleteCredential(id: string) {
  return await VaultService.deleteCredential(id);
}

/**
 * Logs out the current user from Appwrite and clears session/local storage.
 * Use this everywhere for a consistent logout experience.
 */
export async function logoutAppwrite() {
  try {
    await appwriteAccount.deleteSession("current");
  } catch { }
  invalidateCurrentUserCache();
  // Clear vault/session data
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("vault_unlocked");
    sessionStorage.removeItem("kylrix_vault_unlocked");
    localStorage.removeItem("vault_timeout_minutes");
    // Optionally clear other app-specific keys here
  }
}

interface EmbeddedCredentialAttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  createdAt: string;
}

function normalizeCredentialAttachmentsField(credential: any): EmbeddedCredentialAttachmentMeta[] {
  const raw = credential.attachments;
  if (!raw) return [];
  try {
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

export async function addAttachmentToCredential(credentialId: string, file: File) {
  const credential = await VaultService.getCredential(credentialId);
  if (!credential) throw new Error('Credential not found');

  const existingMetas = normalizeCredentialAttachmentsField(credential);

  // 1. Client-side Framework Gating & Compression
  const { validateFileUploadLimit, compressImageToWebP, getFileTypeCategory } = await import('@/lib/storage/framework');

  // Strict size limit check BEFORE compression
  validateFileUploadLimit(file, 'vault_attachments');

  let activeFile = file;
  if (getFileTypeCategory(file.type, file.name) === 'image') {
    try {
      activeFile = await compressImageToWebP(file);
    } catch (compressErr) {
      console.warn('[vault-attachments] Client-side image compression failed, falling back to original:', compressErr);
    }
  }

  // Upload file to vault_attachments bucket
  let uploaded: any;
  try {
    const formData = new FormData();
    formData.append('file', activeFile);
    formData.append('bucketId', 'vault_attachments');
    formData.append('fileId', ID.unique());
    
    const { secureUploadFile } = await import('@/lib/actions/client-ops');
    uploaded = await secureUploadFile(formData);
  } catch (err: any) {
    console.error('[vault-attachments] Upload failed:', err);
    throw new Error(err.message || 'Server upload failed');
  }

  const meta: EmbeddedCredentialAttachmentMeta = {
    id: uploaded.$id,
    name: activeFile.name || 'attachment',
    size: activeFile.size,
    mime: activeFile.type || 'application/octet-stream',
    createdAt: new Date().toISOString()
  };

  // Add metadata object to attachments array
  existingMetas.push(meta);
  
  // Encrypt & Update credential row
  const updated = await VaultService.updateCredential(credentialId, {
    attachments: JSON.stringify(existingMetas)
  });

  return updated;
}

export async function deleteCredentialAttachment(credentialId: string, fileId: string) {
  const credential = await VaultService.getCredential(credentialId);
  if (!credential) throw new Error('Credential not found');

  const existingMetas = normalizeCredentialAttachmentsField(credential);
  const updatedMetas = existingMetas.filter(m => m.id !== fileId);

  // Delete from Appwrite Storage
  try {
    const { appwriteStorage } = await import('./client');
    await appwriteStorage.deleteFile('vault_attachments', fileId);
  } catch (err) {
    console.warn('[vault-attachments] Failed to delete file from storage (might already be deleted):', err);
  }

  // Encrypt & Update credential row
  const updated = await VaultService.updateCredential(credentialId, {
    attachments: JSON.stringify(updatedMetas)
  });

  return updated;
}

export async function setCredentialPinned(id: string, pinned: boolean) {
  return await VaultService.setCredentialPinned(id, pinned);
}

export async function setTotpPinned(id: string, pinned: boolean) {
  return await VaultService.setTotpPinned(id, pinned);
}

/**
 * validatePublicVaultAccess — server-side only.
 * Loads a credential row from the admin SDK and returns it
 * only when isPublic === true. Fields remain encrypted;
 * the shared page will decrypt using the DEK passed in the URL.
 */
export async function validatePublicVaultAccess(credentialId: string): Promise<Credentials | null> {
  try {
    if (typeof window === 'undefined') {
      const { createSystemClient } = await import('@/lib/appwrite-admin');
      const { databases: adminDbs } = createSystemClient();
      const doc = await adminDbs.getRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        credentialId
      ) as any;
      if (doc && doc.isPublic === true) {
        return doc as Credentials;
      }
      return null;
    }
    // Client-side: use regular user-scoped request
    const doc = await appwriteDatabases.getRow(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_CREDENTIALS_ID, credentialId);
    return (doc as any)?.isPublic === true ? (doc as unknown as Credentials) : null;
  } catch (err) {
    console.error(`validatePublicVaultAccess failed for ${credentialId}:`, err);
    return null;
  }
}

/**
 * validatePublicTotpAccess — server-side only.
 * Loads a TOTP secret row from the admin SDK and returns it
 * only when isPublic === true. secretKey remains encrypted;
 * the shared page will decrypt using the DEK from the URL
 * (or derive the 60-second code from the temp-encoded params).
 */
export async function validatePublicTotpAccess(totpId: string): Promise<TotpSecrets | null> {
  try {
    if (typeof window === 'undefined') {
      const { createSystemClient } = await import('@/lib/appwrite-admin');
      const { databases: adminDbs } = createSystemClient();
      const doc = await adminDbs.getRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_TOTPSECRETS_ID,
        totpId
      ) as any;
      if (doc && doc.isPublic === true) {
        return doc as TotpSecrets;
      }
      return null;
    }
    const doc = await appwriteDatabases.getRow(APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_TOTPSECRETS_ID, totpId);
    return (doc as any)?.isPublic === true ? (doc as unknown as TotpSecrets) : null;
  } catch (err) {
    console.error(`validatePublicTotpAccess failed for ${totpId}:`, err);
    return null;
  }
}


