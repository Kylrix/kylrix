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
        
        if (doc) {
            const data = doc.data as T;
            const isStale = Date.now() - doc.timestamp >= ttl;
            if (isStale) {
                (async () => {
                    try {
                        const fresh = await fetcher();
                        if (JSON.stringify(fresh) !== JSON.stringify(data)) {
                            await db.cache.upsert({
                                id: key,
                                data: fresh as any,
                                timestamp: Date.now()
                            });
                            window.dispatchEvent(new CustomEvent('kylrix:nexus:update', {
                                detail: { key, data: fresh }
                            }));
                        }
                    } catch (err) {
                        console.warn(`[Nexus Bridge] Background revalidation failed for ${key}`, err);
                    }
                })();
            }
            return data;
        }

        // Network Sensing Fetch
        const data = await fetcher();
        
        // Persist to RxDB Substrate
        await db.cache.upsert({
            id: key,
            data: data as any,
            timestamp: Date.now()
        });

        window.dispatchEvent(new CustomEvent('kylrix:nexus:update', {
            detail: { key, data }
        }));

        return data;
    } catch (e) {
        console.warn(`[Nexus Bridge] Local-First fetch failed for ${key}, falling back to direct network.`, e);
        return await fetcher();
    }
}

function isRxConflictError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code = String((error as { code?: string }).code || '');
    if (code.includes('CONFLICT')) return true;
    const status = (error as { parameters?: { writeError?: { status?: number } } }).parameters?.writeError?.status;
    return status === 409;
}

async function safeRemoveCacheDoc(doc: { id: string; _deleted?: boolean; remove: () => Promise<unknown>; collection: { findOne: (id: string) => { exec: () => Promise<{ _deleted?: boolean; remove: () => Promise<unknown> } | null> } } }) {
    if (doc._deleted) return;
    try {
        await doc.remove();
    } catch (error) {
        if (!isRxConflictError(error)) throw error;
        const latest = await doc.collection.findOne(doc.id).exec();
        if (latest && !latest._deleted) {
            try {
                await latest.remove();
            } catch (retryError) {
                if (!isRxConflictError(retryError)) throw retryError;
            }
        }
    }
}

/**
 * Manually invalidate a cache key across all layers.
 */
export async function invalidateCache(key: string) {
    if (typeof window === 'undefined') return;
    
    try {
        const db = await getRxDB();
        if (key.includes('*')) {
            const prefix = key.split('*')[0];
            const docs = await db.cache.find({ selector: { id: { $regex: `^${prefix}` } } }).exec();
            for (const doc of docs) {
                await safeRemoveCacheDoc(doc as any);
            }
        } else {
            const doc = await db.cache.findOne(key).exec();
            if (doc) await safeRemoveCacheDoc(doc as any);
        }
        
        publishNexusInvalidate(key);
    } catch (e) {
        if (!isRxConflictError(e)) {
            console.error(`[Nexus Bridge] Invalidation failed for ${key}`, e);
        }
    }
}
