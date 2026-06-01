"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode, useState } from 'react';
import { NEXUS_INVALIDATE_EVENT } from '@/lib/ecosystem/nexus-bridge';
import { getRxDB, migrateLocalStorageToRxDB } from '@/lib/webrtc/RxDBManager';

/**
 * KYLRIX ECOSYSTEM DATA NEXUS (DUAL-ENGINE V2)
 * Aggressive architectural specification for sub-millisecond execution.
 * 1. Synchronous Mirror: Volatile Map Ref Cache (Hit: 0ms)
 * 2. Local Persistent Substrate: RxDB/IndexedDB (Bypasses thundering herds & 5MB wall)
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface DataNexusContextType {
    getCachedData: <T>(key: string, ttl?: number) => T | null;
    setCachedData: <T>(key: string, data: T, ttl?: number) => void;
    fetchOptimized: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
    invalidate: (key: string) => void;
    /** Non-blocking refresh; uses a separate flight map so it never stalls `fetchOptimized`. */
    refreshInBackground: <T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl?: number,
        onSettled?: (result: { data?: T; error?: unknown }) => void,
    ) => void;
    /** Hijacked reload trigger: scans local state against remote without DOM teardown. */
    triggerBackgroundSync: () => Promise<void>;
    isRefreshing: boolean;
}

const DataNexusContext = createContext<DataNexusContextType | undefined>(undefined);

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes default TTL

