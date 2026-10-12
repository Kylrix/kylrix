import { describe, it, expect } from 'vitest';
import {
  parseKeyToBytes,
  sealRowFields,
  unsealRowWithAnyKey,
  deriveMekFromMasterPassword,
  formatVaultSecretToEnv,
  VAULT_ENCRYPTED_FIELDS,
} from '@/lib/api/vault-crypto';

describe('Vault Dual-Mode Decryption & Public Secret Resolution', () => {
  const dummyMekBytes = new Uint8Array(32).fill(7);

  it('correctly parses key formats (hex, url-safe base64, standard base64)', () => {
    const hex = Buffer.from(dummyMekBytes).toString('hex');
    expect(parseKeyToBytes(hex)).toEqual(dummyMekBytes);

    const base64 = Buffer.from(dummyMekBytes).toString('base64');
    expect(parseKeyToBytes(base64)).toEqual(dummyMekBytes);

    const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(parseKeyToBytes(urlSafe)).toEqual(dummyMekBytes);
  });

  it('seals and unseals secrets with direct DEK (Public Share URL flow)', async () => {
    const plainPayload = {
      name: 'Production Cloudflare API Credentials',
      username: 'ops@kylrix.space',
      password: 'super-secret-api-token-12345',
      notes: 'API_ENDPOINT=https://api.cloudflare.com/client/v4\nDEBUG=true',
      customFields: JSON.stringify([
        { label: 'CLOUDFLARE_API_KEY', value: 'cfa_xyz987654321' },
        { label: 'CLOUDFLARE_ZONE_ID', value: 'zone_abc123' },
      ]),
    };

    const { encryptedFields, wrappedDek } = await sealRowFields(
      plainPayload,
      VAULT_ENCRYPTED_FIELDS.credentials,
      dummyMekBytes
    );

    const rawDekBase64 = await (async () => {
      const { decryptFieldWithKey, importMekCryptoKey } = await import('@/lib/api/vault-crypto');
      const mekKey = await importMekCryptoKey(dummyMekBytes);
      return decryptFieldWithKey(wrappedDek, mekKey);
    })();

    const rawRow = {
      $id: 'secret-pub-456',
      userId: 'user-human-1',
      dek: wrappedDek,
      isPublic: true,
      isGuest: true,
      ...encryptedFields,
    };

    // 1. Light Lifting Default (No key supplied): Returns sealed fields
    const { unsealed: unsealedDefault, keyUsed: keyUsedDefault } = await unsealRowWithAnyKey(
      rawRow,
      VAULT_ENCRYPTED_FIELDS.credentials,
      {}
    );
    expect(keyUsedDefault).toBeNull();
    expect(Object.keys(unsealedDefault).length).toBe(0);

    // 2. Heavy Lifting (Direct DEK supplied, e.g. from share URL /vault/:id/:dek): Unseals plaintext
    const { unsealed: unsealedDek, keyUsed: keyUsedDek } = await unsealRowWithAnyKey(
      rawRow,
      VAULT_ENCRYPTED_FIELDS.credentials,
      { shareKey: rawDekBase64 }
    );
    expect(keyUsedDek).toBe('dek');
    expect(unsealedDek.password).toBe('super-secret-api-token-12345');
    expect(unsealedDek.name).toBe('Production Cloudflare API Credentials');

    // 3. Format into .env
    const envOutput = formatVaultSecretToEnv(unsealedDek);
    expect(envOutput).toContain('CLOUDFLARE_API_KEY=cfa_xyz987654321');
    expect(envOutput).toContain('CLOUDFLARE_ZONE_ID=zone_abc123');
  });

  it('unseals secrets with Master Password derivation on the fly', async () => {
    // Generate dummy master password & PBKDF2 wrapped MEK
    const masterPassword = 'CorrectHorseBatteryStaple2026!';
    const saltBytes = new Uint8Array(16).fill(9);
    const saltBase64 = Buffer.from(saltBytes).toString('base64');

    const enc = new TextEncoder();
    const baseKey = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(masterPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      256
    );

    const kekKey = await globalThis.crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const encryptedMek = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      kekKey,
      dummyMekBytes
    );
    const combined = new Uint8Array(16 + encryptedMek.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedMek), 16);
    const wrappedKeyBase64 = Buffer.from(combined).toString('base64');

    // Test derivation
    const derivedMek = await deriveMekFromMasterPassword({
      password: masterPassword,
      salt: saltBase64,
      wrappedKey: wrappedKeyBase64,
      isArgon: false,
    });

    expect(derivedMek).toBeDefined();
    expect(derivedMek).toEqual(dummyMekBytes);
  });
});
