'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateNote } from '@/lib/actions/client-ops';
import { pickNoteAutosavePayload } from '@/lib/appwrite/note';
import type { Notes } from '@/types/appwrite';

interface AutosaveOptions {
  minChangeThreshold?: number; // Minimum length diff before saving
  debounceMs?: number;
  enabled?: boolean;
  onSave?: (note: Notes) => void;
  onError?: (error: Error) => void;
  save?: (note: Notes) => Promise<Notes>;
  trigger?: 'continuous' | 'manual';
  isDirty?: boolean;
}

function arraysEqual(a?: string[] | null, b?: string[] | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function shouldSave(
  previous: Notes | null,
  current: Notes,
  minChangeThreshold: number
) {
  if (!previous) return true;
  if (previous.title !== current.title) return true;
  if (previous.format !== current.format) return true;
  if (!arraysEqual(previous.tags, current.tags)) return true;

  const prevContent = (previous.content || '').trim();
  const currContent = (current.content || '').trim();
  if (prevContent === currContent) return false;

  const diff = Math.abs(currContent.length - prevContent.length);
  if (diff >= minChangeThreshold || prevContent === '' || currContent === '') {
    return true;
  }

  return false;
}

async function defaultSave(note: Notes): Promise<Notes> {
  if (!note.$id) {
    throw new Error('Missing note id for autosave');
  }
  return updateNote(note.$id, {
    ...pickNoteAutosavePayload(note),
    metadata: note.metadata,
  });
}

export function useAutosave(note: Notes | null, options: AutosaveOptions = {}) {
  const {
    minChangeThreshold = 0,
    debounceMs = 500,
    enabled = true,
    onSave,
    onError,
    save,
    trigger = 'continuous',
    isDirty = false,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const lastSavedRef = useRef<Notes | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const pendingPayloadRef = useRef<Notes | null>(null);
  const rateLimitUntilRef = useRef<number>(0);
  const lastErrorToastAtRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const saveFn = save ?? defaultSave;

  const performSave = useCallback(
    async (candidate: Notes, force = false) => {
      if (!candidate.$id) return;
      
      // If a save is already in flight, queue this latest payload
      if (isSavingRef.current) {
        pendingPayloadRef.current = candidate;
        return;
      }

      if ((!enabled && !force) || Date.now() < rateLimitUntilRef.current) {
        return;
      }

      if (!force && !shouldSave(lastSavedRef.current, candidate, minChangeThreshold)) {
        return;
      }

      isSavingRef.current = true;
      if (isMountedRef.current) {
        setIsSaving(true);
      }

      try {
        const saved = await saveFn(candidate);
        lastSavedRef.current = saved;
        onSave?.(saved);
      } catch (error: any) {
        console.error('Autosave failed:', error);
        const message = String(error?.message || '');
        const isRateLimit = /rate limit|too many requests|exceeded/i.test(message);
        if (isRateLimit) {
          rateLimitUntilRef.current = Date.now() + 30000;
        }
        const now = Date.now();
        if (now - lastErrorToastAtRef.current >= 8000) {
          lastErrorToastAtRef.current = now;
          onError?.(error as Error);
        }
      } finally {
        isSavingRef.current = false;
        if (isMountedRef.current) {
          setIsSaving(false);
        }
        
        // Process any queued payload immediately
        if (pendingPayloadRef.current) {
          const next = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          void performSave(next, true);
        }
      }
    },
    [enabled, minChangeThreshold, onSave, onError, saveFn]
  );

  const forceSave = useCallback((candidate: Notes) => performSave(candidate, true), [performSave]);

  useEffect(() => {
    if (!note) {
      lastSavedRef.current = null;
      rateLimitUntilRef.current = 0;
      return;
    }
    const isDifferentNote = !lastSavedRef.current || lastSavedRef.current.$id !== note.$id;
    const isExternalUpdate = !isDirty && lastSavedRef.current && (lastSavedRef.current.content !== note.content || lastSavedRef.current.title !== note.title);

    if (isDifferentNote || isExternalUpdate) {
      // Flush previous note immediately if it had pending changes
      if (isDifferentNote && lastSavedRef.current && pendingPayloadRef.current && pendingPayloadRef.current.$id === lastSavedRef.current.$id) {
        const prev = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        void saveFn(prev).catch(e => console.error('Failed to flush switched note:', e));
      }
      lastSavedRef.current = note;
      rateLimitUntilRef.current = 0;
      pendingPayloadRef.current = null;
    }
  }, [note, saveFn, isDirty]);

  useEffect(() => {
    if (trigger === 'manual') return;
    if (!enabled || !note) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSave(note);
    }, debounceMs);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [note, enabled, debounceMs, performSave, trigger]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    forceSave,
  };
}

export default useAutosave;
