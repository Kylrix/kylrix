type ListFetcher<T> = () => Promise<T>;

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const DEFAULT_TTL = 30000; // 30s
const DEBOUNCE_MS = 2000; // 2s

export class SimpleListCache<T> {
    private cache: CacheEntry<T> | null = null;
    private inFlight: Promise<T> | null = null;
    private lastFetch = 0;
    private ttl: number;

    constructor(ttl = DEFAULT_TTL) {
        this.ttl = ttl;
    }

    async fetch(fetcher: ListFetcher<T>, force = false): Promise<T> {
        const now = Date.now();
        
        if (!force && this.cache && this.cache.expiresAt > now) {
            return this.cache.data;
        }

        if (force && now - this.lastFetch < DEBOUNCE_MS && this.cache) {
            return this.cache.data;
        }

        if (this.inFlight) return this.inFlight;

        this.inFlight = fetcher()
            .then(data => {
                this.cache = { data, expiresAt: Date.now() + this.ttl };
                this.lastFetch = Date.now();
                return data;
            })
            .finally(() => {
                this.inFlight = null;
            });

        return this.inFlight;
    }

    invalidate() {
        this.cache = null;
        this.lastFetch = 0;
    }
}

const caches = new Map<string, SimpleListCache<any>>();

export const getNamedListCache = <T>(name: string, ttl = DEFAULT_TTL): SimpleListCache<T> => {
    if (!caches.has(name)) {
        caches.set(name, new SimpleListCache<T>(ttl));
    }
    return caches.get(name)!;
};
