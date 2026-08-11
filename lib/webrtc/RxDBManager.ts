import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
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

const DB_NAME = 'kylrix_nexus_db_v2';

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
    crdt: { field: 'crdt' },
    indexes: ['userId', ['userId', 'updatedAt']]
};

const GenericCacheSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 256 },
        data: { type: 'object' },
        timestamp: { type: 'number' }
    },
    required: ['id', 'data', 'timestamp']
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
    required: ['id', 'title', 'userId'],
    indexes: ['userId', 'projectId', ['userId', 'projectId']]
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
let currentDbPartition: string | null = null;

export async function getRxDB(): Promise<RxDatabase> {
    if (typeof window === 'undefined') {
        throw new Error('RxDB can only be initialized on the client.');
    }

    const { getActivePartitionId } = await import('@/lib/account/partition');
    const activePid = getActivePartitionId() || 'acc_default';

    if (dbPromise && currentDbPartition === activePid) return dbPromise;

    currentDbPartition = activePid;
    const partitionedDbName = activePid === 'acc_default' ? DB_NAME : `${DB_NAME}_${activePid}`;

    dbPromise = (async () => {
        const db = await createRxDatabase({
            name: partitionedDbName,
            storage: getRxStorageDexie()
        });

        try {
            await db.addCollections({
                notes: { schema: NoteSchema },
                tags: { schema: TagSchema },
                tasks: { schema: TaskSchema },
                forms: { schema: FormSchema },
                events: { schema: EventSchema },
                cache: { schema: GenericCacheSchema }
            });
        } catch (addErr: any) {
            console.warn('[RxDBManager] Schema mismatch or DB6 error, purging outdated partition DB:', partitionedDbName, addErr?.message);
            if (db && typeof (db as any).remove === 'function') {
                await (db as any).remove().catch(() => {});
            } else if (db && typeof (db as any).destroy === 'function') {
                await (db as any).destroy().catch(() => {});
            }
            if (typeof window !== 'undefined' && window.indexedDB) {
                await new Promise<void>((resolve) => {
                    const req = indexedDB.deleteDatabase(partitionedDbName);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                });
            }
            const freshDb = await createRxDatabase({
                name: partitionedDbName,
                storage: getRxStorageDexie()
            });
            await freshDb.addCollections({
                notes: { schema: NoteSchema },
                tags: { schema: TagSchema },
                tasks: { schema: TaskSchema },
                forms: { schema: FormSchema },
                events: { schema: EventSchema },
                cache: { schema: GenericCacheSchema }
            });
            return freshDb;
        }

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
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn(`[RxDB Migration] Failed for key: ${key}`, e);
        }
    }
}
