import { Client, TablesDB, Storage, Account, Realtime } from "appwrite";
import { APPWRITE_CONFIG } from "./config";

const client = new Client();

const initAppwrite = () => {
    if (typeof APPWRITE_CONFIG === 'undefined') return;
    
    // Use the api subdomain for the endpoint
    const endpoint = `https://api.kylrix.space/v1`;
    client.setEndpoint(endpoint);

    if (APPWRITE_CONFIG.PROJECT_ID) {
        client.setProject(APPWRITE_CONFIG.PROJECT_ID);
    }
};

initAppwrite();

export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const account = new Account(client);
export const realtime = new Realtime(client);
export { client };

let currentUserCache: { user: any | null; expiresAt: number } | null = null;
let currentUserInFlight: Promise<any | null> | null = null;
const CURRENT_USER_CACHE_TTL = 5000;
const CURRENT_USER_CACHE_KEY = 'kylrix_flow_current_user_v1';

function canUseStorage() {
    return typeof window !== 'undefined';
}

function readCurrentUserSnapshot() {
    if (!canUseStorage()) return null;
    try {
        const raw = localStorage.getItem(CURRENT_USER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { user: any; expiresAt: number };
        if (!parsed?.user || parsed.expiresAt <= Date.now()) {
            localStorage.removeItem(CURRENT_USER_CACHE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function writeCurrentUserSnapshot(user: any | null) {
    if (!canUseStorage()) return;
    try {
        if (!user) {
            localStorage.removeItem(CURRENT_USER_CACHE_KEY);
            return;
        }
        localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify({
            user,
            expiresAt: Date.now() + CURRENT_USER_CACHE_TTL,
        }));
    } catch {
        // Best effort only.
    }
}

function hydrateCurrentUserCache() {
    if (currentUserCache) return;
    const snapshot = readCurrentUserSnapshot();
    if (snapshot) {
        currentUserCache = snapshot;
    }
}

export function getCurrentUserSnapshot() {
    hydrateCurrentUserCache();
    return currentUserCache && currentUserCache.expiresAt > Date.now() ? currentUserCache.user : null;
}

import { Query } from "appwrite";

export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const APPWRITE_COLLECTION_KEYCHAIN_ID = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

export class AppwriteService {
    static async hasMasterpass(userId: string): Promise<boolean> {
        try {
            const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
            const USERS_TABLE = 'users';

            const res = await tablesDB.listRows<any>({
                databaseId: FLOW_DB,
                tableId: USERS_TABLE,
                queries: [Query.equal("userId", userId)]
            });

            if (res.total > 0 && res.rows[0].hasMasterpass) {
                return true;
            }
            const entries = await this.listKeychainEntries(userId);
            return entries.some(e => e.type === 'password');
        } catch (_e: unknown) {
            console.error('hasMasterpass error', _e);
            return false;
        }
    }

    static async listKeychainEntries(userId: string): Promise<any[]> {
        try {
            const res = await tablesDB.listRows<any>({
                databaseId: APPWRITE_DATABASE_ID,
                tableId: APPWRITE_COLLECTION_KEYCHAIN_ID,
                queries: [Query.equal("userId", userId)]
            });
            return res.rows;
        } catch (_e: unknown) {
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

export async function getCurrentUser(force = false): Promise<any | null> {
    hydrateCurrentUserCache();

    if (!force && currentUserCache && currentUserCache.expiresAt > Date.now()) {
        return currentUserCache.user;
    }

    if (!force && currentUserInFlight) {
        return currentUserInFlight;
    }

    currentUserInFlight = account.get()
        .then((user) => {
            currentUserCache = { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL };
            writeCurrentUserSnapshot(user);
            return user;
        })
        .catch((error) => {
            currentUserCache = null;
            writeCurrentUserSnapshot(null);
            return null;
        })
        .finally(() => {
            currentUserInFlight = null;
        });

    return currentUserInFlight;
}

export function invalidateCurrentUserCache() {
    currentUserCache = null;
    writeCurrentUserSnapshot(null);
}

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
