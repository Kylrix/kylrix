"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { SudoModal } from "@/components/overlays/SudoModal";
import { ecosystemSecurity } from "@/lib/ecosystem/security";

interface SudoOptions {
    onSuccess: () => void;
    onCancel?: () => void;
    intent?: "unlock" | "initialize" | "reset";
}

interface SudoContextType {
    requestSudo: (options: SudoOptions) => void;
    promptSudo: (intent?: "unlock" | "initialize" | "reset") => Promise<boolean>;
    isUnlocked: boolean;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export function SudoProvider({ children }: { children: ReactNode }) {
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<SudoOptions | null>(null);
    const [sudoPromise, setSudoPromise] = useState<{ resolve: (v: boolean) => void } | null>(null);

    const isUnlocked = ecosystemSecurity.status.isUnlocked;

    const requestSudo = useCallback((options: SudoOptions) => {
        if (ecosystemSecurity.status.isUnlocked) {
            options.onSuccess();
            return;
        }

        setPendingAction(options);
        setIsSudoOpen(true);
    }, []);

    const promptSudo = useCallback((intent: "unlock" | "initialize" | "reset" = "unlock") => {
        if (ecosystemSecurity.status.isUnlocked) return Promise.resolve(true);

        return new Promise<boolean>((resolve) => {
            setSudoPromise({ resolve });
            setPendingAction({ 
                intent,
                onSuccess: () => resolve(true),
                onCancel: () => resolve(false)
            });
            setIsSudoOpen(true);
        });
    }, []);

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
    }, [pendingAction, sudoPromise]);

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

    return (
        <SudoContext.Provider value={{ requestSudo, promptSudo, isUnlocked }}>
            {children}
            <SudoModal
                isOpen={isSudoOpen}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                intent={pendingAction?.intent}
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
