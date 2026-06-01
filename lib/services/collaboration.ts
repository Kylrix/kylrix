import { replicateRxCollection } from 'rxdb/plugins/replication';
import { getRxDB, type NoteDocument } from '@/lib/webrtc/RxDBManager';
import { pullNotesDeltaSecure, pushNotesDeltaSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite/client';

/**
 * Kylrix Collaboration Service
 * Handles RxDB replication with Appwrite for conflict-free character-level sync.
 * Apply Proposal 2.
 */
export const CollaborationService = {
    async setupReplication(userId: string) {
        if (typeof window === 'undefined') return;

        const db = await getRxDB();
        const collection = db.notes;

        console.log(`[Collaboration] Setting up replication for user: ${userId}`);

        const replicationState = replicateRxCollection({
            collection,
            replicationIdentifier: `appwrite-notes-${userId}`,
            live: true,
            retryTime: 5000,
            pull: {
                handler: async (lastCheckpoint: any, batchSize) => {
                    try {
                        const jwt = await account.createJWT();
                        const result = await pullNotesDeltaSecure({
                            lastCheckpoint: lastCheckpoint ? lastCheckpoint.updatedAt : null,
                            limit: batchSize
                        }, jwt.jwt);
                        
                        return {
                            documents: result.documents as any[],
                            checkpoint: result.checkpoint
                        };
                    } catch (err) {
                        console.error('[Replication] Pull failed:', err);
                        return { documents: [], checkpoint: lastCheckpoint };
                    }
                }
            },
            push: {
                handler: async (rows) => {
                    try {
                        const jwt = await account.createJWT();
                        const conflicts = await pushNotesDeltaSecure(rows, jwt.jwt);
                        return conflicts as any[];
                    } catch (err) {
                        console.error('[Replication] Push failed:', err);
                        return [];
                    }
                },
                batchSize: 5
            }
        });

        // Log replication events
        replicationState.error$.subscribe(err => {
            console.error('[Replication] Sync Error:', err);
        });

        replicationState.active$.subscribe(active => {
            console.log('[Replication] Sync Active:', active);
        });

        return replicationState;
    },

    /**
     * Conflict-free update using CRDT operators.
     */
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
                    updatedAt: new Date().toISOString()
                }
            }
        });
    }
};
