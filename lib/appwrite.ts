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
export const APPWRITE_BUCKET_PROFILE_PICTURES = APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES;

export { ID, Query };

export function getFilePreview(bucketId: string, fileId: string, width: number = 64, height: number = 64) {
    return storage.getFilePreview(bucketId, fileId, width, height);
}

export function getProfilePicturePreview(fileId: string, width: number = 64, height: number = 64) {
    return getFilePreview("profile_pictures", fileId, width, height);
}

// --- KYLRIX PULSE (NEW ISOLATED CACHE) ---

const PULSE_KEY = 'kylrix_pulse_v1';

export interface KylrixPulse {
    $id: string;
    name: string;
    avatarBase64?: string | null;
}

export function getKylrixPulse(): KylrixPulse | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(PULSE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setKylrixPulse(user: any, avatarBase64?: string | null) {
    if (typeof window === 'undefined') return;
    try {
        const current = getKylrixPulse();
        const pulse: KylrixPulse = {
            $id: user.$id,
            name: user.name || user.username || 'User',
            avatarBase64: avatarBase64 || (current?.$id === user.$id ? current?.avatarBase64 : null)
        };
        localStorage.setItem(PULSE_KEY, JSON.stringify(pulse));
    } catch (e) {
        console.warn('[Pulse] Quota exceeded or storage failure');
    }
}

export function clearKylrixPulse() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PULSE_KEY);
}

// --- USER SESSION ---

export async function getCurrentUser(): Promise<any | null> {
    try {
        return await account.get();
    } catch {
        return null;
    }
}

// Compatibility placeholders
export function getCurrentUserSnapshot() { return null; }
export function invalidateCurrentUserCache() { clearKylrixPulse(); }
export function getIdentityCollateral() { return null; }
export function setIdentityCollateral() {}
export function clearIdentityCollateral() {}

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
    } catch {
        return null;
    }
}
