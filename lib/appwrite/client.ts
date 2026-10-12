import { APPWRITE_CONFIG } from './config';
import { systemTables } from '@/lib/data/system-tables';

export const databases = {
  createRow: <T = any>(dbId: string, tblId: string, rowId: string, data: any, permissions?: string[]): Promise<T> =>
    systemTables().createRow({ databaseId: dbId, tableId: tblId, rowId, data, permissions }),
  updateRow: <T = any>(dbId: string, tblId: string, rowId: string, data: any, permissions?: string[]): Promise<T> =>
    systemTables().updateRow({ databaseId: dbId, tableId: tblId, rowId, data, permissions }),
  getRow: <T = any>(dbId: string, tblId: string, rowId: string): Promise<T> =>
    systemTables().getRow({ databaseId: dbId, tableId: tblId, rowId }),
  listRows: <T = any>(dbId: string, tblId: string, queries?: any[]): Promise<{ total: number; rows: T[] }> =>
    systemTables().listRows({ databaseId: dbId, tableId: tblId, queries }),
  deleteRow: (dbId: string, tblId: string, rowId: string): Promise<void> =>
    systemTables().deleteRow({ databaseId: dbId, tableId: tblId, rowId }),
};

export const tablesDB: any = databases;
export const account: any = {
  get: async () => getCurrentUser(),
  listSessions: async () => ({ sessions: [] }),
  deleteSession: async () => ({}),
  deleteSessions: async () => ({}),
};

export const realtime: any = {
  subscribe: (channels: any, callback: any) => {
    if (typeof window === 'undefined') return () => {};
    try {
      const { partyRealtime } = require('@/lib/realtime/partykit');
      return partyRealtime.subscribe(channels, callback);
    } catch {
      return () => {};
    }
  },
};

export const storage: any = {
  getFilePreview: () => '',
};

export const client: any = {
  setEndpoint: () => client,
  setProject: () => client,
};

export function getSessionTablesDB(): any {
  return tablesDB;
}

export const APPWRITE_BUCKET_BACKUPS_ID = APPWRITE_CONFIG.BUCKETS.BACKUPS;
export const APPWRITE_BUCKET_PROFILE_PICTURES_ID = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

export function getFilePreview(bucketId: string, fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(bucketId, fileId, width, height);
}

export function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return getFilePreview("profile_pictures", fileId, width, height);
}

let currentUserCache: { user: any | null; expiresAt: number; lastForcedAt?: number } | null = null;
let currentUserInFlight: Promise<any | null> | null = null;
const currentUserListeners = new Set<(user: any | null) => void>();
const CURRENT_USER_CACHE_TTL = 30000;
const CURRENT_USER_CACHE_KEY = 'kylrix_flow_current_user_v2';

export function hasAuthSessionHint(): boolean {
    if (typeof window === 'undefined') return false;
    if (getKylrixPulse()) return true;
    if (getCurrentUserSnapshot()) return true;
    return document.cookie.includes('a_session_');
}

function canUseStorage() {
    return typeof window !== 'undefined';
}

function readCurrentUserSnapshot(allowOfflineFallback: boolean = true) {
    if (!canUseStorage()) return null;
    try {
        const pid = localStorage.getItem('kylrix:activePartition') || 'acc_default';
        const cacheKey = `${CURRENT_USER_CACHE_KEY}_${pid}`;
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
            const parsed = JSON.parse(raw) as { user: any; expiresAt: number; lastForcedAt?: number };
            if (parsed?.user) {
                if (parsed.expiresAt > Date.now() || allowOfflineFallback || (typeof navigator !== 'undefined' && !navigator.onLine)) {
                    return parsed;
                }
            }
        }
        const lastUserKey = `kylrix_last_logged_in_user_${pid}`;
        const lastRaw = localStorage.getItem(lastUserKey);
        if (lastRaw) {
            const user = JSON.parse(lastRaw);
            if (user?.$id) {
                return { user, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL };
            }
        }
        return null;
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
    } catch {}
}

function emitCurrentUserChange(user: any | null) {
    for (const listener of currentUserListeners) {
        listener(user);
    }
}

function hydrateCurrentUserCache() {
    if (currentUserCache && currentUserCache.expiresAt > Date.now()) return;
    const snapshot = readCurrentUserSnapshot();
    if (snapshot) {
        currentUserCache = snapshot;
    }
}

export function getCurrentUserSnapshot() {
    hydrateCurrentUserCache();
    return currentUserCache?.user ?? null;
}

