import { describe, test, expect } from 'vitest';

describe('HangoutsDrawer Share Performance Benchmark', () => {
  const mockShareSequential = async (
    targets: Array<{ id: string; kind: 'secure' | 'thread' }>,
    latencyMs: number
  ) => {
    let sentCount = 0;
    for (const target of targets) {
      if (target.kind === 'secure') {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
      } else {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
      }
      sentCount++;
    }
    return sentCount;
  };

  const mockShareParallel = async (
    targets: Array<{ id: string; kind: 'secure' | 'thread' }>,
    latencyMs: number
  ) => {
    let sentCount = 0;
    await Promise.all(
      targets.map(async (target) => {
        if (target.kind === 'secure') {
          await new Promise((resolve) => setTimeout(resolve, latencyMs));
        } else {
          await new Promise((resolve) => setTimeout(resolve, latencyMs));
        }
        sentCount++;
      })
    );
    return sentCount;
  };

  test('compares sequential vs Promise.all execution time for sharing object across 5 hangouts with 20ms latency', async () => {
    const targets: Array<{ id: string; kind: 'secure' | 'thread' }> = [
      { id: 'chat_1', kind: 'secure' },
      { id: 'chat_2', kind: 'secure' },
      { id: 'thread_1', kind: 'thread' },
      { id: 'chat_3', kind: 'secure' },
      { id: 'thread_2', kind: 'thread' },
    ];
    const latencyMs = 20;

    const startSeq = performance.now();
    const countSeq = await mockShareSequential(targets, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const countPar = await mockShareParallel(targets, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(countSeq).toBe(targets.length);
    expect(countPar).toBe(targets.length);

    console.log(`Sequential duration (5 targets, 20ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (5 targets, 20ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    // Concurrent execution should complete in ~1 latency window (~20ms) vs 5 windows (~100ms)
    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
