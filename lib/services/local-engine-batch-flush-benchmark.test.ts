import { describe, test, expect } from 'vitest';

describe('LocalEngine Batch Mutator Flush Concurrent Execution Benchmark', () => {
  const simulatedMutatorLatencyMs = 15;

  const runSequentialFlush = async (
    entries: Array<[string, { mutator: () => Promise<void> }]>
  ): Promise<string[]> => {
    const executed: string[] = [];
    for (const [key, { mutator }] of entries) {
      try {
        await mutator();
        executed.push(key);
      } catch (e) {
        console.warn('[LocalEngine batch] mutator failed', e);
      }
    }
    return executed;
  };

  const runConcurrentFlush = async (
    entries: Array<[string, { mutator: () => Promise<void> }]>
  ): Promise<string[]> => {
    const executed: string[] = [];
    await Promise.all(
      entries.map(async ([key, { mutator }]) => {
        try {
          await mutator();
          executed.push(key);
        } catch (e) {
          console.warn('[LocalEngine batch] mutator failed', e);
        }
      })
    );
    return executed;
  };

  test('compares sequential vs Promise.all execution time and confirms error isolation across 10 queued batch mutators', async () => {
    const executedKeysSeq: string[] = [];
    const executedKeysPar: string[] = [];

    const createEntries = (targetList: string[]) =>
      Array.from({ length: 10 }, (_, i) => {
        const key = `cache_key_${i}`;
        const shouldFail = i === 4; // Verify error isolation when a mutator fails
        const mutator = async () => {
          await new Promise((resolve) => setTimeout(resolve, simulatedMutatorLatencyMs));
          if (shouldFail) {
            throw new Error(`Intentional network glitch on ${key}`);
          }
          targetList.push(key);
        };
        return [key, { mutator }] as [string, { mutator: () => Promise<void> }];
      });

    // 1. Run sequential
    const entriesSeq = createEntries(executedKeysSeq);
    const startSeq = performance.now();
    await runSequentialFlush(entriesSeq);
    const durationSeq = performance.now() - startSeq;

    // 2. Run concurrent (Promise.all)
    const entriesPar = createEntries(executedKeysPar);
    const startPar = performance.now();
    await runConcurrentFlush(entriesPar);
    const durationPar = performance.now() - startPar;

    console.log(
      `Sequential batch flush duration (10 mutators, ${simulatedMutatorLatencyMs}ms latency): ${durationSeq.toFixed(2)}ms`
    );
    console.log(
      `Concurrent batch flush duration (10 mutators, ${simulatedMutatorLatencyMs}ms latency): ${durationPar.toFixed(2)}ms`
    );
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    // Verify all 9 successful mutators executed despite 1 error (error isolation parity)
    expect(executedKeysSeq.length).toBe(9);
    expect(executedKeysPar.length).toBe(9);
    expect(new Set(executedKeysPar)).toEqual(new Set(executedKeysSeq));

    // Assert speedup is at least 3x faster than serial loop
    expect(durationPar).toBeLessThan(durationSeq / 3);
  });
});
