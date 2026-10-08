import { AuthenticationFactor, AuthenticatorType, type Account, type Models } from 'appwrite';
import { account } from '@/lib/appwrite/client';

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

type SessionLike = {
  $createdAt?: string | null;
  mfaUpdatedAt?: string | null;
  factors?: string[] | null;
  provider?: string | null;
};

function resolveLoginMethod(provider?: string | null): MfaLoginMethod {
  const value = (provider || '').toLowerCase();
  if (value.includes('email')) return 'email-otp';
  if (value.includes('oauth')) return 'oauth2';
  if (value.includes('password')) return 'password';
  return 'unknown';
}

function normalizeMfaFactors(value: unknown): MfaFactorsLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const factors = value as Record<string, unknown>;
  return {
    email: Boolean(factors.email),
    totp: Boolean(factors.totp),
    phone: Boolean(factors.phone),
    passkey: Boolean(factors.passkey || factors.custom),
  };
}

export function isMfaFullyEnabled(factors?: MfaFactorsLike | null): boolean {
  if (!factors) return false;
  return Boolean(factors.email || factors.totp || factors.passkey || factors.phone);
}

export function isMfaRequiredError(error: unknown): boolean {
  const err = error as { type?: string; message?: string; code?: string };
  return (
    err?.type === 'user_more_factors_required'
    || err?.code === 'MFA_REQUIRED'
    || Boolean(err?.message?.includes('more_factors_required'))
  );
}

export function getLoginChallengeFactors(
  loginMethod: MfaLoginMethod,
  factors?: MfaFactorsLike | null): MfaChallengeFactor[] {
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
  factors?: MfaFactorsLike | null): MfaChallengeFactor {
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
    
    let mfaEnabled = Boolean(bUser?.twoFactorEnabled);
    let totp = Boolean(bUser?.twoFactorEnabled);
    let email = Boolean(bUser?.twoFactorEnabled);
    let hasPasskey = false;

    // Check passkey presence for 2FA capability
    const userId = bUser?.id;
    if (userId) {
      try {
        const { VaultService } = await import('@/lib/appwrite/vault-service');
        const entries = await VaultService.listKeychainEntries(userId);
        hasPasskey = entries.some((e: any) => e.type === 'passkey');
      } catch {}
    }

    // Appwrite fallback check if Better Auth session is not present
    if (!bUser) {
      try {
        const [factorsRes, userDoc] = await Promise.all([
          account.listMfaFactors().catch(() => null),
          account.get().catch(() => null),
        ]);
        if (userDoc?.mfa) {
          mfaEnabled = true;
          const rawFactors = normalizeMfaFactors(factorsRes);
          totp = Boolean(rawFactors?.totp);
          email = Boolean(rawFactors?.email);
        }
      } catch {}
    }

    return {
      email,
      totp,
      phone: false,
      passkey: hasPasskey,
      mfaEnabled,
    };
  } catch {
    return { email: false, totp: false, phone: false, passkey: false, mfaEnabled: false };
  }
}

export async function assertAuthenticatedAccount(
  target: Account = account): Promise<Models.User<Models.Preferences>> {
  return target.get();
}

export async function beginMfaChallenge(
  factor: MfaChallengeFactor,
  target: Account = account): Promise<string> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    if (factor === 'email' || factor === 'totp' || (factor as string) === 'otp') {
      const res = await authClient.twoFactor.sendOtp({ trustDevice: true }).catch(() => null);
      if (res?.data) {
        return 'better-auth-otp-challenge';
      }
    }
  } catch {}

  try {
    const response = await target.createMfaChallenge({
      factor: factor as AuthenticationFactor});
    return (response as { $id: string }).$id;
  } catch {
    return 'fallback-challenge';
  }
}

