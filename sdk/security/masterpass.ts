import { KylrixSecurity } from '../security';

export async function deriveMasterpassKey(password: string, salt: string) {
  return KylrixSecurity.deriveKey(password, salt);
}

export async function encryptMasterpassPayload(payload: string, password: string, salt: string) {
  const key = await deriveMasterpassKey(password, salt);
  return KylrixSecurity.encrypt(payload, key);
}

export async function decryptMasterpassPayload(cipher: string, iv: string, password: string, salt: string) {
  const key = await deriveMasterpassKey(password, salt);
  return KylrixSecurity.decrypt(cipher, iv, key);
}

export class MasterpassState {
  private storage: any;
  private storageKey: string;
  private masterKey: CryptoKey | null = null;

  constructor({ storage, storageKey }: { storage: any; storageKey: string }) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  isLocked(): boolean {
    return this.masterKey === null;
  }

  isUnlocked(): boolean {
    return this.masterKey !== null;
  }

  wasPersistedUnlocked(): boolean {
    return this.storage.getItem(this.storageKey) === 'true';
  }

  async importMasterKey(rawKey: ArrayBuffer): Promise<void> {
    this.masterKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );
    this.storage.setItem(this.storageKey, 'true');
  }

  lock(): void {
    this.masterKey = null;
    this.storage.removeItem(this.storageKey);
  }
}

export async function wrapMasterKey(key: CryptoKey, password: string, saltBase64: string): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const derivedKey = await KylrixSecurity.deriveKey(password, saltBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    rawKey
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function unwrapMasterKey(wrappedBase64: string, password: string, saltBase64: string): Promise<CryptoKey> {
  const derivedKey = await KylrixSecurity.deriveKey(password, saltBase64);
  const combined = Uint8Array.from(atob(wrappedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    ciphertext
  );
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

