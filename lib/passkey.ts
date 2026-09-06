"use client";

import { startAuthentication } from '@simplewebauthn/browser';
import { AppwriteService } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import {
  resolvePasskeyRpId,
  transportsForPasskeyEntry} from '@/lib/passkey-webauthn-options';
import { bufferToBase64Url } from '@/lib/webauthn-utils';
import toast from 'react-hot-toast';
import { getPasskeyRegisterFallbackSeedAction } from '@/lib/actions/auth-actions';

function seedBase64ToBuffer(seed: string): ArrayBuffer {
  return new Uint8Array(atob(seed).split('').map((c) => c.charCodeAt(0))).buffer;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((v) => v).catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function tryUnwrapMek(
  kwrapSeed: ArrayBuffer,
  wrappedKeyBytes: Uint8Array,
): Promise<ArrayBuffer | null> {
  try {
    const kwrap = await crypto.subtle.importKey(
      'raw',
      kwrapSeed,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const iv = wrappedKeyBytes.slice(0, 12);
    const ciphertext = wrappedKeyBytes.slice(12);
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kwrap, ciphertext);
  } catch {
    return null;
  }
}

/**
 * Unlocks the ecosystem security (MEK) using a registered passkey.
 * signal allows SudoModal to abort cleanly when switching to password — abort is not a failure.
 * MEK unwrap stays local; server seed / keychain fetch never gate unlock longer than a short timeout.
 */
export async function unlockWithPasskey(userId: string, signal?: AbortSignal): Promise<boolean> {
  try {
    // 1. Get passkey rows from security enclave first (offline-safe)
    const { SecurityEnclave } = await import('@/lib/security/enclave');
    let passkeyEntries = await SecurityEnclave.getPasskeyEntries(userId);

    if (passkeyEntries.length === 0) {
      // Soft-timeout remote fill — never hang unlock on a dead socket
      const entries = await withTimeout<any[]>(
        AppwriteService.listKeychainEntries(userId) as Promise<any[]>,
        4000,
      );
      if (Array.isArray(entries) && entries.length > 0) {
        passkeyEntries = entries.filter((k: any) => k.type === 'passkey');
        void SecurityEnclave.setKeychain(userId, entries).catch(() => {});
      }
    }

    if (passkeyEntries.length === 0) {
      toast.error("No passkeys registered for this account.");
      return false;
    }

    // 2. Prepare authentication options
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = bufferToBase64Url(challenge.buffer);

    const rpId = resolvePasskeyRpId(window.location.hostname);

    const authOptions: any = {
      challenge: challengeBase64,
      rpId,
      allowCredentials: passkeyEntries.map((entry: any) => ({
        id: entry.credentialId!,
        type: 'public-key' as const,
        transports: transportsForPasskeyEntry(entry)})),
      userVerification: 'preferred' as UserVerificationRequirement,
      timeout: 60000};

    const wantsPrf = passkeyEntries.some((entry: any) => {
      if (entry.authPasskey) return true;
      try {
        const paramsObj = typeof entry.params === 'string' ? JSON.parse(entry.params) : entry.params;
        return !!paramsObj?.prf;
      } catch {
        return false;
      }
    });
    if (wantsPrf) {
      authOptions.extensions = {
        prf: {
          eval: {
            first: new TextEncoder().encode('kylrix-unified-salt-v1')
          }
        }
      };
    }

    // 3. Start WebAuthn authentication — abortable when user switches to password (not a failure)
    if (signal?.aborted) return false;
    const authResp = await (signal
      ? Promise.race([
          startAuthentication({ optionsJSON: authOptions } as any),
          new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted due to method switch', 'AbortError')), { once: true })),
        ])
      : startAuthentication({ optionsJSON: authOptions } as any));

    // 4. Find the matching keychain entry
    const matchingEntry = passkeyEntries.find((e: any) => e.credentialId === authResp.id);
    if (!matchingEntry) {
      toast.error("Authenticated with an unregistered passkey.");
      return false;
    }

    const wrappedKeyBytes = new Uint8Array(
      atob(matchingEntry.wrappedKey).split('').map((c) => c.charCodeAt(0)),
    );

    // 5. Resolve kwrap seed locally first (PRF → cached → digest), server only as last resort
    let usePrf = false;
    if (matchingEntry.params) {
      try {
        const paramsObj = JSON.parse(matchingEntry.params);
        usePrf = !!paramsObj.prf;
      } catch (_e) {}
    }

    const seedCandidates: ArrayBuffer[] = [];

    if (usePrf) {
      const extensionResults = authResp.clientExtensionResults as any;
      const prfBuffer = extensionResults?.prf?.results?.first;
      if (prfBuffer) {
        const bytes =
          prfBuffer instanceof ArrayBuffer
            ? new Uint8Array(prfBuffer)
            : prfBuffer instanceof Uint8Array
              ? prfBuffer
              : new Uint8Array(prfBuffer as ArrayBuffer);
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        seedCandidates.push(copy.buffer);
      }
    }

    const cachedSeed = await SecurityEnclave.getPasskeyFallbackSeed(userId, matchingEntry.credentialId);
    if (cachedSeed) {
      seedCandidates.push(seedBase64ToBuffer(cachedSeed));
    }

    // Legacy local digest (offline last resort before / after timed-out server)
    {
      const encoder = new TextEncoder();
      const credentialData = encoder.encode(authResp.id + userId);
      seedCandidates.push(await crypto.subtle.digest('SHA-256', credentialData));
    }

    let mekBytes: ArrayBuffer | null = null;
    for (const seed of seedCandidates) {
      mekBytes = await tryUnwrapMek(seed, wrappedKeyBytes);
      if (mekBytes) break;
    }

    if (!mekBytes) {
      const fallbackRes = await withTimeout(
        getPasskeyRegisterFallbackSeedAction(matchingEntry.credentialId),
        4000,
      );
      if (fallbackRes?.success && fallbackRes.seed) {
        mekBytes = await tryUnwrapMek(seedBase64ToBuffer(fallbackRes.seed), wrappedKeyBytes);
        if (mekBytes) {
          void SecurityEnclave.setPasskeyFallbackSeed(
            userId,
            matchingEntry.credentialId,
            fallbackRes.seed,
          ).catch(() => {});
        }
      }
    }

    if (!mekBytes) {
      toast.error('Passkey unlock failed: could not unwrap vault key');
      return false;
    }

    // 6. Import the MEK into ecosystemSecurity — unlock is complete once this succeeds
    const success = await ecosystemSecurity.importMasterKey(mekBytes);

    if (success) {
      // Warm identity/enclave in background — never block unlock UX
      void SecurityEnclave.hydrateFromRemote(userId).catch(() => {});
      return true;
    }

    return false;
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      return false;
    }
    
    console.error("Passkey unlock failed", err);
    toast.error(`Passkey unlock failed: ${err.message}`);
    return false;
  }
}
