import { Client, Account, Databases, Storage, ID, Query, Realtime, TablesDB } from 'appwrite';
import { APPWRITE_CONFIG } from './appwrite/config';

export const APPWRITE_ENDPOINT = 'https://api.kylrix.space/v1';
export const APPWRITE_PROJECT_ID = APPWRITE_CONFIG.PROJECT_ID;

// Client is initialized lazily or with a safe check
const getAppwriteClient = () => {
  const client = new Client();
  const endpoint = APPWRITE_ENDPOINT;
  const project = APPWRITE_PROJECT_ID;

  client.setEndpoint(endpoint);
  if (project) client.setProject(project);

  return client;
};

// Services are getters to ensure client is ready and to avoid top-level side effects during build
let _client: Client | null = null;
export const getClient = () => {
  if (!_client) _client = getAppwriteClient();
  return _client;
};

let _account: Account | null = null;
export const getAccount = () => {
  if (!_account) _account = new Account(getClient());
  return _account;
};

let _databases: Databases | null = null;
export const getDatabases = () => {
  if (!_databases) _databases = new Databases(getClient());
  return _databases;
};

let _storage: Storage | null = null;
export const getStorage = () => {
  if (!_storage) _storage = new Storage(getClient());
  return _storage;
};

let _realtime: Realtime | null = null;
export const getRealtime = () => {
  if (!_realtime) _realtime = new Realtime(getClient());
  return _realtime;
};

export const client = getClient();
export const account = getAccount();
export const databases = getDatabases();
export const storage = getStorage();
export const realtime = getRealtime();
export const tablesDB = new TablesDB(client);

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

export async function getCurrentUser(): Promise<any | null> {
    try {
        return await account.get();
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
