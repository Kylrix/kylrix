import { describe, expect, it } from 'vitest';
import { MasterpassState, unwrapMasterKey, wrapMasterKey } from './masterpass';

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};

describe('masterpass helpers', () => {
  it('tracks unlock state and persists it', async () => {
    const storage = createStorage();
    const state = new MasterpassState({ storage, storageKey: 'vault-unlocked' });

    expect(state.isLocked()).toBe(true);
    expect(state.wasPersistedUnlocked()).toBe(false);

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );
    const raw = await crypto.subtle.exportKey('raw', key);

    await state.importMasterKey(raw);
    expect(state.isUnlocked()).toBe(true);
    expect(storage.getItem('vault-unlocked')).toBe('true');

    state.lock();
    expect(state.isLocked()).toBe(true);
    expect(storage.getItem('vault-unlocked')).toBeNull();
  });

  it('wraps and unwraps a master key', async () => {
    const password = 'correct horse battery staple';
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = btoa(String.fromCharCode(...saltBytes));

    const wrapped = await wrapMasterKey(key, password, saltBase64);
    const unwrapped = await unwrapMasterKey(wrapped, password, saltBase64);

    const originalRaw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const recoveredRaw = new Uint8Array(await crypto.subtle.exportKey('raw', unwrapped));

    expect(recoveredRaw).toEqual(originalRaw);
  });
});
