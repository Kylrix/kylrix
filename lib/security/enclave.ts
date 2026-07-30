/**
 * Security Enclave — LocalEngine partition for vault crypto material.
 * Rows stay encrypted-as-is (same ciphertext as Appwrite). Never stores MEK/plaintext.
 *
 * Canonical keys (with legacy aliases for migration):
 * - sec_enclave_keychain_{userId}
 * - sec_enclave_userdoc_{userId}
 * - sec_enclave_identity_{userId}   (e2e_connect identity row)
 * - sec_enclave_wallets_{userId}
 * - sec_enclave_meta_{userId}       (last hydrated at, flags)
 */

import { LocalEngine } from '@/lib/services/LocalEngine';

const PREFIX = 'sec_enclave';

export type EnclaveMeta = {
  hydratedAt: string;
  hasMasterpass: boolean;
  hasPasskey: boolean;
  keychainCount: number;
};

function keychainKey(userId: string) {
  return `${PREFIX}_keychain_${userId}`;
}
function userDocKey(userId: string) {
  return `${PREFIX}_userdoc_${userId}`;
}
function identityKey(userId: string) {
  return `${PREFIX}_identity_${userId}`;
}
function walletsKey(userId: string) {
  return `${PREFIX}_wallets_${userId}`;
}
function metaKey(userId: string) {
  return `${PREFIX}_meta_${userId}`;
}

/** Legacy keys written by older vault/client paths */
const LEGACY_KEYCHAIN = (userId: string) => [
  `kylrix_keychain_${userId}`,
  `f_keychain_${userId}`,
];
const LEGACY_USERDOC = (userId: string) => [`kylrix_userdoc_${userId}`];

async function readFirst<T>(keys: string[]): Promise<T | null> {
  for (const key of keys) {
    const hit = await LocalEngine.cacheGet<T>(key);
    if (hit != null && !(Array.isArray(hit) && hit.length === 0)) return hit;
  }
  return null;
}

/**
 * Prefer local when offline. When online, race network against a short timeout
 * so unlock UI never spins forever on a dead socket.
 */
export async function raceNetworkOrLocal<T>(opts: {
  network: () => Promise<T>;
  local: () => Promise<T>;
  timeoutMs?: number;
  preferLocalWhenOffline?: boolean;
}): Promise<{ value: T; source: 'network' | 'local' | 'timeout-local' }> {
  const preferLocal = opts.preferLocalWhenOffline !== false;
  if (preferLocal && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { value: await opts.local(), source: 'local' };
  }

  const timeoutMs = opts.timeoutMs ?? 2500;
  let timedOut = false;

  try {
    const value = await Promise.race([
      opts.network().then((v) => ({ v, from: 'network' as const })),
      new Promise<{ v: T; from: 'timeout' }>((resolve) => {
        setTimeout(async () => {
          timedOut = true;
          resolve({ v: await opts.local(), from: 'timeout' });
        }, timeoutMs);
      }),
    ]);

    if (value.from === 'timeout') {
      return { value: value.v, source: 'timeout-local' };
    }
    return { value: value.v, source: 'network' };
  } catch {
    if (timedOut) {
      return { value: await opts.local(), source: 'timeout-local' };
    }
    return { value: await opts.local(), source: 'local' };
  }
}

