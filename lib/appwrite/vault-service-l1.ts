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
import { VaultServiceBase } from './vault-service-base';
export class VaultServiceL1 extends VaultServiceBase {
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
}
