---
name: why.mfa-session-verification
description: Deep dive into the temporal Multi-Factor Authentication (MFA) session verification in Kylrix. Explains factor normalization, temporal alignment (mfaUpdatedAt vs createdAt), and TOTP verification rules.
---

# Why: Multi-Factor Authentication Session Verification & Temporal Alignments

Multi-factor authentication (MFA) is critical to protect accounts, but simple checks are easily bypassed if session states are not validated accurately. For example, if a system simply checks "is MFA enabled on the account?", an attacker who hijacks a session created before MFA was configured could bypass the lock.

We solve this using temporal **MFA Session Verification** in `lib/mfa-session.ts`.

## 1. Temporal MFA Verification Alignment

To ensure a session is fully verified, we compare the exact timestamp when MFA was completed against the timestamp when the session was created:

```typescript
export function sessionHasCompletedTotpMfa(session?: SessionLike | null): boolean {
  const createdAt = session?.$createdAt ? Date.parse(session.$createdAt) : NaN;
  const mfaUpdatedAt = session?.mfaUpdatedAt ? Date.parse(session.mfaUpdatedAt) : NaN;

  if (Number.isFinite(createdAt) && Number.isFinite(mfaUpdatedAt)) {
    return mfaUpdatedAt >= createdAt;
  }

  const activeFactors = Array.isArray(session?.factors) ? session.factors.filter(Boolean) : [];
  return activeFactors.includes('totp');
}
```

This enforces a crucial security rule: **the MFA challenge must have been completed *after* the active session was generated**. If the session is newer than the last MFA verification, the user is prompted to re-authenticate.

## 2. Dynamic Factor Normalization

Users can configure multiple authentication factors (TOTP, Email, Phone). The service normalizes these options dynamically:

```typescript
export function normalizeMfaFactors(value: unknown): MfaFactorsLike | null {
  if (!value || typeof value !== 'object') return null;
  const factors = value as Record<string, unknown>;
  return {
    email: Boolean(factors.email),
    totp: Boolean(factors.totp),
    phone: Boolean(factors.phone),
  };
}
```

## 3. Passive Security Checks

To keep the application fast and avoid locking out users who haven't enabled MFA, the engine performs passive validation. If MFA factors are disabled on the account, the check completes instantly:

```typescript
export function sessionNeedsTotpMfa(params: {
  session?: SessionLike | null;
  availableFactors?: MfaFactorsLike | null;
}): boolean {
  if (!totpIsEnabled(params.availableFactors)) {
    return false; // MFA is not set up, proceed normally
  }
  return !sessionHasCompletedTotpMfa(params.session);
}
```
