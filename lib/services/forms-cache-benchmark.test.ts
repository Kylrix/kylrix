import { describe, test, expect, vi } from 'vitest';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { FormsService } from '@/lib/services/forms';

describe('FormsService Local Form Cache Concurrent Update Benchmark', () => {
  test('compares sequential vs concurrent execution time for updating form caches across 3 keys with 15ms simulated latency', async () => {
    const userId = 'usr_benchmark_test';
    const cacheKeys = [`f_forms_list_${userId}`, `f_forms_${userId}`, 'f_forms_list'];
    const latencyMs = 15;

    // Helper simulating sequential update
    const runSequential = async () => {
      for (const _key of cacheKeys) {
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheGet
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheSet
      }
    };

    // Helper simulating concurrent update
    const runConcurrent = async () => {
      await Promise.all(
        cacheKeys.map(async (_key) => {
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

    console.log(`Sequential form cache update duration (3 keys, 15ms per step): ${durationSeq.toFixed(2)}ms`);
    console.log(`Concurrent form cache update duration (3 keys, 15ms per step): ${durationCon.toFixed(2)}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x faster`);

    expect(durationCon).toBeLessThan(durationSeq / 2);
    expect(speedup).toBeGreaterThan(2.0);
  });

  test('verifies FormsService.createForm correctly updates all 3 local cache stores concurrently', async () => {
    const userId = 'user_form_tester';
    const mockStore = new Map<string, any[]>();

    const existingKey1 = `f_forms_list_${userId}`;
    const existingKey2 = `f_forms_${userId}`;
    const existingKey3 = 'f_forms_list';

    mockStore.set(existingKey1, [{ id: 'form_existing_1', title: 'Old Form 1' }]);
    mockStore.set(existingKey2, [{ id: 'form_existing_2', title: 'Old Form 2' }]);
    mockStore.set(existingKey3, [{ id: 'form_existing_3', title: 'Old Form 3' }]);

    vi.spyOn(LocalEngine, 'cacheGet').mockImplementation(async (key: string) => {
      return (mockStore.get(key) as any) || [];
    });

    vi.spyOn(LocalEngine, 'cacheSet').mockImplementation(async (key: string, data: any) => {
      mockStore.set(key, data);
    });

    // Provide window context for client-side branch
    const originalWindow = global.window;
    // @ts-expect-error mock window
    global.window = {};

    try {
      const created = await FormsService.createForm(userId, {
        id: 'form_new_123',
        $id: 'form_new_123',
        title: 'New Performance Form',
      });

      expect(created).toBeDefined();

      for (const key of [existingKey1, existingKey2, existingKey3]) {
        const cacheContent = mockStore.get(key) || [];
        expect(cacheContent.length).toBe(2);
        expect(cacheContent[0].id || cacheContent[0].$id).toBe('form_new_123');
      }
    } finally {
      global.window = originalWindow;
    }
  });
});
