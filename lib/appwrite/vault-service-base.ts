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
export class VaultServiceBase {
  private static credentialsListCache = new Map<string, Credentials[]>();
  private static totpSecretsCache = new Map<string, TotpSecrets[]>();
  private static credentialsListInflight = new Map<string, Promise<Credentials[]>>();
  private static totpSecretsInflight = new Map<string, Promise<TotpSecrets[]>>();
  private static runtimeHooksInitialized = false;

  private static ensureRuntimeSecurityHooks() {
    if (this.runtimeHooksInitialized || typeof window === "undefined") return;
    this.runtimeHooksInitialized = true;

    window.addEventListener("vault-locked", () => {
      this.credentialsListCache.clear();
      this.totpSecretsCache.clear();
      this.credentialsListInflight.clear();
      this.totpSecretsInflight.clear();
    });
  }

  private static clearCredentialCache(userId: string) {
    for (const key of this.credentialsListCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.credentialsListCache.delete(key);
      }
    }
    for (const key of this.totpSecretsCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.totpSecretsCache.delete(key);
      }
    }
    for (const key of this.credentialsListInflight.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.credentialsListInflight.delete(key);
      }
    }
    for (const key of this.totpSecretsInflight.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.totpSecretsInflight.delete(key);
      }
    }
  }

  // Map a single Appwrite row to domain type
  private static mapDoc<T>(doc: Models.Row | Record<string, unknown>): T {
    return doc as unknown as T;
  }

  // Map Appwrite RowList response to domain RowList shape
  private static mapRowList<T>(
    response:
      | Models.RowList<Models.Row>
      | { rows?: unknown[]; items?: unknown[]; total?: number }
      | unknown[]): { total: number; rows: T[] } {
    if (Array.isArray(response)) {
      return {
        total: response.length,
        rows: response as unknown as T[]};
    }

    const resp = response as {
      rows?: unknown[];
      items?: unknown[];
      total?: number;
    };
    return {
      total: resp.total ?? 0,
      rows: (resp.rows ?? resp.items ?? []) as unknown as T[]};
  }
  /**
   * LocalEngine is a 1:1 ciphertext mirror of Appwrite — never write decrypted vault rows.
   * Predictive create: seal → mirror locally → sync remote with the same id/payload.
   */
  private static dedupeRowsById<T extends { $id?: string; id?: string }>(rows: T[]): T[] {
    const byId = new Map<string, T>();
    for (const row of rows) {
      if (!row) continue;
      const id = row.$id || row.id;
      if (!id) continue;
      byId.set(id, row);
    }
    return Array.from(byId.values());
  }

  private static async mirrorRawCredential(userId: string, row: Record<string, unknown> & { $id: string }) {
    try {
      const { LocalEngine } = await import("@/lib/services/LocalEngine");
      await LocalEngine.cacheSet(`vault_credential_${row.$id}`, row);
      const listKey = `vault_credentials_${userId}`;
      const prev = (await LocalEngine.cacheGet<any[]>(listKey)) || [];
      const arr = Array.isArray(prev) ? prev : [];
      const next = this.dedupeRowsById([row, ...arr.filter((r) => r && (r.$id || r.id) !== row.$id)]);
      await LocalEngine.cacheSet(listKey, next);
    } catch {
      /* offline / first run */
    }
  }

  private static async mirrorRawTotp(userId: string, row: Record<string, unknown> & { $id: string }) {
    try {
      const { LocalEngine } = await import("@/lib/services/LocalEngine");
      await LocalEngine.cacheSet(`vault_totp_row_${row.$id}`, row);
      const listKey = `vault_totp_${userId}`;
      const prev = (await LocalEngine.cacheGet<any[]>(listKey)) || [];
      const arr = Array.isArray(prev) ? prev : [];
      const next = this.dedupeRowsById([row, ...arr.filter((r) => r && (r.$id || r.id) !== row.$id)]);
      await LocalEngine.cacheSet(listKey, next);
    } catch {
      /* offline / first run */
    }
  }

  // Create with automatic encryption — returns RAW ciphertext row (UI decrypts for display).
  static async createCredential(
    data: CredentialsCreate,
    options?: { linkedNoteIds?: string[] }): Promise<Credentials> {
    const sanitizedData = this.sanitizeCredentialData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptRowFields(sanitizedData, "credentials");

    // Schema-required for login: userId + itemType + name only. Password optional (env + note-like secrets).
    if (!encryptedData.itemType) {
      encryptedData.itemType = "login";
    }

    const rowId = ID.unique();
    const now = new Date().toISOString();
    if (!encryptedData.createdAt) encryptedData.createdAt = now;
    encryptedData.updatedAt = now;

    const predictiveRow = {
      ...encryptedData,
      $id: rowId,
      $createdAt: now,
      $updatedAt: now,
    } as Record<string, unknown> & { $id: string };

    // Seal → LocalEngine (ciphertext) → Appwrite — same shape as pull.
    await this.mirrorRawCredential(String(data.userId), predictiveRow);

    try {
      const doc = await appwriteDatabases.createRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        rowId,
        encryptedData,
        [
          Permission.read(Role.user(data.userId))]
      );
      this.clearCredentialCache(data.userId);
      const { ecosystemSecurity } = await import("../ecosystem/security");
      ecosystemSecurity.fetchSecuritySnapshot(data.userId, true);
      const raw = doc as unknown as Credentials & { $id: string };
      await this.mirrorRawCredential(String(data.userId), raw as any);
      return raw;
    } catch (createError) {
      console.error("[AppwriteService] Create Credential FAILED:", createError);
      throw createError;
    }
  }

  /**
   * Import path: encrypt → LocalEngine (ciphertext) → return immediately.
   * Remote create is high-priority outbox only (local batch earmarks never hit DB).
   */
  static async stageCredentialImport(
    data: CredentialsCreate,
    opts: { batchId: string },
  ): Promise<Credentials> {
    const sanitizedData = this.sanitizeCredentialData(data);
    const encryptedData = await this.encryptRowFields(sanitizedData, "credentials");
    if (!encryptedData.itemType) encryptedData.itemType = "login";

    const rowId = ID.unique();
    const now = new Date().toISOString();
    if (!encryptedData.createdAt) encryptedData.createdAt = now;
    encryptedData.updatedAt = now;

    const predictiveRow = {
      ...encryptedData,
      $id: rowId,
      $createdAt: now,
      $updatedAt: now,
    } as Record<string, unknown> & { $id: string };

    await this.mirrorRawCredential(String(data.userId), predictiveRow);

    const {
      enqueueImportOutbox,
      IMPORT_SYNC_PRIORITY,
    } = await import('@/lib/vault/import-local-batch');
    await enqueueImportOutbox({
      rowId,
      kind: 'credential',
      batchId: opts.batchId,
      userId: String(data.userId),
      priority: IMPORT_SYNC_PRIORITY,
      enqueuedAt: now,
    });
    this.clearCredentialCache(String(data.userId));
    return predictiveRow as unknown as Credentials;
  }

  static async stageTotpImport(
    data: TotpSecretsCreate,
    opts: { batchId: string },
  ): Promise<TotpSecrets> {
    const sanitizedData = this.sanitizeTotpData(data);
    const encryptedData = await this.encryptRowFields(sanitizedData, "totpSecrets");
    const rowId = ID.unique();
    const now = new Date().toISOString();
    if (!encryptedData.createdAt) encryptedData.createdAt = now;
    encryptedData.updatedAt = now;

    const predictiveRow = {
      ...encryptedData,
      $id: rowId,
      $createdAt: now,
      $updatedAt: now,
    } as Record<string, unknown> & { $id: string };

    await this.mirrorRawTotp(String(data.userId), predictiveRow);

    const {
      enqueueImportOutbox,
      IMPORT_SYNC_PRIORITY,
    } = await import('@/lib/vault/import-local-batch');
    await enqueueImportOutbox({
      rowId,
      kind: 'totp',
      batchId: opts.batchId,
      userId: String(data.userId),
      priority: IMPORT_SYNC_PRIORITY,
      enqueuedAt: now,
    });
    this.clearVaultCaches();
    return predictiveRow as unknown as TotpSecrets;
  }

  /** Push one staged LocalEngine ciphertext row to Appwrite (write-only). */
  static async pushStagedImportRow(item: {
    rowId: string;
    kind: 'credential' | 'totp';
    userId: string;
  }): Promise<void> {
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const cacheKey =
      item.kind === 'credential'
        ? `vault_credential_${item.rowId}`
        : `vault_totp_row_${item.rowId}`;
    const row = (await LocalEngine.cacheGet<Record<string, unknown>>(cacheKey)) as any;
    if (!row || !row.$id) {
      throw new Error('Staged row missing from local store');
    }

    const {
      $id,
      $createdAt,
      $updatedAt,
      $permissions,
      $databaseId,
      $tableId,
      $sequence,
      ...payload
    } = row;

    const collectionId =
      item.kind === 'credential'
        ? APPWRITE_COLLECTION_CREDENTIALS_ID
        : APPWRITE_COLLECTION_TOTPSECRETS_ID;

    try {
      const doc = await appwriteDatabases.createRow(
        APPWRITE_DATABASE_ID,
        collectionId,
        String($id),
        payload,
        [Permission.read(Role.user(item.userId))],
      );
      if (item.kind === 'credential') {
        await this.mirrorRawCredential(item.userId, doc as any);
      } else {
        await this.mirrorRawTotp(item.userId, doc as any);
      }
    } catch (e: any) {
      // Already exists from a prior partial flush — treat as synced
      const msg = String(e?.message || e || '');
      if (/already exists|document_already_exists|409/i.test(msg)) {
        return;
      }
      throw e;
    }
  }

  static async createTOTPSecret(
    data: TotpSecretsCreate,
    options?: { linkedNoteIds?: string[] }): Promise<TotpSecrets> {
    const sanitizedData = this.sanitizeTotpData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptRowFields(sanitizedData, "totpSecrets");
    const rowId = ID.unique();
    const now = new Date().toISOString();
    if (!encryptedData.createdAt) encryptedData.createdAt = now;
    encryptedData.updatedAt = now;

    const predictiveRow = {
      ...encryptedData,
      $id: rowId,
      $createdAt: now,
      $updatedAt: now,
    } as Record<string, unknown> & { $id: string };

    await this.mirrorRawTotp(String(data.userId), predictiveRow);

    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      rowId,
      encryptedData,
      [
        Permission.read(Role.user(data.userId))]
    );
    this.clearCredentialCache(data.userId);
    const raw = doc as unknown as TotpSecrets & { $id: string };
    await this.mirrorRawTotp(String(data.userId), raw as any);
    return raw as unknown as TotpSecrets;
  }

  static async createKeyMapping(
    data: KeyMappingCreate,
    permissions: string[]): Promise<KeyMapping> {
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      ID.unique(),
      {
        ...data,
        metadata: data.metadata ?? null},
      permissions);
    return doc as unknown as KeyMapping;
  }

  static async listIncomingKeyMappings(userId: string): Promise<KeyMapping[]> {
    const response = await listRowsWithRetry(APPWRITE_COLLECTION_KEY_MAPPING_ID, [
      Query.equal("grantee", userId),
      Query.notEqual("isShared", true),
      Query.orderDesc("$createdAt")]);
    const rows = Array.isArray(response?.rows) ? response.rows : [];
    return rows as unknown as KeyMapping[];
  }

  static async deleteKeyMapping(id: string): Promise<void> {
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      id);
  }

  private static async getCollaboratedResourceIds(
    userId: string,
    resourceType: 'secret' | 'totp'): Promise<string[]> {
    try {
      const response = await originalAppwriteDatabases.listRows(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_KEY_MAPPING_ID,
        [
          Query.equal('grantee', userId),
          Query.equal('resourceType', resourceType === 'secret' ? 'credential' : 'totp'),
          Query.equal('isShared', true),
          Query.limit(100)
        ]
      );
      const rows = Array.isArray(response?.rows) ? response.rows : [];
      return rows.map((row: any) => row.resourceId).filter(Boolean);
    } catch (error) {
      console.error(`[VaultService] Failed to list collaborated resource IDs for ${resourceType}:`, error);
      return [];
    }
  }

  static async migrateCredentialToDEK(credentialId: string): Promise<Credentials> {
    const existing = await this.getCredential(credentialId);
    if (existing.dek) {
      return existing;
    }

    const dataToUpdate: Partial<Credentials> = {
      name: existing.name,
      url: existing.url,
      username: existing.username,
      password: existing.password,
      notes: existing.notes,
      customFields: existing.customFields,
      cardNumber: existing.cardNumber,
      cardholderName: existing.cardholderName,
      cardExpiry: existing.cardExpiry,
      cardCVV: existing.cardCVV,
      cardPIN: existing.cardPIN};

    return await this.updateCredential(credentialId, dataToUpdate);
  }

  static async migrateTotpSecretToDEK(totpSecretId: string): Promise<TotpSecrets> {
    const existing = await this.getTOTPSecret(totpSecretId);
    if (existing.dek) {
      return existing;
    }

    const dataToUpdate: Partial<TotpSecrets> = {
      issuer: existing.issuer,
      accountName: existing.accountName,
      secretKey: existing.secretKey,
      url: existing.url};

    return await this.updateTOTPSecret(totpSecretId, dataToUpdate);
  }

  static async shareCredential(
    credentialId: string,
    recipient: { userId: string; publicKey: string }): Promise<KeyMapping> {
    let credential = await this.getCredential(credentialId);
    if (!credential.dek) {
      credential = await this.migrateCredentialToDEK(credentialId);
    }
    const currentUser = await getCurrentUser();

    const { decryptField } = await import("../masterpass-crypto");
    const { ecosystemSecurity } = await import("../ecosystem/security");

    const dekBase64 = await decryptField(credential.dek as string);
    const rawKey = base64ToBytes(dekBase64);
    const dek = await crypto.subtle.importKey(
      "raw",
      rawKey as any,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const wrappedKey = await ecosystemSecurity.wrapKeyWithECDH(dek, recipient.publicKey);
    const senderPublicKey = await ecosystemSecurity.exportIdentityPublicKey() || "";

    const created = await this.createKeyMapping(
      {
        resourceId: credentialId,
        resourceType: "credential",
        grantee: recipient.userId,
        wrappedKey: wrappedKey,
        isShared: false,
        metadata: JSON.stringify({
          senderId: credential.userId,
          senderPublicKey: senderPublicKey,
          sourceName: credential.name,
          createdAt: new Date().toISOString()})},
      [
        Permission.read(Role.user(recipient.userId)),
        Permission.read(Role.user(credential.userId))]
    );
    try {
      if (typeof window !== 'undefined') {
        const { grantPermission } = await import('@/lib/actions/client-ops');
        await grantPermission({
          userId: credential.userId,
          resourceId: credentialId,
          resourceType: 'secret',
          resourceTitle: credential.name || 'Credential',
          targetUserId: recipient.userId,
          permission: 'viewer',
          actorName: currentUser?.name || currentUser?.email || credential.userId,
          skipEmail: true});
      } else {
        const { grantPermissionSecure } = await import('@/lib/actions/secure-ops');
        await grantPermissionSecure({
          userId: credential.userId,
          resourceId: credentialId,
          resourceType: 'secret',
          resourceTitle: credential.name || 'Credential',
          targetUserId: recipient.userId,
          permission: 'viewer',
          actorName: currentUser?.name || currentUser?.email || credential.userId,
          skipEmail: true});
      }
    } catch (permError) {
      console.error("[Vault] Failed to grant read permission for shared credential:", permError);
    }

    try {
      await sendKylrixEmailNotification({
        eventType: 'password_shared',
        sourceApp: 'vault',
        verificationMode: 'error',
        actorName: currentUser?.name || currentUser?.email || credential.userId,
        recipientIds: [recipient.userId],
        resourceId: credentialId,
        resourceTitle: credential.name || 'Credential',
        resourceType: 'credential',
        templateKey: 'vault:credential-shared',
        ctaUrl: `${getEcosystemUrl('vault')}/sharing`,
        ctaText: 'Open sharing'});
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('not verified')) {
        throw error;
      }
      console.error('[Vault] Failed to queue credential share email', error);
    }

    return created;
  }

}
