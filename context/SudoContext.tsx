'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';
import SudoModal from '@/components/overlays/SudoModal';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { usePathname } from 'next/navigation';
import type { KylrixApp } from '@/lib/sdk/design';

import { useAuth } from '@/context/auth/AuthContext';
import { isFlowPath } from '@/lib/routing/app-paths';
import { useRightRail } from '@/context/RightRailContext';

interface SudoOptions {
    onSuccess: () => void;
    onCancel?: () => void;
    intent?: "unlock" | "initialize" | "reset" | "upgrade";
    forcePrompt?: boolean;
}

interface SudoContextType {
    requestSudo: (options: SudoOptions) => void;
    promptSudo: (intent?: "unlock" | "initialize" | "reset" | "upgrade", forcePrompt?: boolean) => Promise<boolean>;
    isUnlocked: boolean;
    hasMasterpass: boolean | null;
    hasPasskey: boolean | null;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(min-width: 768px)');
        const sync = () => setIsDesktop(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);
    return isDesktop;
}

export function SudoProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const isDesktop = useIsDesktop();
    const { open: openRightRail, close: closeRightRail } = useRightRail();
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [securityStatus, setSecurityStatus] = useState(ecosystemSecurity.status);

    useEffect(() => {
        return ecosystemSecurity.onStatusChange((status) => {
            setSecurityStatus(status);
        });
    }, []);

    const { isUnlocked, hasMasterpass, hasPasskey } = securityStatus;

    useEffect(() => {
        if (user?.$id) {
            ecosystemSecurity.fetchSecuritySnapshot(user.$id);
            void import('@/lib/security/enclave').then(({ SecurityEnclave }) => {
                void SecurityEnclave.hydrateFromRemote(user.$id!).catch(() => {});
            });

            if (!isUnlocked) {
                const recoverMEK = async () => {
                    const { masterPassCrypto } = await import('@/lib/masterpass-crypto');
                    const recovered = await masterPassCrypto.recoverFromServiceWorker();
                    if (recovered) {
                        console.log('[SudoContext] Session re-hydrated from Service Worker.');
                        ecosystemSecurity.fetchSecuritySnapshot(user.$id, true);
                    }
                };
                recoverMEK();
            }
        }
    }, [user?.$id, isUnlocked]);

    const sudoApp: KylrixApp = (() => {
        if (pathname?.startsWith('/vault')) return 'vault';
        if (isFlowPath(pathname)) return 'flow';
        if (pathname?.startsWith('/connect')) return 'connect';
        if (pathname?.startsWith('/accounts')) return 'accounts';
        if (pathname?.startsWith('/settings')) return 'root';
        return 'note';
    })();

    const [pendingAction, setPendingAction] = useState<SudoOptions | null>(null);
    const [sudoPromise, setSudoPromise] = useState<{ resolve: (v: boolean) => void } | null>(null);

    const requestSudo = useCallback((options: SudoOptions) => {
        if (isUnlocked && !options.forcePrompt && options.intent !== "upgrade") {
            options.onSuccess();
            return;
        }

        setPendingAction(options);
        setIsSudoOpen(true);
    }, [isUnlocked]);

    const promptSudo = useCallback((intent: "unlock" | "initialize" | "reset" | "upgrade" = "unlock", forcePrompt = false) => {
        if (isUnlocked && !forcePrompt && intent !== "upgrade") return Promise.resolve(true);

        return new Promise<boolean>((resolve) => {
            setSudoPromise({ resolve });
            setPendingAction({
                intent,
                forcePrompt,
                onSuccess: () => resolve(true),
                onCancel: () => resolve(false)
            });
            setIsSudoOpen(true);
        });
    }, [isUnlocked]);

    const handleSuccess = useCallback(() => {
        setIsSudoOpen(false);
        closeRightRail('sudo');
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("kylrix:vault-unlocked"));
        }
        if (pendingAction) {
            pendingAction.onSuccess();
            setPendingAction(null);
        }
        if (sudoPromise) {
            sudoPromise.resolve(true);
            setSudoPromise(null);
        }
        if (user?.$id) {
            ecosystemSecurity.fetchSecuritySnapshot(user.$id, true);
        }
    }, [pendingAction, sudoPromise, user, closeRightRail]);

    const handleCancel = useCallback(() => {
        setIsSudoOpen(false);
        closeRightRail('sudo');
        if (pendingAction?.onCancel) {
            pendingAction.onCancel();
        }
        setPendingAction(null);
        if (sudoPromise) {
            sudoPromise.resolve(false);
            setSudoPromise(null);
        }
    }, [pendingAction, sudoPromise, closeRightRail]);

    const successRef = useRef(handleSuccess);
    const cancelRef = useRef(handleCancel);
    successRef.current = handleSuccess;
    cancelRef.current = handleCancel;

    useEffect(() => {
        if (!isDesktop) {
            closeRightRail('sudo');
            return;
        }
        if (!isSudoOpen) {
            closeRightRail('sudo');
            return;
        }

        openRightRail(
            <SudoModal
                isOpen
                presentation="embedded"
                onSuccess={() => successRef.current()}
                onCancel={() => cancelRef.current()}
                intent={pendingAction?.intent}
                app={sudoApp}
            />,
            { key: 'sudo', width: 420 },
        );
    }, [isSudoOpen, isDesktop, pendingAction?.intent, sudoApp, openRightRail, closeRightRail]);

    const contextValue = useMemo<SudoContextType>(
        () => ({ requestSudo, promptSudo, isUnlocked, hasMasterpass, hasPasskey }),
        [requestSudo, promptSudo, isUnlocked, hasMasterpass, hasPasskey]
    );

    return (
        <SudoContext.Provider value={contextValue}>
            {children}
            {!isDesktop && (
                <SudoModal
                    isOpen={isSudoOpen}
                    presentation="overlay"
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                    intent={pendingAction?.intent}
                    app={sudoApp}
                />
            )}
        </SudoContext.Provider>
    );
}

export function useSudo() {
    const context = useContext(SudoContext);
    if (!context) {
        throw new Error("useSudo must be used within a SudoProvider");
    }
    return context;
}
