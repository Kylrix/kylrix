export const MFA_RECOVERY_VAULT_NAME = 'kylrix:mfa-recovery';
export const MFA_RECOVERY_KIND = 'kylrix-mfa-recovery';

export type MfaLoginMethod = 'email-otp' | 'oauth2' | 'password' | 'unknown';
export type MfaChallengeFactor = 'email' | 'totp' | 'recoverycode' | 'passkey';

export type MfaFactorsLike = {
  email?: boolean;
  totp?: boolean;
  phone?: boolean;
  passkey?: boolean;
  mfaEnabled?: boolean;
};

export function isMfaFullyEnabled(factors?: MfaFactorsLike | null): boolean {
  if (!factors) return false;
  return Boolean(factors.email || factors.totp || factors.passkey || factors.phone);
}

export function isMfaRequiredError(error: unknown): boolean {
  const err = error as { type?: string; message?: string; code?: string };
  return (
    err?.type === 'user_more_factors_required' ||
    err?.code === 'MFA_REQUIRED' ||
    Boolean(err?.message?.includes('more_factors_required'))
  );
}

export function getLoginChallengeFactors(
  loginMethod: MfaLoginMethod,
  factors?: MfaFactorsLike | null,
): MfaChallengeFactor[] {
  const available: MfaChallengeFactor[] = [];
  const canUseEmail = loginMethod !== 'email-otp' && Boolean(factors?.email);
  if (canUseEmail) {
    available.push('email');
  }
  if (factors?.totp) {
    available.push('totp');
  }
  available.push('recoverycode');
  return available;
}

export function getPreferredLoginChallengeFactor(
  loginMethod: MfaLoginMethod,
  factors?: MfaFactorsLike | null,
): MfaChallengeFactor {
  const options = getLoginChallengeFactors(loginMethod, factors);
  if (options.includes('totp')) return 'totp';
  if (options.includes('email')) return 'email';
  return 'recoverycode';
}

export async function listCurrentMfaFactors(): Promise<MfaFactorsLike> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const betterSession = await authClient.getSession().catch(() => null);
    const bUser = betterSession?.data?.user as any;

    const mfaEnabled = Boolean(bUser?.twoFactorEnabled);
    const totp = Boolean(bUser?.twoFactorEnabled);
    const email = Boolean(bUser?.twoFactorEnabled);

    return {
      email,
      totp,
      phone: false,
      passkey: false,
      mfaEnabled,
    };
  } catch {
    return { email: false, totp: false, phone: false, passkey: false, mfaEnabled: false };
  }
}

export async function beginMfaChallenge(factor: MfaChallengeFactor): Promise<string> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    if (factor === 'email' || factor === 'totp' || (factor as string) === 'otp') {
      const res = await authClient.twoFactor.sendOtp({ trustDevice: true }).catch(() => null);
      if (res?.data) {
        return 'better-auth-otp-challenge';
      }
    }
  } catch {}

  return 'better-auth-otp-challenge';
}

export async function completeMfaChallenge(
  challengeId: string,
  otp: string,
  factor: MfaChallengeFactor = 'totp',
): Promise<void> {
  const code = otp.trim();
  const { authClient } = await import('@/lib/auth/better-auth-client');

  if (factor === 'totp') {
    const res = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    if (res?.error) throw new Error(res.error.message || 'Invalid 2FA code');
  } else if (factor === 'email') {
    const res = await authClient.twoFactor.verifyOtp({ code, trustDevice: true });
    if (res?.error) throw new Error(res.error.message || 'Invalid OTP code');
  } else if (factor === 'recoverycode') {
    const res = await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true });
    if (res?.error) throw new Error(res.error.message || 'Invalid recovery code');
  }
}

export async function generateMfaRecoveryCodes(password?: string): Promise<string[]> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const res = await authClient.twoFactor.generateBackupCodes({
      password: password || undefined,
    });
    if (res?.data?.backupCodes && Array.isArray(res.data.backupCodes)) {
      return res.data.backupCodes;
    }
  } catch {}

  return [];
}

export async function createTotpAuthenticator(
  password?: string,
): Promise<{ secret: string; uri: string; backupCodes?: string[] }> {
  const { authClient } = await import('@/lib/auth/better-auth-client');
  const res = await authClient.twoFactor.enable({
    password: password || undefined,
    issuer: 'Kylrix',
  });
  if (res?.data && 'totpURI' in res.data) {
    const uri = (res.data as any).totpURI || '';
    let secret = uri;
    try {
      const parsed = new URL(uri);
      secret = parsed.searchParams.get('secret') || uri;
    } catch {}
    return {
      secret,
      uri,
      backupCodes: (res.data as any).backupCodes || [],
    };
  }
  if (res?.error) {
    throw new Error(res.error.message || 'Failed to generate 2FA secret');
  }
  return { secret: '', uri: '' };
}

export async function verifyTotpAuthenticator(otp: string): Promise<void> {
  const code = otp.trim();
  const { authClient } = await import('@/lib/auth/better-auth-client');
  const res = await authClient.twoFactor.verifyTotp({
    code,
    trustDevice: true,
  });
  if (res?.error) {
    throw new Error(res.error.message || 'Invalid 2FA code');
  }
}

export async function removeTotpFactor(password?: string): Promise<void> {
  const { authClient } = await import('@/lib/auth/better-auth-client');
  await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
}

export async function removeEmailFactor(password?: string): Promise<void> {
  const { authClient } = await import('@/lib/auth/better-auth-client');
  await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
}

export async function enableAccountMfa(_password?: string): Promise<void> {
  // Better Auth enables MFA via createTotpAuthenticator/verifyTotpAuthenticator
}

export function getCurrentLoginMethod(): MfaLoginMethod {
  return 'password';
}

export async function disableAllMfaFactors(password?: string): Promise<void> {
  const { authClient } = await import('@/lib/auth/better-auth-client');
  await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
}
