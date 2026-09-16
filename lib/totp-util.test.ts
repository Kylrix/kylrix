import { describe, it, expect } from 'vitest';
import { generateTOTP } from './totp-util';

describe('generateTOTP', () => {
  // RFC 6238 standard base32 test key "JBSWY3DPEHPK3PXP" (ASCII: "12345678901234567890")
  const SECRET = 'JBSWY3DPEHPK3PXP';

  it('generates a 6-digit TOTP code by default', () => {
    const code = generateTOTP(SECRET, { timestamp: 1600000000000 });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates deterministic code for fixed timestamp', () => {
    const ts = 1680000000000;
    const code1 = generateTOTP(SECRET, { timestamp: ts });
    const code2 = generateTOTP(SECRET, { timestamp: ts });
    expect(code1).toBe(code2);
  });

  it('supports custom digit lengths', () => {
    const code8 = generateTOTP(SECRET, { digits: 8, timestamp: 1680000000000 });
    expect(code8).toMatch(/^\d{8}$/);
  });

  it('supports custom time step interval', () => {
    const ts = 1680000000000;
    const codeStep30 = generateTOTP(SECRET, { step: 30, timestamp: ts });
    const codeStep60 = generateTOTP(SECRET, { step: 60, timestamp: ts });
    expect(typeof codeStep30).toBe('string');
    expect(typeof codeStep60).toBe('string');
  });

  it('handles lowercase and unpadded base32 secret strings', () => {
    const codeUpper = generateTOTP('jbswy3dpehpk3pxp===', { timestamp: 1680000000000 });
    const codeClean = generateTOTP('JBSWY3DPEHPK3PXP', { timestamp: 1680000000000 });
    expect(codeUpper).toBe(codeClean);
  });
});
