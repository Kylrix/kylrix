'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getRxDB, type NoteDocument } from '@/lib/webrtc/RxDBManager';
import { CollaborationService } from '@/lib/services/collaboration';
import { useAuth } from '@/context/auth/AuthContext';

/**
 * Hook for conflict-free collaborative note editing.
 * Bypasses overwrites using character-level CRDT deltas via RxDB.
 */
export function useCollaborativeNote(noteId?: string) {
    const { user } = useAuth();
    const [note, setNote] = useState<NoteDocument | null>(null);
    const [loading, setLoading] = useState(!!noteId);
    const [error, setError] = useState<string | null>(null);
    const rxNoteRef = useRef<any>(null);

    const loadNote = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const db = await getRxDB();
            const query = db.notes.findOne(id);
            
            // Subscribe to live updates (CRDT merges)
            const sub = query.$.subscribe(doc => {
                if (doc) {
                    setNote(doc.toJSON() as NoteDocument);
                    rxNoteRef.current = doc;
                }
            });

            return () => sub.unsubscribe();
        } catch (err: any) {
            console.error('[useCollaborativeNote] Failed to load:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (noteId) {
            const cleanupPromise = loadNote(noteId);
            return () => {
                cleanupPromise.then(cleanup => cleanup?.());
            };
        }
    }, [noteId, loadNote]);

    const updateNote = useCallback(async (patch: Partial<Omit<NoteDocument, 'id' | 'updatedAt' | 'crdt'>>) => {
        if (!noteId) return;
        
        try {
            // Section 4: Conflict-Free update using CRDT operators
            await CollaborationService.updateNoteCRDT(noteId, patch);
        } catch (err: any) {
            console.error('[useCollaborativeNote] Update failed:', err);
            throw err;
        }
    }, [noteId]);

    return {
        note,
        loading,
        error,
        updateNote
    };
}
