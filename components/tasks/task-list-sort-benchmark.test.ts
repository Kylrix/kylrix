import { describe, it, expect } from 'vitest';
import { sortByDeadlineThenUpdatedAt } from '@/lib/sync/local-copy-sync';

interface TaskItem {
  id: string;
  dueDate?: string | Date | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAt?: string | Date;
  updatedAt?: string | Date;
  creatorId?: string;
  userId?: string;
  isPinned?: boolean;
  status?: string;
}

// Simulated expensive or context-lookup pin checker
function mockIsResourcePinned(
  _type: string,
  _id: string,
  _ownerId?: string,
  rowIsPinned?: boolean
): boolean {
  // Simulate small context/lookup overhead (e.g., checking Set/Map or custom overrides)
  let val = Boolean(rowIsPinned);
  for (let i = 0; i < 50; i++) {
    val = val || false;
  }
  return val;
}

describe('TaskList Sorting & Partitioning Performance Benchmark', () => {
  it('compares redundant pin evaluation vs pre-computed pin state', () => {
    // Generate 1,000 tasks
    const sampleTasks: TaskItem[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `task-${i}`,
      dueDate: i % 3 === 0 ? new Date(Date.now() + i * 100000).toISOString() : null,
      priority: i % 4 === 0 ? 'high' : 'medium',
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      updatedAt: new Date(Date.now() - i * 500).toISOString(),
      creatorId: `user-${i % 5}`,
      userId: `user-${i % 5}`,
      isPinned: i % 7 === 0,
      status: i % 10 === 0 ? 'done' : 'active',
    }));

    // Method 1: Redundant evaluation (calls mockIsResourcePinned multiple times per task)
    const startRedundant = performance.now();
    const activeTasks1 = sampleTasks.filter((t) => t.status !== 'done');

    const sortTasksByDeadlineRedundant = (rows: typeof activeTasks1) => {
      const order = sortByDeadlineThenUpdatedAt(
        rows.map((t) => ({
          $id: t.id,
          dueDate: t.dueDate,
          priority: t.priority,
          createdAt:
            t.createdAt instanceof Date && !isNaN(t.createdAt.getTime())
              ? t.createdAt.toISOString()
              : String(t.createdAt ?? ''),
          updatedAt:
            t.updatedAt instanceof Date && !isNaN(t.updatedAt.getTime())
              ? t.updatedAt.toISOString()
              : String(t.updatedAt ?? ''),
          isPinned: mockIsResourcePinned('task', t.id, t.creatorId || t.userId, t.isPinned),
        }))
      ).map((row) => row.$id);
      const byId = new Map(rows.map((t) => [t.id, t]));
      return order.map((id) => byId.get(id)).filter(Boolean);
    };

    const pinnedTasks1 = sortTasksByDeadlineRedundant(
      activeTasks1.filter((t) => mockIsResourcePinned('task', t.id, t.creatorId || t.userId, t.isPinned))
    );
    const unpinnedTasks1 = sortTasksByDeadlineRedundant(
      activeTasks1.filter((t) => !mockIsResourcePinned('task', t.id, t.creatorId || t.userId, t.isPinned))
    );
    const durationRedundant = performance.now() - startRedundant;

    // Method 2: Pre-computed evaluation (calls mockIsResourcePinned exactly 1 time per task)
    const startPrecomputed = performance.now();
    const taskPinMap = new Map<string, boolean>();
    for (const t of sampleTasks) {
      taskPinMap.set(t.id, mockIsResourcePinned('task', t.id, t.creatorId || t.userId, t.isPinned));
    }

    const activeTasks2 = sampleTasks.filter((t) => t.status !== 'done');

    const sortTasksByDeadlinePrecomputed = (rows: typeof activeTasks2) => {
      const order = sortByDeadlineThenUpdatedAt(
        rows.map((t) => ({
          $id: t.id,
          dueDate: t.dueDate,
          priority: t.priority,
          createdAt:
            t.createdAt instanceof Date && !isNaN(t.createdAt.getTime())
              ? t.createdAt.toISOString()
              : String(t.createdAt ?? ''),
          updatedAt:
            t.updatedAt instanceof Date && !isNaN(t.updatedAt.getTime())
              ? t.updatedAt.toISOString()
              : String(t.updatedAt ?? ''),
          isPinned: taskPinMap.get(t.id) ?? false,
        }))
      ).map((row) => row.$id);
      const byId = new Map(rows.map((t) => [t.id, t]));
      return order.map((id) => byId.get(id)).filter(Boolean);
    };

    const pinnedTasks2 = sortTasksByDeadlinePrecomputed(
      activeTasks2.filter((t) => taskPinMap.get(t.id))
    );
    const unpinnedTasks2 = sortTasksByDeadlinePrecomputed(
      activeTasks2.filter((t) => !taskPinMap.get(t.id))
    );
    const durationPrecomputed = performance.now() - startPrecomputed;

    // Output results
    console.log(`Redundant pin evaluation duration (1000 tasks): ${durationRedundant.toFixed(2)}ms`);
    console.log(`Pre-computed pin evaluation duration (1000 tasks): ${durationPrecomputed.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationRedundant / durationPrecomputed).toFixed(2)}x faster`);

    // Verify output parity
    expect(pinnedTasks1.length).toBe(pinnedTasks2.length);
    expect(unpinnedTasks1.length).toBe(unpinnedTasks2.length);
    expect(pinnedTasks1.map((t: any) => t.id)).toEqual(pinnedTasks2.map((t: any) => t.id));
    expect(unpinnedTasks1.map((t: any) => t.id)).toEqual(unpinnedTasks2.map((t: any) => t.id));
  });
});
