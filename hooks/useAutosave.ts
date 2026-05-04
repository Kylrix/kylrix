'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateNote } from '@/lib/appwrite';
import type { Notes } from '@/types/appwrite';

interface AutosaveOptions {
  minChangeThreshold?: number; // Minimum length diff before saving
  debounceMs?: number;
  enabled?: boolean;
  onSave?: (note: Notes) => void;
  onError?: (error: Error) => void;
  save?: (note: Notes) => Promise<Notes>;
  trigger?: 'continuous' | 'manual';
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
  return updateNote(note.$id, note);
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
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const lastSavedRef = useRef<Notes | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const rateLimitUntilRef = useRef<number>(0);

  const saveFn = save ?? defaultSave;

  const performSave = useCallback(
    async (candidate: Notes, force = false) => {
      if ((!enabled && !force) || isSavingRef.current || !candidate.$id) return;
      if (Date.now() < rateLimitUntilRef.current) return;
      if (!shouldSave(lastSavedRef.current, candidate, minChangeThreshold)) {
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);

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
        onError?.(error as Error);
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
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
    if (!lastSavedRef.current || lastSavedRef.current.$id !== note.$id) {
      lastSavedRef.current = note;
      rateLimitUntilRef.current = 0;
    }
  }, [note]);

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
