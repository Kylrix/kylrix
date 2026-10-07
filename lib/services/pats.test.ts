import { describe, it, expect } from 'vitest';
import { formatPatToken, parsePatToken } from './pats';

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

  it('rejects invalid or malformed tokens', () => {
    expect(parsePatToken('')).toBeNull();
    expect(parsePatToken('random_string')).toBeNull();
    expect(parsePatToken('kyl_pat_short')).toBeNull();
    expect(parsePatToken('kyl_unknown_12345_67890')).toBeNull();
  });
});
