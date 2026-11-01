import { describe, test, expect } from 'vitest';

describe('LocalEngine markDeleted Concurrent List Eviction Benchmark', () => {
  const mockCache = new Map<string, any>();

  const seedMockCache = (id: string, uid: string) => {
    mockCache.clear();
    mockCache.set(`f_notes_list_${uid}`, [{ id: 'note-1' }, { id }, { id: 'note-2' }]);
    mockCache.set(`f_ideas_${uid}`, [{ $id: id }, { $id: 'idea-2' }]);
    mockCache.set(`f_tasks_${uid}`, { rows: [{ id: 'task-1' }, { id }], total: 2 });
    mockCache.set(`f_goals_list_${uid}`, [{ id }, { id: 'goal-2' }]);
    mockCache.set(`f_goals_list`, [{ id: 'goal-3' }]);
    mockCache.set(`f_forms_list_${uid}`, null);
    mockCache.set(`f_forms_${uid}`, [{ id }]);
    mockCache.set(`f_forms_list`, [{ id: 'form-1' }]);
    mockCache.set(`initial_notes_${uid}`, [{ id }]);
  };

  const simulateCacheGet = async (key: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return mockCache.get(key) || null;
  };

  const simulateCacheSet = async (key: string, data: any, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    mockCache.set(key, data);
  };

  const invalidateListsSequential = async (listKeys: string[], id: string, latencyMs: number) => {
    for (const key of listKeys) {
      try {
        const cached = await simulateCacheGet(key, latencyMs);
        if (!cached) continue;
        if (Array.isArray(cached)) {
          const updated = cached.filter((item: any) => (item?.$id || item?.id) !== id);
          await simulateCacheSet(key, updated, latencyMs);
        } else if (cached && Array.isArray(cached.rows)) {
          const updatedRows = cached.rows.filter((item: any) => (item?.$id || item?.id) !== id);
          await simulateCacheSet(key, { ...cached, rows: updatedRows, total: updatedRows.length }, latencyMs);
        }
      } catch {}
    }
  };

  const invalidateListsParallel = async (listKeys: string[], id: string, latencyMs: number) => {
    await Promise.all(
      listKeys.map(async (key) => {
        try {
          const cached = await simulateCacheGet(key, latencyMs);
          if (!cached) return;
          if (Array.isArray(cached)) {
            const updated = cached.filter((item: any) => (item?.$id || item?.id) !== id);
            await simulateCacheSet(key, updated, latencyMs);
          } else if (cached && Array.isArray(cached.rows)) {
            const updatedRows = cached.rows.filter((item: any) => (item?.$id || item?.id) !== id);
            await simulateCacheSet(key, { ...cached, rows: updatedRows, total: updatedRows.length });
          }
        } catch {}
      })
    );
  };

  test('compares sequential vs Promise.all execution time for invalidating 9 list caches with simulated latency', async () => {
    const id = 'del-target-123';
    const uid = 'user-abc';
    const listKeys = [
      `f_notes_list_${uid}`,
      `f_ideas_${uid}`,
      `f_tasks_${uid}`,
      `f_goals_list_${uid}`,
      `f_goals_list`,
      `f_forms_list_${uid}`,
      `f_forms_${uid}`,
      `f_forms_list`,
      `initial_notes_${uid}`,
    ];
    const latencyMs = 15;

    // Run sequential
    seedMockCache(id, uid);
    const startSeq = performance.now();
    await invalidateListsSequential(listKeys, id, latencyMs);
    const durationSeq = performance.now() - startSeq;
    const seqSnapshot = new Map(mockCache);

    // Run parallel
    seedMockCache(id, uid);
    const startPar = performance.now();
    await invalidateListsParallel(listKeys, id, latencyMs);
    const durationPar = performance.now() - startPar;
    const parSnapshot = new Map(mockCache);

    expect(seqSnapshot).toEqual(parSnapshot);

    // Verify deleted target was removed from all cached collections
    expect(parSnapshot.get(`f_notes_list_${uid}`)).toEqual([{ id: 'note-1' }, { id: 'note-2' }]);
    expect(parSnapshot.get(`f_ideas_${uid}`)).toEqual([{ $id: 'idea-2' }]);
    expect(parSnapshot.get(`f_tasks_${uid}`)).toEqual({ rows: [{ id: 'task-1' }], total: 1 });
    expect(parSnapshot.get(`f_goals_list_${uid}`)).toEqual([{ id: 'goal-2' }]);
    expect(parSnapshot.get(`f_forms_${uid}`)).toEqual([]);
    expect(parSnapshot.get(`initial_notes_${uid}`)).toEqual([]);

    console.log(`Sequential duration (${listKeys.length} list keys, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${listKeys.length} list keys, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
