import { describe, test, expect } from 'vitest';

describe('Form Responses Workflow Goal Creation Benchmark', () => {
  const mockCreateGoalSequential = async (items: any[], latencyMs: number) => {
    const created: any[] = [];
    for (const item of items) {
      if (item?.title) {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
        created.push({ ...item, status: 'todo' });
      }
    }
    return created;
  };

  const mockCreateGoalParallel = async (items: any[], latencyMs: number) => {
    const promises = items.map(async (item) => {
      if (item?.title) {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
        return { ...item, status: 'todo' };
      }
      return null;
    });
    const results = await Promise.all(promises);
    return results.filter(Boolean);
  };

  test('compares sequential vs Promise.all execution time for creating synthesized goals with 20ms latency', async () => {
    const mockGoals = [
      { title: 'Goal 1', description: 'Desc 1', priority: 'high' },
      { title: 'Goal 2', description: 'Desc 2', priority: 'medium' },
      { title: 'Goal 3', description: 'Desc 3', priority: 'low' },
      { title: 'Goal 4', description: 'Desc 4', priority: 'high' },
      { title: 'Goal 5', description: 'Desc 5', priority: 'medium' },
    ];
    const latencyMs = 20;

    const startSeq = performance.now();
    const createdSeq = await mockCreateGoalSequential(mockGoals, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const createdPar = await mockCreateGoalParallel(mockGoals, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(createdSeq.length).toBe(mockGoals.length);
    expect(createdPar.length).toBe(mockGoals.length);

    console.log(`Sequential duration (${mockGoals.length} goals, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${mockGoals.length} goals, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    // Parallel execution should complete in ~1 latency window instead of 5
    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
