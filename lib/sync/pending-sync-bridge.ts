/**
 * Client-only pending-sync bridge.
 * Never serialized to Appwrite — sync engine reads live payloads via getters.
 */

import type { Notes } from '@/types/appwrite';
import type { Task } from '@/types';

type LiveNoteGetter = (noteId: string) => Notes | null | undefined;
type LiveGoalGetter = (goalId: string) => Task | null | undefined;

let liveNoteGetter: LiveNoteGetter | null = null;
let liveGoalGetter: LiveGoalGetter | null = null;

const pendingListeners = new Set<() => void>();

export function registerLiveNoteGetter(getter: LiveNoteGetter | null): void {
  liveNoteGetter = getter;
}

export function getLiveNoteForSync(noteId: string): Notes | null {
  const id = String(noteId || '').trim();
  if (!id || !liveNoteGetter) return null;
  return liveNoteGetter(id) || null;
}

export function registerLiveGoalGetter(getter: LiveGoalGetter | null): void {
  liveGoalGetter = getter;
}

export function getLiveGoalForSync(goalId: string): Task | null {
  const id = String(goalId || '').trim();
  if (!id || !liveGoalGetter) return null;
  return liveGoalGetter(id) || null;
}

export function notifyPendingSyncListeners(): void {
  pendingListeners.forEach((l) => l());
}

export function subscribePendingSync(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}
