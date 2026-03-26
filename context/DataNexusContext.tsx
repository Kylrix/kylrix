"use client";

import React, { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

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
}

const DataNexusContext = createContext<DataNexusContextType | undefined>(undefined);

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes default TTL

export function DataNexusProvider({ children }: { children: ReactNode }) {
    // In-memory cache for ultra-fast access
    const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
    // Active request tracking for deduplication
    const activeRequests = useRef<Map<string, Promise<any>>>(new Map());

    const getCachedData = useCallback(<T>(key: string, ttl: number = DEFAULT_TTL): T | null => {
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
            } catch (e) {
                console.warn(`[Nexus-Kylrix] Cache retrieval error for ${key}`, e);
            }
        }

        return null;
    }, []);

    const setCachedData = useCallback(<T>(key: string, data: T, _ttl?: number) => {
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
            } catch (e) {
                console.warn(`[Nexus-Kylrix] Persist error for ${key}`, e);
            }
        }
    }, []);

    const invalidate = useCallback((key: string) => {
        memoryCache.current.delete(key);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(`k_nexus_${key}`);
        }
    }, []);

    const fetchOptimized = useCallback(async <T>(
        key: string, 
        fetcher: () => Promise<T>, 
        ttl: number = DEFAULT_TTL
    ): Promise<T> => {
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
        <DataNexusContext.Provider value={{ getCachedData, setCachedData, fetchOptimized, invalidate }}>
            {children}
        </DataNexusContext.Provider>
    );
}

export function useDataNexus() {
    const context = useContext(DataNexusContext);
    if (!context) throw new Error('useDataNexus must be used within DataNexusProvider');
    return context;
}
