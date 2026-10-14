import { replicateRxCollection } from 'rxdb/plugins/replication';
import { getRxDB, type NoteDocument } from '@/lib/webrtc/RxDBManager';
import { pullNotesDeltaSecure, pushNotesDeltaSecure } from '@/lib/actions/secure-ops';

export const CollaborationService = {
  async setupReplication(userId: string) {
    if (typeof window === 'undefined') return;

    const db = await getRxDB();
    const collection = db.notes;

    console.log(`[Collaboration] Setting up replication for user: ${userId}`);

    const replicationState = replicateRxCollection({
      collection,
      replicationIdentifier: `turso-notes-${userId}`,
      live: true,
      retryTime: 5000,
      pull: {
        handler: async (lastCheckpoint: any, batchSize) => {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return { documents: [], checkpoint: lastCheckpoint };
          }
          try {
            const result = await pullNotesDeltaSecure({
              lastCheckpoint: lastCheckpoint ? lastCheckpoint.updatedAt : null,
              limit: batchSize,
            });

            return {
              documents: result.documents as any[],
              checkpoint: result.checkpoint,
            };
          } catch (_err) {
            return { documents: [], checkpoint: lastCheckpoint };
          }
        },
      },
      push: {
        handler: async (rows) => {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return [];
          }
          try {
            const conflicts = await pushNotesDeltaSecure(rows);
            return conflicts as any[];
          } catch (_err) {
            return [];
          }
        },
        batchSize: 5,
      },
    });

    replicationState.error$.subscribe((err) => {
      console.error('[Replication] Sync Error:', err);
    });

    replicationState.active$.subscribe((active) => {
      console.log('[Replication] Sync Active:', active);
    });

    return replicationState;
  },

  async updateNoteCRDT(noteId: string, patch: Partial<Omit<NoteDocument, 'id' | 'updatedAt' | 'crdt'>>) {
    const db = await getRxDB();
    const doc = await db.notes.findOne(noteId).exec();

    if (!doc) {
      console.warn(`[Collaboration] Note not found for CRDT update: ${noteId}`);
      return;
    }

    await doc.insertCRDT({
      ifMatch: {
        $set: {
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  },
};
