/**
 * Kylrix Flow - Drafts Intelligence Service
 * Handles localized persistence of uncommitted form designs.
 */

const STORAGE_PREFIX = 'kylrix_flow_draft_';
const METADATA_KEY = 'kylrix_flow_drafts_manifest';

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
     * Save a form draft to local storage and update the manifest
     */
    saveDraft(id: string, data: Omit<FormDraft, 'id' | 'updatedAt'>) {
        if (typeof window === 'undefined') return;

        const draft: FormDraft = {
            ...data,
            id,
            updatedAt: new Date().toISOString()
        };

        // Store the actual content
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(draft));

        // Update the manifest for fast lookups
        const manifest = this.getManifest();
        manifest[id] = {
            title: draft.title || 'Untitled Portal',
            updatedAt: draft.updatedAt
        };
        localStorage.setItem(METADATA_KEY, JSON.stringify(manifest));
    },

    /**
     * Retrieve a specific draft
     */
    getDraft(id: string): FormDraft | null {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_e) {
            return null;
        }
    },

    /**
     * Check if a specific form has an unsynced draft
     */
    hasDraft(id: string): boolean {
        const manifest = this.getManifest();
        return !!manifest[id];
    },

    /**
     * Remove a draft and update the manifest
     */
    clearDraft(id: string) {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
        const manifest = this.getManifest();
        delete manifest[id];
        localStorage.setItem(METADATA_KEY, JSON.stringify(manifest));
    },

    /**
     * Get the manifest of all existing drafts
     */
    getManifest(): Record<string, { title: string, updatedAt: string }> {
        if (typeof window === 'undefined') return {};
        const raw = localStorage.getItem(METADATA_KEY);
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch (_e) {
            return {};
        }
    },

    /**
     * Clear all form drafts (useful for master resets)
     */
    clearAll() {
        if (typeof window === 'undefined') return;
        const manifest = this.getManifest();
        Object.keys(manifest).forEach(id => {
            localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
        });
        localStorage.removeItem(METADATA_KEY);
    }
};
