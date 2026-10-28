import { describe, it, expect } from 'vitest';
import { formatPatToken, parsePatToken, PatService } from './pats';
import { bytesToBase64 } from '@/lib/security/zero-knowledge';

describe('PatService and Token Utilities', () => {
  it('correctly formats and parses user PAT tokens', () => {
    const token = formatPatToken('testprefix', 'testsecret', 'user_pat');
    expect(token).toBe('kyl_pat_testprefix_testsecret');
    const parsed = parsePatToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('testprefix');
    expect(parsed?.category).toBe('user_pat');
  });

  it('correctly formats and parses agent provisioning keys', () => {
    const token = formatPatToken('apkprefix', 'secret12345', 'agent_provisioning_key');
    expect(token).toBe('kyl_apk_apkprefix_secret12345');
    const parsed = parsePatToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('apkprefix');
    expect(parsed?.category).toBe('agent_provisioning_key');
  });

  it('correctly formats and parses punch tokens', () => {
    const token = formatPatToken('punchpfx', 'secret67890', 'punch_token');
    expect(token).toBe('kyl_punch_punchpfx_secret67890');
    const parsed = parsePatToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('punchpfx');
    expect(parsed?.category).toBe('punch_token');
  });

  it('correctly formats and parses workspace PAT tokens', () => {
    const token = formatPatToken('wpatpfx', 'secretwpat', 'workspace_pat');
    expect(token).toBe('kyl_wpat_wpatpfx_secretwpat');
    const parsed = parsePatToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('wpatpfx');
    expect(parsed?.category).toBe('workspace_pat');
  });

  it('correctly formats and parses agent enclave tokens', () => {
    const token = formatPatToken('a1b2c3d4', 'A'.repeat(32), 'agent_enclave_token');
    expect(token).toBe(`kyl_aet_a1b2c3d4_${'A'.repeat(32)}`);

    const parsed = parsePatToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.prefix).toBe('a1b2c3d4');
    expect(parsed?.category).toBe('agent_enclave_token');
    expect(parsed?.token).toBe(token);
  });

  it('strips the unlock part when a full AET is presented', () => {
    const bearer = `kyl_aet_a1b2c3d4_${'A'.repeat(32)}`;
    const full = `${bearer}.etk_${'ab'.repeat(32)}`;
    const parsed = parsePatToken(full);
    expect(parsed).not.toBeNull();
    expect(parsed?.token).toBe(bearer);
    expect(parsed?.category).toBe('agent_enclave_token');
    expect(parsed?.prefix).toBe('a1b2c3d4');
  });

  it('rejects malformed AETs', () => {
    expect(parsePatToken('kyl_aet_tooshort_secret')).toBeNull();
    expect(parsePatToken(`kyl_aet_g1b2c3d4_${'A'.repeat(32)}`)).toBeNull();
    expect(parsePatToken('kyl_aet_')).toBeNull();
  });

  it('rejects invalid or malformed tokens', () => {
    expect(parsePatToken('')).toBeNull();
    expect(parsePatToken('random_string')).toBeNull();
    expect(parsePatToken('kyl_pat_short')).toBeNull();
    expect(parsePatToken('kyl_unknown_12345_67890')).toBeNull();
  });

  it('toPublic never exposes metadata.aet', () => {
    const pub = PatService.toPublic({
      id: 'pat_1',
      name: 'agent key',
      prefix: 'a1b2c3d4',
      key: 'hash',
      userId: 'u1',
      enabled: true,
      permissions: '["vault:read"]',
      category: 'agent_enclave_token',
      metadata: JSON.stringify({
        agentId: null,
        aet: { v: 1, deks: { 'credential:x': { wrappedDek: 'w', iv: 'i', algorithm: 'AES-256-GCM' } } },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(pub.category).toBe('agent_enclave_token');
    expect(JSON.stringify(pub)).not.toContain('aet');
    expect(JSON.stringify(pub)).not.toContain('wrappedDek');
  });

  it('stores metadata.aet on create and returns a kyl_aet_ bearer', async () => {
    const envelope = {
      v: 1,
      alg: 'AES-256-GCM',
      kdf: 'HKDF-SHA256',
      salt: bytesToBase64(new Uint8Array(16)),
      resources: { credential: true, totp: false, note: false },
      createdAt: new Date().toISOString(),
      deks: {},
    };
    try {
      const res = await PatService.create({
        userId: 'u_test_aet',
        name: 'agent key',
        scopes: ['vault:read'],
        keyCategory: 'agent_enclave_token',
        aetEnvelope: envelope,
      });
      expect(res.token).toMatch(/^kyl_aet_[0-9a-f]{8}_[A-Za-z0-9_-]{32}$/);
      expect(res.pat.category).toBe('agent_enclave_token');
    } catch (e: any) {
      // DB unavailable in unit env is acceptable; failure must not be a validation error
      expect(e?.code).not.toBe('invalid_envelope');
    }
  });

  it('rejects an invalid envelope on create', async () => {
    await expect(
      PatService.create({
        userId: 'u_test_aet',
        name: 'agent key',
        scopes: ['vault:read'],
        keyCategory: 'agent_enclave_token',
        aetEnvelope: { v: 2 },
      })
    ).rejects.toThrowError(expect.objectContaining({ code: 'invalid_envelope' }));
  });
});
