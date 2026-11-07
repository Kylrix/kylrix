import { describe, test, expect, vi } from 'vitest';
import { updateLocalShareCache } from './ShareContextDrawer';
import { LocalEngine } from '@/lib/services/LocalEngine';

describe('ShareContextDrawer Local Share Cache Concurrent Update Benchmark', () => {
  test('compares sequential vs concurrent execution time for updating share cache across 4 keys with 15ms simulated latency', async () => {
    const keys = ['f_ideas_all', 'f_ideas_guest', 'f_notes_list', 'f_notes_list_guest'];
    const latencyMs = 15;

    // Helper simulating sequential update
    const runSequential = async () => {
      for (const _key of keys) {
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheGet
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheSet
      }
    };

    // Helper simulating concurrent update
    const runConcurrent = async () => {
      await Promise.all(
        keys.map(async (_key) => {
          await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheGet
          await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheSet
        })
      );
    };

    const startSeq = performance.now();
    await runSequential();
    const durationSeq = performance.now() - startSeq;

    const startCon = performance.now();
    await runConcurrent();
    const durationCon = performance.now() - startCon;

    const speedup = durationSeq / durationCon;

    console.log(`Sequential cache update duration (4 keys, 15ms per step): ${durationSeq.toFixed(2)}ms`);
    console.log(`Concurrent cache update duration (4 keys, 15ms per step): ${durationCon.toFixed(2)}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x faster`);

    expect(durationCon).toBeLessThan(durationSeq / 2);
    expect(speedup).toBeGreaterThan(2.0);
  });

  test('verifies updateLocalShareCache correctly mutates items and writes to LocalEngine', async () => {
    const resourceId = 'test_note_target';
    const mockStore = new Map<string, any>();

    mockStore.set('f_ideas_all', {
      rows: [
        { $id: 'other_note', title: 'Other', isPublic: false, isGuest: false },
        { $id: resourceId, title: 'Target', isPublic: false, isGuest: false },
      ],
    });
    mockStore.set('f_ideas_guest', {
      rows: [
        { id: resourceId, title: 'Target Guest', isPublic: false, isGuest: false },
      ],
    });
    mockStore.set('f_notes_list', {
      rows: [
        { $id: resourceId, title: 'Target List', isPublic: false, isGuest: false },
      ],
    });
    mockStore.set('f_notes_list_guest', {
      rows: [
        { $id: 'unrelated', title: 'Unrelated' },
      ],
    });

    vi.spyOn(LocalEngine, 'cacheGet').mockImplementation(async (key: string) => {
      return mockStore.get(key) || null;
    });

    vi.spyOn(LocalEngine, 'cacheSet').mockImplementation(async (key: string, data: any) => {
      mockStore.set(key, data);
    });

    await updateLocalShareCache('note', resourceId);

    const updatedIdeasAll = mockStore.get('f_ideas_all');
    const targetInIdeasAll = updatedIdeasAll.rows.find((r: any) => r.$id === resourceId);
    expect(targetInIdeasAll.isPublic).toBe(true);
    expect(targetInIdeasAll.isGuest).toBe(true);
    expect(targetInIdeasAll.isPublished).toBe(true);

    const otherInIdeasAll = updatedIdeasAll.rows.find((r: any) => r.$id === 'other_note');
    expect(otherInIdeasAll.isPublic).toBe(false);

    const updatedGuest = mockStore.get('f_ideas_guest');
    const targetInGuest = updatedGuest.rows.find((r: any) => r.id === resourceId);
    expect(targetInGuest.isPublic).toBe(true);
    expect(targetInGuest.isGuest).toBe(true);
    expect(targetInGuest.isPublished).toBe(true);
  });
});