export function isCurrentUserSnapshotFresh() {
    hydrateCurrentUserCache();
    return Boolean(currentUserCache && currentUserCache.expiresAt > Date.now());
}

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

            const res = await tablesDB.listRows({
                databaseId: FLOW_DB,
                tableId: USERS_TABLE,
                queries: [`equal("userId", ${JSON.stringify(userId)})`]
            }).catch(() => null);

            if (res && res.total > 0 && res.rows[0].hasMasterpass) {
                return true;
            }
            const entries = await this.listKeychainEntries(userId);
            return entries.some((e: any) => e.type === 'password' || e.type === 'passkey');
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
                    const res = await tablesDB.listRows({
                        databaseId: APPWRITE_DATABASE_ID,
                        tableId: APPWRITE_COLLECTION_KEYCHAIN_ID,
                        queries: [`equal("userId", ${JSON.stringify(userId)})`]
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
        return await tablesDB.createRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_KEYCHAIN_ID,
            crypto.randomUUID(),
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
            const USERS_TABLE = 'users';

            const res = await tablesDB.listRows({
                databaseId: FLOW_DB,
                tableId: USERS_TABLE,
                queries: [`equal("userId", ${JSON.stringify(userId)})`]
            });

            if (res.total > 0) {
                await tablesDB.updateRow(FLOW_DB, USERS_TABLE, res.rows[0].$id, {
                    hasMasterpass: true
                });
            } else {
                await tablesDB.createRow(FLOW_DB, USERS_TABLE, crypto.randomUUID(), {
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
        const resolvedName = (user.name && user.name.trim() !== 'User')
            ? user.name
            : (user.username || user.email?.split('@')[0] || (user.$id ? `Account ${user.$id.slice(0, 8)}` : 'Local Account'));
        const pulse = {
            $id: user.$id,
            name: resolvedName,
            profilePicId: user.prefs?.profilePicId || user.profilePicId || null
        };
        
        const domainStr = getCookieDomain();
        const secureStr = window.location.protocol === 'https:' ? 'Secure; ' : '';
        document.cookie = `${PULSE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(pulse))}; path=/; ${domainStr}${secureStr}max-age=31536000; SameSite=Lax`;
        if (avatarBase64) localStorage.setItem(AVATAR_CACHE_PREFIX + user.$id, avatarBase64);
        (window as any).__KYLRIX_PULSE__ = { ...pulse, avatarBase64: avatarBase64 || localStorage.getItem(AVATAR_CACHE_PREFIX + user.$id) };
    } catch (_e) {}
}

export function clearKylrixPulse() {
    if (typeof window === 'undefined') return;
    const domainStr = getCookieDomain();
    const secureStr = window.location.protocol === 'https:' ? 'Secure; ' : '';
    if (domainStr) {
        document.cookie = `${PULSE_COOKIE_NAME}=; path=/; ${domainStr}${secureStr}expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }
    document.cookie = `${PULSE_COOKIE_NAME}=; path=/; ${secureStr}expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    delete (window as any).__KYLRIX_PULSE__;
    document.documentElement.removeAttribute('data-kylrix-pulse');
}

export async function salvageUserFromLocalSubstrate(): Promise<any | null> {
    if (!canUseStorage()) return null;
    
    const snap = readCurrentUserSnapshot(true);
    if (snap?.user?.$id) return snap.user;

    const pulse = getKylrixPulse();
    if (pulse?.$id) {
        return {
            $id: pulse.$id,
            name: pulse.name || null,
            email: null,
            profilePicId: pulse.profilePicId || null,
            isPulse: true
        };
    }

    return null;
}

export async function getCurrentUser(force = false): Promise<any | null> {
    if (!force) {
        hydrateCurrentUserCache();
        const now = Date.now();
        if (currentUserCache && currentUserCache.expiresAt > now) {
            return currentUserCache.user;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const snap = readCurrentUserSnapshot(true);
            if (snap?.user) return snap.user;
            const salvaged = await salvageUserFromLocalSubstrate();
            if (salvaged) return salvaged;
        }
    }

    if (currentUserInFlight) {
        return currentUserInFlight;
    }

    currentUserInFlight = (async () => {
        try {
            const { authClient } = await import('@/lib/auth/better-auth-client');
            const betterSession = await authClient.getSession().catch(() => null);
            if (betterSession?.data?.user) {
                const bUser = betterSession.data.user;
                const mappedUser = {
                    $id: bUser.id,
                    id: bUser.id,
                    name: bUser.name || bUser.email || 'User',
                    email: bUser.email,
                    emailVerification: (bUser as any).emailVerified ?? true,
                    prefs: {},
                    isPulse: false,
                    authProvider: 'better-auth',
                    profilePicId: bUser.image || null,
                };
                const forcedAt = Date.now();
                currentUserCache = { 
                    user: mappedUser, 
                    expiresAt: Date.now() + CURRENT_USER_CACHE_TTL,
                    lastForcedAt: forcedAt
                };
                writeCurrentUserSnapshot(mappedUser, forcedAt);
                setKylrixPulse(mappedUser);
                emitCurrentUserChange(mappedUser);
                return mappedUser;
            }
        } catch {}

        const snap = readCurrentUserSnapshot(true);
        if (snap?.user) return snap.user;
        const salvaged = await salvageUserFromLocalSubstrate();
        if (salvaged) return salvaged;

        currentUserCache = null;
        return null;
    })().finally(() => {
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

export async function resolveCurrentUser(req?: { headers: { get(k: string): string | null } } | null): Promise<any | null> {
    const direct = await getCurrentUser();
    if (direct && direct.$id) return direct;
    if (req) {
        const fallback = await getCurrentUserFromRequest(req as any);
        if (fallback && (fallback as any).$id) return fallback;
    }
    return null;
}

export async function getCurrentUserFromRequest(req: { headers: { get(k: string): string | null } } | null | undefined): Promise<any | null> {
    try {
        if (!req) return null;
        const { auth } = await import('@/lib/auth/better-auth');
        const session = await auth.api.getSession({
            headers: req.headers as any,
        }).catch(() => null);
        if (session?.user) {
            return {
                $id: session.user.id,
                id: session.user.id,
                name: session.user.name || session.user.email || 'User',
                email: session.user.email,
                emailVerification: (session.user as any).emailVerified ?? true,
                prefs: {},
                isPulse: false,
                authProvider: 'better-auth',
                profilePicId: session.user.image || null,
            };
        }
        return null;
    } catch (_e: unknown) {
        return null;
    }
}
