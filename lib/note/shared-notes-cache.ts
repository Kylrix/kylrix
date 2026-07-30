import type { Notes } from '@/types/appwrite';
import { getNotePublicState } from '@/lib/appwrite/note';

export type SharedNoteRow = Notes & {
  sharedPermission?: string;
  sharedAt?: string;
  sharedBy?: { name: string; email: string } | null;
};

interface SharedNotesPartition {
  privateNotes: SharedNoteRow[];
  sharedPublicNotes: SharedNoteRow[];
}

/** In-memory session cache — survives client navigations within the same tab. */
let sessionSharedRows: SharedNoteRow[] | null = null;

export function getSessionSharedNotes(): SharedNoteRow[] | null {
  return sessionSharedRows;
}

export function setSessionSharedNotes(rows: SharedNoteRow[]): void {
  sessionSharedRows = rows;
}


export function sharedNotesCacheKey(userId: string): string {
  return `shared_notes_${userId}`;
}


