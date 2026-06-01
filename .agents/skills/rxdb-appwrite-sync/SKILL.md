---
name: rxdb-appwrite-sync
description: Heavy-duty local storage with RxDB and Appwrite synchronization. Use when the application needs to bypass localStorage limits (5MB) using IndexedDB, implement CRDT-based conflict-free collaboration on shared notes, or support offline-first data persistence.
---

# RxDB & Appwrite Sync Guide

This skill provides architectural guidance and implementation patterns for heavy-duty offline storage and conflict-free collaboration in the Kylrix ecosystem.

## 1. Architecture: The Dual-Engine Nexus

To achieve pure HTML loading velocities and sub-millisecond execution speeds, the Data Nexus uses a two-tier storage model:

1.  **Synchronous Mirror (Volatile Map)**: A reactive, in-memory JavaScript Map that provides 0ms access for UI components.
2.  **Local Substrate (RxDB/IndexedDB)**: A persistent, heavy-duty browser database that handles data scaling beyond the 5MB localStorage wall.

## 2. RxDB Setup & Collections

Register the CRDT plugin and initialize the RxDatabase.

```typescript
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBPluginsCRDTPlugin, getCRDTSchemaPart } from 'rxdb/plugins/crdt';

addRxPlugin(RxDBPluginsCRDTPlugin);

const db = await createRxDatabase({
    name: 'kylrix_nexus_db',
    storage: getRxStorageDexie()
});

await db.addCollections({
    notes: {
        schema: {
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
            crdt: { field: 'crdt' }
        }
    }
});
```

## 3. Appwrite Replication Protocol

Implement the Push-Pull protocol using Secure Server Actions.

### Pull Handler (Server -> Client)
Fetches changes since the last checkpoint. Uses `listDocuments` with an `updatedAt` filter.

### Push Handler (Client -> Server)
Sends local changes to the server. Performs conflict resolution by returning the master state if a mismatch is detected.

```typescript
const replicationState = replicateRxCollection({
    collection: db.notes,
    replicationIdentifier: 'appwrite-notes',
    live: true,
    pull: {
        handler: async (lastCheckpoint, batchSize) => {
            const { pullNotesDeltaSecure } = await import('@/lib/actions/secure-ops');
            return await pullNotesDeltaSecure({
                lastCheckpoint: lastCheckpoint?.updatedAt || null,
                limit: batchSize
            });
        }
    },
    push: {
        handler: async (rows) => {
            const { pushNotesDeltaSecure } = await import('@/lib/actions/secure-ops');
            return await pushNotesDeltaSecure(rows);
        },
        batchSize: 5
    }
});
```

## 4. Conflict-Free Collaboration (CRDTs)

Instead of absolute overwrites, use CRDT operators for character-level or field-level updates.

```typescript
// Conflict-free text update
await noteDoc.insertCRDT({
    ifMatch: {
        $set: { content: newText }
    }
});
```

## 5. Security Mandates

1.  **Authenticated Sync**: Every replication request MUST include a valid JWT or session cookie.
2.  **Encrypted Payloads**: Leverage `encrypt: true` in Appwrite columns for signaling data and SDP strings.
3.  **Authoritative Checkpoints**: Checkpoints MUST be verified server-side against the user's actual update history.

## 6. Self-Cleaning GC

Periodically prune CRDT operation history using the RxDB `cleanup` plugin to maintain performance.
