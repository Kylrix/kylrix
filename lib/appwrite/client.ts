import { Client, TablesDB, Storage, Account, Realtime, Databases, Avatars, Teams, Functions, Locale } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

const client = new Client();

const initAppwrite = () => {
    if (typeof APPWRITE_CONFIG === 'undefined') return;
    
    // Use the api subdomain for the endpoint
    const endpoint = APPWRITE_CONFIG.ENDPOINT;
    client.setEndpoint(endpoint);

    if (APPWRITE_CONFIG.PROJECT_ID) {
        client.setProject(APPWRITE_CONFIG.PROJECT_ID);
    }
};

initAppwrite();
export const account = new Account(client);
const originalDatabases = new Databases(client);
const originalTablesDB = new TablesDB(client);

// Helper to fetch JWT securely from client-side SDK
async function getJwt(): Promise<string | undefined> {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return undefined;
  }
  try {
    const res = await account.createJWT().catch(() => null);
    return res?.jwt;
  } catch (_e) {
    return undefined;
  }
}

// --- HELPER PARSERS (Hoisted/Early Defined) ---

function parseDatabasesArgs(args: any[]) {
    const [databaseId, tableId, rowId, data, permissions] = args;
    return { databaseId, tableId, rowId, data, permissions };
}

function parseDatabasesDeleteArgs(args: any[]) {
    const [databaseId, tableId, rowId] = args;
    return { databaseId, tableId, rowId };
}

function parseTablesDBArgs(args: any[]) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && ('databaseId' in args[0])) {
        const obj = args[0];
        return {
            databaseId: obj.databaseId,
            tableId: obj.tableId || obj.tableId,
            rowId: obj.rowId || obj.rowId,
            data: obj.data,
            permissions: obj.permissions
        };
    }
    const [databaseId, tableId, rowId, data, permissions] = args;
    return { databaseId, tableId, rowId, data, permissions };
}

function parseTablesDBDeleteArgs(args: any[]) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && ('databaseId' in args[0])) {
        const obj = args[0];
        return {
            databaseId: obj.databaseId,
            tableId: obj.tableId || obj.tableId,
            rowId: obj.rowId || obj.rowId
        };
    }
    const [databaseId, tableId, rowId] = args;
    return { databaseId, tableId, rowId };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseTablesDBListArgs(args: any[]) {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && ('databaseId' in args[0])) {
        const obj = args[0];
        return {
            databaseId: obj.databaseId,
            tableId: obj.tableId,
            queries: obj.queries
        };
    }
    const [databaseId, tableId, queries] = args;
    return { databaseId, tableId, queries };
}

// --- PROXIES ---

