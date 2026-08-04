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
import { buildVaultNoteTags } from "../sdk/crosslinks";
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
        const finalQueries = queries ? [...queries] : [];
        const trashSupported = ['credentials', 'totpSecrets'];
        if (trashSupported.includes(collId) && !finalQueries.some(q => q.includes('isTrash'))) {
            finalQueries.push(Query.notEqual('isTrash', true));
        }
        return originalAppwriteDatabases.listRows(dbId, collId, finalQueries);
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

/** Compound indexes split rows across idx_userId, (userId,isPublic), (userId,isPinned). */
function getCredentialOwnerIndexQueries(userId: string): string[] {
  return [
    Query.equal("userId", userId),
    Query.and([Query.equal("userId", userId), Query.equal("isPublic", true)]),
    Query.and([Query.equal("userId", userId), Query.equal("isPinned", true)]),
  ];
}

function buildCredentialOwnerFilterQueries(
  userId: string,
  resourceIds: string[] = []): string[] {
  const queries = getCredentialOwnerIndexQueries(userId);
  if (resourceIds.length > 0) {
    queries.push(Query.equal("$id", resourceIds));
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
      let response: Models.RowList<Models.Row>;
      do {
        response = await listRowsWithRetry(tableId, [
          filterQuery,
          Query.limit(pageSize),
          Query.offset(offset),
          ...extraQueries,
        ]);
        for (const row of response.rows) {
          byId.set(row.$id, row);
        }
        offset += pageSize;
      } while (response.rows.length > 0 && offset < response.total);
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
export class VaultService {
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
  // Create with automatic encryption
  static async createCredential(
    data: CredentialsCreate,
    options?: { linkedNoteIds?: string[] }): Promise<Credentials> {
    const sanitizedData = this.sanitizeCredentialData(data);
    const linkedTags = buildVaultNoteTags(options?.linkedNoteIds || []);
    if (linkedTags.length) {
      sanitizedData.tags = Array.from(new Set([...(sanitizedData.tags || []), ...linkedTags]));
    }
    const encryptedData = await this.encryptRowFields(sanitizedData, "credentials");

    // Ensure itemType is present, default to 'login'
    if (!encryptedData.itemType) {
      encryptedData.itemType = "login";
    }

    // Validate password presence for login items
    if (encryptedData.itemType === "login" && !encryptedData.password) {
      console.error("[AppwriteService] Password missing for credential:", data.name);
      throw new Error("Password is required for login credentials. It may be empty or encryption failed.");
    }

    console.log("[AppwriteService] Creating Credential...", {
      dbId: APPWRITE_DATABASE_ID,
      collId: APPWRITE_COLLECTION_CREDENTIALS_ID,
      userId: data.userId,
      permissions: [
        Permission.read(Role.user(data.userId))]
    });

    try {
      const doc = await appwriteDatabases.createRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        ID.unique(),
        encryptedData,
        [
          Permission.read(Role.user(data.userId))]
      );
      console.log("[AppwriteService] Credential Created Successfully:", doc.$id);
      this.clearCredentialCache(data.userId);
      // Invalidate ecosystem security snapshot
      const { ecosystemSecurity } = await import("../ecosystem/security");
      ecosystemSecurity.fetchSecuritySnapshot(data.userId, true);

      return (await this.decryptRowFields(
        doc,
        "credentials")) as Credentials;
    } catch (createError) {
      console.error("[AppwriteService] Create Credential FAILED:", createError);
      throw createError;
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
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      ID.unique(),
      encryptedData,
      [
        Permission.read(Role.user(data.userId))]
    );
    this.clearCredentialCache(data.userId);
    return (await this.decryptRowFields(
      doc,
      "totpSecrets")) as unknown as TotpSecrets;
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
    return response.rows as unknown as KeyMapping[];
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
      return response.rows.map((row: any) => row.resourceId).filter(Boolean);
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

  static async shareTotpSecret(
    totpSecretId: string,
    recipient: { userId: string; publicKey: string }): Promise<KeyMapping> {
    let totpSecret = await this.getTOTPSecret(totpSecretId);
    if (!totpSecret.dek) {
      totpSecret = await this.migrateTotpSecretToDEK(totpSecretId);
    }
    const currentUser = await getCurrentUser();

    const { decryptField } = await import("../masterpass-crypto");
    const { ecosystemSecurity } = await import("../ecosystem/security");

    const dekBase64 = await decryptField(totpSecret.dek as string);
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
        resourceId: totpSecretId,
        resourceType: "totp",
        grantee: recipient.userId,
        wrappedKey: wrappedKey,
        isShared: false,
        metadata: JSON.stringify({
          senderId: totpSecret.userId,
          senderPublicKey: senderPublicKey,
          sourceName: `${totpSecret.issuer} / ${totpSecret.accountName}`,
          createdAt: new Date().toISOString()})},
      [
        Permission.read(Role.user(recipient.userId)),
        Permission.read(Role.user(totpSecret.userId))]);

    try {
      if (typeof window !== 'undefined') {
        const { grantPermission } = await import('@/lib/actions/client-ops');
        await grantPermission({
          userId: totpSecret.userId,
          resourceId: totpSecretId,
          resourceType: 'totp',
          resourceTitle: `${totpSecret.issuer} / ${totpSecret.accountName}`,
          targetUserId: recipient.userId,
          permission: 'viewer',
          actorName: currentUser?.name || currentUser?.email || totpSecret.userId,
          skipEmail: true});
      } else {
        const { grantPermissionSecure } = await import('@/lib/actions/secure-ops');
        await grantPermissionSecure({
          userId: totpSecret.userId,
          resourceId: totpSecretId,
          resourceType: 'totp',
          resourceTitle: `${totpSecret.issuer} / ${totpSecret.accountName}`,
          targetUserId: recipient.userId,
          permission: 'viewer',
          actorName: currentUser?.name || currentUser?.email || totpSecret.userId,
          skipEmail: true});
      }
    } catch (permError) {
      console.error("[Vault] Failed to grant read permission for shared totp:", permError);
    }

    try {
      await sendKylrixEmailNotification({
        eventType: 'password_shared',
        sourceApp: 'vault',
        verificationMode: 'error',
        actorName: currentUser?.name || currentUser?.email || totpSecret.userId,
        recipientIds: [recipient.userId],
        resourceId: totpSecretId,
        resourceTitle: `${totpSecret.issuer} / ${totpSecret.accountName}`.trim(),
        resourceType: 'totp',
        templateKey: 'vault:totp-shared',
        ctaUrl: `${getEcosystemUrl('vault')}/sharing`,
        ctaText: 'Open sharing'});
    } catch (error: any) {
      if (String(error?.message || '').toLowerCase().includes('not verified')) {
        throw error;
      }
      console.error('[Vault] Failed to queue TOTP share email', error);
    }

    return created;
  }

  static async acceptSharedCredential(mapping: KeyMapping): Promise<Credentials> {
    await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      mapping.$id,
      { isShared: true }
    );
    return await this.getCredential(mapping.resourceId);
  }

  static async acceptSharedTotp(mapping: KeyMapping): Promise<TotpSecrets> {
    await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEY_MAPPING_ID,
      mapping.$id,
      { isShared: true }
    );
    return await this.getTOTPSecret(mapping.resourceId);
  }

  static async createFolder(
    data: FoldersCreate): Promise<Folders> {
    const sanitizedData = {
      ...data,
      name: sanitizeString(data.name, 100)};
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      ID.unique(),
      sanitizedData as unknown as Record<string, unknown>,
      [
        Permission.read(Role.user(data.userId))]
    );
    return this.mapDoc<Folders>(doc);
  }

  static async createSecurityLog(
    data: SecurityLogsCreate): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId)),
        // Logs are usually read-only for the user, but for now we give full access
        ]
    );
    return doc as unknown as SecurityLogs;
  }

  static async createKeychainEntry(
    data: KeychainCreate): Promise<Keychain> {
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId))]
    );
    const created = doc as unknown as Keychain;
    const { SecurityEnclave } = await import("@/lib/security/enclave");
    const existing = await SecurityEnclave.getKeychain(data.userId);
    await SecurityEnclave.setKeychain(data.userId, [created, ...existing.filter(e => e.$id !== created.$id)]);
    await SecurityEnclave.markDirty(data.userId);
    // Invalidate ecosystem security snapshot
    const { ecosystemSecurity } = await import("../ecosystem/security");
    ecosystemSecurity.fetchSecuritySnapshot(data.userId, true);
    
    return created;
  }

  static async listKeychainEntries(
    userId: string): Promise<Keychain[]> {
    const { SecurityEnclave, raceNetworkOrLocal } = await import("@/lib/security/enclave");
    const cached = (await SecurityEnclave.getKeychain(userId)) as Keychain[];

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return cached;
    }

    try {
      const { value, source } = await raceNetworkOrLocal({
        timeoutMs: 2500,
        network: async () => {
          const response = await appwriteDatabases.listRows(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_KEYCHAIN_ID,
            [Query.equal("userId", userId)]);
          return response.rows as unknown as Keychain[];
        },
        local: async () => cached});

      if (source === 'network' && Array.isArray(value) && value.length > 0) {
        await SecurityEnclave.setKeychain(userId, value);
        return value;
      }
      return cached.length > 0 ? cached : (Array.isArray(value) ? value : []);
    } catch (err) {
      if (cached.length > 0) return cached;
      throw err;
    }
  }

  static async deleteKeychainEntry(id: string, userId?: string): Promise<void> {
    await appwriteDatabases.deleteRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      id);
    if (userId) {
      const { SecurityEnclave } = await import("@/lib/security/enclave");
      const existing = await SecurityEnclave.getKeychain(userId);
      await SecurityEnclave.setKeychain(
        userId,
        existing.filter((e) => e.$id !== id));
      await SecurityEnclave.markDirty(userId);
    }
  }

  static async updateKeychainEntry(
    id: string,
    data: Partial<Keychain>): Promise<Keychain> {
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      id,
      data);
    const updated = doc as unknown as Keychain;
    if (updated.userId) {
      const { SecurityEnclave } = await import("@/lib/security/enclave");
      const existing = await SecurityEnclave.getKeychain(updated.userId);
      await SecurityEnclave.setKeychain(
        updated.userId,
        existing.map((e) => (e.$id === id ? { ...e, ...updated } : e)));
      await SecurityEnclave.markDirty(updated.userId);
    }
    return updated;
  }

  static async createUserDoc(data: Omit<User, "$id">): Promise<User> {
    const doc = await appwriteDatabases.createRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_USER_ID,
      ID.unique(),
      data,
      [
        Permission.read(Role.user(data.userId))]
    );
    return doc as unknown as User;
  }

  /**
   * Checks if the user has set up a master password (local enclave first).
   */
  static async hasMasterpass(userId: string): Promise<boolean> {
    const { SecurityEnclave } = await import("@/lib/security/enclave");
    const probe = await SecurityEnclave.probeCapabilities(userId);
    if (probe.hasMasterpass) return true;
    const userDoc = await this.getUserDoc(userId);
    return !!(userDoc && userDoc.masterpass === true);
  }

  /**
   * Sets the masterpass flag for the user in the database.
   * If the user doc exists, updates it; otherwise, creates it.
   */
  static async setMasterpassFlag(userId: string, email: string): Promise<void> {
    const { SecurityEnclave } = await import("@/lib/security/enclave");
    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      const updated = await appwriteDatabases.updateRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        userDoc.$id,
        { masterpass: true });
      await SecurityEnclave.setUserDoc(userId, { ...userDoc, ...updated, masterpass: true });
      await SecurityEnclave.markDirty(userId);
    } else {
      const created = await appwriteDatabases.createRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        ID.unique(),
        {
          userId,
          email,
          masterpass: true});
      await SecurityEnclave.setUserDoc(userId, created);
      await SecurityEnclave.markDirty(userId);
    }
  }

  /**
   * Checks if the user has set up a passkey.
   */
  static async hasPasskey(userId: string): Promise<boolean> {
    const { SecurityEnclave } = await import("@/lib/security/enclave");
    const probe = await SecurityEnclave.probeCapabilities(userId);
    if (probe.hasPasskey) return true;
    const entries = await this.listKeychainEntries(userId);
    return entries.some(e => e.type === 'passkey');
  }

  /**
   * Adds a new passkey credential to the user's row.
   */
  static async setPasskey(
    userId: string,
    passkeyBlob: string,
    newCredential: {
      credentialID: string;
      publicKey: string;
      counter: number;
      transports: string[];
    }): Promise<void> {
    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      await appwriteDatabases.updateRow(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_USER_ID,
        userDoc.$id,
        {
          isPasskey: true,
          passkeyBlob,
          credentialId: newCredential.credentialID,
          publicKey: newCredential.publicKey,
          counter: newCredential.counter});
    }
  }

  /**
   * Syncs the isPasskey flag on the user row based on actual keychain entries.
   */
  static async syncPasskeyStatus(userId: string): Promise<void> {
    const entries = await this.listKeychainEntries(userId);
    const hasPasskey = entries.some(e => e.type === 'passkey');

    const userDoc = await this.getUserDoc(userId);
    if (userDoc && userDoc.$id) {
      // Only update if different to save writes
      if (!!userDoc.isPasskey !== hasPasskey) {
        await appwriteDatabases.updateRow(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_USER_ID,
          userDoc.$id,
          { isPasskey: hasPasskey }
        );
      }
    }
  }

  /**
   * Removes all passkey credentials for the user.
   */
  static async removePasskey(userId: string): Promise<void> {
    // Remove ALL passkeys from keychain
    const entries = await this.listKeychainEntries(userId);
    const passkeyEntries = entries.filter(e => e.type === 'passkey');

    await Promise.all(passkeyEntries.map(e => this.deleteKeychainEntry(e.$id)));

    // Clear flags on user doc
    await this.syncPasskeyStatus(userId);
  }

  // Read with automatic decryption
  static async getCredential(id: string): Promise<Credentials> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id);
    return (await this.decryptRowFields(
      doc,
      "credentials")) as Credentials;
  }

  static async getTOTPSecret(id: string): Promise<TotpSecrets> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id);
    return (await this.decryptRowFields(
      doc,
      "totpSecrets")) as unknown as TotpSecrets;
  }

  static async getFolder(id: string): Promise<Folders> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_FOLDERS_ID,
      id);
    return doc as unknown as Folders;
  }

  static async getUserDoc(userId: string): Promise<User | null> {
    const { SecurityEnclave, raceNetworkOrLocal } = await import("@/lib/security/enclave");
    const local = await SecurityEnclave.getUserDoc(userId);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return (local as User) || null;
    }

    try {
      const { value, source } = await raceNetworkOrLocal({
        timeoutMs: 2500,
        network: async () => {
          const response = await appwriteDatabases.listRows(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_USER_ID,
            [Query.equal("userId", userId)]);
          return (response.rows[0] as unknown as User) || null;
        },
        local: async () => (local as User) || null});

      if (source === 'network' && value) {
        await SecurityEnclave.setUserDoc(userId, value);
        return value;
      }
      return value || (local as User) || null;
    } catch {
      return (local as User) || null;
    }
  }

  static async getSecurityLog(id: string): Promise<SecurityLogs> {
    const doc = await appwriteDatabases.getRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      id);
    return doc as unknown as SecurityLogs;
  }

  // List with automatic decryption and pagination
  static async listRows<T extends Models.Row>(
    tableId: string,
    queries: string[] = []): Promise<{ total: number; rows: T[] }> {
    const response = await listRowsWithRetry(tableId, queries);
    return {
      total: response.total,
      rows: response.rows as unknown as T[]};
  }

  static async listCredentials(
    userId: string,
    limit: number = 25,
    offset: number = 0,
    queries: string[] = []): Promise<{ total: number; rows: Credentials[] }> {
    const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
    
    const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
    const mergedRows = sortMergedRows(
      await listRowsMergedAcrossFilters(
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        filterQueries),
      [Query.orderAsc("name"), ...queries]);
    const pageRows = mergedRows.slice(offset, offset + limit);

    const decryptedRows = await Promise.all(
      pageRows.map(
        (doc: Models.Row) =>
          this.decryptRowFields(
            doc,
            "credentials") as Promise<Credentials>));

    return {
      total: mergedRows.length,
      rows: decryptedRows};
  }

  // Enhanced search with database-level filtering for better performance
  static async searchCredentialsByName(
    userId: string,
    searchTerm: string,
    limit: number = 50,
    offset: number = 0): Promise<{ total: number; rows: Credentials[] }> {
    const filterQueries = buildCredentialOwnerFilterQueries(userId);
    const mergedRows = sortMergedRows(
      await listRowsMergedAcrossFilters(
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        filterQueries,
        [Query.search("name", searchTerm)]),
      [Query.orderAsc("name")]);
    const pageRows = mergedRows.slice(offset, offset + limit);

    const decryptedRows = await Promise.all(
      pageRows.map(
        (doc: Models.Row) =>
          this.decryptRowFields(
            doc,
            "credentials") as Promise<Credentials>));

    return {
      total: mergedRows.length,
      rows: decryptedRows};
  }

  static clearVaultCaches() {
    this.credentialsListCache.clear();
    this.credentialsListInflight.clear();
    this.totpSecretsCache.clear();
    this.totpSecretsInflight.clear();
  }

  /**
   * Fetches raw encrypted credential rows (never decrypted).
   * Safe for local persistence (RxDB / IndexedDB).
   */
  static async listRawCredentials(
    userId: string,
    queries: string[] = []): Promise<Credentials[]> {
    this.ensureRuntimeSecurityHooks();
    const resourceIds = await this.getCollaboratedResourceIds(userId, 'secret');
    const filterQueries = buildCredentialOwnerFilterQueries(userId, resourceIds);
    const mergedRows = sortMergedRows(
      await listRowsMergedAcrossFilters(
        APPWRITE_COLLECTION_CREDENTIALS_ID,
        filterQueries,
        queries),
      queries);
    return mergedRows as unknown as Credentials[];
  }

  /**
   * Fetches raw encrypted TOTP secret rows (never decrypted).
   * Safe for local persistence (RxDB / IndexedDB).
   */
  static async listRawTOTPSecrets(
    userId: string,
    queries: string[] = []): Promise<TotpSecrets[]> {
    this.ensureRuntimeSecurityHooks();
    const resourceIds = await this.getCollaboratedResourceIds(userId, 'totp');
    let filterQuery;
    if (resourceIds.length > 0) {
      filterQuery = Query.or([
        Query.equal("userId", userId),
        Query.equal("$id", resourceIds)
      ]);
    } else {
      filterQuery = Query.equal("userId", userId);
    }
    const response = await appwriteDatabases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      [filterQuery, ...queries]);
    return response.rows as unknown as TotpSecrets[];
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
      return cached.map((doc) => ({ ...doc }));
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

      const rows = await Promise.all(
        mergedRows.map(
          (doc: Models.Row) =>
            this.decryptRowFields(
              doc,
              "credentials") as unknown as Credentials));

      const { masterPassCrypto } = await import("../masterpass-crypto");
      if (masterPassCrypto.isVaultUnlocked()) {
        this.credentialsListCache.set(cacheKey, rows);
      }
      return rows;
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
      return cached.map((doc) => ({ ...doc }));
    }

    const pending = this.totpSecretsInflight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const resourceIds = await this.getCollaboratedResourceIds(userId, 'totp');
      let filterQuery;
      if (resourceIds.length > 0) {
        filterQuery = Query.or([
          Query.equal("userId", userId),
          Query.equal("$id", resourceIds)
        ]);
      } else {
        filterQuery = Query.equal("userId", userId);
      }

      const response = await appwriteDatabases.listRows(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_TOTPSECRETS_ID,
        [filterQuery, ...queries]);
      const decryptedSecrets = await Promise.all(
        response.rows.map(
          (doc: Models.Row) =>
            this.decryptRowFields(
              doc,
              "totpSecrets") as Promise<TotpSecrets>));
      this.totpSecretsCache.set(cacheKey, decryptedSecrets);
      return decryptedSecrets;
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
    return response.rows as unknown as Folders[];
  }

  static async listSecurityLogs(
    userId: string,
    queries: string[] = []): Promise<SecurityLogs[]> {
    const response = await appwriteDatabases.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_SECURITYLOGS_ID,
      [Query.equal("userId", userId), Query.orderDesc("timestamp"), ...queries]);
    return response.rows as unknown as SecurityLogs[];
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
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_CREDENTIALS_ID,
      id,
      encryptedData);
    this.clearCredentialCache(existing.userId);
    return (await this.decryptRowFields(
      doc,
      "credentials")) as Credentials;
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
    const doc = await appwriteDatabases.updateRow(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_TOTPSECRETS_ID,
      id,
      encryptedData);
    this.clearCredentialCache(existing.userId);
    return (await this.decryptRowFields(
      doc,
      "totpSecrets")) as unknown as TotpSecrets;
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

              if (mappings.rows.length > 0) {
                const mapping = mappings.rows[0] as KeyMapping;
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
