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
    expect(getLoginChallengeFactors('email-otp', null)).toEqual(['recoverycode']);
    expect(getLoginChallengeFactors('oauth2', null)).toEqual(['recoverycode']);
    expect(getLoginChallengeFactors('unknown', null)).toEqual(['recoverycode']);
  });

  it('handles empty factors object or falsy factor values', () => {
    expect(getLoginChallengeFactors('password', {})).toEqual(['recoverycode']);
    expect(
      getLoginChallengeFactors('password', { email: false, totp: false })
    ).toEqual(['recoverycode']);
    expect(
      getLoginChallengeFactors('password', { email: undefined, totp: undefined })
    ).toEqual(['recoverycode']);
  });

  it('includes email for non-email-otp login methods when email factor is enabled', () => {
    const factors = { email: true, totp: false };
    expect(getLoginChallengeFactors('password', factors)).toEqual(['email', 'recoverycode']);
    expect(getLoginChallengeFactors('oauth2', factors)).toEqual(['email', 'recoverycode']);
    expect(getLoginChallengeFactors('unknown', factors)).toEqual(['email', 'recoverycode']);
  });

  it('excludes email factor when login method is email-otp even if email factor is true', () => {
    const factors = { email: true, totp: false };
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['recoverycode']);
  });

  it('includes totp factor when enabled across any login method', () => {
    const factors = { email: false, totp: true };
    expect(getLoginChallengeFactors('password', factors)).toEqual(['totp', 'recoverycode']);
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['totp', 'recoverycode']);
    expect(getLoginChallengeFactors('oauth2', factors)).toEqual(['totp', 'recoverycode']);
    expect(getLoginChallengeFactors('unknown', factors)).toEqual(['totp', 'recoverycode']);
  });

  it('includes both email and totp in correct order for eligible login methods', () => {
    const factors = { email: true, totp: true };
    expect(getLoginChallengeFactors('password', factors)).toEqual([
      'email',
      'totp',
      'recoverycode',
    ]);
    expect(getLoginChallengeFactors('oauth2', factors)).toEqual([
      'email',
      'totp',
      'recoverycode',
    ]);
    expect(getLoginChallengeFactors('unknown', factors)).toEqual([
      'email',
      'totp',
      'recoverycode',
    ]);
  });

  it('excludes email and includes totp for email-otp login method when both are enabled', () => {
    const factors = { email: true, totp: true };
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['totp', 'recoverycode']);
  });

  it('ignores additional factor flags like phone, passkey, and mfaEnabled', () => {
    const factors = {
      email: false,
      totp: false,
      phone: true,
      passkey: true,
      mfaEnabled: true,
    };
    expect(getLoginChallengeFactors('password', factors)).toEqual(['recoverycode']);
  });

  it('combines email and totp with extra factor flags correctly', () => {
    const factors = {
      email: true,
      totp: true,
      phone: true,
      passkey: true,
      mfaEnabled: true,
    };
    expect(getLoginChallengeFactors('password', factors)).toEqual([
      'email',
      'totp',
      'recoverycode',
    ]);
    expect(getLoginChallengeFactors('email-otp', factors)).toEqual(['totp', 'recoverycode']);
  });
});

describe('getPreferredLoginChallengeFactor', () => {
  it('prefers totp when totp factor is available regardless of email factor', () => {
    const factorsBoth = { email: true, totp: true };
    const factorsTotpOnly = { email: false, totp: true };

    expect(getPreferredLoginChallengeFactor('password', factorsBoth)).toBe('totp');
    expect(getPreferredLoginChallengeFactor('oauth2', factorsBoth)).toBe('totp');
    expect(getPreferredLoginChallengeFactor('email-otp', factorsBoth)).toBe('totp');
    expect(getPreferredLoginChallengeFactor('unknown', factorsBoth)).toBe('totp');

    expect(getPreferredLoginChallengeFactor('password', factorsTotpOnly)).toBe('totp');
    expect(getPreferredLoginChallengeFactor('email-otp', factorsTotpOnly)).toBe('totp');
  });

  it('prefers email when totp is unavailable and email factor is active for eligible login methods', () => {
    const factors = { email: true, totp: false };
    expect(getPreferredLoginChallengeFactor('password', factors)).toBe('email');
    expect(getPreferredLoginChallengeFactor('oauth2', factors)).toBe('email');
    expect(getPreferredLoginChallengeFactor('unknown', factors)).toBe('email');
  });

  it('falls back to recoverycode when email is excluded due to email-otp login method and totp is unavailable', () => {
    const factors = { email: true, totp: false };
    expect(getPreferredLoginChallengeFactor('email-otp', factors)).toBe('recoverycode');
  });

  it('falls back to recoverycode when no preferred factors (totp or email) are available', () => {
    expect(getPreferredLoginChallengeFactor('password', null)).toBe('recoverycode');
    expect(getPreferredLoginChallengeFactor('password', undefined)).toBe('recoverycode');
    expect(getPreferredLoginChallengeFactor('password', {})).toBe('recoverycode');
    expect(getPreferredLoginChallengeFactor('password', { email: false, totp: false })).toBe('recoverycode');
    expect(getPreferredLoginChallengeFactor('email-otp', { email: false, totp: false })).toBe('recoverycode');
  });

  it('ignores non-challenge factors like phone, passkey, and mfaEnabled when determining preferred factor', () => {
    const factorsOnlyOther = {
      email: false,
      totp: false,
      phone: true,
      passkey: true,
      mfaEnabled: true,
    };
    expect(getPreferredLoginChallengeFactor('password', factorsOnlyOther)).toBe('recoverycode');

    const factorsWithTotpAndOther = {
      email: false,
      totp: true,
      phone: true,
      passkey: true,
      mfaEnabled: true,
    };
    expect(getPreferredLoginChallengeFactor('password', factorsWithTotpAndOther)).toBe('totp');

    const factorsWithEmailAndOther = {
      email: true,
      totp: false,
      phone: true,
      passkey: true,
      mfaEnabled: true,
    };
    expect(getPreferredLoginChallengeFactor('password', factorsWithEmailAndOther)).toBe('email');
  });
});
