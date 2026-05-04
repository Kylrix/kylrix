'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { ActivityService } from '@/lib/services/activity';
import { realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useDataNexus } from '@/context/DataNexusContext';

const PresenceContext = createContext<{
    getPresence: (userId: string) => Promise<any>;
    presence: Record<string, any>;
}>({
    getPresence: async () => null,
    presence: {}
});

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const { fetchOptimized, setCachedData } = useDataNexus();
    const [presence, setPresence] = React.useState<Record<string, any>>({});

    useEffect(() => {
        if (!user) return;

        // Subscribe to presence updates
        const unsub = (realtime as any).subscribe(
            [`databases.${APPWRITE_CONFIG.DATABASES.CHAT}.tables.${APPWRITE_CONFIG.TABLES.CHAT.APP_ACTIVITY}.rows`],
            (response: any) => {
                const payload = response.payload;
                if (payload.userId) {
                    setPresence(prev => ({
                        ...prev,
                        [payload.userId]: payload
                    }));
                    // Update cache as well to keep it fresh
                    setCachedData(`presence_${payload.userId}`, payload, 1000 * 60 * 5);
                }
            }
        );

        const updateStatus = (status: 'online' | 'offline' | 'away') => {
            ActivityService.updatePresence(user.$id, status);
        };

        // Mark as online
        updateStatus('online');

        // Periodically update lastSeen
        const interval = setInterval(() => updateStatus('online'), 1000 * 60 * 2); // Every 2 mins

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateStatus('online');
            } else {
                updateStatus('away');
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            updateStatus('offline');
            if (typeof unsub === 'function') (unsub)();
            else (unsub)?.unsubscribe?.();
        };
    }, [user, setCachedData]);

    const getPresence = useCallback(async (userId: string) => {
        if (presence[userId]) return presence[userId];
        
        // Use DataNexus to deduplicate and cache presence lookups
        return await fetchOptimized(`presence_${userId}`, async () => {
            const p = await ActivityService.getUserPresence(userId);
            if (p) {
                setPresence(prev => ({ ...prev, [userId]: p }));
            }
            return p;
        }, 1000 * 60 * 5); // 5 minutes TTL for presence
    }, [presence, fetchOptimized]);

    return (
        <PresenceContext.Provider value={{ getPresence, presence }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => useContext(PresenceContext);
