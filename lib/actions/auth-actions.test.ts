import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { getPasskeyLoginOptionsAction, verifyPasskeyLoginAction } from './auth-actions';

// Mock database to provide a registered credential during verifyPasskeyLoginAction testing
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          // Can return a mock row array directly or via limit
          const rows = [
            {
              id: 'kc_123',
              userId: 'user_test_123',
              type: 'passkey',
              account: 'cred_test_123',
              metadata: JSON.stringify({
                credentialId: 'cred_test_123',
                publicKey: Buffer.from('mock-public-key').toString('base64'),
                authPasskey: true,
              }),
            },
          ];
          return Object.assign(Promise.resolve(rows), {
            limit: vi.fn().mockResolvedValue(rows),
          });
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

describe('verifyChallengeToken timing-safe security invariants in auth-actions', () => {
  const secretKey = 'test-secret-key-12345';
  let originalAppwriteApi: string | undefined;
  let originalBetterAuthSecret: string | undefined;

  beforeEach(() => {
    originalAppwriteApi = process.env.APPWRITE_API;
    originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = secretKey;
    delete process.env.APPWRITE_API;
  });

  afterEach(() => {
    if (originalAppwriteApi !== undefined) process.env.APPWRITE_API = originalAppwriteApi;
    else delete process.env.APPWRITE_API;

    if (originalBetterAuthSecret !== undefined) process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;
    else delete process.env.BETTER_AUTH_SECRET;
  });

  it('generates a valid challengeToken and successfully accepts matching signature', async () => {
    const res = await getPasskeyLoginOptionsAction();
    expect(res.success).toBe(true);
    expect(res.challengeToken).toBeDefined();

    const [payloadB64, sig] = res.challengeToken!.split('.');
    expect(payloadB64).toBeDefined();
    expect(sig).toBeDefined();

    // Verify computed signature matches
    const expectedSig = crypto
      .createHmac('sha256', secretKey)
      .update(payloadB64)
      .digest('base64url');
    expect(sig).toBe(expectedSig);
  });

  it('rejects tampered or mismatched length signatures without throwing error or timing leak', async () => {
    const res = await getPasskeyLoginOptionsAction();
    expect(res.success).toBe(true);

    const [payloadB64] = res.challengeToken!.split('.');

    // Case 1: Arbitrary length shorter signature
    const shortToken = `${payloadB64}.invalidsig`;
    const checkShort = await verifyPasskeyLoginAction({ id: 'cred_test_123' }, shortToken);
    expect(checkShort.success).toBe(false);
    expect(checkShort.error).toBe('Invalid challenge token');

    // Case 2: Arbitrary length longer signature
    const longToken = `${payloadB64}.${'A'.repeat(128)}`;
    const checkLong = await verifyPasskeyLoginAction({ id: 'cred_test_123' }, longToken);
    expect(checkLong.success).toBe(false);
    expect(checkLong.error).toBe('Invalid challenge token');

    // Case 3: Same length as valid base64url HMAC but forged/corrupted
    const fakeSameLengthSig = 'X'.repeat(43);
    const checkForged = await verifyPasskeyLoginAction({ id: 'cred_test_123' }, `${payloadB64}.${fakeSameLengthSig}`);
    expect(checkForged.success).toBe(false);
    expect(checkForged.error).toBe('Invalid challenge token');
  });

  it('rejects expired challenge tokens cleanly', async () => {
    const expiredPayload = JSON.stringify({ c: 'expired-challenge-123', e: Date.now() - 10000 });
    const payloadB64 = Buffer.from(expiredPayload).toString('base64url');
    const sig = crypto.createHmac('sha256', secretKey).update(payloadB64).digest('base64url');
    const expiredToken = `${payloadB64}.${sig}`;

    const check = await verifyPasskeyLoginAction({ id: 'cred_test_123' }, expiredToken);
    expect(check.success).toBe(false);
    expect(check.error).toBe('Login session expired. Please retry.');
  });
});
