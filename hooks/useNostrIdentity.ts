'use client';

import { useState, useCallback, useEffect } from 'react';
import { getNostrIdentityAction, registerNostrIdentityAction } from '@/lib/actions/secure-ops';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useSudo } from '@/context/SudoContext';
import { useAuth } from '@/context/auth/AuthContext';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp256k1 from '@noble/secp256k1';
import { bytesToNpub, bytesToNsec, bytesToHex, hexToBytes } from '@/lib/tmp/crypto';
import toast from 'react-hot-toast';

export interface NostrIdentity {
  npub: string;
  nsec: string;
  privateKeyBytes: Uint8Array;
}

export function useNostrIdentity() {
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const [identity, setIdentity] = useState<NostrIdentity | null>(null);
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

      // Check if identity already exists on server
      const existing = await getNostrIdentityAction();

      if (existing) {
        // Decrypt the nsec using vault decrypt
        const decryptedNsec = await ecosystemSecurity.decrypt(existing.encryptedNsec);
        const privateKeyBytes = hexToBytes(decryptedNsec);
        const derivedNsec = bytesToNsec(privateKeyBytes);

        const currentIdentity: NostrIdentity = {
          npub: existing.npub,
          nsec: derivedNsec,
          privateKeyBytes
        };
        setIdentity(currentIdentity);
        setLoading(false);
        return currentIdentity;
      }

      // Mint a new Nostr key deterministically from user MEK
      const rawMek = await window.crypto.subtle.exportKey("raw", masterKey);
      const privKeyBytes = new Uint8Array(sha256(new Uint8Array(rawMek)));
      const pubKeyBytes = secp256k1.schnorr.getPublicKey(privKeyBytes);

      const npub = bytesToNpub(pubKeyBytes);
      const nsec = bytesToNsec(privKeyBytes);

      // Encrypt the hex representation of the nsec using MEK
      const hexNsec = bytesToHex(privKeyBytes);
      const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

      // Store in Appwrite database
      await registerNostrIdentityAction({
        npub,
        encryptedNsec,
        iv: 'aes-gcm-iv', // IV is handled internally by ecosystemSecurity.encrypt/decrypt
        salt: 'mek-derived-salt'
      });

      const newIdentity: NostrIdentity = {
        npub,
        nsec,
        privateKeyBytes: privKeyBytes
      };

      setIdentity(newIdentity);
      setLoading(false);
      return newIdentity;
    } catch (err: any) {
      console.error('Failed to load or mint Nostr identity:', err);
      toast.error('Failed to initialize Nostr identity');
      setLoading(false);
      return null;
    }
  }, [user?.$id]);

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
    loading,
    isVaultLocked,
    unlockAndLoad,
  };
}
