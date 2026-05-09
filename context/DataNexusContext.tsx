"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode } from 'react';
import { NEXUS_INVALIDATE_EVENT } from '@/lib/ecosystem/nexus-bridge';

/**
 * KYLRIX ECOSYSTEM DATA NEXUS
 * A high-performance, local-first caching layer for the main portal.
 * Aggressively minimizes Appwrite database reads for docs and global state.
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
}

const DataNexusContext = createContext<DataNexusContextType | undefined>(undefined);

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes default TTL

export function DataNexusProvider({ children }: { children: ReactNode }) {
    // In-memory cache for ultra-fast access
    const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    // Active request tracking for deduplication
    const activeRequests = useRef<Map<string, Promise<any>>>(new Map());
    const backgroundRefreshRequests = useRef<Map<string, Promise<void>>>(new Map());

    const getCachedData = useCallback(function<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
        // 1. Check memory cache first
        const memoryEntry = memoryCache.current.get(key);
        const now = Date.now();

        if (memoryEntry && (now - memoryEntry.timestamp < ttl)) {
            return memoryEntry.data;
        }

        // 2. Check localStorage for persistence across reloads
        if (typeof window !== 'undefined') {
            try {
                const persisted = localStorage.getItem(`k_nexus_${key}`);
                if (persisted) {
                    const entry: CacheEntry<T> = JSON.parse(persisted);
                    if (now - entry.timestamp < ttl) {
                        // Hydrate memory cache
                        memoryCache.current.set(key, entry);
                        return entry.data;
                    }
                }
            } catch (_e) {
                console.warn(`[Nexus-Kylrix] Cache retrieval error for ${key}`);
            }
        }

        return null;
    }, []);

    const setCachedData = useCallback(function<T>(key: string, data: T, _ttl?: number) {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now()
        };

        // Update memory
        memoryCache.current.set(key, entry);

        // Update persistence
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(`k_nexus_${key}`, JSON.stringify(entry));
            } catch (_e) {
                console.warn(`[Nexus-Kylrix] Persist error for ${key}`);
            }
        }
    }, []);

    const invalidate = useCallback((key: string) => {
        memoryCache.current.delete(key);
        activeRequests.current.delete(key);
        backgroundRefreshRequests.current.delete(key);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(`k_nexus_${key}`);
        }
    }, []);

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
                setCachedData(key, data, ttl);
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
        // 1. Check if we already have valid data
        const cached = getCachedData<T>(key, ttl);
        if (cached) return cached;

        // 2. Deduplication: Check if an identical request is already in flight
        const existingRequest = activeRequests.current.get(key);
        if (existingRequest) return existingRequest;

        // 3. Perform the actual fetch
        const request = (async () => {
            try {
                const data = await fetcher();
                setCachedData(key, data, ttl);
                return data;
            } finally {
                // Cleanup active request
                activeRequests.current.delete(key);
            }
        })();

        activeRequests.current.set(key, request);
        return request;
    }, [getCachedData, setCachedData]);

    return (
        <DataNexusContext.Provider value={{ getCachedData, setCachedData, fetchOptimized, invalidate, refreshInBackground }}>
            {children}
        </DataNexusContext.Provider>
    );
}

export function useDataNexus() {
    const context = useContext(DataNexusContext);
    if (!context) throw new Error('useDataNexus must be used within DataNexusProvider');
    return context;
}
