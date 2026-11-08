import { describe, test, expect } from 'vitest';
import { projectObjectsKindCacheKey } from '@/lib/projects/projects-cache';

describe('Workspace Object Cache Eviction Benchmark', () => {
  const mockCache = new Map<string, any>();

  const seedMockCache = (workspaceId: string, kinds: string[]) => {
    mockCache.clear();
    mockCache.set(`ws_details_${workspaceId}`, { id: workspaceId, title: 'Shared Team Space' });
    mockCache.set(`project_objects_${workspaceId}`, [{ entityId: 'item-1' }, { entityId: 'item-2' }]);
    mockCache.set(`f_shared_ws_${workspaceId}`, { id: workspaceId, active: true });
    for (const kind of kinds) {
      mockCache.set(projectObjectsKindCacheKey(workspaceId, kind), [{ entityId: `${kind}-1` }]);
    }
  };

  const simulateCacheDelete = async (key: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    mockCache.delete(key);
  };

  const purgeWorkspaceSequential = async (
    workspaceId: string,
    kinds: string[],
    latencyMs: number
  ) => {
    await simulateCacheDelete(`ws_details_${workspaceId}`, latencyMs);
    await simulateCacheDelete(`project_objects_${workspaceId}`, latencyMs);
    await simulateCacheDelete(`f_shared_ws_${workspaceId}`, latencyMs);
    for (const kind of kinds) {
      await simulateCacheDelete(projectObjectsKindCacheKey(workspaceId, kind), latencyMs);
    }
  };

  const purgeWorkspaceConcurrent = async (
    workspaceId: string,
    kinds: string[],
    latencyMs: number
  ) => {
    await Promise.allSettled([
      simulateCacheDelete(`ws_details_${workspaceId}`, latencyMs),
      simulateCacheDelete(`project_objects_${workspaceId}`, latencyMs),
      simulateCacheDelete(`f_shared_ws_${workspaceId}`, latencyMs),
      ...kinds.map((kind) => simulateCacheDelete(projectObjectsKindCacheKey(workspaceId, kind), latencyMs)),
    ]);
  };

  test('compares sequential vs concurrent Promise.allSettled cache eviction across 10 keys (7 kinds + 3 workspace keys)', async () => {
    const workspaceId = 'ws-test-purge-123';
    const kinds = ['goal', 'note', 'event', 'form', 'password', 'totp', 'agent_session'];
    const latencyMs = 15;

    // Run sequential
    seedMockCache(workspaceId, kinds);
    const startSeq = performance.now();
    await purgeWorkspaceSequential(workspaceId, kinds, latencyMs);
    const durationSeq = performance.now() - startSeq;
    const seqRemaining = mockCache.size;

    // Run concurrent
    seedMockCache(workspaceId, kinds);
    const startPar = performance.now();
    await purgeWorkspaceConcurrent(workspaceId, kinds, latencyMs);
    const durationPar = performance.now() - startPar;
    const parRemaining = mockCache.size;

    expect(seqRemaining).toBe(0);
    expect(parRemaining).toBe(0);

    console.log(`Sequential workspace cache eviction duration (10 keys, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Concurrent workspace cache eviction duration (10 keys, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
