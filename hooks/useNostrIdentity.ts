'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  listNostrIdentitiesAction, 
  registerNostrIdentityAction, 
  setActiveNostrIdentityAction, 
  deleteNostrIdentityAction 
} from '@/lib/actions/secure-ops';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToNpub, bytesToNsec, bytesToHex, hexToBytes, nsecToBytes } from '@/lib/nostr/crypto';

export interface NostrIdentity {
  id?: string;
  npub: string;
  nsec: string;
  label?: string;
  isDefault?: boolean;
  isDerived?: boolean;
  createdAt?: string;
  privateKeyBytes: Uint8Array;
}

export function useNostrIdentity() {
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const [identity, setIdentity] = useState<NostrIdentity | null>(null);
  const [identities, setIdentities] = useState<NostrIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVaultLocked, setIsVaultLocked] = useState(!ecosystemSecurity.status.isUnlocked);

  // Sync vault status
  useEffect(() => {
    const unsub = ecosystemSecurity.onStatusChange((status) => {
      setIsVaultLocked(!status.isUnlocked);
    });
    return unsub;
  }, []);

  const loadOrMintIdentity = useCallback(async () => {
    if (!user?.$id) return null;
    
    setLoading(true);
    try {
      // 1. Retrieve master key from volatile RAM
      const masterKey = ecosystemSecurity.getMasterKey();
      if (!masterKey) {
        setIsVaultLocked(true);
        setLoading(false);
        return null;
      }

      setIsVaultLocked(false);

      // Generate JWT for secure actions validation
      let jwtToken: string | undefined;
      try {
        const jwtResponse = await account.createJWT();
        jwtToken = jwtResponse.jwt;
      } catch (err) {
        console.warn('Failed to generate JWT (possible guest session):', err);
      }

      // Check all registered identities on server
      const rows = await listNostrIdentitiesAction({ jwt: jwtToken });

      if (rows && rows.length > 0) {
        const decryptedList: NostrIdentity[] = [];
        for (const row of rows) {
          try {
            const decryptedNsecRaw = await ecosystemSecurity.decrypt(row.encryptedNsec);
            const decryptedNsec = JSON.parse(decryptedNsecRaw);
            const privateKeyBytes = hexToBytes(decryptedNsec);
            const derivedNsec = bytesToNsec(privateKeyBytes);
            decryptedList.push({
              id: row.id,
              npub: row.npub,
              nsec: derivedNsec,
              label: row.label,
              isDefault: row.isDefault,
              isDerived: row.isDerived,
              createdAt: row.createdAt,
              privateKeyBytes
            });
          } catch (decryptErr) {
            console.warn('Failed to decrypt Nostr identity row:', row.id, decryptErr);
          }
        }

        setIdentities(decryptedList);
        const active = decryptedList.find(i => i.isDefault) || decryptedList[0] || null;
        setIdentity(active);
        setLoading(false);
        return active;
      }

      // No identities exist yet — Mint default deterministic Nostr key from user MEK
      const rawMek = await window.crypto.subtle.exportKey("raw", masterKey);
      const privKeyBytes = new Uint8Array(sha256(new Uint8Array(rawMek)));
      const pubKeyBytes = secp256k1.schnorr.getPublicKey(privKeyBytes);

      const npub = bytesToNpub(pubKeyBytes);
      const nsec = bytesToNsec(privKeyBytes);

      // Encrypt the hex representation of the nsec using MEK
      const hexNsec = bytesToHex(privKeyBytes);
      const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

      // Store in Appwrite database
      const reg = await registerNostrIdentityAction({
        npub,
        encryptedNsec,
        iv: 'aes-gcm-iv',
        salt: 'mek-derived-salt',
        label: 'Default Kylrix Key',
        isDerived: true,
        makeDefault: true,
        jwt: jwtToken
      });

      const newIdentity: NostrIdentity = {
        id: reg.id,
        npub,
        nsec,
        label: 'Default Kylrix Key',
        isDefault: true,
        isDerived: true,
        privateKeyBytes: privKeyBytes
      };

      setIdentity(newIdentity);
      setIdentities([newIdentity]);
      setLoading(false);
      return newIdentity;
    } catch (err: any) {
      console.error('Failed to load or mint Nostr identity:', err);
      setLoading(false);
      return null;
    }
  }, [user?.$id]);

  const importCustomNsec = useCallback(async (customNsec: string, label?: string): Promise<NostrIdentity | null> => {
    if (!user?.$id) return null;
    const clean = customNsec.trim();
    if (!clean) throw new Error('Private key cannot be empty');

    let privKeyBytes: Uint8Array;
    if (clean.startsWith('nsec')) {
      privKeyBytes = nsecToBytes(clean);
    } else if (/^[0-9a-fA-F]{64}$/.test(clean)) {
      privKeyBytes = hexToBytes(clean);
    } else {
      throw new Error('Invalid Nostr private key. Must be nsec1... or 64-char hex.');
    }

    const masterKey = ecosystemSecurity.getMasterKey();
    if (!masterKey) throw new Error('Vault is locked. Unlock vault first.');

    const pubKeyBytes = secp256k1.schnorr.getPublicKey(privKeyBytes);
    const npub = bytesToNpub(pubKeyBytes);
    const nsec = bytesToNsec(privKeyBytes);

    let jwtToken: string | undefined;
    try {
      const jwtResponse = await account.createJWT();
      jwtToken = jwtResponse.jwt;
    } catch {}

    const hexNsec = bytesToHex(privKeyBytes);
    const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

    const reg = await registerNostrIdentityAction({
      npub,
      encryptedNsec,
      iv: 'aes-gcm-iv',
      salt: 'mek-derived-salt',
      label: label || `Imported (${npub.slice(0, 10)}…)`,
      isDerived: false,
      makeDefault: true,
      jwt: jwtToken,
    });

    const newIdentity: NostrIdentity = {
      id: reg.id,
      npub,
      nsec,
      label: label || `Imported (${npub.slice(0, 10)}…)`,
      isDefault: true,
      isDerived: false,
      privateKeyBytes: privKeyBytes,
    };

    setIdentity(newIdentity);
    await loadOrMintIdentity();
    return newIdentity;
  }, [user?.$id, loadOrMintIdentity]);

  const setActiveIdentity = useCallback(async (identityId: string) => {
    if (!user?.$id) return;
    let jwtToken: string | undefined;
    try {
      const jwtResponse = await account.createJWT();
      jwtToken = jwtResponse.jwt;
    } catch {}

    await setActiveNostrIdentityAction({ identityId, jwt: jwtToken });
    await loadOrMintIdentity();
  }, [user?.$id, loadOrMintIdentity]);

  const deleteIdentity = useCallback(async (identityId: string) => {
    if (!user?.$id) return;
    let jwtToken: string | undefined;
    try {
      const jwtResponse = await account.createJWT();
      jwtToken = jwtResponse.jwt;
    } catch {}

    await deleteNostrIdentityAction({ identityId, jwt: jwtToken });
    await loadOrMintIdentity();
  }, [user?.$id, loadOrMintIdentity]);

  const resetToDefaultIdentity = useCallback(async (): Promise<NostrIdentity | null> => {
    if (!user?.$id) return null;
    const masterKey = ecosystemSecurity.getMasterKey();
    if (!masterKey) throw new Error('Vault is locked. Unlock vault first.');

    const rawMek = await window.crypto.subtle.exportKey('raw', masterKey);
    const privKeyBytes = new Uint8Array(sha256(new Uint8Array(rawMek)));
    const pubKeyBytes = secp256k1.schnorr.getPublicKey(privKeyBytes);

    const npub = bytesToNpub(pubKeyBytes);
    const nsec = bytesToNsec(privKeyBytes);

    let jwtToken: string | undefined;
    try {
      const jwtResponse = await account.createJWT();
      jwtToken = jwtResponse.jwt;
    } catch {}

    const hexNsec = bytesToHex(privKeyBytes);
    const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

    const reg = await registerNostrIdentityAction({
      npub,
      encryptedNsec,
      iv: 'aes-gcm-iv',
      salt: 'mek-derived-salt',
      label: 'Default Kylrix Key',
      isDerived: true,
      makeDefault: true,
      jwt: jwtToken,
    });

    const newIdentity: NostrIdentity = {
      id: reg.id,
      npub,
      nsec,
      label: 'Default Kylrix Key',
      isDefault: true,
      isDerived: true,
      privateKeyBytes: privKeyBytes,
    };

    setIdentity(newIdentity);
    await loadOrMintIdentity();
    return newIdentity;
  }, [user?.$id, loadOrMintIdentity]);

  const unlockAndLoad = useCallback(async () => {
    return new Promise<NostrIdentity | null>((resolve) => {
      requestSudo({
        onSuccess: async () => {
          const id = await loadOrMintIdentity();
          resolve(id);
        },
        onCancel: () => {
          resolve(null);
        }
      });
    });
  }, [requestSudo, loadOrMintIdentity]);

  // Attempt auto-load if vault is already unlocked
  useEffect(() => {
    if (user?.$id && !isVaultLocked && !identity && !loading) {
      loadOrMintIdentity();
    }
  }, [user?.$id, isVaultLocked, identity, loading, loadOrMintIdentity]);

  return {
    identity,
    identities,
    loading,
    isVaultLocked,
    unlockAndLoad,
    loadOrMintIdentity,
    importCustomNsec,
    setActiveIdentity,
    deleteIdentity,
    resetToDefaultIdentity,
  };
}
