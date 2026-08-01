/**
 * Application MEK (Master Encryption Key) foundations.
 *
 * Intended later use: wrap offline / LocalEngine blobs so remembered unlock
 * material is not stored as plaintext at rest.
 *
 * Offline note: browser builds only see env vars inlined at build time.
 * - `KYLRIX_KEY` (server-only) is NOT available in the client or offline SW.
 * - A client wrap key must be `NEXT_PUBLIC_KYLRIX_KEY` (weaker — public in bundle)
 *   or derived/provisioned another way (passkey, device key, etc.).
 *
 * Nothing here is connected to LocalEngine or unlock yet.
 */

export const APP_MEK_ENV_SERVER = 'KYLRIX_KEY';
export const APP_MEK_ENV_PUBLIC = 'NEXT_PUBLIC_KYLRIX_KEY';

export type AppMekProbe = {
  /** Server process has KYLRIX_KEY (Node only). */
  serverKeyPresent: boolean;
  /** Client bundle has NEXT_PUBLIC_KYLRIX_KEY inlined. */
  publicKeyPresent: boolean;
  /** Whether a wrap key could be used in this runtime. */
  usableInThisRuntime: boolean;
  runtime: 'server' | 'browser';
};

function readEnv(name: string): string | undefined {
  try {
    const value = process.env[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Probe only — never returns key material. */
export function probeAppMek(): AppMekProbe {
  const isBrowser = typeof window !== 'undefined';
  const serverKeyPresent = Boolean(!isBrowser && readEnv(APP_MEK_ENV_SERVER));
  const publicKeyPresent = Boolean(readEnv(APP_MEK_ENV_PUBLIC));
  return {
    serverKeyPresent,
    publicKeyPresent,
    usableInThisRuntime: isBrowser ? publicKeyPresent : serverKeyPresent || publicKeyPresent,
    runtime: isBrowser ? 'browser' : 'server',
  };
}

/**
 * Future: derive a CryptoKey for wrapping sealed unlock material.
 * Stub — throws if ever called until intentionally implemented.
 */
export async function getAppMekCryptoKey(): Promise<CryptoKey> {
  throw new Error(
    '[app-mek] Not connected. Remember Unlock seal wrapping is foundation-only.',
  );
}

/**
 * Future: encrypt a Uint8Array with the app MEK for LocalEngine at-rest wrap.
 * Stub — throws if ever called until intentionally implemented.
 */
export async function wrapWithAppMek(_plaintext: Uint8Array): Promise<Uint8Array> {
  void _plaintext;
  throw new Error('[app-mek] wrapWithAppMek is not connected yet.');
}

/**
 * Future: decrypt a blob produced by wrapWithAppMek.
 * Stub — throws if ever called until intentionally implemented.
 */
export async function unwrapWithAppMek(_ciphertext: Uint8Array): Promise<Uint8Array> {
  void _ciphertext;
  throw new Error('[app-mek] unwrapWithAppMek is not connected yet.');
}
