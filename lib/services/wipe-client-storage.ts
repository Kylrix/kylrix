import { purgeRxDB } from '@/lib/webrtc/RxDBManager';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { clearSessionProjectsList } from '@/lib/projects/projects-cache';
import { clearAllChatMemory } from '@/lib/chat/local-chat-cache';
import { clearInstalledFlowsMemory } from '@/lib/flows/installed';

export async function purgeAllClientStorageOnLogout(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    masterPassCrypto.lock();
    ecosystemSecurity.lock();
  } catch {}

  try {
    clearSessionProjectsList();
    clearAllChatMemory();
    clearInstalledFlowsMemory();
  } catch {}

  try {
    await purgeRxDB();
  } catch (err) {
    console.warn('[purgeAllClientStorageOnLogout] RxDB purge warning:', err);
  }

  try {
    const win = window as any;
    Object.keys(win).forEach((key) => {
      if (key.startsWith('__kylrix_baseline_')) {
        delete win[key];
      }
    });
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}

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

  try {
    window.dispatchEvent(new CustomEvent('kylrix:auth:logout'));
    window.dispatchEvent(new CustomEvent('kylrix:nexus:clear'));
  } catch {}
}