const databasesProxy = new Proxy(originalDatabases, {
    get(target: any, prop: string | symbol, receiver: any) {
        // Standardized method names (Primary)
        if (prop === 'createRow' || prop === 'createRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId, data, permissions } = parseDatabasesArgs(args);
                const payload = data ? { ...data } : {};
                if (rowId) payload.$id = rowId;
                const jwt = await getJwt();
                const { createRowSecure } = await import('@/lib/actions/secure-ops');
                return await createRowSecure(databaseId, tableId, payload, permissions, jwt);
            };
        }
        if (prop === 'updateRow' || prop === 'updateRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId, data, permissions } = parseDatabasesArgs(args);
                const jwt = await getJwt();
                const { updateRowSecure } = await import('@/lib/actions/secure-ops');
                const res = await updateRowSecure(databaseId, tableId, rowId, data, permissions, jwt);
                const { invalidateTablesDbRowCache } = await import('@/lib/ecosystem/tablesdb-row-cache');
                invalidateTablesDbRowCache({ databaseId, tableId, rowId });
                return res;
            };
        }
        if (prop === 'listRows' || prop === 'listRows' || prop === 'listDocuments' || prop === 'listDocuments') {
            return async (...args: any[]) => {
                let dbId: string = '';
                let tblId: string = '';
                let q: any[] | undefined;
                if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                    dbId = args[0].databaseId;
                    tblId = args[0].tableId;
                    q = args[0].queries;
                } else {
                    [dbId, tblId, q] = args;
                }
                const fetcher = async () => {
                    const t: any = target as any;
                    if (typeof t.listRows === 'function') return await t.listRows(...args);
                    if (typeof t.listDocuments === 'function') return await t.listDocuments(...args);
                    throw new Error('listRows/listDocuments not available on Databases client');
                };
                if (dbId && tblId) {
                    const { getTablesDbListCached } = await import('@/lib/ecosystem/tablesdb-row-cache');
                    return getTablesDbListCached({ databaseId: dbId, tableId: tblId, queries: q }, fetcher);
                }
                return fetcher();
            };
        }
        if (prop === 'getRow' || prop === 'getRow' || prop === 'getDocument' || prop === 'getDocument') {
            return async (...args: any[]) => {
                let dbId: string = '';
                let tblId: string = '';
                let rId: string = '';
                if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                    dbId = args[0].databaseId;
                    tblId = args[0].tableId;
                    rId = args[0].rowId;
                } else {
                    [dbId, tblId, rId] = args;
                }
                const fetcher = async () => {
                    const t: any = target as any;
                    if (typeof t.getRow === 'function') return await t.getRow(...args);
                    if (typeof t.getDocument === 'function') return await t.getDocument(...args);
                    throw new Error('getRow/getDocument not available on Databases client');
                };
                if (dbId && tblId && rId) {
                    const { getTablesDbRowCached } = await import('@/lib/ecosystem/tablesdb-row-cache');
                    return getTablesDbRowCached({ databaseId: dbId, tableId: tblId, rowId: rId }, fetcher);
                }
                return fetcher();
            };
        }
        if (prop === 'deleteRow' || prop === 'deleteRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId } = parseDatabasesDeleteArgs(args);
                const jwt = await getJwt();
                const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
                const res = await deleteRowSecure(databaseId, tableId, rowId, jwt);
                const { invalidateTablesDbRowCache } = await import('@/lib/ecosystem/tablesdb-row-cache');
                invalidateTablesDbRowCache({ databaseId, tableId, rowId });
                return res;
            };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
    }
});

export const databases = typeof window !== 'undefined' ? (databasesProxy as unknown as Databases) : originalDatabases;

