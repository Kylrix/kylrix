import { describe, it, expect, vi } from 'vitest';
import {
  bytesToBase64,
  formatAgentToken,
  generateDEK,
  generateEtkSecret,
  wrapDekEntry,
  deriveAetWrappingKey,
  type AetResourceKey,
} from '@/lib/security/zero-knowledge';

const { openEnclave, assertSecureTransport } = await import('./enclave');

function makeAet() {
  const etk = generateEtkSecret();
  const bearer = `kyl_aet_a1b2c3d4_${'A'.repeat(32)}`;
  return { etk, bearer, aet: formatAgentToken(bearer, etk) };
}

async function makeEnvelope(etk: Uint8Array, dek: Uint8Array, key: AetResourceKey = 'credential:cred_1') {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapKey = await deriveAetWrappingKey(etk, salt);
  const entry = await wrapDekEntry(wrapKey, dek, key);
  return {
    v: 1 as const,
    alg: 'AES-256-GCM' as const,
    kdf: 'HKDF-SHA256' as const,
    salt: bytesToBase64(salt),
    resources: { credential: true, totp: false, note: false },
    createdAt: new Date().toISOString(),
    deks: { [key]: entry },
  };
}

describe('assertSecureTransport', () => {
  it('rejects non-https non-local URLs', () => {
    expect(() => assertSecureTransport('http://evil.example.com')).toThrow(/secure \(https\)/);
    expect(() => assertSecureTransport('https://kylrix.space')).not.toThrow();
    expect(() => assertSecureTransport('http://localhost:3005')).not.toThrow();
    expect(() => assertSecureTransport('http://127.0.0.1:3005')).not.toThrow();
  });
});

describe('openEnclave', () => {
  it('fetches the envelope, unlocks a DEK, and close() zeroes secrets', async () => {
    const { etk, bearer, aet } = makeAet();
    const dek = await generateDEK();
    const envelope = await makeEnvelope(etk, dek);

    const mockFetch = vi.fn(async (url: any, init: any) => {
      expect(String(url)).toContain('/token/enclave');
      expect(init.headers['Authorization']).toBe(`Bearer ${bearer}`);
      expect(JSON.stringify(init.headers)).not.toContain('etk_');
      return new Response(
        JSON.stringify({ ok: true, data: { envelope, scopes: ['vault:read'], expiresAt: null } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }) as any;
    vi.stubGlobal('fetch', mockFetch);

    const enc = await openEnclave(aet, { url: 'https://unit.test' });
    const out = await enc.unlockDek('credential:cred_1');
    expect(Array.from(out!)).toEqual(Array.from(dek));

    enc.close();
    enc.close(); // idempotent
    // After close() the etkSecret bytes are zeroed: unwrapping now derives the
    // wrong key and fails closed.
    await expect(enc.unlockDek('credential:cred_1')).rejects.toThrowError(
      expect.objectContaining({ code: 'decrypt_failed' })
    );
    vi.unstubAllGlobals();
  });

  it('a wrong unlock part fails to unwrap', async () => {
    const { bearer, aet } = makeAet();
    const dek = await generateDEK();
    const envelope = await makeEnvelope(generateEtkSecret(), dek); // different etk

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ ok: true, data: { envelope, scopes: [], expiresAt: null } }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      ) as any
    );
    const enc = await openEnclave(aet, { url: 'https://unit.test' });
    await expect(enc.unlockDek('credential:cred_1')).rejects.toThrowError(
      expect.objectContaining({ code: 'decrypt_failed' })
    );
    enc.close();
    vi.unstubAllGlobals();
  });

  it('an http non-local URL throws before any fetch', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const { aet } = makeAet();
    await expect(openEnclave(aet, { url: 'http://evil.example.com' })).rejects.toThrow(/secure \(https\)/);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
