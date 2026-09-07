import {
  ID,
  Query,
  Models,
  Permission,
  Role,} from "appwrite";
import { 
  databases, 
  client, 
  getCurrentUser,
  appwriteDatabases as originalAppwriteDatabases,
  appwriteStorage,
  APPWRITE_DATABASE_ID,
  APPWRITE_BUCKET_BACKUPS_ID,
  APPWRITE_COLLECTION_KEYCHAIN_ID
} from './client';
import { buildVaultNoteTags } from "@/sdk/crosslinks";
import type {
  Credentials,
  CredentialsCreate,
  TotpSecrets,
  TotpSecretsCreate,
  Folders,
  FoldersCreate,
  SecurityLogs,
  SecurityLogsCreate,
  User,
  Keychain,
  KeychainCreate,
  KeyMapping,
  KeyMappingCreate} from "./types";
import { sanitizeString } from "../validation";
import { getEcosystemUrl } from "../ecosystem";

import { APPWRITE_CONFIG } from "./config";
import { sendKylrixEmailNotification } from "../email-notifications";

// --- Isomorphic secure database interceptor ---
async function secureCreateRow(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) {
    if (typeof window !== 'undefined') {
        const { createRow } = await import('@/lib/actions/client-ops');
        return await createRow(databaseId, tableId, data, permissions) as any;
    } else {
        const { createRowSecure } = await import('@/lib/actions/secure-ops');
        return await createRowSecure(databaseId, tableId, data, permissions) as any;
    }
}

async function secureUpdateRow(databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) {
    if (typeof window !== 'undefined') {
        const { updateRow } = await import('@/lib/actions/client-ops');
        return await updateRow(databaseId, tableId, rowId, data, permissions) as any;
    } else {
        const { updateRowSecure } = await import('@/lib/actions/secure-ops');
        return await updateRowSecure(databaseId, tableId, rowId, data, permissions) as any;
    }
}

async function secureDeleteRow(databaseId: string, tableId: string, rowId: string) {
    if (typeof window !== 'undefined') {
        const { deleteRow } = await import('@/lib/actions/client-ops');
        await deleteRow(databaseId, tableId, rowId);
    } else {
        const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
        await deleteRowSecure(databaseId, tableId, rowId);
    }
}

const secureDatabases = {
    createRow: secureCreateRow,
    updateRow: secureUpdateRow,
    deleteRow: secureDeleteRow,
    getRow: (dbId: string, collId: string, docId: string) => originalAppwriteDatabases.getRow(dbId, collId, docId),
    listRows: (dbId: string, collId: string, queries?: string[]) => {
        return originalAppwriteDatabases.listRows(dbId, collId, queries);
    }};

export const vaultDatabases = secureDatabases;
const appwriteDatabases = vaultDatabases;

// --- Helper Utilities ---

function normalizeEndpoint(ep?: string): string {
  const raw = (ep || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/\/+$/, "");
  if (/\/v1$/.test(cleaned)) return cleaned;
  return `${cleaned}/v1`;
}

function isFetchNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed")
  );
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(atob(value).split("").map((char) => char.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function readShareMetadata(metadata: string | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getCredentialOwnerIndexQueries(userId: string): string[] {
  // Reliable single-index fanout: primary userId covers all rows; public/pinned variants are additive and deduped.
  // Keep isPublic/isPinned queries best-effort — if compound index missing, primary still returns.
  return [Query.equal("userId", userId)];
}

function buildCredentialOwnerFilterQueries(
  userId: string,
  resourceIds: string[] = []): string[] {
  // Simple notes/goals style: userId primary + collaborator $id fanout as separate filters (no Query.or array rejection)
  const queries = [Query.equal("userId", userId)];
  if (resourceIds.length > 0) {
    // Chunk $id arrays to avoid URL length limits — each chunk becomes its own filter, merged & deduped
    const CHUNK = 50;
    for (let i = 0; i < resourceIds.length; i += CHUNK) {
      queries.push(Query.equal("$id", resourceIds.slice(i, i + CHUNK)));
    }
  }
  return queries;
}

async function listRowsMergedAcrossFilters(
  tableId: string,
  filterQueries: string[],
  extraQueries: string[] = []): Promise<Models.Row[]> {
  const byId = new Map<string, Models.Row>();
  const pageSize = 100;

  await Promise.all(
    filterQueries.map(async (filterQuery) => {
      let offset = 0;
      let response: Models.RowList<Models.Row> | null = null;
      try {
        do {
          response = await listRowsWithRetry(tableId, [
            filterQuery,
            Query.limit(pageSize),
            Query.offset(offset),
            ...extraQueries,
          ]);
          const rows = Array.isArray(response?.rows) ? response.rows : [];
          for (const row of rows) {
            byId.set(row.$id, row);
          }
          offset += pageSize;
        } while (Array.isArray(response?.rows) && response.rows.length > 0 && offset < (response.total || 0));
      } catch (e) {
        // Best-effort: compound index missing or throttled — skip this filter, keep primary userId results
        console.warn("[vault] listRowsMerged filter skipped:", (e as any)?.message || e);
      }
    }));

  return Array.from(byId.values());
}

function sortMergedRows(rows: Models.Row[], queries: string[]): Models.Row[] {
  if (rows.length <= 1) return rows;

  let attribute: string | null = null;
  let direction: "asc" | "desc" = "asc";
  for (const q of queries) {
    try {
      const parsed = JSON.parse(q) as { method?: string; attribute?: string };
      if (parsed.method === "orderAsc" && parsed.attribute) {
        attribute = parsed.attribute;
        direction = "asc";
        break;
      }
      if (parsed.method === "orderDesc" && parsed.attribute) {
        attribute = parsed.attribute;
        direction = "desc";
        break;
      }
    } catch {
      // ignore non-JSON query strings
    }
  }

  if (!attribute) return rows;

  const sorted = [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[attribute!];
    const bv = (b as Record<string, unknown>)[attribute!];
    const cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    return direction === "desc" ? -cmp : cmp;
  });
  return sorted;
}

async function listRowsWithRetry(
  tableId: string,
  queries: string[] = []): Promise<Models.RowList<Models.Row>> {
  try {
    return await databases.listRows(
      APPWRITE_DATABASE_ID,
      tableId,
      queries);
  } catch (err: unknown) {
    if (!isFetchNetworkError(err)) throw err as Error;

    // Try to normalize endpoint then retry once
    try {
      const envEp = APPWRITE_CONFIG.ENDPOINT;
      if (envEp) {
        client.setEndpoint(envEp);
      } else if (typeof window !== "undefined") {
        // Fallback to same-origin /v1 in dev if env missing
        client.setEndpoint(normalizeEndpoint(window.location.origin));
      }
      return await databases.listRows(
        APPWRITE_DATABASE_ID,
        tableId,
        queries);
    } catch (err2: unknown) {
      // Surface a clearer error with guidance
      const note =
        "Network request to Appwrite failed. Check NEXT_PUBLIC_APPWRITE_ENDPOINT, CORS, and /v1 suffix.";
      const e = err2 as Error & { cause?: unknown };
      e.cause = err;
      throw new Error(`${note} Original: ${e.message}`);
    }
  }
}

// --- Appwrite Config ---
export const APPWRITE_COLLECTION_CREDENTIALS_ID = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const APPWRITE_COLLECTION_TOTPSECRETS_ID = APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS;
export const APPWRITE_COLLECTION_FOLDERS_ID = APPWRITE_CONFIG.TABLES.VAULT.FOLDERS;
export const APPWRITE_COLLECTION_SECURITYLOGS_ID = APPWRITE_CONFIG.TABLES.VAULT.SECURITY_LOGS;
export const APPWRITE_COLLECTION_USER_ID = APPWRITE_CONFIG.TABLES.VAULT.USER;
const APPWRITE_COLLECTION_KEY_MAPPING_ID = APPWRITE_CONFIG.TABLES.VAULT.KEY_MAPPING;

// Ecosystem: Kylrix Flow
const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const FLOW_COLLECTION_ID_TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
const FLOW_COLLECTION_ID_EVENTS = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;

// Ecosystem: Kylrix Note
const NOTE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
const NOTE_COLLECTION_ID = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

// Ecosystem: Unified Identity & Chat
export const PASSWORD_MANAGER_DATABASE_ID = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
export const APPWRITE_COLLECTION_IDENTITIES_ID = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES;
export const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CHAT_COLLECTION_CONVERSATIONS_ID = APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
export const CHAT_COLLECTION_MESSAGES_ID = APPWRITE_CONFIG.TABLES.CHAT.MESSAGES;
export const CHAT_COLLECTION_USERS_ID = APPWRITE_CONFIG.TABLES.CHAT.USERS;

// --- Table Structure & Field Mappings ---
// Dynamically derive encrypted/plaintext fields from the types
// These fields receive CLIENT-SIDE end-to-end encryption (on top of Appwrite's database encryption)
const ENCRYPTED_FIELDS = {
  credentials: [
    "name",           // Credential name
    "url",            // URL/website
    "username",       // Username/email
    "password",       // Password
    "notes",          // Notes
    "customFields",   // Custom fields JSON
    "cardNumber",     // Credit card number
    "cardholderName", // Cardholder name
    "cardExpiry",     // Card expiry date
    "cardCVV",        // Card CVV
    "cardPIN",        // Card PIN
  ],
  totpSecrets: [
    "issuer",         // TOTP issuer (e.g., "Google", "GitHub")
    "accountName",    // TOTP account name (e.g., user email/username)
    "secretKey",      // TOTP secret key (CRITICAL - must be encrypted)
    "url",            // TOTP URL for QR code/autofill
  ],
  folders: [
    "name",           // Folder name (sensitive organization info)
  ],
  securityLogs: [
    "ipAddress",      // IP address (privacy)
    "userAgent",      // User agent (fingerprinting)
    "deviceFingerprint", // Device fingerprint
    "details",        // Event details (may contain sensitive info)
  ],
  user: [
    "email",          // User email
    "twofaSecret",    // 2FA secret
    "backupCodes",    // 2FA backup codes
    "sessionFingerprint", // Session fingerprint
  ],
  keychain: [], // Keychain entries are already encrypted/hashed or public
} as const;

function getPlaintextFields<T>(
  allFields: (keyof T)[],
  encrypted: readonly string[]): string[] {
  return allFields
    .filter((f) => !encrypted.includes(f as string))
    .map((f) => f as string);
}

export const COLLECTION_SCHEMAS = {
  credentials: {
    encrypted: ENCRYPTED_FIELDS.credentials,
    plaintext: getPlaintextFields<Credentials>(
      [
        "userId",
        "itemType",
        "name",
        "url",
        "username",
        "password",
        "notes",
        "totpId",
        "cardNumber",
        "cardholderName",
        "cardExpiry",
        "cardCVV",
        "cardPIN",
        "cardType",
        "folderId",
        "tags",
        "customFields",
        "faviconUrl",
        "isFavorite",
        "isDeleted",
        "deletedAt",
        "lastAccessedAt",
        "passwordChangedAt",
        "createdAt",
        "updatedAt",
        "isEnv",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.credentials)},
  totpSecrets: {
    encrypted: ENCRYPTED_FIELDS.totpSecrets,
    plaintext: getPlaintextFields<TotpSecrets>(
      [
        "userId",
        "issuer",
        "accountName",
        "secretKey",
        "algorithm",
        "digits",
        "period",
        "url",
        "folderId",
        "tags",
        "isFavorite",
        "isDeleted",
        "deletedAt",
        "lastUsedAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.totpSecrets)},
  folders: {
    encrypted: ENCRYPTED_FIELDS.folders,
    plaintext: getPlaintextFields<Folders>(
      [
        "userId",
        "name",
        "parentFolderId",
        "icon",
        "color",
        "sortOrder",
        "isDeleted",
        "deletedAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.folders)},
  securityLogs: {
    encrypted: ENCRYPTED_FIELDS.securityLogs,
    plaintext: getPlaintextFields<SecurityLogs>(
      [
        "userId",
        "eventType",
        "ipAddress",
        "userAgent",
        "deviceFingerprint",
        "details",
        "success",
        "severity",
        "timestamp",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.securityLogs)},
  user: {
    encrypted: ENCRYPTED_FIELDS.user,
    plaintext: getPlaintextFields<User>(
      [
        "userId",
        "email",
        "masterpass",
        "twofa",
        "twofaSecret",
        "backupCodes",
        "isPasskey",
        "sessionFingerprint",
        "lastLoginAt",
        "lastPasswordChangeAt",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.user)},
  keychain: {
    encrypted: ENCRYPTED_FIELDS.keychain,
    plaintext: getPlaintextFields<Keychain>(
      [
        "userId",
        "type",
        "credentialId",
        "wrappedKey",
        "salt",
        "params",
        "isBackup",
        "createdAt",
        "updatedAt",
        "$id",
        "$createdAt",
        "$updatedAt"],
      ENCRYPTED_FIELDS.keychain)}}; // 1 hour

// --- Secure CRUD Operations ---
import { VaultServiceL2 } from './vault-service-l2';
export class VaultService extends VaultServiceL2 {
  private static async decryptRowFields(
    doc: unknown,
    tableType: keyof typeof COLLECTION_SCHEMAS): Promise<Record<string, unknown>> {
    const schema = COLLECTION_SCHEMAS[tableType];
    const result: Record<string, unknown> = {
      ...(doc as Record<string, unknown>)};

    try {
      const { decryptField, masterPassCrypto } = await import(
        "../masterpass-crypto"
      );
      const { ecosystemSecurity } = await import("../ecosystem/security");

      if (!masterPassCrypto.isVaultUnlocked()) {
        console.warn("Vault is locked - returning encrypted data as-is");
        return result;
      }

      const currentUser = await getCurrentUser().catch(() => null);

      if (tableType === "credentials" || tableType === "totpSecrets") {
        const hasDek = result.dek && typeof result.dek === "string" && result.dek.trim().length > 0;
        let dek: CryptoKey | null = null;

        if (hasDek) {
          const isOwner = !currentUser || !result.userId || result.userId === currentUser.$id;

          if (isOwner) {
            try {
              const dekBase64 = await decryptField(result.dek as string);
              const rawKey = base64ToBytes(dekBase64);
              dek = await crypto.subtle.importKey(
                "raw",
                rawKey as any,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
              );
            } catch (unwrapError) {
              console.error("Failed to unwrap DEK using MEK for owner:", unwrapError);
            }
          } else {
            try {
              const mappings = await listRowsWithRetry(APPWRITE_COLLECTION_KEY_MAPPING_ID, [
                Query.equal("grantee", currentUser.$id),
                Query.equal("resourceId", result.$id as string),
                Query.limit(1)
              ]);
              const mappingRows = Array.isArray(mappings?.rows) ? mappings.rows : [];

              if (mappingRows.length > 0) {
                const mapping = mappingRows[0] as KeyMapping;
                const metadata = readShareMetadata(mapping.metadata);
                const senderPublicKey = String(metadata.senderPublicKey ?? "");
                if (senderPublicKey) {
                  dek = await ecosystemSecurity.unwrapKeyWithECDH(mapping.wrappedKey, senderPublicKey);
                } else {
                  console.error("Missing sender public key in sharing metadata");
                }
              } else {
                console.error("No key mapping found for collaborated resource:", result.$id);
              }
            } catch (unwrapError) {
              console.error("Failed to unwrap DEK using ECDH for collaborator:", unwrapError);
            }
          }
          
          if (currentUser && !isOwner) {
            result.sharedFrom = result.userId;
          }
        }

        for (const field of schema.encrypted) {
          const fieldValue = result[field];

          if (this.shouldDecryptField(fieldValue)) {
            try {
              if (hasDek) {
                if (dek) {
                  result[field] = await ecosystemSecurity.decryptWithKey(fieldValue as string, dek);
                } else {
                  result[field] = "[DECRYPTION_DEK_UNAVAILABLE]";
                }
              } else {
                result[field] = await decryptField(fieldValue as string);
              }
            } catch (error: unknown) {
              console.error(`Failed to decrypt field ${field}:`, error);
              result[field] = "[DECRYPTION_FAILED]";
            }
          } else {
            result[field] =
              fieldValue === null
                ? null
                : fieldValue === undefined
                  ? null
                  : fieldValue;
          }
        }

        return result;
      }

      for (const field of schema.encrypted) {
        const fieldValue = result[field];

        if (this.shouldDecryptField(fieldValue)) {
          try {
            result[field] = await decryptField(fieldValue as string);
          } catch (error: unknown) {
            console.error(`Failed to decrypt field ${field}:`, error);
            result[field] = "[DECRYPTION_FAILED]";
          }
        } else {
          result[field] =
            fieldValue === null
              ? null
              : fieldValue === undefined
                ? null
                : fieldValue;
        }
      }
    } catch (error: unknown) {
      console.error("Decryption module not available:", error);
    }

    return result;
  }

  // Helper method to determine if a field should be encrypted
  private static shouldEncryptField(value: unknown): boolean {
    // Only encrypt if value is a non-empty string
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "string" &&
      value.trim().length > 0
    );
  }

  // Helper method to determine if a field should be decrypted
  private static shouldDecryptField(value: unknown): boolean {
    // Only decrypt non-null, non-empty string values
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "string" &&
      value.trim().length > 0
    );
  }

  // --- Search Operations ---
  static async searchCredentials(
    userId: string,
    searchTerm: string): Promise<Credentials[]> {
    // Search must operate on all credentials since name is encrypted
    const allCredentials = await this.listAllCredentials(userId);
    const term = searchTerm.toLowerCase();

    return allCredentials.filter(
      (cred) =>
        cred.name?.toLowerCase().includes(term) ||
        cred.username?.toLowerCase().includes(term) ||
        (cred.url && cred.url.toLowerCase().includes(term)));
  }

  // --- Bulk Operations ---
  static async bulkCreateCredentials(
    credentials: Omit<Credentials, "$id" | "$createdAt" | "$updatedAt">[]): Promise<Credentials[]> {
    return await Promise.all(
      credentials.map((cred) => this.createCredential(cred)));
  }

  static async exportUserData(
    userId: string,
    options: {
      credentials?: boolean;
      totpSecrets?: boolean;
      folders?: boolean;
    } = { credentials: true, totpSecrets: true, folders: true }): Promise<{
    credentials?: Credentials[];
    totpSecrets?: TotpSecrets[];
    folders?: Folders[];
    version: string;
    exportedAt: string;
  }> {
    const credentialsPromise = options.credentials
      ? this.listAllCredentials(userId)
      : Promise.resolve<Credentials[] | undefined>(undefined);
    const totpPromise = options.totpSecrets
      ? this.listTOTPSecrets(userId)
      : Promise.resolve<TotpSecrets[] | undefined>(undefined);
    const foldersPromise = options.folders
      ? this.listFolders(userId)
      : Promise.resolve<Folders[] | undefined>(undefined);

    const [credentials, totpSecrets, folders] = await Promise.all([
      credentialsPromise,
      totpPromise,
      foldersPromise]);

    return {
      credentials,
      totpSecrets,
      folders,
      version: "1.0",
      exportedAt: new Date().toISOString()};
  }

  // --- Storage Operations ---
  static async cloudBackup(userId: string): Promise<Models.File> {
    const data = await this.exportUserData(userId);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const file = new File([blob], `${APPWRITE_CONFIG.SYSTEM.RP_NAME}-backup-${new Date().getTime()}.json`, { type: "application/json" });

    return await appwriteStorage.createFile(
      APPWRITE_BUCKET_BACKUPS_ID,
      ID.unique(),
      file,
      [
        Permission.read(Role.user(userId))]
    );
  }

  static async listCloudBackups(_userId: string): Promise<Models.FileList> {
    return await appwriteStorage.listFiles(
      APPWRITE_BUCKET_BACKUPS_ID,
      [Query.orderDesc("$createdAt")]
    );
  }
}
