"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {

export function detect(bag: any) {
  const {
  detect,
  handlePasswordVerify
  } = bag as any;

            try {
                setIsDetecting(true);
                const userId = user?.$id || '';
                const cached = SUDO_DETECT_CACHE.get(userId);
                const now = Date.now();

                let hasPass: boolean;
                let pending: boolean;
                let passkeyPresent = false;

                if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
                    hasPass = cached.hasPass;
                    pending = cached.pending;
                    passkeyPresent = cached.passkeyPresent;
                } else {
                    // Instant local probe — never hang unlock UI on a dead socket
                    const { SecurityEnclave } = await import('@/lib/security/enclave');
                    const probe = await SecurityEnclave.probeCapabilities(userId);
                    let entriesRes = probe.keychain;
                    // If local probe returned empty but device is online, attempt AppwriteService fetch as secondary verification
                    if (entriesRes.length === 0 && typeof navigator !== 'undefined' && navigator.onLine !== false) {
                        try {
                            const remoteEntries = await Promise.race([
                                AppwriteService.listKeychainEntries(userId),
                                new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 3500)),
                            ]);
                            if (remoteEntries.length > 0) {
                                entriesRes = remoteEntries;
                                await SecurityEnclave.setKeychain(userId, remoteEntries);
                            }
                        } catch (_err) {}
                    }

                    hasPass =
                        probe.hasMasterpass ||
                        entriesRes.some((e: any) => e.type === 'password' || e.type === 'passkey');
                    pending = entriesRes.some((e: any) => e.type === 'password' && e.isPending);

                    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
                    const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1';
                    passkeyPresent = entriesRes.some((e: any) => {
                        if (e.type !== "passkey") return false;
                        let rpId = '';
                        try {
                            const parsed = typeof e.params === 'string' ? JSON.parse(e.params) : e.params;
                            rpId = parsed?.rpId || '';
                        } catch (_err) {}
                        if (isLocalHost) {
                            return rpId === 'localhost' || rpId === '127.0.0.1';
                        } else {
                            return rpId !== 'localhost' && rpId !== '127.0.0.1';
                        }
                    }) || probe.hasPasskey;

                    SUDO_DETECT_CACHE.set(userId, {
                        hasPass,
                        pending,
                        passkeyPresent,
                        timestamp: now
                    });

                    // Background soft refresh when online (does not block detect)
                    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
                        void SecurityEnclave.hydrateFromRemote(userId).catch(() => {});
                    }
                }

                if (!active) return;
                setHasMasterpass(hasPass);

                // Hoop: hasPass/hasMasterpass false from stale enclave pocket — trigger background sync of dedicated pocket sec_enclave_keychain_{userId} via RxDB/LocalEngine only (rxdb-local-storage-only).
                if (hasPass === false) {
                    void import('@/lib/security/enclave').then(({ SecurityEnclave: _SecurityEnclave }) => _SecurityEnclave.hydrateFromRemote(userId, { force: true }).catch(() => {}));
                }

                // Fail-safe: NEVER default to initialize mode unless explicitly requested by caller (intent === 'initialize')
                // Default to 'password' mode if capability probe is empty due to transient network lag
                if (hasPass === false && intent !== 'initialize') {
                    setMode("password");
                    setIsDetecting(false);
                    return;
                }

                setIsPendingVault(pending);

                const passkeyAllowed = passkeyPresent && isKylrixDomain;
                setHasPasskey(passkeyAllowed);

                // Determine default mode
                if (intent === "initialize") {
                    setMode("initialize");
                } else if (intent === "change-masterpass") {
                    setMode("change-masterpass");
                } else if (intent === "reset") {
                    setMode("reset-confirm");
                    setResetStep(1);
                } else if (intent === "upgrade") {
                    setMode("password");
                } else if (pending) {
                    setMode("password");
                } else if (passkeyAllowed && usePasskeysByDefault) {
                    setMode("passkey");
                } else {
                    setMode("password");
                }

                // Trigger passkey verification immediately if it's default
                if (passkeyAllowed && usePasskeysByDefault && !passkeyTriggeredRef.current) {
                    passkeyTriggeredRef.current = true;
                    // Run async to avoid blocking
                    setTimeout(() => {
                        if (active) handlePasskeyVerify();
                    }, 100);
                }
            } catch (err) {
                console.error("SudoModal detection error:", err);
                if (active) setMode("password");
            } finally {
                if (active) setIsDetecting(false);
            }
}
