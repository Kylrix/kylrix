/**
 * Authentication method policy — env-driven, independent of self-hosted vs cloud.
 * Client bundle reads NEXT_PUBLIC_* mirrors from next.config.js.
 */

import { parseEnvFlag } from '@/lib/config/env-flags';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';

function readServerFlag(name: string): boolean {
  return parseEnvFlag(process.env[name]);
}

function readClientFlag(name: string): boolean {
  return parseEnvFlag(process.env[name]);
}

/** Server-side auth policy snapshot for client UI + actions. */
export function getAuthMethodPolicy() {
  return {
    isSelfHosted: isSelfHostedDeployment(),
    emailPasswordSignup: isEmailPasswordSignupEnabled(),
    emailPasswordSignin: isEmailPasswordSigninEnabled(),
    passkeySignup: isPasskeySignupEnabled(),
    passwordless: isAuthPasswordlessModeEnabled(),
  };
}

export function isAuthPasswordlessModeEnabled(): boolean {
  if (typeof window === 'undefined') {
    return readServerFlag('AUTH_PASSWORDLESS_MODE');
  }
  return readClientFlag('NEXT_PUBLIC_AUTH_PASSWORDLESS_MODE');
}

/** Allow registering new accounts with email + password. */
export function isEmailPasswordSignupEnabled(): boolean {
  if (isAuthPasswordlessModeEnabled()) return false;
  if (typeof window === 'undefined') {
    return readServerFlag('AUTH_EMAIL_PASSWORD_SIGNUP');
  }
  return readClientFlag('NEXT_PUBLIC_AUTH_EMAIL_PASSWORD_SIGNUP');
}

/** Allow registering new accounts with passkey (signup flow wiring is incremental). */
export function isPasskeySignupEnabled(): boolean {
  if (typeof window === 'undefined') {
    return readServerFlag('AUTH_PASSKEY_SIGNUP');
  }
  return readClientFlag('NEXT_PUBLIC_AUTH_PASSKEY_SIGNUP');
}

/** Password sign-in (existing accounts). Blocked only when passwordless mode is on. */
export function isEmailPasswordSigninEnabled(): boolean {
  return !isAuthPasswordlessModeEnabled();
}
