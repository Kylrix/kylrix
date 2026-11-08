import { describe, it, expect } from 'vitest';

interface NoteLike {
  $id: string;
  title?: string;
  tags?: string[];
  isPinned?: boolean;
}

function aggregateTagsBaseline(notes: NoteLike[]): string[] {
  const fromNotes = notes.flatMap((n: any) => n.tags || []).filter(Boolean);
  return Array.from(new Set(fromNotes)).slice(0, 16);
}

function aggregateTagsOptimized(notes: NoteLike[]): string[] {
  const tagSet = new Set<string>();
  for (const note of notes) {
    if (Array.isArray(note.tags)) {
      for (const tag of note.tags) {
        if (tag) {
          tagSet.add(tag);
          if (tagSet.size === 16) break;
        }
      }
      if (tagSet.size === 16) break;
    }
  }
  return Array.from(tagSet);
}

describe('Notes Tag Aggregation Invariant and Benchmark', () => {
  it('verifies exact parity between baseline and optimized tag aggregation across edge cases', () => {
    // Case 1: Empty collection
    expect(aggregateTagsOptimized([])).toEqual(aggregateTagsBaseline([]));
    expect(aggregateTagsOptimized([])).toEqual([]);

    // Case 2: Notes without tags or with empty/null/falsy tags
    const notesWithFalsy: NoteLike[] = [
      { $id: '1' },
      { $id: '2', tags: [] },
      { $id: '3', tags: ['', undefined as unknown as string, 'work', ''] },
      { $id: '4', tags: ['ideas', 'personal'] },
    ];
    expect(aggregateTagsOptimized(notesWithFalsy)).toEqual(aggregateTagsBaseline(notesWithFalsy));
    expect(aggregateTagsOptimized(notesWithFalsy)).toEqual(['work', 'ideas', 'personal']);

    // Case 3: More than 16 unique tags - ensures truncation to top 16 in exact order
    const notesWithManyTags: NoteLike[] = Array.from({ length: 30 }, (_, i) => ({
      $id: `note-${i}`,
      tags: [`tag-${i}`, `shared-tag`],
    }));
    const baselineMany = aggregateTagsBaseline(notesWithManyTags);
    const optimizedMany = aggregateTagsOptimized(notesWithManyTags);
    expect(optimizedMany).toEqual(baselineMany);
    expect(optimizedMany.length).toBe(16);
    expect(optimizedMany[0]).toBe('tag-0');
    expect(optimizedMany[1]).toBe('shared-tag');
    expect(optimizedMany[2]).toBe('tag-1');

    // Case 4: Duplicate tags across notes
    const notesWithDuplicates: NoteLike[] = [
      { $id: 'a', tags: ['alpha', 'beta', 'gamma'] },
      { $id: 'b', tags: ['beta', 'delta'] },
      { $id: 'c', tags: ['gamma', 'alpha', 'epsilon'] },
    ];
    expect(aggregateTagsOptimized(notesWithDuplicates)).toEqual(aggregateTagsBaseline(notesWithDuplicates));
    expect(aggregateTagsOptimized(notesWithDuplicates)).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
  });

  it('measures performance speedup on 1,000 notes collection', () => {
    const sampleNotes: NoteLike[] = Array.from({ length: 1000 }, (_, i) => ({
      $id: `note-${i}`,
      isPinned: i % 4 === 0,
      tags:
        i % 2 === 0
          ? [`tag-${i % 25}`, 'project', '']
          : ['ideas', `tag-${i % 15}`],
    }));

    const iterations = 500;

    // Warm-up
    aggregateTagsBaseline(sampleNotes);
    aggregateTagsOptimized(sampleNotes);

    const startBaseline = performance.now();
    for (let i = 0; i < iterations; i++) {
      aggregateTagsBaseline(sampleNotes);
    }
    const durationBaseline = performance.now() - startBaseline;

    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      aggregateTagsOptimized(sampleNotes);
    }
    const durationOptimized = performance.now() - startOptimized;

    console.log(`Baseline flatMap duration (1,000 notes x ${iterations} iters): ${durationBaseline.toFixed(2)}ms`);
    console.log(`Optimized Set duration (1,000 notes x ${iterations} iters): ${durationOptimized.toFixed(2)}ms`);
    const speedup = durationBaseline / durationOptimized;
    console.log(`Speedup: ${speedup.toFixed(2)}x faster`);

    // Verify speedup is substantial (> 1.5x minimum, typically > 3x)
    expect(speedup).toBeGreaterThan(1.5);
  });
});
