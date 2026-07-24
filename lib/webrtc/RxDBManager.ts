import { addRxPlugin, createRxDatabase, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBcrdtPlugin, getCRDTSchemaPart } from 'rxdb/plugins/crdt';
import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';

// Add necessary plugins
if (typeof window !== 'undefined') {
    addRxPlugin(RxDBcrdtPlugin);
    addRxPlugin(RxDBCleanupPlugin);
    addRxPlugin(RxDBQueryBuilderPlugin);
    addRxPlugin(RxDBLeaderElectionPlugin);
}

const DB_NAME = 'kylrix_nexus_db_v3';

export interface NoteDocument {
    id: string;
    title: string;
    content: string;
    userId: string;
    metadata: string;
    updatedAt: string;
    _deleted: boolean;
    crdt?: any;
}

const NoteSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        content: { type: 'string' },
        userId: { type: 'string' },
        metadata: { type: 'string' },
        updatedAt: { type: 'string', format: 'date-time' },
        _deleted: { type: 'boolean' },
        crdt: getCRDTSchemaPart()
    },
    required: ['id', 'userId', 'updatedAt'],
    crdt: { field: 'crdt' }
};

const GenericCacheSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 256 },
        data: {},
        timestamp: { type: 'number' }
    },
    required: ['id', 'timestamp']
};

const TagSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        color: { type: 'string' },
        userId: { type: 'string' },
        timestamp: { type: 'number' }
    },
    required: ['id', 'name', 'userId']
};

const TaskSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        userId: { type: 'string' },
        projectId: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        updatedAt: { type: 'string', format: 'date-time' },
        _deleted: { type: 'boolean' }
    },
    required: ['id', 'title', 'userId']
};

const FormSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        description: { type: 'string' },
        schema: { type: 'string' },
        status: { type: 'string' },
        userId: { type: 'string' },
        isPublic: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'title', 'userId']
};

const EventSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        title: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        location: { type: 'string' },
        userId: { type: 'string' },
        isPublic: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' }
    },
    required: ['id', 'title', 'startTime', 'userId']
};

let dbPromise: Promise<RxDatabase> | null = null;

export async function getRxDB(): Promise<RxDatabase> {
    if (typeof window === 'undefined') {
        throw new Error('RxDB can only be initialized on the client.');
    }

    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
        const db = await createRxDatabase({
            name: DB_NAME,
            storage: getRxStorageDexie()
        });

        await db.addCollections({
            notes: { schema: NoteSchema },
            tags: { schema: TagSchema },
            tasks: { schema: TaskSchema },
            forms: { schema: FormSchema },
            events: { schema: EventSchema },
            cache: { schema: GenericCacheSchema }
        });

        return db;
    })();

    return dbPromise;
}

/**
 * Migration helper: Moves localStorage keys to RxDB cache.
 */
export async function migrateLocalStorageToRxDB() {
    if (typeof window === 'undefined') return;
    
    const db = await getRxDB();
    const cache = db.cache;
    
    const keys = Object.keys(localStorage);
    const migrateKeys = keys.filter(k => 
        k.startsWith('k_nexus_') || 
        k.startsWith('kylrix_flow_draft_') ||
        k.startsWith('kylrix_connect_cached_')
    );

    for (const key of migrateKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                await cache.upsert({
                    id: key,
                    data: parsed.data || parsed,
                    timestamp: parsed.timestamp || Date.now()
                });
                // Keep localStorage as fallback substrate
            }
        } catch (e) {
            console.warn(`[RxDB Migration] Failed for key: ${key}`, e);
        }
    }
}
