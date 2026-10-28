// Timing-attack tests are intentionally out of scope: WebCrypto AES-GCM tag
// checks are constant-time by implementation, and this module adds no
// secret-dependent branches.
import { describe, it, expect, vi } from 'vitest';
import {
  AET_BEARER_REGEX,
  AET_REGEX,
  ZeroKnowledgeError,
  ZeroKnowledgeModule,
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  decryptPayload,
  decryptRowField,
  deriveAetWrappingKey,
  encryptPayload,
  formatAgentToken,
  generateDEK,
  generateEtkSecret,
  getRowWrappedDek,
  hexToBytes,
  importAesKey,
  isAgentEnclaveToken,
  parseAgentToken,
  splitAgentToken,
  toBearerCredential,
  unwrapDEK,
  unwrapDekFromMap,
  unwrapRowDek,
  validateAetEnvelope,
  validateAgentTokenInput,
  withSecretBytes,
  wrapDEK,
  wrapDekEntry,
  zeroClearBytes,
} from './zero-knowledge';

const VALID_BEARER = 'kyl_aet_a1b2c3d4_' + 'A'.repeat(32);
const VALID_ETK_HEX = 'ab'.repeat(32);
const VALID_AET = `${VALID_BEARER}.etk_${VALID_ETK_HEX}`;

function expectZk(promise: Promise<unknown> | (() => unknown), code: string) {
  if (typeof promise === 'function') {
    return expect(promise).toThrowError(expect.objectContaining({ code }));
  }
  return expect(promise).rejects.toThrowError(expect.objectContaining({ code }));
}

describe('AET token format', () => {
  it('generateEtkSecret returns 32 bytes', () => {
    const etk = generateEtkSecret();
    expect(etk).toBeInstanceOf(Uint8Array);
    expect(etk.byteLength).toBe(32);
  });

  it('formats and parses a full AET (round trip)', () => {
    const etk = generateEtkSecret();
    const token = formatAgentToken(VALID_BEARER, etk);
    expect(token).toMatch(AET_REGEX);

    const parsed = parseAgentToken(token);
    expect(parsed.prefix).toBe('a1b2c3d4');
    expect(parsed.bearer).toBe(VALID_BEARER);
    expect(Array.from(parsed.etkSecret)).toEqual(Array.from(etk));
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'kyl_aet_', 'not_a_token', 123, null, undefined, {}]) {
      expectZk(() => parseAgentToken(bad), 'invalid_token');
    }
    // extra dot
    expectZk(() => parseAgentToken(`${VALID_AET}.x`), 'invalid_token');
    // 7- and 9-char prefixes
    expectZk(() => parseAgentToken(`kyl_aet_a1b2c3_${'A'.repeat(32)}.etk_${VALID_ETK_HEX}`), 'invalid_token');
    expectZk(() => parseAgentToken(`kyl_aet_a1b2c3d4e_${'A'.repeat(32)}.etk_${VALID_ETK_HEX}`), 'invalid_token');
    // 63- and 65-char hex
    expectZk(() => parseAgentToken(`${VALID_BEARER}.etk_${'ab'.repeat(31)}a`), 'invalid_token');
    expectZk(() => parseAgentToken(`${VALID_BEARER}.etk_${VALID_ETK_HEX}a`), 'invalid_token');
    // uppercase hex in unlock part
    expectZk(() => parseAgentToken(`${VALID_BEARER}.etk_${'AB'.repeat(32)}`), 'invalid_token');
    // plain provisioning key (no dot) is not an AET
    expectZk(() => parseAgentToken('kyl_apk_abcd1234_secretsecretsecret'), 'invalid_token');
  });

  it('trims surrounding whitespace', () => {
    const parsed = parseAgentToken(`  ${VALID_AET}\n`);
    expect(parsed.bearer).toBe(VALID_BEARER);
  });

  it('rejects legacy kyl_apk_<x>.<y> format with a friendly error', () => {
    try {
      parseAgentToken('kyl_apk_tok_123456.etk_' + VALID_ETK_HEX);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ZeroKnowledgeError);
      expect((e as ZeroKnowledgeError).code).toBe('legacy_token_format');
    }
  });

  it('formatAgentToken validates both parts', () => {
    expectZk(() => formatAgentToken('kyl_apk_x_y', generateEtkSecret()), 'invalid_token');
    expectZk(() => formatAgentToken(VALID_BEARER, new Uint8Array(31)), 'invalid_key_length');
  });

  it('toBearerCredential strips only AET unlock parts', () => {
    expect(toBearerCredential(VALID_AET)).toBe(VALID_BEARER);
    expect(toBearerCredential('kyl_pat_abc123_secretsecret')).toBe('kyl_pat_abc123_secretsecret');
    expect(toBearerCredential('garbage.with.dots')).toBe('garbage.with.dots');
    expect(toBearerCredential(`  ${VALID_AET}  `)).toBe(VALID_BEARER);
  });

  it('isAgentEnclaveToken only accepts the full format', () => {
    expect(isAgentEnclaveToken(VALID_AET)).toBe(true);
    expect(isAgentEnclaveToken(VALID_BEARER)).toBe(false);
    expect(isAgentEnclaveToken('kyl_apk_x.y')).toBe(false);
    expect(isAgentEnclaveToken(42)).toBe(false);
    expect(isAgentEnclaveToken(null)).toBe(false);
  });

  it('splitAgentToken splits bearer and unlock parts', () => {
    expect(splitAgentToken(VALID_AET)).toEqual({ bearer: VALID_BEARER, unlock: `etk_${VALID_ETK_HEX}` });
    expect(splitAgentToken(VALID_BEARER)).toBeNull();
    expect(splitAgentToken('kyl_pat_x_y')).toBeNull();
  });

  it('validateAgentTokenInput gives plain-language feedback', () => {
    expect(validateAgentTokenInput('')).toBe('Paste your agent key');
    expect(validateAgentTokenInput(VALID_AET)).toBeNull();
    expect(validateAgentTokenInput('kyl_apk_x.etk_' + VALID_ETK_HEX)).toContain('old preview format');
    expect(validateAgentTokenInput('nonsense')).toContain('kyl_aet_');
  });
});

