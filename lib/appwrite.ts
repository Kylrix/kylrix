import { Client, Account, Databases, Storage, ID, Query, Realtime, TablesDB } from 'appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

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

export async function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId, width, height);
}

export { client, ID, Query, Realtime };
// --- Database & Collection IDs ---
// Note Database
export const APPWRITE_DATABASE_ID = APPWRITE_CONFIG.DATABASES.NOTE;
export const APPWRITE_TABLE_ID_PROFILES = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const APPWRITE_TABLE_ID_USERS = APPWRITE_TABLE_ID_PROFILES; // legacy alias
export const APPWRITE_TABLE_ID_NOTES = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
export const APPWRITE_TABLE_ID_TAGS = APPWRITE_CONFIG.TABLES.NOTE.TAGS;
export const APPWRITE_TABLE_ID_APIKEYS = APPWRITE_CONFIG.TABLES.NOTE.APIKEYS;
export const APPWRITE_TABLE_ID_COMMENTS = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
export const APPWRITE_TABLE_ID_EXTENSIONS = APPWRITE_CONFIG.TABLES.NOTE.EXTENSIONS;
export const APPWRITE_TABLE_ID_REACTIONS = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
export const APPWRITE_TABLE_ID_COLLABORATORS = APPWRITE_CONFIG.TABLES.NOTE.COLLABORATORS;
export const APPWRITE_TABLE_ID_ACTIVITYLOG = APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG;
export const APPWRITE_TABLE_ID_SETTINGS = APPWRITE_CONFIG.TABLES.NOTE.SETTINGS;
export const APPWRITE_TABLE_ID_SUBSCRIPTIONS = APPWRITE_CONFIG.TABLES.NOTE.SUBSCRIPTIONS;
export const APPWRITE_TABLE_ID_NOTETAGS = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS;

// Flow Database
export const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
export const FLOW_COLLECTION_ID_TASKS = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
export const FLOW_COLLECTION_ID_EVENTS = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;

// Vault (Keep) Database
export const KEEP_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const KEEP_COLLECTION_ID_CREDENTIALS = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const KEEP_COLLECTION_ID_KEYCHAIN = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;

// Vault Collection IDs
export const APPWRITE_COLLECTION_CREDENTIALS_ID = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
export const APPWRITE_COLLECTION_TOTPSECRETS_ID = APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS;
export const APPWRITE_COLLECTION_FOLDERS_ID = APPWRITE_CONFIG.TABLES.VAULT.FOLDERS;
export const APPWRITE_COLLECTION_SECURITYLOGS_ID = APPWRITE_CONFIG.TABLES.VAULT.SECURITY_LOGS;
export const APPWRITE_COLLECTION_USER_ID = APPWRITE_CONFIG.TABLES.VAULT.USER;
export const APPWRITE_COLLECTION_KEYCHAIN_ID = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;
export const APPWRITE_COLLECTION_KEY_MAPPING_ID = APPWRITE_CONFIG.TABLES.VAULT.KEY_MAPPING;
export const APPWRITE_COLLECTION_IDENTITIES_ID = APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES;

// Connect Database
export const CONNECT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CONNECT_COLLECTION_ID_USERS = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const CONNECT_COLLECTION_ID_MOMENTS = APPWRITE_CONFIG.TABLES.CHAT.MOMENTS;

// --- Storage Buckets ---
export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;
export const APPWRITE_BUCKET_NOTES_ATTACHMENTS = APPWRITE_CONFIG.BUCKETS.NOTES_ATTACHMENTS;
export const APPWRITE_BUCKET_EXTENSION_ASSETS = APPWRITE_CONFIG.BUCKETS.EXTENSION_ASSETS;
export const APPWRITE_BUCKET_BACKUPS = APPWRITE_CONFIG.BUCKETS.BACKUPS;
export const APPWRITE_BUCKET_TEMP_UPLOADS = APPWRITE_CONFIG.BUCKETS.TEMP_UPLOADS;
export const APPWRITE_BUCKET_BACKUPS_ID = "backups";
export const APPWRITE_BUCKET_ENCRYPTED_BACKUPS_ID = "encryptedDataBackups";
export const APPWRITE_BUCKET_SECURE_DOCUMENTS_ID = "secureDocuments";

// --- App URI ---
export const APP_URI = process.env.NEXT_PUBLIC_APP_URI ?? `https://app.${APPWRITE_CONFIG.SYSTEM.DOMAIN}`;


// --- UNIFIED DOMAIN PULSE (CROSS-SUBDOMAIN INSTANT IDENTITY) ---
const PULSE_COOKIE_NAME = 'kylrix_pulse_v2';
const AVATAR_CACHE_PREFIX = 'kylrix_avatar_pulse_v2_';

export interface KylrixPulse {
    $id: string;
    name: string;
    profilePicId?: string | null;
    avatarBase64?: string | null;
}

export function getKylrixPulse(): KylrixPulse | null {
    if (typeof window === 'undefined') return null;
    if ((window as any).__KYLRIX_PULSE__) return (window as any).__KYLRIX_PULSE__;
    
    try {
        const match = document.cookie.match(new RegExp('(^| )' + PULSE_COOKIE_NAME + '=([^;]+)'));
        if (match) {
            const basic = JSON.parse(decodeURIComponent(match[2]));
            const avatar = localStorage.getItem(AVATAR_CACHE_PREFIX + basic.$id);
            return { ...basic, avatarBase64: avatar };
        }
    } catch (e) {}
    return null;
}

