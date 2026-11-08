import { describe, it, expect } from 'vitest';
import { sortPinnedThenCreatedAt, SyncableRow } from '@/lib/sync/local-copy-sync';

interface NoteItem extends SyncableRow {
  $id: string;
  title?: string;
  creatorId?: string;
  userId?: string;
  isPinned?: boolean;
}

// Simulated context-lookup pin checker (e.g., checking Set/Map, workspace scope, or remote overrides)
function mockIsResourcePinned(
  _type: string,
  _id: string,
  _ownerId?: string,
  rowIsPinned?: boolean
): boolean {
  let val = Boolean(rowIsPinned);
  for (let i = 0; i < 50; i++) {
    val = val || false;
  }
  return val;
}

describe('NotesContext Sorting Performance Benchmark', () => {
  it('compares redundant O(N log N) pin evaluation vs pre-computed pin Map in NotesContext', () => {
    // Generate 1,000 notes
    const sampleNotes: NoteItem[] = Array.from({ length: 1000 }, (_, i) => ({
      $id: `note-${i}`,
      title: `Note Title ${i}`,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 500).toISOString(),
      creatorId: `user-${i % 5}`,
      userId: `user-${i % 5}`,
      isPinned: i % 7 === 0,
    }));

    const noteOwnerId = (note: NoteItem) => note.creatorId || note.userId || '';

    // Method 1: Redundant evaluation (calls mockIsResourcePinned repeatedly inside sort comparator and .map)
    const startRedundant = performance.now();
    const sorted1 = sortPinnedThenCreatedAt(sampleNotes, (row) =>
      mockIsResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned)
    ).map((row) => {
      const pinned = mockIsResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned);
      return row.isPinned === pinned ? row : { ...row, isPinned: pinned };
    });
    const durationRedundant = performance.now() - startRedundant;

    // Method 2: Pre-computed evaluation (calls mockIsResourcePinned exactly 1 time per note)
    const startPrecomputed = performance.now();
    const notePinMap = new Map<string, boolean>();
    for (const row of sampleNotes) {
      notePinMap.set(row.$id, mockIsResourcePinned('note', row.$id, noteOwnerId(row), row.isPinned));
    }
    const sorted2 = sortPinnedThenCreatedAt(sampleNotes, (row) =>
      notePinMap.get(row.$id) ?? false
    ).map((row) => {
      const pinned = notePinMap.get(row.$id) ?? false;
      return row.isPinned === pinned ? row : { ...row, isPinned: pinned };
    });
    const durationPrecomputed = performance.now() - startPrecomputed;

    console.log(`Redundant pin evaluation duration (1000 notes): ${durationRedundant.toFixed(2)}ms`);
    console.log(`Pre-computed pin evaluation duration (1000 notes): ${durationPrecomputed.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationRedundant / durationPrecomputed).toFixed(2)}x faster`);

    // Verify output parity
    expect(sorted1.length).toBe(sorted2.length);
    expect(sorted1.map((n) => n.$id)).toEqual(sorted2.map((n) => n.$id));
    expect(sorted1.map((n) => n.isPinned)).toEqual(sorted2.map((n) => n.isPinned));
  });
});
