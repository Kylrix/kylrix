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
    const [factorsRes, userDoc] = await Promise.all([
      account.listMfaFactors().catch(() => null),
      account.get().catch(() => null),
    ]);

    const factors = normalizeMfaFactors(factorsRes) || { email: false, totp: false, phone: false };
    const mfaEnabled = Boolean(userDoc?.mfa);

    // Check passkey presence for 2FA capability
    let passkey = false;
    if (userDoc?.$id) {
      try {
        const { VaultService } = await import('@/lib/appwrite/vault-service');
        const entries = await VaultService.listKeychainEntries(userDoc.$id);
        passkey = entries.some((e: any) => e.type === 'passkey');
      } catch {}
    }

    return {
      email: Boolean(factors.email),
      totp: Boolean(factors.totp),
      phone: Boolean(factors.phone),
      passkey,
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
  const response = await target.createMfaChallenge({
    factor: factor as AuthenticationFactor});
  return (response as { $id: string }).$id;
}

export async function completeMfaChallenge(
  challengeId: string,
  otp: string,
  target: Account = account): Promise<void> {
  await target.updateMfaChallenge({
    challengeId,
    otp: otp.trim()});
  await assertAuthenticatedAccount(target);
}

export async function generateMfaRecoveryCodes(
  target: Account = account): Promise<string[]> {
  const response = await target.createMfaRecoveryCodes();
  return response.recoveryCodes || [];
}

export async function enableAccountMfa(target: Account = account): Promise<void> {
  await target.updateMFA({ mfa: true });
}

async function disableAccountMfa(target: Account = account): Promise<void> {
  await target.updateMFA({ mfa: false });
}

export async function createTotpAuthenticator(target: Account = account): Promise<{ secret: string; uri: string }> {
  return target.createMfaAuthenticator({ type: AuthenticatorType.Totp });
}

export async function verifyTotpAuthenticator(
  otp: string,
  target: Account = account): Promise<void> {
  await target.updateMfaAuthenticator({
    type: AuthenticatorType.Totp,
    otp: otp.trim()});
}

export async function removeTotpFactor(target: Account = account): Promise<void> {
  await target.deleteMfaAuthenticator({ type: AuthenticatorType.Totp });
  const factors = await listCurrentMfaFactors();
  if (!isMfaFullyEnabled(factors)) {
    await disableAccountMfa(target);
  }
}

export async function removeEmailFactor(target: Account = account): Promise<void> {
  await (target as Account & {
    deleteMfaAuthenticator: (params: { type: string }) => Promise<unknown>;
  }).deleteMfaAuthenticator({ type: 'email' });
  const factors = await listCurrentMfaFactors();
  if (!isMfaFullyEnabled(factors)) {
    await disableAccountMfa(target);
  }
}

export async function disableAllMfaFactors(target: Account = account): Promise<void> {
  const factors = await listCurrentMfaFactors();
  if (factors.totp) {
    await target.deleteMfaAuthenticator({ type: AuthenticatorType.Totp }).catch(() => undefined);
  }
  if (factors.email) {
    await (target as Account & {
      deleteMfaAuthenticator: (params: { type: string }) => Promise<unknown>;
    }).deleteMfaAuthenticator({ type: 'email' }).catch(() => undefined);
  }
  await disableAccountMfa(target);
}

export async function getCurrentLoginMethod(
  target: Account = account): Promise<MfaLoginMethod> {
  const session = await target.getSession('current').catch(() => null);
  return resolveLoginMethod((session as SessionLike | null)?.provider);
}