describe('encoding helpers', () => {
  it('rejects malformed base64 on both code paths', () => {
    for (const bad of ['@@@@', 'abc', 'a===', 'a b c', 'AAAA\n']) {
      expectZk(() => base64ToBytes(bad), 'invalid_encoding');
    }
  });

  it('behaves identically without Buffer (atob path)', () => {
    vi.stubGlobal('Buffer', undefined);
    try {
      for (const bad of ['@@@@', 'abc', 'a===', 'a b c']) {
        expectZk(() => base64ToBytes(bad), 'invalid_encoding');
      }
      const bytes = new Uint8Array([1, 2, 3, 250]);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('accepts empty string as zero bytes', () => {
    expect(base64ToBytes('').byteLength).toBe(0);
  });

  it('round-trips base64 and hex', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(37));
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    expect(Array.from(hexToBytes(bytesToHex(bytes)))).toEqual(Array.from(bytes));
  });

  it('rejects malformed hex', () => {
    for (const bad of ['zz', 'abc', 'AB', ' 12']) {
      expectZk(() => hexToBytes(bad), 'invalid_encoding');
    }
  });
});

describe('payload encryption', () => {
  it('encrypts and decrypts with a raw 32-byte DEK', async () => {
    const dek = await generateDEK();
    const enc = await encryptPayload(dek, 'Secret database key string');
    expect(enc.isEncrypted).toBe(true);
    expect(enc.algorithm).toBe('AES-256-GCM');
    expect(await decryptPayload(dek, enc.encryptedData, enc.iv)).toBe('Secret database key string');
  });

  it('supports JSON object payloads', async () => {
    const dek = await generateDEK();
    const enc = await encryptPayload(dek, { a: 1, b: 'x' });
    expect(await decryptPayload(dek, enc.encryptedData, enc.iv)).toBe('{"a":1,"b":"x"}');
  });

  it('rejects string and wrong-length keys', async () => {
    await expectZk(encryptPayload('deadbeef' as any, 'x'), 'invalid_key_length');
    await expectZk(encryptPayload(new Uint8Array(16), 'x'), 'invalid_key_length');
    await expectZk(encryptPayload(new Uint8Array(64), 'x'), 'invalid_key_length');
    await expectZk(decryptPayload('deadbeef' as any, 'AAAA', 'AAAA'), 'invalid_key_length');
  });

  it('fails closed on a wrong key or tampered ciphertext', async () => {
    const dek = await generateDEK();
    const other = await generateDEK();
    const enc = await encryptPayload(dek, 'hello');
    await expectZk(decryptPayload(other, enc.encryptedData, enc.iv), 'decrypt_failed');

    const ct = base64ToBytes(enc.encryptedData);
    ct[0] ^= 0xff;
    await expectZk(decryptPayload(dek, bytesToBase64(ct), enc.iv), 'decrypt_failed');
  });

  it('uses a fresh IV per encryption', async () => {
    const dek = await generateDEK();
    const ivs = new Set<string>();
    for (let i = 0; i < 25; i++) {
      ivs.add((await encryptPayload(dek, 'same')).iv);
    }
    expect(ivs.size).toBe(25);
  });
});

describe('DEK wrap/unwrap', () => {
  it('wrapDEK/unwrapDEK round trip with a raw key', async () => {
    const dek = await generateDEK();
    const wrapping = await generateDEK();
    const { wrappedDek, iv } = await wrapDEK(dek, wrapping);
    const out = await unwrapDEK(wrappedDek, iv, wrapping);
    expect(Array.from(out)).toEqual(Array.from(dek));
  });

  it('unwrapDekFromMap enforces algorithm, lengths, and AAD binding', async () => {
    const etk = generateEtkSecret();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrapKey = await deriveAetWrappingKey(etk, salt);
    const dek = await generateDEK();

    const entry = await wrapDekEntry(wrapKey, dek, 'credential:cred_1');
    expect(base64ToBytes(entry.iv).byteLength).toBe(12);
    expect(base64ToBytes(entry.wrappedDek).byteLength).toBe(48);

    const map = { 'credential:cred_1': entry } as any;
    const out = await unwrapDekFromMap(map, 'credential:cred_1', etk, salt);
    expect(Array.from(out!)).toEqual(Array.from(dek));

    // missing key → null
    expect(await unwrapDekFromMap(map, 'credential:other', etk, salt)).toBeNull();

    // tampered algorithm
    await expectZk(
      unwrapDekFromMap(
        { 'credential:cred_1': { ...entry, algorithm: 'AES-128-GCM' as any } },
        'credential:cred_1',
        etk,
        salt
      ),
      'unsupported_algorithm'
    );

    // bad lengths
    await expectZk(
      unwrapDekFromMap(
        { 'credential:cred_1': { ...entry, iv: bytesToBase64(new Uint8Array(16)) } },
        'credential:cred_1',
        etk,
        salt
      ),
      'invalid_envelope'
    );

    // entry swapped to a different resourceKey fails via AAD
    const swapped = { 'credential:cred_2': entry } as any;
    await expectZk(unwrapDekFromMap(swapped, 'credential:cred_2', etk, salt), 'decrypt_failed');

    // wrong etk fails
    await expectZk(unwrapDekFromMap(map, 'credential:cred_1', generateEtkSecret(), salt), 'decrypt_failed');

    // different salt derives a different key and fails
    await expectZk(
      unwrapDekFromMap(map, 'credential:cred_1', etk, crypto.getRandomValues(new Uint8Array(16))),
      'decrypt_failed'
    );
  });

  it('deriveAetWrappingKey rejects non-32-byte etk and non-16-byte salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await expectZk(deriveAetWrappingKey(new Uint8Array(31), salt), 'invalid_key_length');
    await expectZk(deriveAetWrappingKey(generateEtkSecret(), new Uint8Array(8)), 'invalid_envelope');
  });
});

