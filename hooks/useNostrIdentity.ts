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
import { bytesToNpub, bytesToNsec, bytesToHex, hexToBytes, nsecToBytes, normalizePrivateKeyBytes } from '@/lib/nostr/crypto';

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

function hydrateNostrIdentity(raw: NostrIdentity | null | undefined): NostrIdentity | null {
  if (!raw) return null;
  const privateKeyBytes =
    normalizePrivateKeyBytes(raw.privateKeyBytes) ??
    normalizePrivateKeyBytes(raw.nsec) ??
    (raw.nsec?.startsWith('nsec') ? nsecToBytes(raw.nsec) : null);
  if (!privateKeyBytes) return null;
  return { ...raw, privateKeyBytes };
}

export function useNostrIdentity() {
  const { user } = useAuth();
  const { requestSudo } = useSudo();
  const [identity, setIdentity] = useState<NostrIdentity | null>(null);
  const [identities, setIdentities] = useState<NostrIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVaultLocked, setIsVaultLocked] = useState(!ecosystemSecurity.status.isUnlocked);

  // Sync vault status & Realtime LocalEngine identity sync
  useEffect(() => {
    const unsub = ecosystemSecurity.onStatusChange((status) => {
      setIsVaultLocked(!status.isUnlocked);
    });

    // Hydrate cached active identity immediately on boot
    void import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
      void LocalEngine.cacheGet<NostrIdentity>('nostr:active_identity').then((cached) => {
        const hydrated = hydrateNostrIdentity(cached);
        if (hydrated) setIdentity(hydrated);
      });
    });

    const handleSync = (e: any) => {
      const hydrated = hydrateNostrIdentity(e?.detail);
      if (hydrated) setIdentity(hydrated);
    };

    window.addEventListener('kylrix:nostr-identity-synced', handleSync);
    return () => {
      unsub();
      window.removeEventListener('kylrix:nostr-identity-synced', handleSync);
    };
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

      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const localEncryptedCacheKey = `nostr:identities_encrypted_${user.$id}`;
      
      // Load current local offline encrypted cache first
      let localRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];

      // Opportunistically query server for remote updates (non-blocking if offline/limited)
      let remoteRows: any[] = [];
      try {
        let jwtToken: string | undefined;
        try {
          const jwtResponse = await account.createJWT();
          jwtToken = jwtResponse?.jwt;
        } catch {}

        remoteRows = (await listNostrIdentitiesAction({ jwt: jwtToken })) || [];
      } catch (err) {
        // Server unreachable or billing limited — proceed entirely from local cache
      }

      // Reconcile and deduplicate by npub (LocalEngine is SoT)
      const mergedRowsMap = new Map<string, any>();
      // Put existing local rows first
      for (const row of localRows) {
        if (row && row.npub) mergedRowsMap.set(row.npub, row);
      }
      // Merge remote rows, preserving local default flag if explicitly set
      for (const remote of remoteRows) {
        if (remote && remote.npub) {
          const existing = mergedRowsMap.get(remote.npub);
          mergedRowsMap.set(remote.npub, {
            ...remote,
            isDefault: existing?.isDefault ?? remote.isDefault,
            label: existing?.label || remote.label,
          });
        }
      }

      let allRows = Array.from(mergedRowsMap.values());

      if (allRows.length > 0) {
        const decryptedList: NostrIdentity[] = [];
        for (const row of allRows) {
          try {
            const decryptedNsecRaw = await ecosystemSecurity.decrypt(row.encryptedNsec);
            const decryptedNsec = JSON.parse(decryptedNsecRaw);
            const privateKeyBytes = hexToBytes(decryptedNsec);
            const derivedNsec = bytesToNsec(privateKeyBytes);
            decryptedList.push({
              id: row.id || row.$id || `id_${row.npub.slice(0, 16)}`,
              npub: row.npub,
              nsec: derivedNsec,
              label: row.label || `Key (${row.npub.slice(0, 8)}…)`,
              isDefault: Boolean(row.isDefault),
              isDerived: Boolean(row.isDerived),
              createdAt: row.createdAt || row.$createdAt,
              privateKeyBytes
            });
          } catch (decryptErr) {
            console.warn('Failed to decrypt Nostr identity row:', row.id || row.npub, decryptErr);
          }
        }

        if (decryptedList.length > 0) {
          setIdentities(decryptedList);

          // Check if user previously selected or imported a specific active key
          const cachedActive = await LocalEngine.cacheGet<NostrIdentity>('nostr:active_identity').catch(() => null);
          const matchedCached = cachedActive?.npub
            ? decryptedList.find((i) => i.npub === cachedActive.npub)
            : null;

          // Priority: (1) explicitly cached active -> (2) isDefault -> (3) imported non-derived -> (4) first
          const active =
            matchedCached ||
            decryptedList.find((i) => i.isDefault) ||
            decryptedList.find((i) => !i.isDerived) ||
            decryptedList[0];

          const hydratedActive = hydrateNostrIdentity(active);
          setIdentity(hydratedActive);
          if (hydratedActive) {
            void LocalEngine.cacheSet('nostr:active_identity', hydratedActive);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kylrix:nostr-identity-synced', { detail: hydratedActive }));
            }
          }

          // Keep local rows synchronized with the active default
          const normalizedRows = allRows.map((r) => ({
            ...r,
            isDefault: r.npub === active.npub,
          }));
          void LocalEngine.cacheSet(localEncryptedCacheKey, normalizedRows).catch(() => {});
          setLoading(false);
          return hydratedActive;
        }
      }

      // No identities exist — Mint default deterministic Nostr key from user MEK (100% offline)
      const rawMek = await window.crypto.subtle.exportKey("raw", masterKey);
      const privKeyBytes = new Uint8Array(sha256(new Uint8Array(rawMek)));
      const pubKeyBytes = secp256k1.schnorr.getPublicKey(privKeyBytes);

      const npub = bytesToNpub(pubKeyBytes);
      const nsec = bytesToNsec(privKeyBytes);
      const hexNsec = bytesToHex(privKeyBytes);
      const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

      const newIdentity = hydrateNostrIdentity({
        id: `derived_${npub.slice(0, 16)}`,
        npub,
        nsec,
        label: 'Default Kylrix Key',
        isDefault: true,
        isDerived: true,
        privateKeyBytes: privKeyBytes,
      })!;

      const initialRow = {
        id: newIdentity.id,
        npub,
        encryptedNsec,
        label: 'Default Kylrix Key',
        isDefault: true,
        isDerived: true,
        createdAt: new Date().toISOString(),
      };

      setIdentity(newIdentity);
      setIdentities([newIdentity]);
      void LocalEngine.cacheSet(localEncryptedCacheKey, [initialRow]).catch(() => {});
      void LocalEngine.cacheSet('nostr:active_identity', newIdentity).catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:nostr-identity-synced', { detail: newIdentity }));
      }

      // Non-blocking background sync to Appwrite database if available
      void (async () => {
        try {
          let jwtToken: string | undefined;
          try {
            const jwtResponse = await account.createJWT();
            jwtToken = jwtResponse?.jwt;
          } catch {}

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
          if (reg?.id) {
            initialRow.id = reg.id;
            void LocalEngine.cacheSet(localEncryptedCacheKey, [initialRow]).catch(() => {});
          }
        } catch {}
      })();

      setLoading(false);
      return newIdentity;
    } catch (err: any) {
      console.error('Failed to load or mint Nostr identity:', err);
      setLoading(false);
      return null;
    }
  }, [user?.$id]);

  const importCustomNsec = useCallback(async (customNsec: string, label?: string, makeDefault: boolean = true): Promise<NostrIdentity | null> => {
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
    const hexNsec = bytesToHex(privKeyBytes);
    const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const localEncryptedCacheKey = `nostr:identities_encrypted_${user.$id}`;
    let existingRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];

    const newId = `imported_${npub.slice(0, 16)}`;
    const newIdentity: NostrIdentity = {
      id: newId,
      npub,
      nsec,
      label: label || `Imported (${npub.slice(0, 10)}…)`,
      isDefault: makeDefault,
      isDerived: false,
      privateKeyBytes: privKeyBytes,
    };

    // Update local encrypted storage immediately (100% offline)
    const updatedRows = existingRows.map((r) => ({
      ...r,
      isDefault: makeDefault ? false : r.isDefault,
    })).filter((r) => r.npub !== npub);

    updatedRows.push({
      id: newId,
      npub,
      encryptedNsec,
      label: newIdentity.label,
      isDefault: makeDefault,
      isDerived: false,
      createdAt: new Date().toISOString(),
    });

    await LocalEngine.cacheSet(localEncryptedCacheKey, updatedRows);

    if (makeDefault) {
      setIdentity(newIdentity);
      await LocalEngine.cacheSet('nostr:active_identity', newIdentity);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:nostr-identity-synced', { detail: newIdentity }));
      }
    }

    // Refresh state from local cache
    await loadOrMintIdentity();

    // Background opportunistic sync to Appwrite
    void (async () => {
      try {
        let jwtToken: string | undefined;
        try {
          const jwtResponse = await account.createJWT();
          jwtToken = jwtResponse?.jwt;
        } catch {}

        const reg = await registerNostrIdentityAction({
          npub,
          encryptedNsec,
          iv: 'aes-gcm-iv',
          salt: 'mek-derived-salt',
          label: newIdentity.label,
          isDerived: false,
          makeDefault,
          jwt: jwtToken,
        });

        if (reg?.id) {
          const syncedRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];
          const idx = syncedRows.findIndex((r) => r.npub === npub);
          if (idx !== -1) {
            syncedRows[idx].id = reg.id;
            await LocalEngine.cacheSet(localEncryptedCacheKey, syncedRows);
          }
        }
      } catch {
        // Backend offline or over quota — local storage is already fully active
      }
    })();

    return newIdentity;
  }, [user?.$id, loadOrMintIdentity]);

  const setActiveIdentity = useCallback(async (identityIdOrNpub: string) => {
    if (!user?.$id) return;
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const localEncryptedCacheKey = `nostr:identities_encrypted_${user.$id}`;
    let existingRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];

    const targetRow = existingRows.find((r) => r.id === identityIdOrNpub || r.npub === identityIdOrNpub);
    if (targetRow) {
      const updatedRows = existingRows.map((r) => ({
        ...r,
        isDefault: r.npub === targetRow.npub,
      }));
      await LocalEngine.cacheSet(localEncryptedCacheKey, updatedRows);
    }

    await loadOrMintIdentity();

    // Opportunistic background sync to Appwrite
    void (async () => {
      try {
        let jwtToken: string | undefined;
        try {
          const jwtResponse = await account.createJWT();
          jwtToken = jwtResponse?.jwt;
        } catch {}
        if (targetRow?.id && !targetRow.id.startsWith('imported_') && !targetRow.id.startsWith('derived_')) {
          await setActiveNostrIdentityAction({ identityId: targetRow.id, jwt: jwtToken });
        }
      } catch {}
    })();
  }, [user?.$id, loadOrMintIdentity]);

  const deleteIdentity = useCallback(async (identityIdOrNpub: string) => {
    if (!user?.$id) return;
    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const localEncryptedCacheKey = `nostr:identities_encrypted_${user.$id}`;
    let existingRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];

    const targetRow = existingRows.find((r) => r.id === identityIdOrNpub || r.npub === identityIdOrNpub);
    const updatedRows = existingRows.filter((r) => r.id !== identityIdOrNpub && r.npub !== identityIdOrNpub);
    
    // If deleted identity was default, set first remaining as default
    if (targetRow?.isDefault && updatedRows.length > 0) {
      updatedRows[0].isDefault = true;
    }

    await LocalEngine.cacheSet(localEncryptedCacheKey, updatedRows);
    await loadOrMintIdentity();

    // Opportunistic background delete on Appwrite
    void (async () => {
      try {
        let jwtToken: string | undefined;
        try {
          const jwtResponse = await account.createJWT();
          jwtToken = jwtResponse?.jwt;
        } catch {}
        if (targetRow?.id && !targetRow.id.startsWith('imported_') && !targetRow.id.startsWith('derived_')) {
          await deleteNostrIdentityAction({ identityId: targetRow.id, jwt: jwtToken });
        }
      } catch {}
    })();
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
    const hexNsec = bytesToHex(privKeyBytes);
    const encryptedNsec = await ecosystemSecurity.encrypt(hexNsec);

    const { LocalEngine } = await import('@/lib/services/LocalEngine');
    const localEncryptedCacheKey = `nostr:identities_encrypted_${user.$id}`;
    let existingRows = (await LocalEngine.cacheGet<any[]>(localEncryptedCacheKey).catch(() => [])) || [];

    const defaultRow = {
      id: `derived_${npub.slice(0, 16)}`,
      npub,
      encryptedNsec,
      label: 'Default Kylrix Key',
      isDerived: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
    };

    const updatedRows = existingRows.map((r) => ({
      ...r,
      isDefault: r.npub === npub,
    }));
    if (!updatedRows.some((r) => r.npub === npub)) {
      updatedRows.unshift(defaultRow);
    }

    await LocalEngine.cacheSet(localEncryptedCacheKey, updatedRows);
    return await loadOrMintIdentity();
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
