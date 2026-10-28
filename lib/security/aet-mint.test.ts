import { describe, it, expect } from 'vitest';
import { buildAetEnvelope } from './aet-mint';
import {
  generateEtkSecret,
  unwrapDekFromMap,
  decryptRowField,
  base64ToBytes,
  type AetResourceKey,
} from './zero-knowledge';
import { sealRowFields, importMekCryptoKey } from '@/lib/api/vault-crypto';

const FIELDS = ['name', 'username', 'password'] as const;

async function makeSealedRow(mekBytes: Uint8Array, data: Record<string, string>, withDek = true) {
  const { encryptedFields, wrappedDek } = await sealRowFields(data, FIELDS, mekBytes);
  return {
    row: {
      ...encryptedFields,
      ...(withDek ? { dek: wrappedDek } : {}),
    },
    data,
  };
}

describe('buildAetEnvelope', () => {
  it('wraps permitted row DEKs and decrypts round trip', async () => {
    const mekBytes = crypto.getRandomValues(new Uint8Array(32));
    const mek = await importMekCryptoKey(mekBytes);
    const { row, data } = await makeSealedRow(mekBytes, {
      name: 'Prod DB',
      username: 'admin',
      password: 's3cret!',
    });
    const etk = generateEtkSecret();

    const { envelope, included, skipped } = await buildAetEnvelope({
      mek,
      rows: [{ kind: 'credential', id: 'cred_1', row }],
      resources: { credential: true, totp: false, note: false },
      etkSecret: etk,
    });

    expect(included).toBe(1);
    expect(skipped).toBe(0);
    expect(envelope.deks['credential:cred_1']).toBeDefined();

    const salt = base64ToBytes(envelope.salt);
    const dek = await unwrapDekFromMap(envelope.deks, 'credential:cred_1' as AetResourceKey, etk, salt);
    expect(dek).not.toBeNull();
    for (const f of FIELDS) {
      expect(await decryptRowField(row[f], dek!)).toBe(data[f]);
    }
  });

  it('skips rows without a wrapped DEK and caps at 500', async () => {
    const mekBytes = crypto.getRandomValues(new Uint8Array(32));
    const mek = await importMekCryptoKey(mekBytes);
    const { row: good } = await makeSealedRow(mekBytes, { name: 'a', username: 'b', password: 'c' });
    const { row: noDek } = await makeSealedRow(mekBytes, { name: 'x', username: 'y', password: 'z' }, false);
    const etk = generateEtkSecret();

    const { included, skipped, envelope } = await buildAetEnvelope({
      mek,
      rows: [
        { kind: 'credential', id: 'ok', row: good },
        { kind: 'credential', id: 'legacy', row: noDek },
      ],
      resources: { credential: true, totp: false, note: false },
      etkSecret: etk,
    });
    expect(included).toBe(1);
    expect(skipped).toBe(1);
    expect(envelope.deks['credential:ok']).toBeDefined();
    expect(envelope.deks['credential:legacy' as AetResourceKey]).toBeUndefined();

    const many = Array.from({ length: 501 }, (_, i) => ({ kind: 'credential' as const, id: `c${i}`, row: good }));
    const res2 = await buildAetEnvelope({
      mek,
      rows: many,
      resources: { credential: true, totp: false, note: false },
      etkSecret: etk,
    });
    expect(res2.included).toBe(500);
    expect(res2.skipped).toBe(1);
  });
});