export const SecurityEnclave = {
  keychainKey,
  userDocKey,
  identityKey,
  walletsKey,
  metaKey,

  async getKeychain(userId: string): Promise<any[]> {
    if (!userId) return [];
    const primary = await LocalEngine.cacheGet<any[]>(keychainKey(userId));
    if (Array.isArray(primary) && primary.length > 0) return primary;

    const legacy = await readFirst<any[]>(LEGACY_KEYCHAIN(userId));
    if (Array.isArray(legacy) && legacy.length > 0) {
      await this.setKeychain(userId, legacy);
      return legacy;
    }
    return Array.isArray(primary) ? primary : [];
  },

  async setKeychain(userId: string, rows: any[]): Promise<void> {
    if (!userId) return;
    const list = Array.isArray(rows) ? rows : [];
    await LocalEngine.cacheSet(keychainKey(userId), list);
    // Keep legacy keys warm so older readers still work during rollout
    await LocalEngine.cacheSet(`kylrix_keychain_${userId}`, list);
    await LocalEngine.cacheSet(`f_keychain_${userId}`, list);
    await this.touchMeta(userId, {
      keychainCount: list.length,
      hasMasterpass: list.some((e) => e?.type === 'password'),
      hasPasskey: list.some((e) => e?.type === 'passkey')});
  },

  async getPasswordEntry(userId: string): Promise<any | null> {
    const rows = await this.getKeychain(userId);
    const passwords = rows.filter((r) => r?.type === 'password');
    if (!passwords.length) return null;
    return passwords.find((r) => !r.isPending) || passwords[0];
  },

  async getPasskeyEntries(userId: string): Promise<any[]> {
    const rows = await this.getKeychain(userId);
    return rows.filter((r) => r?.type === 'passkey');
  },

  async getUserDoc(userId: string): Promise<any | null> {
    if (!userId) return null;
    const primary = await LocalEngine.cacheGet<any>(userDocKey(userId));
    if (primary) return primary;
    const legacy = await readFirst<any>(LEGACY_USERDOC(userId));
    if (legacy) {
      await this.setUserDoc(userId, legacy);
      return legacy;
    }
    return null;
  },

  async setUserDoc(userId: string, doc: any): Promise<void> {
    if (!userId || !doc) return;
    await LocalEngine.cacheSet(userDocKey(userId), doc);
    await LocalEngine.cacheSet(`kylrix_userdoc_${userId}`, doc);
    await this.touchMeta(userId, {
      hasMasterpass: !!(doc?.masterpass === true),
      hasPasskey: !!(doc?.isPasskey === true)});
  },

  async getIdentity(userId: string): Promise<any | null> {
    if (!userId) return null;
    return LocalEngine.cacheGet<any>(identityKey(userId));
  },

  async setIdentity(userId: string, row: any | null): Promise<void> {
    if (!userId) return;
    await LocalEngine.cacheSet(identityKey(userId), row);
  },

  async getWallets(userId: string): Promise<any[]> {
    if (!userId) return [];
    const rows = await LocalEngine.cacheGet<any[]>(walletsKey(userId));
    return Array.isArray(rows) ? rows : [];
  },

  async setWallets(userId: string, rows: any[]): Promise<void> {
    if (!userId) return;
    await LocalEngine.cacheSet(walletsKey(userId), Array.isArray(rows) ? rows : []);
  },

  async getMeta(userId: string): Promise<EnclaveMeta | null> {
    if (!userId) return null;
    return LocalEngine.cacheGet<EnclaveMeta>(metaKey(userId));
  },

  async touchMeta(userId: string, patch: Partial<EnclaveMeta>): Promise<void> {
    const prev = (await this.getMeta(userId)) || {
      hydratedAt: '',
      hasMasterpass: false,
      hasPasskey: false,
      keychainCount: 0};
    await LocalEngine.cacheSet(metaKey(userId), {
      ...prev,
      ...patch,
      hydratedAt: patch.hydratedAt || prev.hydratedAt || new Date().toISOString()});
  },

  /**
   * Local-first capability probe for SudoModal — never blocks on network.
   */
  async probeCapabilities(userId: string): Promise<{
    hasMasterpass: boolean;
    hasPasskey: boolean;
    keychain: any[];
  }> {
    const [keychain, userDoc, meta] = await Promise.all([
      this.getKeychain(userId),
      this.getUserDoc(userId),
      this.getMeta(userId),
    ]);
    const hasMasterpass = !!(
      userDoc?.masterpass === true ||
      meta?.hasMasterpass ||
      keychain.some((e) => e?.type === 'password')
    );
    const hasPasskey = !!(
      userDoc?.isPasskey === true ||
      meta?.hasPasskey ||
      keychain.some((e) => e?.type === 'passkey')
    );
    return { hasMasterpass, hasPasskey, keychain };
  },

  /**
   * Pull remote security rows into the enclave. Safe to call in background.
   * Does nothing destructive when offline.
   */
  async hydrateFromRemote(userId: string, opts?: { force?: boolean }): Promise<EnclaveMeta | null> {
    if (!userId || typeof window === 'undefined') return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return this.getMeta(userId);
    }

    const meta = await this.getMeta(userId);
    const ageMs = meta?.hydratedAt ? Date.now() - new Date(meta.hydratedAt).getTime() : Infinity;
    // Soft TTL: 12h unless force or empty keychain
    const localKeychain = await this.getKeychain(userId);
    if (!opts?.force && localKeychain.length > 0 && ageMs < 1000 * 60 * 60 * 12) {
      return meta;
    }

    try {
      const { tablesDB } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
      const { Query } = await import('appwrite');

      const [keychainRes, userRes, identityRes, walletsRes] = await Promise.all([
        tablesDB
          .listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
            queries: [Query.equal('userId', userId), Query.limit(50)]})
          .catch(() => ({ rows: [] as any[] })),
        tablesDB
          .listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.USER,
            queries: [Query.equal('userId', userId), Query.limit(1)]})
          .catch(() => ({ rows: [] as any[] })),
        tablesDB
          .listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
            queries: [
              Query.equal('userId', userId),
              Query.equal('identityType', 'e2e_connect'),
              Query.limit(1),
            ]})
          .catch(() => ({ rows: [] as any[] })),
        tablesDB
          .listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.WALLETS,
            queries: [
              Query.equal('ownerId', `user:${userId}`),
              Query.equal('type', 'main'),
              Query.limit(100),
            ],
          })
          .catch(() => ({ rows: [] as any[] })),
      ]);

      const keychainRows = Array.isArray(keychainRes.rows) ? keychainRes.rows : [];
      if (keychainRows.length > 0) {
        await this.setKeychain(userId, keychainRows);
      }

      const userDoc = (userRes.rows || [])[0] || null;
      if (userDoc) await this.setUserDoc(userId, userDoc);

      const identity = (identityRes.rows || [])[0] || null;
      if (identity) await this.setIdentity(userId, identity);

      const wallets = Array.isArray(walletsRes.rows) ? walletsRes.rows : [];
      if (wallets.length > 0) await this.setWallets(userId, wallets);

      await this.touchMeta(userId, {
        hydratedAt: new Date().toISOString(),
        hasMasterpass: !!(
          userDoc?.masterpass === true || keychainRows.some((e: any) => e?.type === 'password')
        ),
        hasPasskey: !!(
          userDoc?.isPasskey === true || keychainRows.some((e: any) => e?.type === 'passkey')
        ),
        keychainCount: keychainRows.length || localKeychain.length});

      return this.getMeta(userId);
    } catch (err) {
      console.warn('[SecurityEnclave] hydrateFromRemote failed:', err);
      return this.getMeta(userId);
    }
  },

  /** Invalidate soft TTL so next hydrate pulls (e.g. after passkey add). */
  async markDirty(userId: string): Promise<void> {
    if (!userId) return;
    await this.touchMeta(userId, { hydratedAt: '' });
  },
};
