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
import { VaultServiceL1 } from './vault-service-l1';
export class VaultServiceL2 extends VaultServiceL1 {
  static async listRawTOTPSecrets(
    userId: string,
    queries: string[] = []): Promise<TotpSecrets[]> {
    this.ensureRuntimeSecurityHooks();
    const resourceIds = await this.getCollaboratedResourceIds(userId, 'totp');
    const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
    const mergedRows = sortMergedRows(
      await listRowsMergedAcrossFilters(
        APPWRITE_COLLECTION_TOTPSECRETS_ID,
        filterQueries,
        queries),
      queries);
    return mergedRows as unknown as TotpSecrets[];
  }

  /**
   * Fetches ALL credentials for a user, handling pagination automatically.
   * Use this for operations that require the full dataset, like search or export.
   */
  static async listAllCredentials(
    userId: string,
    queries: string[] = []): Promise<Credentials[]> {
    this.ensureRuntimeSecurityHooks();
    const cacheKey = `${userId}:${JSON.stringify(queries)}`;
    const cached = this.credentialsListCache.get(cacheKey);
    if (cached) {
      // Cache holds RAW ciphertext; decrypt in RAM for callers only.
      return Promise.all(
        cached.map(
          (doc) =>
            this.decryptRowFields(doc, "credentials") as Promise<Credentials>));
    }

    const pending = this.credentialsListInflight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
      const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
      const mergedRows = sortMergedRows(
        await listRowsMergedAcrossFilters(
          APPWRITE_COLLECTION_CREDENTIALS_ID,
          filterQueries,
          queries),
        queries);

      // Persist raw only — never cache decrypted vault rows.
      this.credentialsListCache.set(cacheKey, mergedRows as unknown as Credentials[]);

      return Promise.all(
        mergedRows.map(
          (doc: Models.Row) =>
            this.decryptRowFields(
              doc,
              "credentials") as Promise<Credentials>));
    })().finally(() => {
      this.credentialsListInflight.delete(cacheKey);
    });

    this.credentialsListInflight.set(cacheKey, request);
    return request;
  }

  static async listRecentCredentials(
    userId: string,
    limit: number = 5): Promise<Credentials[]> {
    const filterQueries = getCredentialOwnerIndexQueries(userId);
    const byId = new Map<string, Models.Row>();

    await Promise.all(
      filterQueries.map(async (filterQuery) => {
        const response = await listRowsWithRetry(
          APPWRITE_COLLECTION_CREDENTIALS_ID,
          [
            filterQuery,
            Query.orderDesc("$updatedAt"),
            Query.limit(limit),
          ]);
        for (const row of response.rows) {
          byId.set(row.$id, row);
        }
      }));

    const recentRows = Array.from(byId.values())
      .sort(
        (a, b) =>
          new Date(b.$updatedAt).getTime() - new Date(a.$updatedAt).getTime())
      .slice(0, limit);

    return await Promise.all(
      recentRows.map(
        (doc: Models.Row) =>
          this.decryptRowFields(
            doc,
            "credentials") as Promise<Credentials>));
  }

  static async listTOTPSecrets(
    userId: string,
    queries: string[] = []): Promise<TotpSecrets[]> {
    this.ensureRuntimeSecurityHooks();
    const cacheKey = `${userId}:${JSON.stringify(queries)}`;
    const cached = this.totpSecretsCache.get(cacheKey);
    if (cached) {
      return Promise.all(
        cached.map(
          (doc) =>
            this.decryptRowFields(doc, "totpSecrets") as Promise<TotpSecrets>));
    }

    const pending = this.totpSecretsInflight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const resourceIds = await this.getCollaboratedResourceIds(userId, 'totp');
      const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
      const mergedRows = sortMergedRows(
        await listRowsMergedAcrossFilters(
          APPWRITE_COLLECTION_TOTPSECRETS_ID,
          filterQueries,
          queries),
        queries);
      // Persist raw only — decrypt on read for UI callers.
      this.totpSecretsCache.set(cacheKey, mergedRows as unknown as TotpSecrets[]);
      return Promise.all(
        mergedRows.map(
          (doc: Models.Row) =>
            this.decryptRowFields(
              doc,
              "totpSecrets") as Promise<TotpSecrets>));
    })().finally(() => {
      this.totpSecretsInflight.delete(cacheKey);
    });

    this.totpSecretsInflight.set(cacheKey, request);
    return request;
  }

  static async listFolders(
    userId: string,
    queries: string[] = []): Promise<Folders[]> {
    const response = await appwriteDatabases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      [Query.equal("userId", userId), ...queries]);
    const rows = Array.isArray(response?.rows) ? response.rows : [];
    return rows as unknown as Folders[];
  }

  static async listSecurityLogs(
    userId: string,
    queries: string[] = []): Promise<SecurityLogs[]> {
    const response = await appwriteDatabases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      [Query.equal("userId", userId), Query.orderDesc("timestamp"), ...queries]);
    const rows = Array.isArray(response?.rows) ? response.rows : [];
    return rows as unknown as SecurityLogs[];
  }

  // Update with automatic encryption
  static async updateCredential(
    id: string,
    data: Partial<Credentials>,
    options?: { linkedNoteIds?: string[] }): Promise<Credentials> {
    const existing = await this.getCredential(id);
    const sanitizedData = this.sanitizeCredentialData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    if (existing.dek) {
      sanitizedData.dek = existing.dek;
    }
    const encryptedData = await this.encryptRowFields(sanitizedData, "credentials");
    // Prefer raw LocalEngine row as base so we never re-mirror decrypted getCredential() fields.
    let baseRaw: Record<string, unknown> = {};
    try {
      const { LocalEngine } = await import("@/lib/services/LocalEngine");
      baseRaw = ((await LocalEngine.cacheGet<any>(`vault_credential_${id}`)) || {}) as any;
    } catch {}
    const predictive = {
      ...baseRaw,
      ...encryptedData,
      $id: id,
      userId: existing.userId,
      $updatedAt: new Date().toISOString(),
    } as Record<string, unknown> & { $id: string };
    await this.mirrorRawCredential(String(existing.userId), predictive);

    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
      encryptedData);
    this.clearCredentialCache(existing.userId);
    const raw = doc as unknown as Credentials & { $id: string };
    await this.mirrorRawCredential(String(existing.userId), raw as any);
    return raw;
  }

  static async updateTOTPSecret(
    id: string,
    data: Partial<TotpSecrets>,
    options?: { linkedNoteIds?: string[] }): Promise<TotpSecrets> {
    const existing = await this.getTOTPSecret(id);
    const sanitizedData = this.sanitizeTotpData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    if (existing.dek) {
      sanitizedData.dek = existing.dek;
    }
    const encryptedData = await this.encryptRowFields(sanitizedData, "totpSecrets");
    let baseRaw: Record<string, unknown> = {};
    try {
      const { LocalEngine } = await import("@/lib/services/LocalEngine");
      baseRaw = ((await LocalEngine.cacheGet<any>(`vault_totp_row_${id}`)) || {}) as any;
    } catch {}
    const predictive = {
      ...baseRaw,
      ...encryptedData,
      $id: id,
      userId: existing.userId,
      $updatedAt: new Date().toISOString(),
    } as Record<string, unknown> & { $id: string };
    await this.mirrorRawTotp(String(existing.userId), predictive);

    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
      encryptedData);
    this.clearCredentialCache(existing.userId);
    const raw = doc as unknown as TotpSecrets & { $id: string };
    await this.mirrorRawTotp(String(existing.userId), raw as any);
    return raw as unknown as TotpSecrets;
  }

  static async updateFolder(
    id: string,
    data: Partial<Folders>): Promise<Folders> {
    const sanitizedData = { ...data };
    if (sanitizedData.name) {
      sanitizedData.name = sanitizeString(sanitizedData.name, 100);
    }
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id,
      sanitizedData as unknown as Record<string, unknown>);
    return doc as unknown as Folders;
  }

  static async updateUserDoc(id: string, data: Partial<User>): Promise<User> {
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      id,
      data as unknown as Record<string, unknown>);
    return doc as unknown as User;
  }

  static async updateSecurityLog(
    id: string,
    data: Partial<SecurityLogs>): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id,
      data as unknown as Record<string, unknown>);
    return doc as unknown as SecurityLogs;
  }

  // Delete operations
  static async deleteCredential(id: string): Promise<void> {
    const existing = await this.getCredential(id);
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id);
    this.clearCredentialCache(existing.userId);
  }

  static async deleteTOTPSecret(id: string): Promise<void> {
    const existing = await this.getTOTPSecret(id);
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id);
    this.clearCredentialCache(existing.userId);
  }

  static async deleteFolder(id: string): Promise<void> {
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id);
  }

  static async deleteSecurityLog(id: string): Promise<void> {
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id);
  }

  static async deleteUserDoc(id: string): Promise<void> {
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      id);
  }

  // --- Ecosystem: Flow ---
  static async listFlowTasks(userId: string, queries: string[] = []): Promise<{ total: number; rows: any[] }> {
    const res = await appwriteDatabases.listRows(
      FLOW_DATABASE_ID,
      FLOW_COLLECTION_ID_TASKS,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("$createdAt"), ...queries]
    );
    return { total: res.total, rows: res.rows };
  }

  static async listFlowEvents(userId: string, queries: string[] = []): Promise<{ total: number; rows: any[] }> {
    const res = await appwriteDatabases.listRows(
      FLOW_DATABASE_ID,
      FLOW_COLLECTION_ID_EVENTS,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("startTime"), ...queries]
    );
    return { total: res.total, rows: res.rows };
  }

  static async listFlowNotes(userId: string, queries: string[] = []): Promise<{ total: number; rows: any[] }> {
    const res = await appwriteDatabases.listRows(
      NOTE_DATABASE_ID,
      NOTE_COLLECTION_ID,
      [Query.equal("userId", userId), Query.limit(100), Query.orderDesc("$createdAt"), ...queries]
    );
    return { total: res.total, rows: res.rows };
  }

  // --- Security Event Logging ---
  static async logSecurityEvent(
    userId: string,
    eventType: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string): Promise<void> {
    const extendedDetails = {
      ...details,
      ecosystemApp: APPWRITE_CONFIG.DATABASES.VAULT
    };
    await this.createSecurityLog({
      userId,
      eventType,
      details: JSON.stringify(extendedDetails),
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      timestamp: new Date().toISOString(),
      $permissions: []} as any);
  }

  static async setCredentialPinned(id: string, pinned: boolean): Promise<void> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id) as Record<string, unknown>;
    const permissions = Array.isArray(doc.$permissions)
      ? (doc.$permissions as string[])
      : undefined;
    await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
      { isPinned: pinned },
      permissions);
    if (typeof doc.userId === 'string') {
      this.clearCredentialCache(doc.userId);
    }
  }

  static async setTotpPinned(id: string, pinned: boolean): Promise<void> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id) as Record<string, unknown>;
    const permissions = Array.isArray(doc.$permissions)
      ? (doc.$permissions as string[])
      : undefined;
    await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
      { isPinned: pinned },
      permissions);
    if (typeof doc.userId === 'string') {
      this.clearCredentialCache(doc.userId);
    }
  }

  static async toggleCredentialPin(id: string): Promise<boolean> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id) as { isPinned?: boolean };
    const newPinned = !doc.isPinned;
    await this.setCredentialPinned(id, newPinned);
    return newPinned;
  }

  static async toggleTOTPPin(id: string): Promise<boolean> {
    const existing = await this.getTOTPSecret(id);
    const newPinned = !existing.isPinned;
    await this.setTotpPinned(id, newPinned);
    return newPinned;
  }

  // --- Sanitization Helpers ---
  private static sanitizeCredentialData(data: Partial<Credentials>): Partial<Credentials> {
    const sanitized = { ...data };

    // Sanitize string fields that might be displayed as HTML
    if (sanitized.name) sanitized.name = sanitizeString(sanitized.name, 100);
    if (sanitized.username) sanitized.username = sanitizeString(sanitized.username, 255);
    // Note: We don't sanitize password as it needs to be exact
    // Note: Urls can be tricky to sanitize without breaking them, validation is better.
    // sanitizeString removes HTML tags which should be safe for URLs unless they are weird
    if (sanitized.url) sanitized.url = sanitizeString(sanitized.url, 2048);
    if (sanitized.notes) sanitized.notes = sanitizeString(sanitized.notes, 10000);

    // Custom fields are JSON strings, we trust the validation/parser there or sanitize individual string values if we parse it.
    // For now, we leave customFields as is, assuming validation happened before.

    return sanitized;
  }

  private static sanitizeTotpData(data: Partial<TotpSecrets>): Partial<TotpSecrets> {
    const sanitized = { ...data };
    if (sanitized.issuer) sanitized.issuer = sanitizeString(sanitized.issuer, 100);
    if (sanitized.accountName) sanitized.accountName = sanitizeString(sanitized.accountName, 100);
    if (sanitized.url) sanitized.url = sanitizeString(sanitized.url, 2048);
    return sanitized;
  }

  // --- Encryption/Decryption Helpers ---
  private static async encryptRowFields(
    data: unknown,
    tableType: keyof typeof COLLECTION_SCHEMAS): Promise<Record<string, unknown>> {
    const schema = COLLECTION_SCHEMAS[tableType];
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>)};

    const { encryptField, decryptField, masterPassCrypto } = await import("../masterpass-crypto");
    const { ecosystemSecurity } = await import("../ecosystem/security");

    if (!masterPassCrypto.isVaultUnlocked()) {
      throw new Error("Vault is locked - cannot encrypt data");
    }

    if (tableType === "credentials" || tableType === "totpSecrets") {
      let dek: CryptoKey;
      let wrappedDek: string;

      if (result.dek && typeof result.dek === "string" && result.dek.trim().length > 0) {
        wrappedDek = result.dek;
        const dekBase64 = await decryptField(wrappedDek);
        const rawKey = base64ToBytes(dekBase64);
        dek = await crypto.subtle.importKey(
          "raw",
          rawKey as any,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
      } else {
        dek = await ecosystemSecurity.generateRandomMEK();
        const rawKey = await crypto.subtle.exportKey("raw", dek);
        const dekBase64 = bytesToBase64(new Uint8Array(rawKey));
        wrappedDek = await encryptField(dekBase64);
        result.dek = wrappedDek;
      }

      for (const field of schema.encrypted) {
        const fieldValue = result[field];
        if (this.shouldEncryptField(fieldValue)) {
          try {
            result[field] = await ecosystemSecurity.encryptWithKey(String(fieldValue), dek);
          } catch (error: unknown) {
            console.error(`Failed to encrypt field ${field} with DEK:`, error);
            throw new Error(`DEK Encryption failed for ${field}: ${error}`);
          }
        } else {
          delete result[field];
        }
      }

      return result;
    }

    for (const field of schema.encrypted) {
      const fieldValue = result[field];
      if (this.shouldEncryptField(fieldValue)) {
        try {
          result[field] = await encryptField(String(fieldValue));
        } catch (error: unknown) {
          console.error(`Failed to encrypt field ${field}:`, error);
          throw new Error(`Encryption failed for ${field}: ${error}`);
        }
      } else {
        delete result[field];
      }
    }

    return result;
  }

}
