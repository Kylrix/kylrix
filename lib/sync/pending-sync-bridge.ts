/**
 * Client-only pending-sync bridge.
 * Never serialized to Appwrite — sync engine reads live payloads via getters.
 */

import type { Notes } from '@/types/appwrite';
import type { Task, Event } from '@/types';
import { toCanonicalDocumentId } from '@/lib/sync/goal-keys';

type LiveNoteGetter = (noteId: string) => Notes | null | undefined;
type LiveGoalGetter = (goalId: string) => Task | null | undefined;
type LiveEventGetter = (eventId: string) => Event | null | undefined;

let liveNoteGetter: LiveNoteGetter | null = null;
let liveGoalGetter: LiveGoalGetter | null = null;
let liveEventGetter: LiveEventGetter | null = null;

export function registerLiveNoteGetter(getter: LiveNoteGetter | null): void {
  liveNoteGetter = getter;
}

export function getLiveNoteForSync(noteId: string): Notes | null {
  const id = toCanonicalDocumentId(noteId);
  if (!id || !liveNoteGetter) return null;
  return liveNoteGetter(id) || null;
}

export function registerLiveGoalGetter(getter: LiveGoalGetter | null): void {
  liveGoalGetter = getter;
}

export function getLiveGoalForSync(goalId: string): Task | null {
  const id = toCanonicalDocumentId(goalId);
  if (!id || !liveGoalGetter) return null;
  return liveGoalGetter(id) || null;
}

export function registerLiveEventGetter(getter: LiveEventGetter | null): void {
  liveEventGetter = getter;
}

export function getLiveEventForSync(eventId: string): Event | null {
  const id = toCanonicalDocumentId(eventId);
  if (!id || !liveEventGetter) return null;
  return liveEventGetter(id) || null;
}