const tablesDBProxy = new Proxy(originalTablesDB, {
    get(target: any, prop: string | symbol, receiver: any) {
        if (prop === 'createRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId, data, permissions } = parseTablesDBArgs(args);
                const payload = data ? { ...data } : {};
                if (rowId) payload.$id = rowId;
                const jwt = await getJwt();
                const { createRowSecure } = await import('@/lib/actions/secure-ops');
                return await createRowSecure(databaseId, tableId, payload, permissions, jwt);
            };
        }
        if (prop === 'updateRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId, data, permissions } = parseTablesDBArgs(args);
                const jwt = await getJwt();
                const { updateRowSecure } = await import('@/lib/actions/secure-ops');
                const res = await updateRowSecure(databaseId, tableId, rowId, data, permissions, jwt);
                const { invalidateTablesDbRowCache } = await import('@/lib/ecosystem/tablesdb-row-cache');
                invalidateTablesDbRowCache({ databaseId, tableId, rowId });
                return res;
            };
        }
        if (prop === 'listRows' || prop === 'listDocuments') {
            return async (...args: any[]) => {
                let dbId: string = '';
                let tblId: string = '';
                let q: any[] | undefined;
                if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                    dbId = args[0].databaseId;
                    tblId = args[0].tableId;
                    q = args[0].queries;
                } else {
                    [dbId, tblId, q] = args;
                }
                const fetcher = async () => {
                    const t: any = target as any;
                    if (typeof t.listRows === 'function') return await t.listRows(...args);
                    if (typeof t.listDocuments === 'function') return await t.listDocuments(...args);
                    throw new Error('listRows/listDocuments not available on TablesDB client');
                };
                if (dbId && tblId) {
                    const { getTablesDbListCached } = await import('@/lib/ecosystem/tablesdb-row-cache');
                    return getTablesDbListCached({ databaseId: dbId, tableId: tblId, queries: q }, fetcher);
                }
                return fetcher();
            };
        }
        if (prop === 'getRow' || prop === 'getDocument') {
            return async (...args: any[]) => {
                let dbId: string = '';
                let tblId: string = '';
                let rId: string = '';
                if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                    dbId = args[0].databaseId;
                    tblId = args[0].tableId;
                    rId = args[0].rowId;
                } else {
                    [dbId, tblId, rId] = args;
                }
                const fetcher = async () => {
                    const t: any = target as any;
                    if (typeof t.getRow === 'function') return await t.getRow(...args);
                    if (typeof t.getDocument === 'function') return await t.getDocument(...args);
                    throw new Error('getRow/getDocument not available on TablesDB client');
                };
                if (dbId && tblId && rId) {
                    const { getTablesDbRowCached } = await import('@/lib/ecosystem/tablesdb-row-cache');
                    return getTablesDbRowCached({ databaseId: dbId, tableId: tblId, rowId: rId }, fetcher);
                }
                return fetcher();
            };
        }
        if (prop === 'deleteRow') {
            return async (...args: any[]) => {
                const { databaseId, tableId, rowId } = parseTablesDBDeleteArgs(args);
                const jwt = await getJwt();
                const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
                const res = await deleteRowSecure(databaseId, tableId, rowId, jwt);
                const { invalidateTablesDbRowCache } = await import('@/lib/ecosystem/tablesdb-row-cache');
                invalidateTablesDbRowCache({ databaseId, tableId, rowId });
                return res;
            };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
    }
});

export const tablesDB = typeof window !== 'undefined' ? (tablesDBProxy as unknown as TablesDB) : originalTablesDB;

export const storage = new Storage(client);
export const avatars = new Avatars(client);
export const teams = new Teams(client);
export const functions = new Functions(client);
export const locale = new Locale(client);
export const realtime = new Realtime(client);

// Aliases for compatibility
export const appwriteAccount = account;
export const appwriteDatabases = databases; // Standard Databases API

export const appwriteStorage = storage;
export const appwriteAvatars = avatars;
export const appwriteClient = client;
export const appwriteRealtime = realtime;
export { client };

export const APPWRITE_BUCKET_BACKUPS_ID = APPWRITE_CONFIG.BUCKETS.BACKUPS;
export const APPWRITE_BUCKET_PROFILE_PICTURES_ID = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

let currentUserCache: { user: any | null; expiresAt: number; lastForcedAt?: number } | null = null;
let currentUserInFlight: Promise<any | null> | null = null;
const currentUserListeners = new Set<(user: any | null) => void>();
const CURRENT_USER_CACHE_TTL = 30000; // 30 seconds for passive reads
const CURRENT_USER_NETWORK_TIMEOUT_MS = 4000;
const CURRENT_USER_CACHE_KEY = 'kylrix_flow_current_user_v2';

function withNetworkTimeout<T>(promise: Promise<T>, ms = CURRENT_USER_NETWORK_TIMEOUT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('account.get timeout')), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

/** Fast local signal — skip network auth probes when nothing suggests a session. */
export function hasAuthSessionHint(): boolean {
    if (typeof window === 'undefined') return false;
    if (getKylrixPulse()) return true;
    if (getCurrentUserSnapshot()) return true;
    return document.cookie.includes('a_session_');
}

function canUseStorage() {
    return typeof window !== 'undefined';
}

