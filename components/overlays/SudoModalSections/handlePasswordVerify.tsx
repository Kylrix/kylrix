"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {

export function handlePasswordVerify(bag: any) {
  const {
  detect,
  handlePasswordVerify
  } = bag as any;

        if (e) e.preventDefault();
        if (!user?.$id) return;

        if (hasMasterpass === false) {
            // Hoop: hasMasterpass false from enclave probe — sync dedicated pocket (sec_enclave_keychain_{userId}) via LocalEngine/RxDB only, no UI fetch. Don't block unlock.
            void import('@/lib/security/enclave').then(({ SecurityEnclave }) => SecurityEnclave.hydrateFromRemote(user.$id, { force: true }).catch(() => {}));
            // Still attempt unlock if password provided — decouple from stale probe (masterpass-crypto SoT). Only redirect to setup if unlock+verified zero rows.
            if (!password) {
                handleRedirectToVaultSetup();
                return;
            }
            // fall through to unlock attempt below
        }

        if (!password) return;

        setLoading(true);
        try {
            const success = await masterPassCrypto.unlock(
              password,
              user.$id,
              false
            );

            if (success) {
                setHasMasterpass(true);
                SUDO_DETECT_CACHE.set(user.$id, {
                    hasPass: true,
                    pending: false,
                    passkeyPresent: hasPasskey || false,
                    timestamp: Date.now()
                });
                // IF MIGRATING: Don't call handleSuccessWithSync yet.
                if (isMigratingRef.current) {
                    return;
                }
                if (intent === "upgrade") {
                    setMode("change-masterpass");
                    setPassword("");
                    setConfirmPassword("");
                } else {
                    toast.success("Verified");
                    handleSuccessWithSync();
                }
            } else {
                toast.error("Incorrect master password");
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === 'VAULT_ALREADY_EXISTS') {
                toast.error("Vault already initialized.");
                handleSuccessWithSync();
            } else {
                toast.error("Verification failed");
            }
        } finally {
            setLoading(false);
        }
}
