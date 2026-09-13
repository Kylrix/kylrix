import { describe, expect, it } from 'vitest';
import { searchLocalEngine } from './globalLocalSearch';

describe('searchLocalEngine relevance scoring & OpenBricks fixes', () => {
  it('returns empty array for queries shorter than 2 characters', () => {
    expect(searchLocalEngine('a', {})).toEqual([]);
    expect(searchLocalEngine('', {})).toEqual([]);
  });

  it('ranks exact title match higher than prefix match or content match', () => {
    const ctx = {
      notes: [
        { id: '1', title: 'Task manager notes', content: 'Notes about things' },
        { id: '2', title: 'Task', content: 'Exact match title' },
        { id: '3', title: 'My ideas', content: 'Contains word Task in body' },
      ],
    };

    const results = searchLocalEngine('Task', ctx);
    const noteResults = results.filter((r) => r.kind === 'note');

    expect(noteResults.length).toBe(3);
    // Exact title match ("Task") should be ranked first
    expect(noteResults[0].id).toBe('2');
    // Prefix title match ("Task manager notes") should be ranked second
    expect(noteResults[1].id).toBe('1');
    // Content match ("My ideas") should be ranked third
    expect(noteResults[2].id).toBe('3');
  });

  it('ranks pinned items and recent items properly', () => {
    const ctx = {
      notes: [
        { id: 'unpinned', title: 'Alpha Note', content: 'Content', isPinned: false, $updatedAt: '2020-01-01' },
        { id: 'pinned', title: 'Alpha Note', content: 'Content', isPinned: true, $updatedAt: '2020-01-01' },
      ],
    };

    const results = searchLocalEngine('Alpha', ctx);
    const noteResults = results.filter((r) => r.kind === 'note');
    expect(noteResults[0].id).toBe('pinned');
  });

  it('safely handles special regex characters in search query without throwing', () => {
    const ctx = {
      notes: [
        { id: '1', title: 'Function (test)', content: 'Content with (test)' },
      ],
    };

    expect(() => searchLocalEngine('(test)', ctx)).not.toThrow();
    const results = searchLocalEngine('(test)', ctx);
    expect(results.length).toBeGreaterThan(0);
  });
});
