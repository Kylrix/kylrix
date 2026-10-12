'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { PresenceService, UserPresenceState, PresencePayload } from '@/lib/services/presence';

interface PresenceContextType {
    globalPresence: Record<string, PresencePayload>;
    resourcePresence: Record<string, PresencePayload[]>;
    joinResource: (databaseId: string, tableId: string, rowId: string) => () => void;
    setMyState: (state: UserPresenceState, activity?: string) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [globalPresence, setGlobalPresence] = useState<Record<string, PresencePayload>>({});
    const [resourcePresence, setResourcePresence] = useState<Record<string, PresencePayload[]>>({});
    
    // Active subscriptions tracker to avoid redundant pings
    const activeResourcesRef = useRef<Set<string>>(new Set());

    const setMyState = useCallback(async (state: UserPresenceState, activity?: string) => {
        if (!user?.$id) return;
        
        // Broadcast to global channel only if privacy settings allow
        const isOnlineVisible = user.prefs?.isOnlineVisible !== false;
        
        if (isOnlineVisible) {
            await PresenceService.broadcastState('users', {
                userId: user.$id,
                state,
                activity,
                lastSeen: new Date().toISOString()
            });
        }

        // Also broadcast to all active resources (local collaboration ignores global toggle)
        for (const resourceKey of activeResourcesRef.current) {
            await PresenceService.broadcastState(resourceKey, {
                userId: user.$id,
                state,
                activity
            });
        }
    }, [user]);

    // Handle online/offline lifecycle
    useEffect(() => {
        if (!user?.$id) return;

        // 1. Subscribe to global presence
        const unsubGlobal = PresenceService.subscribeToPresence('users', (payload: PresencePayload) => {
            setGlobalPresence(prev => ({
                ...prev,
                [payload.userId]: payload
            }));
        });

        // 2. Initial state
        setMyState('online');

        // 3. Handle visibility change (Away mode)
        const handleVisibilityChange = () => {
            const state = document.visibilityState === 'visible' ? 'online' : 'away';
            setMyState(state);
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            setMyState('offline');
            if (typeof unsubGlobal === 'function') (unsubGlobal as any)();
            else (unsubGlobal as any)?.unsubscribe?.();
        };
    }, [user?.$id, setMyState]);

    const joinResource = useCallback((databaseId: string, tableId: string, rowId: string) => {
        if (!user?.$id) return () => {};

        const channel = PresenceService.getResourceChannel(databaseId, tableId, rowId);
        
        // On-demand: only track if we haven't joined yet
        activeResourcesRef.current.add(channel);
        
        const unsub = PresenceService.subscribeToPresence(channel, (payload: PresencePayload) => {
            setResourcePresence(prev => {
                const current = prev[rowId] || [];
                const filtered = current.filter(p => p.userId !== payload.userId);
                
                if (payload.state === 'offline') {
                    return { ...prev, [rowId]: filtered };
                }

                return {
                    ...prev,
                    [rowId]: [...filtered, payload]
                };
            });
        });

        // Announce myself to the resource
        setMyState('online', `Viewing ${tableId}`);

        return () => {
            activeResourcesRef.current.delete(channel);
            setMyState('online'); // Reset to general online
            if (typeof unsub === 'function') (unsub as any)();
            else (unsub as any)?.unsubscribe?.();
        };
    }, [user?.$id, setMyState]);

    return (
        <PresenceContext.Provider value={{ globalPresence, resourcePresence, joinResource, setMyState }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => {
    const context = useContext(PresenceContext);
    if (!context) throw new Error('usePresence must be used within a PresenceProvider');
    return context;
};
