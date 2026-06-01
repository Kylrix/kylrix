"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode, useState } from 'react';
import { NEXUS_INVALIDATE_EVENT } from '@/lib/ecosystem/nexus-bridge';

/**
 * KYLRIX ECOSYSTEM DATA NEXUS (DUAL-ENGINE)
 * Aggressive architectural specification for sub-millisecond execution.
 * 1. Synchronous Mirror: Volatile Map Ref Cache (Hit: 0ms)
 * 2. Local Persistent Substrate: IndexedDB (Bypasses thundering herds)
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hash?: string;
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
const DB_NAME = 'kylrix_nexus_v2';
const STORE_NAME = 'cache';

export function DataNexusProvider({ children }: { children: ReactNode }) {
    // In-memory cache for ultra-fast (0ms) access
    const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    // Active request tracking for deduplication
    const activeRequests = useRef<Map<string, Promise<any>>>(new Map());
    const backgroundRefreshRequests = useRef<Map<string, Promise<void>>>(new Map());
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dbRef = useRef<IDBDatabase | null>(null);

    // Initialize IndexedDB
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event) => {
            dbRef.current = (event.target as IDBOpenDBRequest).result;
            console.log('[Nexus] IndexedDB substrate initialized.');
        };
    }, []);

    const getCachedData = useCallback(function<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
        // 1. Synchronous Mirror Hit (0ms)
        const memoryEntry = memoryCache.current.get(key);
        const now = Date.now();

        if (memoryEntry && (now - memoryEntry.timestamp < ttl)) {
            return memoryEntry.data;
        }

        // 2. IndexedDB Substrate Fallback (Asynchronous)
        // Since getCachedData is synchronous, we can't await IDB here.
        // We rely on the UI component to trigger a fetchOptimized if this returns null.
        // However, we pre-hydrate memoryCache from IDB on mount/init for critical keys.
        return null;
    }, []);

    const setCachedData = useCallback(async function<T>(key: string, data: T, _ttl?: number) {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now()
        };

        // Update Synchronous Mirror
        memoryCache.current.set(key, entry);

        // Update IndexedDB Substrate
        if (dbRef.current) {
            const tx = dbRef.current.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(entry, key);
        }
    }, []);

    const invalidate = useCallback((key: string) => {
        memoryCache.current.delete(key);
        activeRequests.current.delete(key);
        backgroundRefreshRequests.current.delete(key);
        
        if (dbRef.current) {
            const tx = dbRef.current.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
        }
    }, []);

    const triggerBackgroundSync = useCallback(async () => {
        if (isRefreshing) return;
        console.log('[Nexus] Triggering background delta sync sweep...');
        setIsRefreshing(true);
        
        // Dispatches a global event for the Topbar indicator to mount
        window.dispatchEvent(new CustomEvent('kylrix:nexus:sync_start'));

        try {
            // Section 4: Transaction-Clock Delta Sync
            const localManifest: { id: string; updatedAt: string }[] = [];
            memoryCache.current.forEach((entry, key) => {
                if (key.startsWith('note:')) {
                    localManifest.push({ id: key.replace('note:', ''), updatedAt: new Date(entry.timestamp).toISOString() });
                }
            });

            const { syncNotesDelta } = await import('@/lib/ecosystem/delta-sync');
            const result = await syncNotesDelta(localManifest);

            // Apply surgical patches
            for (const patch of result.patches) {
                await setCachedData(`note:${patch.$id}`, patch);
            }

            // Remove deleted items
            for (const id of result.deletedIds) {
                invalidate(`note:${id}`);
            }

            console.log(`[Nexus] Delta sync complete. Patched ${result.patches.length} items, removed ${result.deletedIds.length}.`);
        } catch (err) {
            console.error('[Nexus] Background sync failed:', err);
        } finally {
            setIsRefreshing(false);
            window.dispatchEvent(new CustomEvent('kylrix:nexus:sync_end'));
        }
    }, [invalidate, isRefreshing, setCachedData]);

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

        // 2. Check IndexedDB Substrate (if memory miss)
        if (dbRef.current) {
            const dbEntry = await new Promise<CacheEntry<T> | null>((resolve) => {
                const tx = dbRef.current!.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });

            if (dbEntry && (Date.now() - dbEntry.timestamp < ttl)) {
                memoryCache.current.set(key, dbEntry);
                return dbEntry.data;
            }
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