function readCurrentUserSnapshot() {
    if (!canUseStorage()) return null;
    try {
        const pid = localStorage.getItem('kylrix:activePartition') || 'acc_default';
        const cacheKey = `${CURRENT_USER_CACHE_KEY}_${pid}`;
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { user: any; expiresAt: number; lastForcedAt?: number };
        if (!parsed?.user) return null;
        if (parsed.expiresAt <= Date.now()) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeCurrentUserSnapshot(user: any | null, lastForcedAt?: number) {
    if (!canUseStorage()) return;
    try {
        if (!user) {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith(CURRENT_USER_CACHE_KEY) || k.startsWith('kylrix_last_logged_in_user'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
            localStorage.removeItem('kylrix:activePartition');
            return;
        }
        const pid = `acc_${user.$id}`;
        localStorage.setItem('kylrix:activePartition', pid);
        const cacheKey = `${CURRENT_USER_CACHE_KEY}_${pid}`;
        const lastUserKey = `kylrix_last_logged_in_user_${pid}`;
        localStorage.setItem(cacheKey, JSON.stringify({
            user,
            expiresAt: Date.now() + CURRENT_USER_CACHE_TTL,
            lastForcedAt: lastForcedAt || (currentUserCache?.lastForcedAt)
        }));
        localStorage.setItem(lastUserKey, JSON.stringify(user));
    } catch {
        // Best effort only.
    }
}

function emitCurrentUserChange(user: any | null) {
    for (const listener of currentUserListeners) {
        listener(user);
    }
}

function hydrateCurrentUserCache() {
    // Refresh when missing or expired so local-first pages keep a stable user id.
    if (currentUserCache && currentUserCache.expiresAt > Date.now()) return;
    const snapshot = readCurrentUserSnapshot();
    if (snapshot) {
        currentUserCache = snapshot;
    }
}

/** Optimistic local user for instant hydration — never waits on account.get. */
export function getCurrentUserSnapshot() {
    hydrateCurrentUserCache();
    return currentUserCache?.user ?? null;
}

/** True when snapshot TTL is still fresh (safe to skip forced network probe). */
export function isCurrentUserSnapshotFresh() {
    hydrateCurrentUserCache();
    return Boolean(currentUserCache && currentUserCache.expiresAt > Date.now());
}

import { Query } from 'appwrite';

export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const APPWRITE_COLLECTION_KEYCHAIN_ID = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

export class AppwriteService {
    static async hasMasterpass(userId: string): Promise<boolean> {
        const { SecurityEnclave } = await import('@/lib/security/enclave');
        const probe = await SecurityEnclave.probeCapabilities(userId);
        if (probe.hasMasterpass || probe.hasPasskey) return true;

        try {
            const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
            const USERS_TABLE = 'users';

            const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
            if (offline) {
                return probe.hasMasterpass || probe.hasPasskey;
            }

            const res = await tablesDB.listRows<any>({
                databaseId: FLOW_DB,
                tableId: USERS_TABLE,
                queries: [Query.equal("userId", userId)]
            }).catch(() => null);

            if (res && res.total > 0 && res.rows[0].hasMasterpass) {
                return true;
            }
            const entries = await this.listKeychainEntries(userId);
            return entries.some(e => e.type === 'password' || e.type === 'passkey');
        } catch (_e: unknown) {
            return probe.hasMasterpass || probe.hasPasskey;
        }
    }

    static async listKeychainEntries(userId: string): Promise<any[]> {
        const { SecurityEnclave, raceNetworkOrLocal } = await import('@/lib/security/enclave');
        const cached = await SecurityEnclave.getKeychain(userId);

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return cached;
        }

        try {
            const { value, source } = await raceNetworkOrLocal({
                timeoutMs: 2500,
                network: async () => {
                    const res = await tablesDB.listRows<any>({
                        databaseId: APPWRITE_DATABASE_ID,
                        tableId: APPWRITE_COLLECTION_KEYCHAIN_ID,
                        queries: [Query.equal("userId", userId)]
                    });
                    return res.rows || [];
                },
                local: async () => cached});

            if (source === 'network' && Array.isArray(value) && value.length > 0) {
                await SecurityEnclave.setKeychain(userId, value);
                return value;
            }
            return cached.length > 0 ? cached : (Array.isArray(value) ? value : []);
        } catch (_e: unknown) {
            if (cached.length > 0) return cached;
            console.error('listKeychainEntries error', _e);
            return [];
        }
    }

    static async createKeychainEntry(data: any): Promise<any> {
        const { ID } = await import("appwrite");
        return await tablesDB.createRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_KEYCHAIN_ID,
            ID.unique(),
            data
        );
    }

    static async deleteKeychainEntry(id: string): Promise<void> {
        await tablesDB.deleteRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_KEYCHAIN_ID,
            id
        );
    }

    static async setMasterpassFlag(userId: string, email: string): Promise<void> {
        try {
            const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
            const USERS_TABLE = 'users'; // Standard user table in Flow

            const res = await tablesDB.listRows<any>({
                databaseId: FLOW_DB,
                tableId: USERS_TABLE,
                queries: [Query.equal("userId", userId)]
            });

            if (res.total > 0) {
                await tablesDB.updateRow(FLOW_DB, USERS_TABLE, res.rows[0].$id, {
                    hasMasterpass: true
                });
            } else {
                const { ID } = await import("appwrite");
                await tablesDB.createRow(FLOW_DB, USERS_TABLE, ID.unique(), {
                    userId,
                    email,
                    hasMasterpass: true
                });
            }
        } catch (_e: unknown) {
            console.error('setMasterpassFlag error', _e);
        }
    }
}

