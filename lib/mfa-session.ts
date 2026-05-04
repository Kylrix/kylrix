export type SessionLike = {
  $createdAt?: string | null;
  mfaUpdatedAt?: string | null;
  factors?: string[] | null;
};

export type MfaFactorsLike = {
  email?: boolean;
  totp?: boolean;
  phone?: boolean;
};

export function normalizeMfaFactors(value: unknown): MfaFactorsLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const factors = value as Record<string, unknown>;

  return {
    email: Boolean(factors.email),
    totp: Boolean(factors.totp),
    phone: Boolean(factors.phone),
  };
}

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

export function sessionNeedsTotpMfa(params: {
  session?: SessionLike | null;
  availableFactors?: MfaFactorsLike | null;
}): boolean {
  if (!totpIsEnabled(params.availableFactors)) {
    return false;
  }

  return !sessionHasCompletedTotpMfa(params.session);
}
