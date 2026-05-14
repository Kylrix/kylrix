"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import SudoModal from '@/components/overlays/SudoModal';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { usePathname } from 'next/navigation';
import type { KylrixApp } from '@/lib/sdk/design';

import { useAuth } from '@/context/auth/AuthContext';

interface SudoOptions {
    onSuccess: () => void;
    onCancel?: () => void;
    intent?: "unlock" | "initialize" | "reset";
    forcePrompt?: boolean;
}

interface SudoContextType {
    requestSudo: (options: SudoOptions) => void;
    promptSudo: (intent?: "unlock" | "initialize" | "reset", forcePrompt?: boolean) => Promise<boolean>;
    isUnlocked: boolean;
    hasMasterpass: boolean | null;
    hasPasskey: boolean | null;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export function SudoProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [securityStatus, setSecurityStatus] = useState(ecosystemSecurity.status);

    useEffect(() => {
        return ecosystemSecurity.onStatusChange((status) => {
            setSecurityStatus(status);
        });
    }, []);

    useEffect(() => {
        if (user?.$id) {
            ecosystemSecurity.fetchSecuritySnapshot(user.$id);
        }
    }, [user?.$id]);

    const sudoApp: KylrixApp = (() => {
        if (pathname?.startsWith('/vault')) return 'vault';
        if (pathname?.startsWith('/flow')) return 'flow';
        if (pathname?.startsWith('/connect')) return 'connect';
        if (pathname?.startsWith('/accounts')) return 'accounts';
        if (pathname?.startsWith('/settings')) return 'root';
        return 'note';
    })();

    const [pendingAction, setPendingAction] = useState<SudoOptions | null>(null);
    const [sudoPromise, setSudoPromise] = useState<{ resolve: (v: boolean) => void } | null>(null);

    const { isUnlocked, hasMasterpass, hasPasskey } = securityStatus;

    const requestSudo = useCallback((options: SudoOptions) => {
        if (isUnlocked && !options.forcePrompt) {
            options.onSuccess();
            return;
        }

        setPendingAction(options);
        setIsSudoOpen(true);
    }, [isUnlocked]);

    const promptSudo = useCallback((intent: "unlock" | "initialize" | "reset" = "unlock", forcePrompt = false) => {
        if (isUnlocked && !forcePrompt) return Promise.resolve(true);

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
        // Force refresh snapshot after successful sudo action
        if (user?.$id) {
            ecosystemSecurity.fetchSecuritySnapshot(user.$id, true);
        }
    }, [pendingAction, sudoPromise, user]);

    const handleCancel = useCallback(() => {
        setIsSudoOpen(false);
        if (pendingAction?.onCancel) {
            pendingAction.onCancel();
        }
        setPendingAction(null);
        if (sudoPromise) {
            sudoPromise.resolve(false);
            setSudoPromise(null);
        }
    }, [pendingAction, sudoPromise]);

    const contextValue = useMemo<SudoContextType>(
        () => ({ requestSudo, promptSudo, isUnlocked, hasMasterpass, hasPasskey }),
        [requestSudo, promptSudo, isUnlocked, hasMasterpass, hasPasskey]
    );

    return (
        <SudoContext.Provider value={contextValue}>
            {children}
            <SudoModal
                isOpen={isSudoOpen}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                intent={pendingAction?.intent}
                app={sudoApp}
            />
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
