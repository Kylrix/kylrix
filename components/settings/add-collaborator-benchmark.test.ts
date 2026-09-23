import { describe, test, expect } from 'vitest';

describe('Add Collaborators Performance Benchmark', () => {
  const mockAddCollaboratorSequential = async (
    _workspaceId: string,
    users: any[],
    _role: string,
    latencyMs: number
  ) => {
    let count = 0;
    for (const targetUser of users) {
      const _targetId = targetUser.id || targetUser.userId || targetUser.$id || targetUser.email;
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      count++;
    }
    return count;
  };

  const mockAddCollaboratorParallel = async (
    _workspaceId: string,
    users: any[],
    _role: string,
    latencyMs: number
  ) => {
    const promises = users.map(async (targetUser) => {
      const _targetId = targetUser.id || targetUser.userId || targetUser.$id || targetUser.email;
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    });
    await Promise.all(promises);
    return users.length;
  };

  test('compares sequential vs Promise.all execution time for adding 5 collaborators with 20ms latency', async () => {
    const mockUsers = [
      { id: 'user_1', email: 'user1@example.com' },
      { id: 'user_2', email: 'user2@example.com' },
      { id: 'user_3', email: 'user3@example.com' },
      { id: 'user_4', email: 'user4@example.com' },
      { id: 'user_5', email: 'user5@example.com' },
    ];
    const latencyMs = 20;

    const startSeq = performance.now();
    const countSeq = await mockAddCollaboratorSequential('ws_123', mockUsers, 'member', latencyMs);
    const durationSeq = performance.now() - startSeq;

    const startPar = performance.now();
    const countPar = await mockAddCollaboratorParallel('ws_123', mockUsers, 'member', latencyMs);
    const durationPar = performance.now() - startPar;

    expect(countSeq).toBe(mockUsers.length);
    expect(countPar).toBe(mockUsers.length);

    console.log(`Sequential duration (5 users, 20ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (5 users, 20ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    // Parallel execution should complete in ~1 latency window instead of 5
    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
