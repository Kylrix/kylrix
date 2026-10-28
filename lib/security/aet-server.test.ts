import { describe, it, expect } from 'vitest';
import {
  attachEnclave,
  getEnclave,
  releaseEnclave,
  unsealRowWithEnclave,
} from './aet-server';
import {
  bytesToBase64,
  generateEtkSecret,
  generateDEK,
  deriveAetWrappingKey,
  wrapDekEntry,
  type AetEnvelope,
  type AetResourceKey,
} from './zero-knowledge';
import { encryptFieldWithKey, importMekCryptoKey } from '@/lib/api/vault-crypto';

const FIELDS = ['name', 'password'] as const;

async function makeCtx(etk: Uint8Array, dek: Uint8Array, key: AetResourceKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveAetWrappingKey(etk, salt);
  const envelope: AetEnvelope = {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    salt: bytesToBase64(salt),
    resources: { credential: true, totp: false, note: false },
    createdAt: new Date().toISOString(),
    deks: { [key]: await wrapDekEntry(wrapKey, dek, key) },
  };
  return { etkSecret: etk, salt, envelope };
}

describe('server enclave lifecycle', () => {
  it('attach/get/release zeroes etk, salt, and issued DEKs', async () => {
    const etk = generateEtkSecret();
    const dek = crypto.getRandomValues(new Uint8Array(32));
    const actor = {};
    const ctx = await makeCtx(etk, dek, 'credential:c1');
    attachEnclave(actor, ctx);
    expect(getEnclave(actor)).toBeDefined();

    const live = getEnclave(actor)!;
    const issued = crypto.getRandomValues(new Uint8Array(32));
    live.issued.push(issued);

    releaseEnclave(actor);
    expect(getEnclave(actor)).toBeUndefined();
    expect([...ctx.etkSecret]).toEqual(new Array(32).fill(0));
    expect([...ctx.salt]).toEqual(new Array(16).fill(0));
    expect([...issued]).toEqual(new Array(32).fill(0));

    // release on missing actor is a no-op
    expect(() => releaseEnclave({})).not.toThrow();
  });
});

describe('unsealRowWithEnclave', () => {
  it('decrypts granted rows and nulls ungranted/corrupt ones', async () => {
    const etk = generateEtkSecret();
    const key = 'credential:c1' as AetResourceKey;

    // field ciphertext sealed under a row DEK; the DEK is wrapped under the etk
    const dek = await generateDEK();
    const dekKey = await importMekCryptoKey(dek);
    const row: Record<string, string> = {
      name: await encryptFieldWithKey('Prod DB', dekKey),
      password: await encryptFieldWithKey('s3cret!', dekKey),
    };

    const actor = {};
    attachEnclave(actor, await makeCtx(etk, dek, key));
    const ctx = getEnclave(actor)!;

    const out = await unsealRowWithEnclave(ctx, key, row, FIELDS);
    expect(out).toEqual({ name: 'Prod DB', password: 's3cret!' });
    expect(ctx.issued.length).toBe(1);

    // ungranted key → null (locked), not an error
    expect(await unsealRowWithEnclave(ctx, 'credential:other' as AetResourceKey, row, FIELDS)).toBeNull();

    // corrupt ciphertext → fail closed, not throw
    const bad = { name: '!!!not-base64!!!', password: row.password };
    expect(await unsealRowWithEnclave(ctx, key, bad, FIELDS)).toBeNull();

    releaseEnclave(actor);
  });
});
