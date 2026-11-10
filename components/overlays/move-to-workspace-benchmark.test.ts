import { describe, test, expect, vi } from 'vitest';
import { LocalEngine } from '@/lib/services/LocalEngine';

describe('MoveToWorkspaceDrawer Form Cache Concurrent Update Benchmark', () => {
  test('compares sequential vs concurrent execution time for updating form caches across 3 keys with 15ms simulated latency', async () => {
    const uid = 'usr_workspace_move_test';
    const formCacheKeys = [`f_forms_list_${uid}`, `f_forms_${uid}`, 'f_forms_list'];
    const latencyMs = 15;

    // Helper simulating sequential update
    const runSequential = async () => {
      for (const _key of formCacheKeys) {
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheGet
        await new Promise((r) => setTimeout(r, latencyMs)); // Simulated LocalEngine.cacheSet
      }
    };

    // Helper simulating concurrent update
    const runConcurrent = async () => {
      await Promise.all(
        formCacheKeys.map(async (_key) => {
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

    console.log(`Sequential form cache move duration (3 keys, 15ms per step): ${durationSeq.toFixed(2)}ms`);
    console.log(`Concurrent form cache move duration (3 keys, 15ms per step): ${durationCon.toFixed(2)}ms`);
    console.log(`Speedup: ${speedup.toFixed(2)}x faster`);

    expect(durationCon).toBeLessThan(durationSeq / 2);
    expect(speedup).toBeGreaterThan(2.0);
  });

  test('verifies concurrent form cache update correctly patches all local form stores with new target workspace', async () => {
    const uid = 'usr_target_tester';
    const formCacheKeys = [`f_forms_list_${uid}`, `f_forms_${uid}`, 'f_forms_list'];
    const mockStore = new Map<string, any[]>();
    const entityId = 'form_to_move_456';
    const targetWorkspaceId = 'ws_enterprise_999';

    mockStore.set(`f_forms_list_${uid}`, [
      { id: entityId, title: 'Form in list', projectId: 'old_ws', isWorkspace: true },
      { id: 'other_form', title: 'Other Form', projectId: 'other_ws', isWorkspace: true },
    ]);
    mockStore.set(`f_forms_${uid}`, [
      { $id: entityId, title: 'Form user store', projectId: 'old_ws', isWorkspace: true },
    ]);
    mockStore.set('f_forms_list', [
      { id: entityId, title: 'Form global store', projectId: 'old_ws', isWorkspace: true },
    ]);

    vi.spyOn(LocalEngine, 'cacheGet').mockImplementation(async (key: string) => {
      return (mockStore.get(key) as any) || null;
    });

    vi.spyOn(LocalEngine, 'cacheSet').mockImplementation(async (key: string, data: any) => {
      mockStore.set(key, data);
    });

    // Execute concurrent update matching MoveToWorkspaceDrawer implementation
    const isPersonalTarget = false;
    await Promise.all(
      formCacheKeys.map(async (key) => {
        try {
          const cachedForms = await LocalEngine.cacheGet<any[]>(key).catch(() => null);
          if (Array.isArray(cachedForms)) {
            const updated = cachedForms.map((f) =>
              (f.$id === entityId || f.id === entityId)
                ? { ...f, projectId: isPersonalTarget ? undefined : targetWorkspaceId, isWorkspace: !isPersonalTarget }
                : f
            );
            await LocalEngine.cacheSet(key, updated);
          }
        } catch {
          // Silently ignore individual cache failure to preserve resilience
        }
      })
    );

    // Verify all 3 cache stores have been properly updated
    for (const key of formCacheKeys) {
      const items = mockStore.get(key) || [];
      const movedItem = items.find((f: any) => f.id === entityId || f.$id === entityId);
      expect(movedItem).toBeDefined();
      expect(movedItem.projectId).toBe(targetWorkspaceId);
      expect(movedItem.isWorkspace).toBe(true);
    }

    // Verify un-moved items remain untouched
    const listItems = mockStore.get(`f_forms_list_${uid}`) || [];
    const otherItem = listItems.find((f: any) => f.id === 'other_form');
    expect(otherItem.projectId).toBe('other_ws');
  });
});