export function DataNexusProvider({ children }: { children: ReactNode }) {
    // In-memory cache for ultra-fast (0ms) access
    const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    // Active request tracking for deduplication
    const activeRequests = useRef<Map<string, Promise<any>>>(new Map());
    const backgroundRefreshRequests = useRef<Map<string, Promise<void>>>(new Map());
    
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initialize RxDB & Run Migrations
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        (async () => {
            await getRxDB();
            await migrateLocalStorageToRxDB();
            console.log('[Nexus] RxDB substrate initialized and legacy data migrated.');
        })();
    }, []);

    const getCachedData = useCallback(function<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
        // 1. Synchronous Mirror Hit (0ms)
        const memoryEntry = memoryCache.current.get(key);
        const now = Date.now();

        if (memoryEntry && (now - memoryEntry.timestamp < ttl)) {
            return memoryEntry.data;
        }

        // 2. RxDB Substrate Fallback (Asynchronous)
        // Since getCachedData is synchronous, we can't await RxDB here.
        // We rely on fetchOptimized to handle the async load if mirror misses.
        return null;
    }, []);

    const setCachedData = useCallback(async function<T>(key: string, data: T, _ttl?: number) {
        const timestamp = Date.now();
        const entry: CacheEntry<T> = { data, timestamp };

        // Update Synchronous Mirror
        memoryCache.current.set(key, entry);

        // Update RxDB Substrate
        try {
            const db = await getRxDB();
            await db.cache.upsert({ id: key, data: data as any, timestamp });
        } catch (e) {
            console.error(`[Nexus] RxDB Persist failed for ${key}:`, e);
        }
    }, []);

    const invalidate = useCallback(async (key: string) => {
        memoryCache.current.delete(key);
        activeRequests.current.delete(key);
        backgroundRefreshRequests.current.delete(key);
        
        try {
            const db = await getRxDB();
            const doc = await db.cache.findOne(key).exec();
            if (doc) await doc.remove();
        } catch (e) {
            console.error(`[Nexus] RxDB Invalidate failed for ${key}:`, e);
        }
    }, []);

    const triggerBackgroundSync = useCallback(async () => {
        if (isRefreshing) return;
        console.log('[Nexus] Triggering background delta sync sweep...');
        setIsRefreshing(true);
        
        window.dispatchEvent(new CustomEvent('kylrix:nexus:sync_start'));

        try {
            // Section 4: Transaction-Clock Delta Sync
            const localManifest: { id: string; updatedAt: string }[] = [];
            
            // We can now query RxDB for a much larger set than memory cache
            const db = await getRxDB();
            const allCached = await db.notes.find().exec();
            
            for (const doc of allCached) {
                localManifest.push({ id: doc.id, updatedAt: doc.updatedAt });
            }

            const { syncNotesDelta } = await import('@/lib/ecosystem/delta-sync');
            const result = await syncNotesDelta(localManifest);

            // Apply surgical patches
            for (const patch of result.patches) {
                // Update RxDB notes collection
                await db.notes.upsert({
                    id: patch.$id,
                    title: patch.title,
                    content: patch.content,
                    userId: patch.userId,
                    metadata: patch.metadata,
                    updatedAt: patch.$updatedAt,
                    _deleted: false
                });
                // Also update memory mirror if it was there
                memoryCache.current.set(`note:${patch.$id}`, { data: patch, timestamp: Date.now() });
            }

            // Remove deleted items
            for (const id of result.deletedIds) {
                const doc = await db.notes.findOne(id).exec();
                if (doc) await doc.remove();
                memoryCache.current.delete(`note:${id}`);
            }

            console.log(`[Nexus] Delta sync complete. Patched ${result.patches.length} items, removed ${result.deletedIds.length}.`);
        } catch (err) {
            console.error('[Nexus] Background sync failed:', err);
        } finally {
            setIsRefreshing(false);
            window.dispatchEvent(new CustomEvent('kylrix:nexus:sync_end'));
        }
    }, [isRefreshing]);

    const refreshInBackground = useCallback(function<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl: number = DEFAULT_TTL,
        onSettled?: (result: { data?: T; error?: unknown }) => void,
    ) {
        if (typeof window === 'undefined') return;
        if (backgroundRefreshRequests.current.has(key)) return;

        const req = (async () => {
            try {
                const data = await fetcher();
                await setCachedData(key, data, ttl);
                onSettled?.({ data });
            } catch (error) {
                onSettled?.({ error });
            } finally {
                backgroundRefreshRequests.current.delete(key);
            }
        })();

        backgroundRefreshRequests.current.set(key, req);
    }, [setCachedData]);

    useEffect(() => {
        const handler = (event: Event) => {
            const key = (event as CustomEvent<{ key?: string }>).detail?.key;
            if (typeof key === 'string' && key.length > 0) {
                invalidate(key);
            }
        };
        window.addEventListener(NEXUS_INVALIDATE_EVENT, handler);
        return () => window.removeEventListener(NEXUS_INVALIDATE_EVENT, handler);
    }, [invalidate]);

    const fetchOptimized = useCallback(async function<T>(
        key: string, 
        fetcher: () => Promise<T>, 
        ttl: number = DEFAULT_TTL
    ): Promise<T> {
        // 1. Check Synchronous Mirror
        const cached = getCachedData<T>(key, ttl);
        if (cached) return cached;

        // 2. Check RxDB Substrate (if memory miss)
        try {
            const db = await getRxDB();
            const doc = await db.cache.findOne(key).exec();
            
            if (doc && (Date.now() - doc.timestamp < ttl)) {
                const entry = { data: doc.data as T, timestamp: doc.timestamp };
                memoryCache.current.set(key, entry);
                return entry.data;
            }
        } catch (e) {
            console.warn(`[Nexus] RxDB Substrate read failed for ${key}`, e);
        }

        // 3. Deduplication
        const existingRequest = activeRequests.current.get(key);
        if (existingRequest) return existingRequest;

        // 4. Remote Fetch (Network Sensing)
        const request = (async () => {
            try {
                const data = await fetcher();
                await setCachedData(key, data, ttl);
                return data;
            } finally {
                activeRequests.current.delete(key);
            }
        })();

        activeRequests.current.set(key, request);
        return request;
    }, [getCachedData, setCachedData]);

    return (
        <DataNexusContext.Provider value={{ 
            getCachedData, 
            setCachedData, 
            fetchOptimized, 
            invalidate, 
            refreshInBackground,
            triggerBackgroundSync,
            isRefreshing
        }}>
            {children}
        </DataNexusContext.Provider>
    );
}

export function useDataNexus() {
    const context = useContext(DataNexusContext);
    if (!context) throw new Error('useDataNexus must be used within DataNexusProvider');
    return context;
}
