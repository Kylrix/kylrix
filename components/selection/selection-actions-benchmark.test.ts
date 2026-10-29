import { describe, test, expect } from 'vitest';

describe('Universal Selection Actions Performance Benchmark', () => {
  const mockOperation = async (id: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return `processed-${id}`;
  };

  const processSelectedSequential = async (selectedIds: string[], latencyMs: number) => {
    const results: string[] = [];
    for (const id of selectedIds) {
      const res = await mockOperation(id, latencyMs);
      results.push(res);
    }
    return results;
  };

  const processSelectedParallel = async (selectedIds: string[], latencyMs: number) => {
    return Promise.all(
      selectedIds.map(async (id) => {
        return mockOperation(id, latencyMs);
      })
    );
  };

  test('compares sequential vs Promise.all execution time for bulk selection actions on 5 items with simulated latency', async () => {
    const selectedIds = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'];
    const latencyMs = 20;

    const startSeq = performance.now();
    const resultSeq = await processSelectedSequential(selectedIds, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const resultPar = await processSelectedParallel(selectedIds, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(resultSeq).toEqual(resultPar);
    expect(resultPar).toEqual([
      'processed-item-1',
      'processed-item-2',
      'processed-item-3',
      'processed-item-4',
      'processed-item-5',
    ]);

    console.log(`Sequential bulk selection duration (${selectedIds.length} items, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel bulk selection duration (${selectedIds.length} items, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
