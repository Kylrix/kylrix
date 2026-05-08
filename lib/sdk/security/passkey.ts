import { startAuthentication } from '@simplewebauthn/browser';
import {
  resolvePasskeyRpId,
  transportsForPasskeyEntry,
} from '@/lib/passkey-webauthn-options';

export type PasskeyEntry = {
  credentialId?: string | null;
  wrappedKey: string;
  type?: string;
  params?: string | null;
};

export type PasskeyUnlockContext = {
  userId: string;
  rpId?: string;
  listKeychainEntries: (userId: string) => Promise<PasskeyEntry[]>;
  completeUnlock: (mekBytes: ArrayBuffer) => Promise<boolean>;
  onStatus?: (message: string) => void;
  onError?: (message: string, error?: unknown) => void;
};

export async function unlockWithPasskeyCore(context: PasskeyUnlockContext): Promise<boolean> {
  const host =
    typeof window !== 'undefined' ? window.location.hostname : 'kylrix.space';
  const rpId = context.rpId ?? resolvePasskeyRpId(host);

  try {
    const entries = await context.listKeychainEntries(context.userId);
    const passkeyEntries = entries.filter((entry) => entry.type === 'passkey');

    if (passkeyEntries.length === 0) {
      context.onStatus?.('No passkeys registered for this account.');
      return false;
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = btoa(String.fromCharCode(...challenge));

    const authOptions = {
      challenge: challengeBase64,
      rpId,
      allowCredentials: passkeyEntries.map((entry) => ({
        id: entry.credentialId!,
        type: 'public-key' as const,
        transports: transportsForPasskeyEntry(entry),
      })),
      userVerification: 'preferred' as UserVerificationRequirement,
      timeout: 60000,
    };

    const authResp = await startAuthentication({ optionsJSON: authOptions });
    const matchingEntry = passkeyEntries.find((entry) => entry.credentialId === authResp.id);

    if (!matchingEntry) {
      context.onStatus?.('Authenticated with an unregistered passkey.');
      return false;
    }

    const encoder = new TextEncoder();
    const credentialData = encoder.encode(authResp.id + context.userId);
    const kwrapSeed = await crypto.subtle.digest('SHA-256', credentialData);
    const kwrap = await crypto.subtle.importKey(
      'raw',
      kwrapSeed,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const wrappedKeyBytes = new Uint8Array(
      atob(matchingEntry.wrappedKey).split('').map((char) => char.charCodeAt(0))
    );
    const iv = wrappedKeyBytes.slice(0, 12);
    const ciphertext = wrappedKeyBytes.slice(12);
    const mekBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      kwrap,
      ciphertext
    );

    return await context.completeUnlock(mekBytes);
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'NotAllowedError') {
      return false;
    }

    context.onError?.(err.message || 'Passkey unlock failed', error);
    return false;
  }
}
