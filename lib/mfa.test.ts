import { describe, it, expect } from 'vitest';
import {
  isMfaRequiredError,
  isMfaFullyEnabled,
  getLoginChallengeFactors,
  getPreferredLoginChallengeFactor,
} from './mfa';

describe('isMfaRequiredError', () => {
  it('returns true when error type is user_more_factors_required', () => {
    const error = { type: 'user_more_factors_required' };
    expect(isMfaRequiredError(error)).toBe(true);
  });

  it('returns true when error code is MFA_REQUIRED', () => {
    const error = { code: 'MFA_REQUIRED' };
    expect(isMfaRequiredError(error)).toBe(true);
  });

  it('returns true when error message includes more_factors_required', () => {
    const error = { message: 'AppwriteException: user_more_factors_required' };
    expect(isMfaRequiredError(error)).toBe(true);
  });

  it('returns true for Error instances with matching message', () => {
    const error = new Error('Session requires more_factors_required before proceeding');
    expect(isMfaRequiredError(error)).toBe(true);
  });

  it('returns true when multiple conditions match', () => {
    const error = {
      type: 'user_more_factors_required',
      code: 'MFA_REQUIRED',
      message: 'more_factors_required',
    };
    expect(isMfaRequiredError(error)).toBe(true);
  });

  it('returns false for generic error objects with non-matching values', () => {
    const error = {
      type: 'user_invalid_credentials',
      code: '401',
      message: 'Invalid email or password',
    };
    expect(isMfaRequiredError(error)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isMfaRequiredError({})).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isMfaRequiredError(null)).toBe(false);
    expect(isMfaRequiredError(undefined)).toBe(false);
  });

  it('returns false for primitive inputs', () => {
    expect(isMfaRequiredError('user_more_factors_required')).toBe(false);
    expect(isMfaRequiredError(401)).toBe(false);
    expect(isMfaRequiredError(true)).toBe(false);
    expect(isMfaRequiredError(false)).toBe(false);
  });

  it('handles objects with non-string message or null message gracefully', () => {
    expect(isMfaRequiredError({ message: null })).toBe(false);
    expect(isMfaRequiredError({ message: undefined })).toBe(false);
    expect(isMfaRequiredError({ type: null, code: null })).toBe(false);
  });
});

describe('isMfaFullyEnabled', () => {
  it('returns false for null or undefined factors', () => {
    expect(isMfaFullyEnabled(null)).toBe(false);
    expect(isMfaFullyEnabled(undefined)).toBe(false);
  });

  it('returns false when no factors are set or all are false', () => {
    expect(isMfaFullyEnabled({})).toBe(false);
    expect(
      isMfaFullyEnabled({ email: false, totp: false, passkey: false, phone: false })
    ).toBe(false);
  });

  it('returns true if email factor is enabled', () => {
    expect(isMfaFullyEnabled({ email: true })).toBe(true);
  });

  it('returns true if totp factor is enabled', () => {
    expect(isMfaFullyEnabled({ totp: true })).toBe(true);
  });

  it('returns true if passkey factor is enabled', () => {
    expect(isMfaFullyEnabled({ passkey: true })).toBe(true);
  });

  it('returns true if phone factor is enabled', () => {
    expect(isMfaFullyEnabled({ phone: true })).toBe(true);
  });
});

describe('getLoginChallengeFactors', () => {
  it('returns recoverycode by default when factors are missing', () => {
    expect(getLoginChallengeFactors('password', null)).toEqual(['recoverycode']);
    expect(getLoginChallengeFactors('password', undefined)).toEqual(['recoverycode']);
  });

  it('includes email for password login when email factor is enabled', () => {
    const factors = { email: true, totp: false };
    expect(getLoginChallengeFactors('password', factors)).toEqual(['email', 'recoverycode']);
  });

  it('excludes email factor when login method is email-otp', () => {
    const factors = { email: true, totp: false };
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['recoverycode']);
  });

  it('includes totp factor when enabled across any login method', () => {
    const factors = { email: true, totp: true };
    expect(getLoginChallengeFactors('password', factors)).toEqual([
      'email',
      'totp',
      'recoverycode',
    ]);
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['totp', 'recoverycode']);
  });
});

describe('getPreferredLoginChallengeFactor', () => {
  it('prefers totp when totp factor is available', () => {
    const factors = { email: true, totp: true };
    expect(getPreferredLoginChallengeFactor('password', factors)).toBe('totp');
  });

  it('prefers email when totp is unavailable and email is eligible', () => {
    const factors = { email: true, totp: false };
    expect(getPreferredLoginChallengeFactor('password', factors)).toBe('email');
  });

  it('falls back to recoverycode when email is excluded due to email-otp login method', () => {
    const factors = { email: true, totp: false };
    expect(getPreferredLoginChallengeFactor('email-otp', factors)).toBe('recoverycode');
  });

  it('falls back to recoverycode when no other factors are available', () => {
    expect(getPreferredLoginChallengeFactor('password', null)).toBe('recoverycode');
  });
});
