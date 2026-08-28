import { purgeRxDB } from '@/lib/webrtc/RxDBManager';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { invalidateCurrentUserCache, clearKylrixPulse } from '@/lib/appwrite/client';

/**
 * Total Client Compartmentalization & Storage Wipe on Logout / Account Switch.
 * Completely purges RxDB, Dexie databases, LocalEngine baselines, in-memory caches,
 * sessionStorage, user localStorage keys, and cryptographic RAM sessions so that
 * no data leaks between different user accounts.
 */
export async function purgeAllClientStorageOnLogout(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Lock masterpass & crypto enclaves in RAM
  try {
    masterPassCrypto.lock();
    ecosystemSecurity.lock();
  } catch {}

  // 2. Clear Appwrite user snapshot cache & heartbeat
  try {
    invalidateCurrentUserCache();
    clearKylrixPulse();
  } catch {}

  // 3. Purge RxDB & Dexie local storage
  try {
    await purgeRxDB();
  } catch (err) {
    console.warn('[purgeAllClientStorageOnLogout] RxDB purge warning:', err);
  }

  // 4. Clear LocalEngine baseline snapshots & memory structures
  try {
    const win = window as any;
    Object.keys(win).forEach((key) => {
      if (key.startsWith('__kylrix_baseline_')) {
        delete win[key];
      }
    });
  } catch {}

  // 5. Clear sessionStorage completely
  try {
    sessionStorage.clear();
  } catch {}

  // 6. Clear user-specific and sensitive localStorage keys
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('kylrix_') ||
          key.startsWith('f_') ||
          key.startsWith('k_nexus_') ||
          key.startsWith('vault_') ||
          key.startsWith('user_pins_') ||
          key.startsWith('visited_shared_') ||
          key.startsWith('last_route_') ||
          key.startsWith('auth_') ||
          key.startsWith('account_') ||
          key.startsWith('initial_notes_') ||
          key.startsWith('initial_goals_') ||
          key.startsWith('initial_tasks_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // 7. Dispatch global logout event to instantly reset all React Contexts
  try {
    window.dispatchEvent(new CustomEvent('kylrix:auth:logout'));
    window.dispatchEvent(new CustomEvent('kylrix:nexus:clear'));
  } catch {}
}
