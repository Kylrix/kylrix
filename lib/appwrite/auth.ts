import { ID, Query, Permission, Role } from 'appwrite';
import { account, databases, tablesDB, getCurrentUser } from './client';
import { APPWRITE_CONFIG } from './config';

export const CONNECT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
export const CONNECT_COLLECTION_ID_USERS = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
export const VAULT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.VAULT;
export const VAULT_COLLECTION_ID_KEYCHAIN = APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN;
export const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;

export class AppwriteService {
  /**
   * Universal Identity Hook: Ensures the user is linked in the global directory.
   */
  static async ensureGlobalProfile(user: any, force = false) {
    if (!user?.$id || typeof window === 'undefined') return null;

    const SYNC_CACHE_KEY = 'kylrix_identity_synced_v3';
    const SESSION_SYNC_KEY = 'kylrix_session_identity_ok_v3';

    if (!force && sessionStorage.getItem(SESSION_SYNC_KEY)) return null;
    const lastSync = localStorage.getItem(SYNC_CACHE_KEY);
    if (!force && lastSync && (Date.now() - parseInt(lastSync)) < 24 * 60 * 60 * 1000) {
      sessionStorage.setItem(SESSION_SYNC_KEY, '1');
      return null;
    }

    try {
      const [prefs, profileStatus] = await Promise.all([
        account.getPrefs(),
        this.getGlobalProfileStatus(user.$id)
      ]);
      const profile = profileStatus.exists ? profileStatus.profile : null;

      const email = user.email || (user as any).email;
      const name = user.name || (user as any).name;
      let derivedUsername = prefs?.username || '';
      
      if (!derivedUsername && name) {
        derivedUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
      }
      if (!derivedUsername && email) {
        derivedUsername = email.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 32);
      }

      if (!derivedUsername) return null;

      const baseData: any = {
        username: derivedUsername,
        displayName: name || derivedUsername,
        userId: user.$id,
        tier: prefs?.tier || 'FREE'
      };

      if (!profile) {
        await databases.createDocument(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, ID.unique(), baseData, [Permission.read(Role.any())]);
      } else if (profile.username !== derivedUsername || profile.tier !== baseData.tier) {
        await databases.updateDocument(CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, profile.$id, baseData);
      }

      localStorage.setItem(SYNC_CACHE_KEY, Date.now().toString());
      sessionStorage.setItem(SESSION_SYNC_KEY, '1');
      return { success: true, username: derivedUsername };
    } catch (e) {
      console.warn('[Identity] Sync deferred:', e);
      return null;
    }
  }

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
      // Check Keychain first
      const entries = await this.listKeychainEntries(userId);
      if (entries.length > 0) return true;

      // Fallback to Flow user table flag
      const USERS_TABLE = 'users';
      const res = await tablesDB.listRows<any>({
        databaseId: FLOW_DATABASE_ID,
        tableId: USERS_TABLE,
        queries: [Query.equal("userId", userId)]
      });

      return res.total > 0 && res.rows[0].hasMasterpass;
    } catch (e: any) {
      console.error('hasMasterpass error', e);
      return false;
    }
  }

  static async listKeychainEntries(userId: string): Promise<any[]> {
    try {
      const response = await databases.listDocuments(
        VAULT_DATABASE_ID,
        VAULT_COLLECTION_ID_KEYCHAIN,
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
      VAULT_DATABASE_ID,
      VAULT_COLLECTION_ID_KEYCHAIN,
      ID.unique(),
      data
    );
  }

  static async deleteKeychainEntry(id: string): Promise<void> {
    await databases.deleteDocument(
      VAULT_DATABASE_ID,
      VAULT_COLLECTION_ID_KEYCHAIN,
      id
    );
  }

  static async createGhostNote(data: { title: string; content: string; format?: string; ghostSecret: string; expiresAt?: string; isEncrypted?: boolean }): Promise<any> {
    const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = JSON.stringify({
      isGhost: true,
      ghostSecret: data.ghostSecret,
      expiresAt: expiresAt,
      version: 'v2',
      isEncrypted: data.isEncrypted || false
    });

    return await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      ID.unique(),
      {
        title: data.title,
        content: data.content,
        format: data.format || 'markdown',
        isPublic: true,
        userId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata
      },
      [Permission.read(Role.any())]
    );
  }

  /**
   * Send by Kylrix: same storage as ghost notes (no userId, public read) but metadata includes
   * `send_object` so clients render password / TOTP / task payloads instead of plain notes.
   * Coexists with classic ghost notes (those omit `send_object`).
   */
  static async createSendGhostObject(data: {
    title: string;
    content: string;
    format?: string;
    ghostSecret: string;
    expiresAt?: string;
    isEncrypted?: boolean;
    sendObject: { kind: string };
  }): Promise<any> {
    const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = JSON.stringify({
      isGhost: true,
      send_object: data.sendObject,
      ghostSecret: data.ghostSecret,
      expiresAt,
      version: 'v2',
      isEncrypted: data.isEncrypted ?? false,
    });

    return await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      ID.unique(),
      {
        title: data.title,
        content: data.content,
        format: data.format || 'markdown',
        isPublic: true,
        userId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata,
      },
      [Permission.read(Role.any())]
    );
  }
}