export function getFilePreview(bucketId: string, fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(bucketId, fileId, width, height);
}

export function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return getFilePreview("profile_pictures", fileId, width, height);
}

const PULSE_COOKIE_NAME = 'kylrix_pulse_v2';
const AVATAR_CACHE_PREFIX = 'kylrix_avatar_pulse_v2_';

export function getKylrixPulse(): { $id: string; name: string; profilePicId?: string | null; avatarBase64?: string | null } | null {
    if (typeof window === 'undefined') return null;
    if ((window as any).__KYLRIX_PULSE__) return (window as any).__KYLRIX_PULSE__;

    try {
        const match = document.cookie.match(new RegExp('(^| )' + PULSE_COOKIE_NAME + '=([^;]+)'));
        if (match) {
            const basic = JSON.parse(decodeURIComponent(match[2]));
            const avatar = localStorage.getItem(AVATAR_CACHE_PREFIX + basic.$id);
            return { ...basic, avatarBase64: avatar };
        }
    } catch (_e) {}
    return null;
}

function getCookieDomain(): string {
    if (typeof window === 'undefined') return '';
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.includes('192.168.')) {
        return '';
    }
    const configuredDomain = APPWRITE_CONFIG.SYSTEM.DOMAIN || 'kylrix.space';
    if (hostname === configuredDomain || hostname.endsWith(`.${configuredDomain}`)) {
        return `domain=.${configuredDomain}; `;
    }
    return '';
}

export function setKylrixPulse(user: any, avatarBase64?: string | null) {
    if (typeof window === 'undefined') return;
    try {
        const pulse = {
            $id: user.$id,
            name: user.name || user.username || 'User',
            profilePicId: user.prefs?.profilePicId || user.profilePicId || null
        };
        
        const domainStr = getCookieDomain();
        document.cookie = `${PULSE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(pulse))}; path=/; ${domainStr}max-age=31536000; SameSite=Lax`;
        if (avatarBase64) localStorage.setItem(AVATAR_CACHE_PREFIX + user.$id, avatarBase64);
        (window as any).__KYLRIX_PULSE__ = { ...pulse, avatarBase64: avatarBase64 || localStorage.getItem(AVATAR_CACHE_PREFIX + user.$id) };
    } catch (_e) {}
}

