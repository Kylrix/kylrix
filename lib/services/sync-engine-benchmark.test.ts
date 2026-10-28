import { describe, test, expect } from 'vitest';

describe('SyncEngine Concurrent Flushing Benchmark', () => {
  const mockFlushItem = async (id: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return { id, flushedAt: Date.now() };
  };

  const flushSequential = async (pendingIds: string[], latencyMs: number) => {
    const results: any[] = [];
    for (const pendingId of pendingIds) {
      try {
        results.push(await mockFlushItem(pendingId, latencyMs));
      } catch {}
    }
    return results;
  };

  const flushParallel = async (pendingIds: string[], latencyMs: number) => {
    return await Promise.all(
      pendingIds.map(async (pendingId) => {
        try {
          return await mockFlushItem(pendingId, latencyMs);
        } catch {
          return null;
        }
      })
    );
  };

  test('compares sequential vs Promise.all execution time for flushing 5 pending sync queue items with simulated network latency', async () => {
    const pendingIds = ['note_1', 'goal:goal_1', 'event:event_1', 'cred:cred_1', 'totp:totp_1'];
    const latencyMs = 20;

    const startSeq = performance.now();
    const resultSeq = await flushSequential(pendingIds, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const resultPar = await flushParallel(pendingIds, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(resultSeq.length).toBe(5);
    expect(resultPar.length).toBe(5);

    console.log(`Sequential duration (${pendingIds.length} items, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${pendingIds.length} items, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
