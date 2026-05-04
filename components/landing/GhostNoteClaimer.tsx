"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/ui/AuthContext';
import { account } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { KYLRIX_AUTH_URI } from '@/constants/ecosystem';

const GHOST_STORAGE_KEY = 'kylrix_ghost_notes_v2';
const GHOST_SECRET_KEY = 'kylrix_ghost_secret_v2';

/**
 * Background component that claims ghost notes when a user authenticates.
 * Extremely lightweight: only does logic if data exists in localStorage and user is logged in.
 */
export const GhostNoteClaimer = () => {
    const { isAuthenticated, user } = useAuth();
    const isClaiming = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !user?.$id || isClaiming.current) return;

        const claimGhostNotes = async () => {
            const historyRaw = localStorage.getItem(GHOST_STORAGE_KEY);
            const secret = localStorage.getItem(GHOST_SECRET_KEY);

            if (!historyRaw || !secret) return;

            try {
                const history = JSON.parse(historyRaw);
                if (!Array.isArray(history) || history.length === 0) return;

                isClaiming.current = true;
                console.log(`[GhostClaimer] Detected ${history.length} notes to claim for user ${user.$id}`);

                try {
                    const noteIds = history.map(n => n.id);
                    const jwt = await account.createJWT();
                    const wrappedSecret = ecosystemSecurity.status.isUnlocked
                        ? await ecosystemSecurity.encrypt(secret)
                        : secret;

                    const response = await fetch(`${KYLRIX_AUTH_URI}/api/permissions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${jwt.jwt}`,
                        },
                        body: JSON.stringify({
                            action: 'pin_ghost_note',
                            noteIds,
                            wrappedKey: wrappedSecret,
                            metadata: {
                                source: 'ghost-claimer',
                                noteCount: noteIds.length,
                            },
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Failed to claim ghost notes');
                    }

                    localStorage.removeItem(GHOST_STORAGE_KEY);
                    localStorage.removeItem(GHOST_SECRET_KEY);
                    console.log('[GhostClaimer] Successfully handed off ghost notes to accounts API.');
                } catch (fnErr: any) {
                    console.error('[GhostClaimer] Failed to claim ghost notes:', fnErr);
                }
            } catch (e) {
                console.error('[GhostClaimer] Error processing ghost history:', e);
            } finally {
                isClaiming.current = false;
            }
        };

        claimGhostNotes();
    }, [isAuthenticated, user?.$id]);

    return null; // Renderless component
};
