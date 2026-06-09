import { getRxDB } from '@/lib/webrtc/RxDBManager';
import { publishNexusInvalidate } from './nexus-bridge';

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * KYLRIX LOCAL-FIRST DATA ENGINE
 * Core Rule: Retrieve locally from RxDB before reaching the database.
 */
export async function fetchOptimized<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL
): Promise<T> {
    if (typeof window === 'undefined') {
        return await fetcher();
    }

    try {
        const db = await getRxDB();
        const doc = await db.cache.findOne(key).exec();
        
        if (doc && (Date.now() - doc.timestamp < ttl)) {
            return doc.data as T;
        }

        // Network Sensing Fetch
        const data = await fetcher();
        
        // Persist to RxDB Substrate
        await db.cache.upsert({
            id: key,
            data: data as any,
            timestamp: Date.now()
        });

        return data;
    } catch (e) {
        console.warn(`[Nexus Bridge] Local-First fetch failed for ${key}, falling back to direct network.`, e);
        return await fetcher();
    }
}

/**
 * Manually invalidate a cache key across all layers.
 */
export async function invalidateCache(key: string) {
    if (typeof window === 'undefined') return;
    
    try {
        const db = await getRxDB();
        const doc = await db.cache.findOne(key).exec();
        if (doc) await doc.remove();
        
        // Notify React components to clear memory mirror
        publishNexusInvalidate(key);
    } catch (e) {
        console.error(`[Nexus Bridge] Invalidation failed for ${key}`, e);
    }
}
