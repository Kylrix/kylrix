/**
 * Kylrix Flow - Drafts Intelligence Service
 * Handles localized persistence of uncommitted form designs using RxDB substrate.
 */
import { getRxDB } from '@/lib/webrtc/RxDBManager';

const STORAGE_PREFIX = 'kylrix_flow_draft_';
const MANIFEST_KEY = 'kylrix_flow_drafts_manifest';

export interface FormDraft {
    id: string; // 'new' or Appwrite Document ID
    title: string;
    description: string;
    status: string;
    fields: any[];
    updatedAt: string;
}

export const DraftsService = {
    /**
     * Save a form draft to RxDB substrate and update the manifest
     */
    async saveDraft(id: string, data: Omit<FormDraft, 'id' | 'updatedAt'>) {
        if (typeof window === 'undefined') return;

        const draft: FormDraft = {
            ...data,
            id,
            updatedAt: new Date().toISOString()
        };

        const db = await getRxDB();
        
        // Store the actual content in the general cache
        await db.cache.upsert({
            id: `${STORAGE_PREFIX}${id}`,
            data: draft as any,
            timestamp: Date.now()
        });

        // Update the manifest for fast lookups
        const manifest = await this.getManifest();
        manifest[id] = {
            title: draft.title || 'Untitled Portal',
            updatedAt: draft.updatedAt
        };
        
        await db.cache.upsert({
            id: MANIFEST_KEY,
            data: manifest as any,
            timestamp: Date.now()
        });
    },

    /**
     * Retrieve a specific draft
     */
    async getDraft(id: string): Promise<FormDraft | null> {
        if (typeof window === 'undefined') return null;
        
        const db = await getRxDB();
        const doc = await db.cache.findOne(`${STORAGE_PREFIX}${id}`).exec();
        
        return doc ? (doc.data as FormDraft) : null;
    },

    /**
     * Check if a specific form has an unsynced draft
     */
    async hasDraft(id: string): Promise<boolean> {
        const manifest = await this.getManifest();
        return !!manifest[id];
    },

    /**
     * Remove a draft and update the manifest
     */
    async clearDraft(id: string) {
        if (typeof window === 'undefined') return;
        
        const db = await getRxDB();
        const doc = await db.cache.findOne(`${STORAGE_PREFIX}${id}`).exec();
        if (doc) await doc.remove();

        const manifest = await this.getManifest();
        if (manifest[id]) {
            delete manifest[id];
            await db.cache.upsert({
                id: MANIFEST_KEY,
                data: manifest as any,
                timestamp: Date.now()
            });
        }
    },

    /**
     * Get the manifest of all existing drafts
     */
    async getManifest(): Promise<Record<string, { title: string, updatedAt: string }>> {
        if (typeof window === 'undefined') return {};
        
        const db = await getRxDB();
        const doc = await db.cache.findOne(MANIFEST_KEY).exec();
        
        return doc ? (doc.data as any) : {};
    },

    /**
     * Clear all form drafts (useful for master resets)
     */
    async clearAll() {
        if (typeof window === 'undefined') return;
        
        const db = await getRxDB();
        const manifest = await this.getManifest();
        
        const purgeActions = Object.keys(manifest).map(async (id) => {
            const doc = await db.cache.findOne(`${STORAGE_PREFIX}${id}`).exec();
            if (doc) await doc.remove();
        });
        
        await Promise.all(purgeActions);
        
        const manifestDoc = await db.cache.findOne(MANIFEST_KEY).exec();
        if (manifestDoc) await manifestDoc.remove();
    }
};
