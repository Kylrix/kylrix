import { describe, test, expect } from 'vitest';
import type { FlowDraft } from './flow-drafts';

describe('FlowDraftsService Concurrent Draft Loading Benchmark', () => {
  const mockCache = new Map<string, any>();

  const seedMockDrafts = (count: number) => {
    mockCache.clear();
    const manifest: Record<string, any> = {};
    for (let i = 0; i < count; i++) {
      const id = `draft-${i}`;
      const updatedAt = new Date(Date.now() - i * 1000).toISOString();
      manifest[id] = {
        title: `Flow Draft ${i}`,
        updatedAt,
        ready: true,
        niche: 'workspace',
        stepsCount: 2,
      };
      mockCache.set(`kylrix_flow_draft_flow_${id}`, {
        id,
        title: `Flow Draft ${i}`,
        description: `Description ${i}`,
        niche: 'workspace',
        steps: [{ actionId: 'step1', timestamp: updatedAt, importance: 'high' }],
        updatedAt,
        createdAt: updatedAt,
        ready: true,
      } as FlowDraft);
    }
    mockCache.set('kylrix_flow_drafts_manifest_v2', manifest);
  };

  const simulateGetDraft = async (id: string, latencyMs: number): Promise<FlowDraft | null> => {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return mockCache.get(`kylrix_flow_draft_flow_${id}`) || null;
  };

  const listDraftsSequential = async (ids: string[], latencyMs: number): Promise<FlowDraft[]> => {
    const drafts: FlowDraft[] = [];
    for (const id of ids) {
      const d = await simulateGetDraft(id, latencyMs);
      if (d) drafts.push(d);
    }
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return drafts;
  };

  const listDraftsParallel = async (ids: string[], latencyMs: number): Promise<FlowDraft[]> => {
    const results = await Promise.all(ids.map((id) => simulateGetDraft(id, latencyMs)));
    const drafts = results.filter((d): d is FlowDraft => d !== null);
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return drafts;
  };

  test('compares sequential vs Promise.all execution time for loading 6 flow drafts with simulated latency', async () => {
    const draftCount = 6;
    const latencyMs = 20;
    seedMockDrafts(draftCount);
    const manifest = mockCache.get('kylrix_flow_drafts_manifest_v2') as Record<string, any>;
    const ids = Object.keys(manifest);

    // Run sequential
    const startSeq = performance.now();
    const draftsSeq = await listDraftsSequential(ids, latencyMs);
    const durationSeq = performance.now() - startSeq;

    // Run parallel
    const startPar = performance.now();
    const draftsPar = await listDraftsParallel(ids, latencyMs);
    const durationPar = performance.now() - startPar;

    expect(draftsSeq).toEqual(draftsPar);
    expect(draftsPar.length).toBe(draftCount);
    expect(draftsPar[0].id).toBe('draft-0');

    console.log(`Sequential duration (${draftCount} drafts, ${latencyMs}ms latency): ${durationSeq.toFixed(2)}ms`);
    console.log(`Parallel duration (${draftCount} drafts, ${latencyMs}ms latency): ${durationPar.toFixed(2)}ms`);
    console.log(`Speedup: ${(durationSeq / durationPar).toFixed(2)}x faster`);

    expect(durationPar).toBeLessThan(durationSeq / 2);
  });
});