export async function completeMfaChallenge(
  challengeId: string,
  otp: string,
  target: Account = account,
  factor: MfaChallengeFactor = 'totp'): Promise<void> {
  const code = otp.trim();
  let verified = false;

  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    if (factor === 'totp') {
      const res = await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
      if (res?.data) verified = true;
    } else if (factor === 'email') {
      const res = await authClient.twoFactor.verifyOtp({ code, trustDevice: true });
      if (res?.data) verified = true;
    } else if (factor === 'recoverycode') {
      const res = await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true });
      if (res?.data) verified = true;
    }
  } catch (betterErr: any) {
    if (betterErr?.message && !betterErr.message.includes('not found')) {
      throw betterErr;
    }
  }

  if (!verified && challengeId && challengeId !== 'better-auth-otp-challenge' && challengeId !== 'fallback-challenge') {
    try {
      await target.updateMfaChallenge({
        challengeId,
        otp: code});
      await assertAuthenticatedAccount(target);
      verified = true;
    } catch (appwriteErr) {
      if (!verified) throw appwriteErr;
    }
  }
}

export async function generateMfaRecoveryCodes(
  password?: string,
  target: Account = account): Promise<string[]> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const res = await authClient.twoFactor.generateBackupCodes({
      password: password || undefined,
    });
    if (res?.data?.backupCodes && Array.isArray(res.data.backupCodes)) {
      return res.data.backupCodes;
    }
  } catch {}

  try {
    const response = await target.createMfaRecoveryCodes();
    return response.recoveryCodes || [];
  } catch {
    return [];
  }
}

export async function enableAccountMfa(target: Account = account): Promise<void> {
  try {
    await target.updateMFA({ mfa: true }).catch(() => {});
  } catch {}
}

export async function createTotpAuthenticator(
  password?: string,
  target: Account = account): Promise<{ secret: string; uri: string; backupCodes?: string[] }> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const res = await authClient.twoFactor.enable({
      method: 'totp',
      password: password || undefined,
      issuer: 'Kylrix',
    });
    if (res?.data && 'totpURI' in res.data) {
      return {
        secret: res.data.totpURI,
        uri: res.data.totpURI,
        backupCodes: res.data.backupCodes,
      };
    }
    if (res?.error) {
      throw new Error(res.error.message || 'Failed to enable TOTP 2FA');
    }
  } catch (betterErr: any) {
    if (betterErr?.message && !betterErr.message.includes('network')) {
      throw betterErr;
    }
  }

  return target.createMfaAuthenticator({ type: AuthenticatorType.Totp });
}

export async function verifyTotpAuthenticator(
  otp: string,
  target: Account = account): Promise<void> {
  const code = otp.trim();
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const res = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: true,
    });
    if (res?.error) {
      throw new Error(res.error.message || 'Invalid 2FA code');
    }
    if (res?.data) return;
  } catch (betterErr: any) {
    if (betterErr?.message && !betterErr.message.includes('network')) {
      throw betterErr;
    }
  }

  await target.updateMfaAuthenticator({
    type: AuthenticatorType.Totp,
    otp: code});
}

export async function removeTotpFactor(
  password?: string,
  target: Account = account): Promise<void> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
  } catch {}
  try {
    await target.deleteMfaAuthenticator({ type: AuthenticatorType.Totp }).catch(() => {});
  } catch {}
}

export async function removeEmailFactor(
  password?: string,
  target: Account = account): Promise<void> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
  } catch {}
  try {
    await (target as any).deleteMfaAuthenticator({ type: 'email' }).catch(() => {});
  } catch {}
}

export async function disableAllMfaFactors(
  password?: string,
  target: Account = account): Promise<void> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    await authClient.twoFactor.disable({ password: password || undefined }).catch(() => {});
  } catch {}
  try {
    await target.deleteMfaAuthenticator({ type: AuthenticatorType.Totp }).catch(() => undefined);
    await (target as any).deleteMfaAuthenticator({ type: 'email' }).catch(() => undefined);
    await target.updateMFA({ mfa: false }).catch(() => {});
  } catch {}
}

export async function getCurrentLoginMethod(
  target: Account = account): Promise<MfaLoginMethod> {
  const session = await target.getSession('current').catch(() => null);
  return resolveLoginMethod((session as SessionLike | null)?.provider);
}
