'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useDataNexus } from '@/context/DataNexusContext';
import { syncCurrentUserVerification } from '@/lib/verification';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { getCachedIdentityById, seedIdentityCache } from '@/lib/identity-cache';

interface ProfileContextType {
    profile: any | null;
    isLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType>({
    profile: null,
    isLoading: true,
    refreshProfile: async () => {},
});

const PROFILE_SETUP_KEY = 'kylrix_profile_initialized';

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const { fetchOptimized, invalidate } = useDataNexus();
    const [profile, setProfile] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const bootstrapRequestRef = useRef<Promise<any | null> | null>(null);

    const queueProfileBootstrap = useCallback((currentUser: { $id: string; email?: string; name?: string; prefs?: Record<string, any> }) => {
        if (!currentUser?.$id) return Promise.resolve(null);
        if (bootstrapRequestRef.current) return bootstrapRequestRef.current;

        const request = (async () => {
            const existing = await UsersService.getProfileById(currentUser.$id);
            const needsBaseProfile = !existing || !existing.username || !existing.displayName;
            const ensuredProfile = needsBaseProfile ? await UsersService.ensureProfileForUser(currentUser) : existing;

            if (ecosystemSecurity.status.isUnlocked) {
                const syncedProfile = await UsersService.forceSyncProfileWithIdentity(currentUser).catch((error) => {
                    console.error('[ProfileProvider] Background E2E sync failed:', error);
                    return null;
                });
                return syncedProfile || ensuredProfile || existing;
            }

            return ensuredProfile || existing;
        })().finally(() => {
            bootstrapRequestRef.current = null;
        });

        bootstrapRequestRef.current = request;
        return request;
    }, []);

    const refreshProfile = useCallback(async () => {
        if (!user?.$id) {
            setProfile(null);
            setIsLoading(false);
            return;
        }

        try {
            const setupKey = `${PROFILE_SETUP_KEY}_${user.$id}`;
            const setupComplete = typeof window !== 'undefined' && localStorage.getItem(setupKey) === 'true';
            const cachedIdentity = getCachedIdentityById(user.$id);
            const cachedProfile = cachedIdentity || await fetchOptimized(`profile_${user.$id}`, async () => {
                const fetched = await UsersService.getProfileById(user.$id);
                if (fetched) seedIdentityCache(fetched);
                return fetched;
            }, 1000 * 60 * 60);

            if (cachedProfile) {
                if (!cachedIdentity) {
                    seedIdentityCache(cachedProfile);
                }
                setProfile(cachedProfile);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(setupKey, 'true');
                }
            }

            const needsBootstrap = !cachedProfile || !setupComplete || !cachedProfile.username || !cachedProfile.displayName;
            if (!needsBootstrap) {
                setIsLoading(false);
                return;
            }

            try {
                const bootstrappedProfile = await queueProfileBootstrap(user);
                if (bootstrappedProfile) {
                    let nextProfile = bootstrappedProfile;
                    try {
                        const syncedProfile = await syncCurrentUserVerification(user.$id);
                        if (syncedProfile) {
                            nextProfile = syncedProfile;
                            invalidate(`profile_${user.$id}`);
                        }
                    } catch (error) {
                        console.warn('[ProfileProvider] Failed to sync verification state:', error);
                    }

                    setProfile(nextProfile);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(setupKey, 'true');
                    }
                }
            } catch (error) {
                console.error('[ProfileProvider] Failed to bootstrap profile in background:', error);
            }
        } catch (error) {
            console.error('[ProfileProvider] Failed to load/setup profile:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, fetchOptimized, invalidate, queueProfileBootstrap]);

    useEffect(() => {
        if (!user?.$id) return;

        const setupKey = `${PROFILE_SETUP_KEY}_${user.$id}`;

        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (!status.isUnlocked) return;

            const setupComplete = typeof window !== 'undefined' && localStorage.getItem(setupKey) === 'true';
            if (setupComplete) return;

            void queueProfileBootstrap(user)
                .then(async () => {
                    invalidate(`profile_${user.$id}`);
                    await refreshProfile();
                })
                .catch((error) => {
                    console.error('[ProfileProvider] Failed to audit E2E identity:', error);
                });
        });

        return unsubscribe;
    }, [user, invalidate, refreshProfile, queueProfileBootstrap]);

    useEffect(() => {
        if (!user) {
            setProfile(null);
            setIsLoading(false);
            return;
        }

        // Hybrid load strategy: First hit cache, then refresh if needed
        refreshProfile();
    }, [user, refreshProfile]);

    return (
        <ProfileContext.Provider value={{ profile, isLoading, refreshProfile: async () => {
            if (user?.$id) invalidate(`profile_${user.$id}`);
            await refreshProfile();
        } }}>
            {children}
        </ProfileContext.Provider>
    );
};

export const useProfile = () => useContext(ProfileContext);
