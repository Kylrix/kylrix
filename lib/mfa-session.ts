export {
  normalizeMfaFactors,
  isMfaFullyEnabled,
  isMfaRequiredError,
  requiresMfaChallenge,
  resolveLoginMethod,
  type MfaFactorsLike,
  type SessionLike,
} from '@/lib/mfa';

import { isMfaFullyEnabled, normalizeMfaFactors, type MfaFactorsLike, type SessionLike } from '@/lib/mfa';

export function totpIsEnabled(factors?: MfaFactorsLike | null): boolean {
  return Boolean(factors?.totp);
}

export function sessionHasCompletedTotpMfa(session?: SessionLike | null): boolean {
  const createdAt = session?.$createdAt ? Date.parse(session.$createdAt) : NaN;
  const mfaUpdatedAt = session?.mfaUpdatedAt ? Date.parse(session.mfaUpdatedAt) : NaN;

  if (Number.isFinite(createdAt) && Number.isFinite(mfaUpdatedAt)) {
    return mfaUpdatedAt >= createdAt;
  }

  const activeFactors = Array.isArray(session?.factors) ? session.factors.filter(Boolean) : [];
  return activeFactors.includes('totp');
}

/** @deprecated Prefer requiresMfaChallenge() which follows Appwrite account.get() semantics. */
export function sessionNeedsTotpMfa(params: {
  session?: SessionLike | null;
  availableFactors?: MfaFactorsLike | null;
}): boolean {
  if (!isMfaFullyEnabled(params.availableFactors)) {
    return false;
  }

  return !sessionHasCompletedTotpMfa(params.session);
}
