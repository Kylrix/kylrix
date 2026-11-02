import { describe, it, expect } from 'vitest';

interface TaskLike {
  id: string;
  labels?: string[];
  tags?: string[];
}

interface EcosystemTagLike {
  name: string;
}

describe('Task Tag Aggregation Performance Benchmark', () => {
  it('compares flatMap array allocations vs single-pass Set aggregation and verifies parity', () => {
    // Generate 1,000 tasks with various label and tag combinations
    const sampleTasks: TaskLike[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `task-${i}`,
      labels: i % 2 === 0 ? ['frontend', 'bug', 'v1', ''] : ['backend', 'api'],
      tags:
        i % 3 === 0
          ? ['project:ws_1', 'source:import', 'perf', 'urgent', '']
          : ['project:ws_2', 'release', 'perf'],
    }));

    const sampleEcosystemTags: EcosystemTagLike[] = [
      { name: 'urgent' },
      { name: 'security' },
      { name: 'design' },
      { name: '' },
    ];

    const rawTagOptions = ['frontend', 'backend', 'devops', ''];

    // Method 1: Previous approach with multiple arrays, nested flatMap, and multiple filter passes
    const startPrevious = performance.now();
    let previousResult: string[] = [];
    for (let iter = 0; iter < 100; iter++) {
      const fromTasks = sampleTasks.flatMap((task) => {
        const userLabels = task.labels || [];
        const extractedTags = Array.isArray(task.tags)
          ? task.tags.filter(
              (t: string) => !String(t).startsWith('project:') && !String(t).startsWith('source:')
            )
          : [];
        return [...userLabels, ...extractedTags];
      });
      const fromEcosystem = sampleEcosystemTags.map((tag) => tag.name);
      const tagOptions = Array.from(
        new Set(
          [...fromEcosystem, ...fromTasks].filter((name): name is string => Boolean(name))
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      previousResult = Array.from(
        new Set([
          ...rawTagOptions,
          ...sampleEcosystemTags.map((t) => t.name).filter(Boolean),
          ...sampleTasks.flatMap((t) => {
            const userLabels = t.labels || [];
            const extractedTags = Array.isArray(t.tags)
              ? t.tags.filter(
                  (tag: string) =>
                    !String(tag).startsWith('project:') && !String(tag).startsWith('source:')
                )
              : [];
            return [...userLabels, ...extractedTags];
          }),
        ].filter((item): item is string => Boolean(item)))
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      void tagOptions;
    }
    const previousDuration = performance.now() - startPrevious;

    // Method 2: Optimized single-pass Set population
    const startOptimized = performance.now();
    let optimizedResult: string[] = [];
    for (let iter = 0; iter < 100; iter++) {
      // TaskContext getTagFilterOptions
      const contextSet = new Set<string>();
      for (const tag of sampleEcosystemTags) {
        if (tag.name) contextSet.add(tag.name);
      }
      for (const task of sampleTasks) {
        if (task.labels) {
          for (const label of task.labels) {
            if (label) contextSet.add(label);
          }
        }
        if (Array.isArray(task.tags)) {
          for (const t of task.tags) {
            if (t && !String(t).startsWith('project:') && !String(t).startsWith('source:')) {
              contextSet.add(t);
            }
          }
        }
      }
      const tagOptions = Array.from(contextSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );

      // TaskList directTaskTags
      const listSet = new Set<string>();
      for (const opt of rawTagOptions) {
        if (opt) listSet.add(opt);
      }
      if (sampleEcosystemTags) {
        for (const t of sampleEcosystemTags) {
          if (t?.name) listSet.add(t.name);
        }
      }
      for (const t of sampleTasks) {
        if (t.labels) {
          for (const l of t.labels) {
            if (l) listSet.add(l);
          }
        }
        if (Array.isArray(t.tags)) {
          for (const tag of t.tags) {
            if (tag && !String(tag).startsWith('project:') && !String(tag).startsWith('source:')) {
              listSet.add(tag);
            }
          }
        }
      }
      optimizedResult = Array.from(listSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
      );
      void tagOptions;
    }
    const optimizedDuration = performance.now() - startOptimized;

    console.log(
      `Previous tag aggregation duration (1000 tasks x 100 iters): ${previousDuration.toFixed(2)}ms`
    );
    console.log(
      `Optimized tag aggregation duration (1000 tasks x 100 iters): ${optimizedDuration.toFixed(2)}ms`
    );
    const speedup = previousDuration / optimizedDuration;
    console.log(`Speedup: ${speedup.toFixed(2)}x faster`);

    // Verify output parity
    expect(previousResult).toEqual(optimizedResult);
    expect(optimizedResult).toContain('frontend');
    expect(optimizedResult).toContain('backend');
    expect(optimizedResult).toContain('perf');
    expect(optimizedResult).toContain('release');
    expect(optimizedResult).not.toContain('');
    expect(optimizedResult.some((t) => t.startsWith('project:'))).toBe(false);
  });
});
