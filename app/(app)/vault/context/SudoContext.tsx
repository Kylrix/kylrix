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
    isUnlocked: boolean;
}

const SudoContext = createContext<SudoContextType | undefined>(undefined);

export function SudoProvider({ children }: { children: ReactNode }) {
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<SudoOptions | null>(null);

    const isUnlocked = ecosystemSecurity.status.isUnlocked;

    const requestSudo = useCallback((options: SudoOptions) => {
        if (ecosystemSecurity.status.isUnlocked) {
            options.onSuccess();
            return;
        }

        setPendingAction(options);
        setIsSudoOpen(true);
    }, []);

    const handleSuccess = useCallback(() => {
        setIsSudoOpen(false);
        if (pendingAction) {
            pendingAction.onSuccess();
            setPendingAction(null);
        }
    }, [pendingAction]);

    const handleCancel = useCallback(() => {
        setIsSudoOpen(false);
        if (pendingAction?.onCancel) {
            pendingAction.onCancel();
        }
        setPendingAction(null);
    }, [pendingAction]);

    return (
        <SudoContext.Provider value={{ requestSudo, isUnlocked }}>
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
