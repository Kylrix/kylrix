"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { AppwriteService } from "@/lib/appwrite";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import toast from "react-hot-toast";

/**
 * Unlocks the ecosystem security (MEK) using a registered passkey.
 */
export async function unlockWithPasskey(userId: string): Promise<boolean> {
  try {
    // 1. Get all keychain entries for the user
    const entries = await AppwriteService.listKeychainEntries(userId);
    const passkeyEntries = entries.filter(k => k.type === 'passkey');

    if (passkeyEntries.length === 0) {
      toast.error("No passkeys registered for this account.");
      return false;
    }

    // 2. Prepare authentication options
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = btoa(String.fromCharCode(...Array.from(challenge)));

    const authOptions = {
      challenge: challengeBase64,
      rpId: window.location.hostname,
      allowCredentials: passkeyEntries.map(entry => ({
        id: entry.credentialId!,
        type: 'public-key' as const,
        transports: ['internal', 'usb', 'nfc', 'ble'] as AuthenticatorTransport[],
      })),
      userVerification: 'preferred' as UserVerificationRequirement,
      timeout: 60000,
    };

    // 3. Start WebAuthn authentication
    const authResp = await startAuthentication(authOptions as any);

    // 4. Find the matching keychain entry
    const matchingEntry = passkeyEntries.find(e => e.credentialId === authResp.id);
    if (!matchingEntry) {
      toast.error("Authenticated with an unregistered passkey.");
      return false;
    }

    // 5. Derive the wrapping key
    const encoder = new TextEncoder();
    const credentialData = encoder.encode(authResp.id + userId);
    const kwrapSeed = await crypto.subtle.digest("SHA-256", credentialData);
    const kwrap = await crypto.subtle.importKey(
      "raw",
      kwrapSeed,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // 6. Unwrap the Master Encryption Key (MEK)
    const wrappedKeyBytes = new Uint8Array(
      atob(matchingEntry.wrappedKey).split("").map(c => c.charCodeAt(0))
    );

    const iv = wrappedKeyBytes.slice(0, 12);
    const ciphertext = wrappedKeyBytes.slice(12);

    const mekBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      kwrap,
      ciphertext
    );

    // 7. Import the MEK into ecosystemSecurity
    const success = await ecosystemSecurity.importMasterKey(mekBytes);

    if (success) {
      toast.success("Vault unlocked via Passkey");
      return true;
    }

    return false;
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'NotAllowedError') {
      return false;
    }
    
    console.error("Passkey unlock failed", err);
    toast.error(`Passkey unlock failed: ${err.message}`);
    return false;
  }
}
