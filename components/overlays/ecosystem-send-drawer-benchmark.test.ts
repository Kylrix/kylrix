import { describe, test, expect } from 'vitest';

describe('EcosystemSendDrawer Concurrent Message Dispatch Benchmark', () => {
  const mockSequentialDispatch = async (
    targets: Array<{ id: string; kind: 'secure' | 'thread' }>,
    latencyMs: number,
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

  const mockConcurrentDispatch = async (
    targets: Array<{ id: string; kind: 'secure' | 'thread' }>,
    latencyMs: number,
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
      }),
    );
    return sentCount;
  };

  test('compares sequential vs Promise.all execution time for sending item across 5 targets with 20ms simulated latency', async () => {
    const targets: Array<{ id: string; kind: 'secure' | 'thread' }> = [
      { id: 'chat_1', kind: 'secure' },
      { id: 'chat_2', kind: 'secure' },
      { id: 'thread_1', kind: 'thread' },
      { id: 'chat_3', kind: 'secure' },
      { id: 'thread_2', kind: 'thread' },
    ];
    const latencyMs = 20;

    const startSeq = performance.now();
    const countSeq = await mockSequentialDispatch(targets, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startCon = performance.now();
    const countCon = await mockConcurrentDispatch(targets, latencyMs);
    const durationCon = performance.now() - startCon;

    expect(countSeq).toBe(targets.length);
    expect(countCon).toBe(targets.length);

    console.log(`Sequential duration (5 targets, 20ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Concurrent duration (5 targets, 20ms latency): ${durationCon.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationCon).toFixed(2)}x faster`);

    // Concurrent execution should complete in ~1 latency window (~20ms) vs 5 serial windows (~100ms)
    expect(durationCon).toBeLessThan(durationSeq / 2);
  });
});
