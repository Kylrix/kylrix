import { describe, it, expect } from 'vitest';
import { parseTotpData, extractTotpFromBitwardenLogin } from './totp-parser';

describe('totp-parser', () => {
  it('parses otpauth totp URIs accurately', () => {
    const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60';
    const parsed = parseTotpData(uri);
    expect(parsed).toEqual({
      secretKey: 'JBSWY3DPEHPK3PXP',
      issuer: 'GitHub',
      accountName: 'user@example.com',
      algorithm: 'SHA256',
      digits: 8,
      period: 60,
    });
  });

  it('parses otpauth hotp URIs', () => {
    const uri = 'otpauth://hotp/Service:acc?secret=JBSWY3DPEHPK3PXP';
    const parsed = parseTotpData(uri);
    expect(parsed).toBeDefined();
    expect(parsed?.secretKey).toBe('JBSWY3DPEHPK3PXP');
  });

  it('handles otpauth URIs with single path part and issuer param', () => {
    const uri = 'otpauth://totp/accountOnly?secret=JBSWY3DPEHPK3PXP&issuer=ParamIssuer';
    const parsed = parseTotpData(uri);
    expect(parsed?.accountName).toBe('accountOnly');
    expect(parsed?.issuer).toBe('ParamIssuer');
  });

  it('returns null for bad protocols, unknown kinds, or missing secret in otpauth URIs', () => {
    expect(parseTotpData('http://totp/acc?secret=JBSWY3DPEHPK3PXP')).toBeNull();
    expect(parseTotpData('otpauth://invalidkind/acc?secret=JBSWY3DPEHPK3PXP')).toBeNull();
    expect(parseTotpData('otpauth://totp/acc')).toBeNull();
  });

  it('parses bare base32 and hex secrets', () => {
    const base32 = parseTotpData('JBSWY3DPEHPK3PXP');
    expect(base32).toEqual({
      secretKey: 'JBSWY3DPEHPK3PXP',
      issuer: 'Unknown',
      accountName: 'Unknown',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const hex = parseTotpData('1234567890ABCDEF1234567890ABCDEF');
    expect(hex).toBeDefined();
  });

  it('returns null for invalid URIs or secrets', () => {
    expect(parseTotpData('invalid')).toBeNull();
    expect(parseTotpData('http://invalid.com')).toBeNull();
  });

  it('extracts TOTP from Bitwarden login object', () => {
    const res = extractTotpFromBitwardenLogin(
      { totp: 'JBSWY3DPEHPK3PXP', username: 'john_doe' },
      'Amazon - Personal'
    );
    expect(res).toEqual({
      secretKey: 'JBSWY3DPEHPK3PXP',
      issuer: 'Amazon',
      accountName: 'john_doe',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    expect(extractTotpFromBitwardenLogin({ totp: null }, 'Item')).toBeNull();
  });
});
