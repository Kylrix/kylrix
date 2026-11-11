import { describe, test, expect } from 'vitest';

describe('ShareNoteDrawer Concurrent Collaborator Grant Benchmark', () => {
  const mockGrantPermission = async (_userId: string, _resourceId: string, _targetUserId: string, latencyMs: number) => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return { ok: true };
  };

  const grantSequential = async (
    users: Array<{ id: string; name: string }>,
    latencyMs: number,
    onShared?: (targetUserId: string) => Promise<void>
  ) => {
    let successCount = 0;
    for (const targetUser of users) {
      await mockGrantPermission('user_self', 'res_123', targetUser.id, latencyMs);
      if (onShared) {
        await onShared(targetUser.id);
      }
      successCount++;
    }
    return successCount;
  };

  const grantParallel = async (
    users: Array<{ id: string; name: string }>,
    latencyMs: number,
    onShared?: (targetUserId: string) => Promise<void>
  ) => {
    let successCount = 0;
    await Promise.all(
      users.map(async (targetUser) => {
        await mockGrantPermission('user_self', 'res_123', targetUser.id, latencyMs);
        if (onShared) {
          await onShared(targetUser.id);
        }
        successCount++;
      })
    );
    return successCount;
  };

  test('compares sequential vs Promise.all execution time for granting access across 5 collaborators with 20ms simulated latency', async () => {
    const selectedUsers = [
      { id: 'usr_1', name: 'Alice' },
      { id: 'usr_2', name: 'Bob' },
      { id: 'usr_3', name: 'Charlie' },
      { id: 'usr_4', name: 'Dave' },
      { id: 'usr_5', name: 'Eve' },
    ];
    const latencyMs = 20;

    const startSeq = performance.now();
    const countSeq = await grantSequential(selectedUsers, latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const countPar = await grantParallel(selectedUsers, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(countSeq).toBe(selectedUsers.length);
    expect(countPar).toBe(selectedUsers.length);

    console.log(`Sequential grant duration (5 users, 20ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel grant duration (5 users, 20ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    // Concurrent execution should complete in ~1 latency window (~20ms) instead of 5 (~100ms)
    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