export function setKylrixPulse(user: any, avatarBase64?: string | null) {
    if (typeof window === 'undefined') return;
    try {
        const pulse = {
            $id: user.$id,
            name: user.name || user.username || 'User',
            profilePicId: user.prefs?.profilePicId || user.profilePicId || null
        };
        const domain = 'kylrix.space';
        document.cookie = `${PULSE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(pulse))}; path=/; domain=.${domain}; max-age=31536000; SameSite=Lax`;
        if (avatarBase64) localStorage.setItem(AVATAR_CACHE_PREFIX + user.$id, avatarBase64);
        (window as any).__KYLRIX_PULSE__ = { ...pulse, avatarBase64: avatarBase64 || localStorage.getItem(AVATAR_CACHE_PREFIX + user.$id) };
    } catch (e) {}
}

export function clearKylrixPulse() {
    if (typeof window === 'undefined') return;
    const domain = 'kylrix.space';
    document.cookie = `${PULSE_COOKIE_NAME}=; path=/; domain=.${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    delete (window as any).__KYLRIX_PULSE__;
    document.documentElement.removeAttribute('data-kylrix-pulse');
}

// Initialize session only if there's an existing session cookie (avoid auth errors for guests)
export const globalSessionPromise = typeof window !== 'undefined' 
  ? (async () => {
      try {
        // Check if there's an active session cookie before calling account.get()
        const hasCookie = document.cookie.includes('a_session');
        if (!hasCookie) return null;
        return await account.get();
      } catch (error) {
        // Silently fail for unauthenticated users
        return null;
      }
    })()
  : Promise.resolve(null);

export async function getCurrentUser(): Promise<any | null> {
    return await globalSessionPromise;
}

export async function getCurrentUserFromRequest(req: { headers: { get(k: string): string | null } } | null | undefined): Promise<any | null> {
    try {
        if (!req) return null;
        const cookieHeader = req.headers.get('cookie') || req.headers.get('Cookie');
        if (!cookieHeader) return null;
        const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
            method: 'GET',
            headers: { 'X-Appwrite-Project': APPWRITE_PROJECT_ID, 'Cookie': cookieHeader, 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data && data.$id) ? data : null;
    } catch { return null; }
}


// --- AppwriteService Utility Class ---
export class AppwriteService {
  static async getGlobalProfileStatus(userId: string) {
    try {
      const res = await databases.listDocuments(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, [
        Query.equal('userId', userId),
        Query.limit(1)
      ]);
      if (res.total > 0) {
        return { exists: true, profile: res.documents[0] };
      }
      return { exists: false, error: 'Not Found' };
    } catch (e: unknown) {
      return { exists: false, error: (e as any).message };
    }
  }

  static async hasMasterpass(userId: string): Promise<boolean> {
    try {
      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_USERS,
        [Query.equal('userId', userId), Query.limit(1)]
      );
      if (res.total > 0 && res.documents[0].hasMasterpass) {
        return true;
      }
      const entries = await this.listKeychainEntries(userId);
      return entries.some(e => e.type === 'password');
    } catch (e: any) {
      console.error('hasMasterpass error', e);
      return false;
    }
  }

  static async listKeychainEntries(userId: string): Promise<any[]> {
    try {
      const response = await databases.listDocuments(
        KEEP_DATABASE_ID,
        KEEP_COLLECTION_ID_KEYCHAIN,
        [Query.equal("userId", userId)],
      );
      return response.documents;
    } catch (e: any) {
      console.error('listKeychainEntries error', e);
      return [];
    }
  }

  static async createKeychainEntry(data: any): Promise<any> {
    return await databases.createDocument(
      KEEP_DATABASE_ID,
      KEEP_COLLECTION_ID_KEYCHAIN,
      ID.unique(),
      data
    );
  }

  /**
   * Create a Ghost Note (Anonymous)
   */
  static async createGhostNote(data: { title: string; content: string; format?: string; ghostSecret: string; expiresAt?: string; isEncrypted?: boolean }): Promise<any> {
    const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = JSON.stringify({
      isGhost: true,
      ghostSecret: data.ghostSecret,
      expiresAt: expiresAt,
      version: 'v2',
      isEncrypted: data.isEncrypted || false
    });

    const noteData = {
      title: data.title,
      content: data.content,
      format: data.format || 'markdown',
      isPublic: true,
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'published',
      metadata: metadata,
      tags: [],
      comments: [],
      extensions: [],
      collaborators: [],
      attachments: null
    };

    return await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_TABLE_ID_NOTES,
      ID.unique(),
      noteData,
      [
        Permission.read(Role.any()),
        // No update/delete for ghosts until claimed
      ]
    );
  }

  static async deleteKeychainEntry(id: string): Promise<boolean> {
    try {
      await databases.deleteDocument(
        KEEP_DATABASE_ID,
        KEEP_COLLECTION_ID_KEYCHAIN,
        id
      );
      return true;
    } catch (e: any) {
      console.error('deleteKeychainEntry error', e);
      return false;
    }
  }

  static async setMasterpassFlag(userId: string, email: string) {
    try {
      // Check if user doc exists in NOTE database
      const res = await databases.listDocuments(
        APPWRITE_DATABASE_ID,
        APPWRITE_TABLE_ID_USERS,
        [Query.equal('userId', userId), Query.limit(1)]
      );

      if (res.total > 0) {
        await databases.updateDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          res.documents[0].$id,
          { hasMasterpass: true }
        );
      } else {
        // Create user doc if it doesn't exist
        await databases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_TABLE_ID_USERS,
          ID.unique(),
          { userId, email, hasMasterpass: true }
        );
      }
    } catch (e: any) {
      console.error('setMasterpassFlag error', e);
    }
  }
}