describe('envelope validation', () => {
  const validEnvelope = () => ({
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'HKDF-SHA256',
    salt: bytesToBase64(new Uint8Array(16)),
    resources: { credential: true, totp: false, note: false },
    createdAt: new Date().toISOString(),
    deks: {
      'credential:cred_1': {
        wrappedDek: bytesToBase64(new Uint8Array(48)),
        iv: bytesToBase64(new Uint8Array(12)),
        algorithm: 'AES-256-GCM',
      },
    },
  });

  it('accepts a valid envelope', () => {
    expect(validateAetEnvelope(validEnvelope()).v).toBe(1);
  });

  it('rejects malformed envelopes', () => {
    const bad = [
      null,
      undefined,
      'x',
      {},
      { ...validEnvelope(), v: 2 },
      { ...validEnvelope(), alg: 'AES-128-GCM' },
      { ...validEnvelope(), kdf: 'SHA-256' },
      { ...validEnvelope(), salt: '!!!' },
      { ...validEnvelope(), salt: bytesToBase64(new Uint8Array(8)) },
      { ...validEnvelope(), createdAt: 5 },
      { ...validEnvelope(), resources: { credential: true } },
      { ...validEnvelope(), deks: [] },
      { ...validEnvelope(), deks: { 'weird:x': validEnvelope().deks['credential:cred_1'] } },
      {
        ...validEnvelope(),
        deks: { 'credential:c': { wrappedDek: 'AA==', iv: bytesToBase64(new Uint8Array(12)), algorithm: 'AES-256-GCM' } },
      },
      {
        ...validEnvelope(),
        deks: { 'credential:c': { wrappedDek: bytesToBase64(new Uint8Array(48)), iv: 'x', algorithm: 'AES-256-GCM' } },
      },
      {
        ...validEnvelope(),
        deks: {
          'credential:c': { wrappedDek: bytesToBase64(new Uint8Array(48)), iv: bytesToBase64(new Uint8Array(12)), algorithm: 'ChaCha20' },
        },
      },
    ];
    for (const b of bad) {
      expectZk(() => validateAetEnvelope(b), 'invalid_envelope');
    }
  });

  it('rejects more than 500 entries', () => {
    const deks: Record<string, unknown> = {};
    for (let i = 0; i < 501; i++) {
      deks[`credential:c${i}`] = {
        wrappedDek: bytesToBase64(new Uint8Array(48)),
        iv: bytesToBase64(new Uint8Array(12)),
        algorithm: 'AES-256-GCM',
      };
    }
    expectZk(() => validateAetEnvelope({ ...validEnvelope(), deks }), 'invalid_envelope');
  });
});

