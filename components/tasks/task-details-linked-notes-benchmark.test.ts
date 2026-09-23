import { describe, test, expect } from 'vitest';

describe('Task Details Linked Notes Load Benchmark', () => {
  const mockNoteApiGet = async (id: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (id === 'error-note') {
      throw new Error('Not found');
    }
    return { title: `Note Title for ${id}` };
  };

  const loadLinkedNotesSequential = async (linkedNotes: string[], latencyMs: number) => {
    const next: Record<string, string> = {};
    for (const noteId of linkedNotes) {
      try {
        const note = await mockNoteApiGet(noteId, latencyMs);
        next[noteId] = note?.title || noteId;
      } catch (_error) {
        next[noteId] = noteId;
      }
    }
    return next;
  };

  const loadLinkedNotesParallel = async (linkedNotes: string[], latencyMs: number) => {
    const next: Record<string, string> = {};
    const entries = await Promise.all(
      linkedNotes.map(async (noteId) => {
        try {
          const note = await mockNoteApiGet(noteId, latencyMs);
          return [noteId, note?.title || noteId] as [string, string];
        } catch (_error) {
          return [noteId, noteId] as [string, string];
        }
      })
    );

    for (const [id, title] of entries) {
      next[id] = title;
    }
    return next;
  };

  test('compares sequential vs Promise.all execution time for loading 5 linked notes with simulated latency', async () => {
    const linkedNotes = ['note-1', 'note-2', 'note-3', 'error-note', 'note-5'];
    const latencyMs = 20;

    const startSeq = performance.now();
    const resultSeq = await loadLinkedNotesSequential(linkedNotes, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const resultPar = await loadLinkedNotesParallel(linkedNotes, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(resultSeq).toEqual(resultPar);
    expect(resultPar).toEqual({
      'note-1': 'Note Title for note-1',
      'note-2': 'Note Title for note-2',
      'note-3': 'Note Title for note-3',
      'error-note': 'error-note',
      'note-5': 'Note Title for note-5',
    });

    console.log(`Sequential duration (${linkedNotes.length} notes, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${linkedNotes.length} notes, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