export function clearKylrixPulse() {
    if (typeof window === 'undefined') return;
    const domainStr = getCookieDomain();
    if (domainStr) {
        document.cookie = `${PULSE_COOKIE_NAME}=; path=/; ${domainStr}expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    document.cookie = `${PULSE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    delete (window as any).__KYLRIX_PULSE__;
    document.documentElement.removeAttribute('data-kylrix-pulse');
}

export async function getCurrentUser(force = false): Promise<any | null> {
    if (!force) {
        hydrateCurrentUserCache();
        const now = Date.now();
        if (currentUserCache && currentUserCache.expiresAt > now) {
            return currentUserCache.user;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const snap = readCurrentUserSnapshot();
            if (snap?.user) return snap.user;
        }
    }

    if (currentUserInFlight) {
        return currentUserInFlight;
    }

    currentUserInFlight = withNetworkTimeout(account.get())
        .then((user) => {
            const forcedAt = Date.now();
            currentUserCache = { 
                user, 
                expiresAt: Date.now() + CURRENT_USER_CACHE_TTL,
                lastForcedAt: forcedAt
            };
            writeCurrentUserSnapshot(user, forcedAt);
            setKylrixPulse(user);
            emitCurrentUserChange(user);
            return user;
        })
        .catch((error: any) => {
            const isUnauthorized =
                error?.code === 401 ||
                error?.code === 'user_unauthorized' ||
                error?.code === 'user_session_not_found' ||
                String(error?.message || '').toLowerCase().includes('unauthorized') ||
                String(error?.message || '').toLowerCase().includes('missing scope') ||
                String(error?.message || '').toLowerCase().includes('not found');

            if (isUnauthorized) {
                invalidateCurrentUserCache();
                return null;
            }

            // Network/timeout blips must not log the user out mid-navigation or offline.
            const snap = readCurrentUserSnapshot();
            if (snap?.user) {
                return snap.user;
            }
            if (currentUserCache?.user) {
                return currentUserCache.user;
            }
            return null;
        })
        .finally(() => {
            currentUserInFlight = null;
        });

    return currentUserInFlight;
}

export function invalidateCurrentUserCache() {
    currentUserCache = null;
    currentUserInFlight = null;
    writeCurrentUserSnapshot(null);
    clearKylrixPulse();
    emitCurrentUserChange(null);
}

export function onCurrentUserChanged(listener: (user: any | null) => void) {
    currentUserListeners.add(listener);
    return () => {
        currentUserListeners.delete(listener);
    };
}

export const globalSessionPromise = typeof window !== 'undefined' && hasAuthSessionHint()
    ? getCurrentUser().catch(() => null)
    : Promise.resolve(null);

// --- USER SESSION ---

// Unified resolver: attempts global session then cookie-based fallback
export async function resolveCurrentUser(req?: { headers: { get(k: string): string | null } } | null): Promise<any | null> {
    const direct = await getCurrentUser();
    if (direct && direct.$id) return direct;
    if (req) {
        const fallback = await getCurrentUserFromRequest(req as any);
        if (fallback && (fallback as any).$id) return fallback;
    }
    return null;
}

// Per-request user fetch using incoming Cookie header
export async function getCurrentUserFromRequest(req: { headers: { get(k: string): string | null } } | null | undefined): Promise<any | null> {
    try {
        if (!req) return null;
        const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
        if (!cookieHeader) return null;

        const res = await fetch(`${APPWRITE_CONFIG.ENDPOINT}/account`, {
            method: 'GET',
            headers: {
                'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
                'Cookie': cookieHeader,
                'Accept': 'application/json'
            },
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || typeof data !== 'object' || !data.$id) return null;
        return data;
    } catch (_e: unknown) {
        console.error('getCurrentUserFromRequest error', _e);
        return null;
    }
}