describe('row format compatibility', () => {
  it('unwrapRowDek + decryptRowField interoperate with vault-crypto sealRowFields', async () => {
    const { sealRowFields, importMekCryptoKey } = await import('@/lib/api/vault-crypto');
    const mekBytes = crypto.getRandomValues(new Uint8Array(32));
    const mek = await importMekCryptoKey(mekBytes);

    const data = { name: 'Prod DB', username: 'admin', password: 's3cret!' };
    const { encryptedFields, wrappedDek } = await sealRowFields(
      data,
      ['name', 'username', 'password'],
      mekBytes
    );

    const dek = await unwrapRowDek(wrappedDek, mek);
    expect(dek.byteLength).toBe(32);
    try {
      for (const f of ['name', 'username', 'password']) {
        expect(await decryptRowField(encryptedFields[f]!, dek)).toBe(data[f as keyof typeof data]);
      }
    } finally {
      zeroClearBytes(dek);
    }
  });

  it('getRowWrappedDek reads row.dek and metadata.dek', () => {
    expect(getRowWrappedDek({ dek: '  abc  ' })).toBe('abc');
    expect(getRowWrappedDek({ metadata: JSON.stringify({ dek: 'mdek' }) })).toBe('mdek');
    expect(getRowWrappedDek({ metadata: { dek: 'mdek2' } })).toBe('mdek2');
    expect(getRowWrappedDek({})).toBeNull();
    expect(getRowWrappedDek({ dek: '', metadata: 'not json' })).toBeNull();
  });
});

describe('memory hygiene', () => {
  it('zeroClearBytes zeroes arrays and tolerates null', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    zeroClearBytes(bytes);
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0, 0]);
    expect(() => zeroClearBytes(null)).not.toThrow();
    expect(() => zeroClearBytes(undefined)).not.toThrow();
  });

  it('withSecretBytes zeroes on success and on throw', async () => {
    const a = new Uint8Array([9, 9, 9]);
    await withSecretBytes(a, async (b) => {
      expect(b[0]).toBe(9);
    });
    expect(Array.from(a)).toEqual([0, 0, 0]);

    const b = new Uint8Array([7, 7]);
    await expect(
      withSecretBytes(b, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(Array.from(b)).toEqual([0, 0]);
  });
});

describe('buffer views', () => {
  it('handles subarray views with non-zero offsets', async () => {
    const backing = crypto.getRandomValues(new Uint8Array(64));
    const dek = backing.subarray(16, 48);
    const enc = await encryptPayload(dek, 'offset test');
    expect(await decryptPayload(dek, enc.encryptedData, enc.iv)).toBe('offset test');
  });

  it.skipIf(typeof SharedArrayBuffer === 'undefined')(
    'handles SharedArrayBuffer-backed views',
    async () => {
      const sab = new SharedArrayBuffer(32);
      const dek = new Uint8Array(sab);
      dek.set(crypto.getRandomValues(new Uint8Array(32)));
      const enc = await encryptPayload(dek, 'sab test');
      expect(await decryptPayload(dek, enc.encryptedData, enc.iv)).toBe('sab test');
    }
  );
});

describe('importAesKey', () => {
  it('rejects non-32-byte input', async () => {
    await expectZk(importAesKey(new Uint8Array(16)), 'invalid_key_length');
    await expectZk(importAesKey('x'.repeat(32) as any), 'invalid_key_length');
  });
});

describe('validateAgentTokenInput + ZeroKnowledgeModule namespace', () => {
  it('namespace exposes the public API', () => {
    expect(ZeroKnowledgeModule.parseAgentToken).toBe(parseAgentToken);
    expect(ZeroKnowledgeModule.unwrapDekFromMap).toBe(unwrapDekFromMap);
    expect(ZeroKnowledgeModule.zeroClearBytes).toBe(zeroClearBytes);
    expect(AET_BEARER_REGEX.test(VALID_BEARER)).toBe(true);
    expect(vi).toBeTruthy(); // keep vitest import used
  });
});
