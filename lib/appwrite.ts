import { Client, Account, Databases, Storage, ID, Query, Realtime, TablesDB } from 'appwrite';
import { APPWRITE_CONFIG } from './appwrite/config';

export const APPWRITE_ENDPOINT = 'https://api.kylrix.space/v1';
export const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const realtime = new Realtime(client);
export const tablesDB = new TablesDB(client);

export { client };

export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
export const APPWRITE_TABLE_ID_USERS = APPWRITE_CONFIG.TABLES.NOTE.USERS;
export const APPWRITE_DATABASE_ID_CONNECT = APPWRITE_CONFIG.DATABASES.CONNECT;
export const APPWRITE_TABLE_ID_CONNECT_USERS = APPWRITE_CONFIG.TABLES.CONNECT.USERS;
export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

export { ID, Query };

export function getFilePreview(bucketId: string, fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(bucketId, fileId, width, height);
}

export function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return getFilePreview("profile_pictures", fileId, width, height);
}

// --- USER SESSION ---

type CurrentUserSnapshot = {
    user: any;
    expiresAt: number;
};

let currentUserCache: CurrentUserSnapshot | null = null;
let currentUserInFlight: Promise<any | null> | null = null;
const CURRENT_USER_CACHE_TTL = 5000;
const CURRENT_USER_CACHE_KEY = 'kylrix_landing_current_user_v1';

function canUseStorage() {
    return typeof window !== 'undefined';
}

function readCurrentUserSnapshot() {
    if (!canUseStorage()) return null;
    try {
        const raw = localStorage.getItem(CURRENT_USER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CurrentUserSnapshot;
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

export function invalidateCurrentUserCache(nextValue?: any | null) {
    currentUserCache = nextValue
        ? { user: nextValue, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL }
        : null;
    currentUserInFlight = null;
    writeCurrentUserSnapshot(nextValue ?? null);
}

export async function getCurrentUser(): Promise<any | null> {
    try {
        hydrateCurrentUserCache();
        if (currentUserCache && currentUserCache.expiresAt > Date.now()) {
            return currentUserCache.user;
        }

        if (currentUserInFlight) {
            return currentUserInFlight;
        }

        currentUserInFlight = account.get()
            .then((user) => {
                currentUserCache = { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL };
                writeCurrentUserSnapshot(user);
                return user;
            })
            .catch(() => {
                currentUserCache = null;
                writeCurrentUserSnapshot(null);
                return null;
            })
            .finally(() => {
                currentUserInFlight = null;
            });

        return await currentUserInFlight;
    } catch {
        return null;
    }
}

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

        const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
            method: 'GET',
            headers: {
                'X-Appwrite-Project': APPWRITE_PROJECT_ID,
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

export async function getUser(userId: string) {
  return databases.getDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId
  );
}

export async function createUser(data: any) {
  return databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    data.id || ID.unique(),
    {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
}

export async function updateUser(userId: string, data: any) {
  return databases.updateDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_TABLE_ID_USERS,
    userId,
    {
      ...data,
      updatedAt: new Date().toISOString()
    }
  );
}

export async function getGlobalProfile(username: string) {
  try {
    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID_CONNECT,
      APPWRITE_TABLE_ID_CONNECT_USERS,
      [Query.equal('username', username.toLowerCase())]
    );
    return res.documents[0] || null;
  } catch (error) {
    console.error('getGlobalProfile error:', error);
    return null;
  }
}
