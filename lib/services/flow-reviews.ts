import { ulid } from '@/lib/utils/ulid';
import { detectFlowPii } from '@/lib/flows/pii';
import { WorkflowDbService } from '@/lib/services/workflows';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export type FlowReviewVerdict =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'needs_changes'
  | 'blocked';

export const FlowReviewService = {
  async createPending(params: {
    flowId: string;
    actorId: string;
    sessionId?: string | null;
    toolTierMax?: string;
    findings?: Record<string, unknown>;
    piiSummary?: string | null;
  }): Promise<any> {
    const now = new Date().toISOString();
    const id = ulid();

    await db.insert(schema.flowReviews).values({
      id,
      flowId: params.flowId,
      actorId: params.actorId,
      sessionId: params.sessionId || null,
      verdict: 'pending',
      toolTierMax: params.toolTierMax || 'general',
      findings: params.findings ? JSON.stringify(params.findings) : null,
      piiSummary: params.piiSummary || null,
      createdAt: now,
      updatedAt: now,
    });

    return { $id: id, id, ...params, verdict: 'pending', createdAt: now };
  },

  async latestForFlow(flowId: string) {
    try {
      const rows = await db
        .select()
        .from(schema.flowReviews)
        .where(eq(schema.flowReviews.flowId, flowId))
        .orderBy(desc(schema.flowReviews.createdAt))
        .limit(1);

      return rows[0] || null;
    } catch {
      return null;
    }
  },

  async requestPublishReview(params: {
    flowId: string;
    actorId: string;
    confirmAware: boolean;
  }) {
    if (!params.confirmAware) {
      throw new Error('Confirm you understand this will be public.');
    }

    const wf = await WorkflowDbService.getByWorkflowId(params.flowId);
    if (!wf) throw new Error('Flow not found');

    const tier = (wf as any).toolTierMax || 'general';
    if (tier === 'system') {
      throw new Error('System-tier flows cannot be published');
    }

    const pii = detectFlowPii(wf);
    const hasNetwork = pii.hits.some((h) => h.hint.includes('network'));
    const hasDeceptive = pii.hits.some((h) => h.hint.includes('Deceptive') || h.hint.includes('Secret'));
    const isRisky = pii.hasPii || hasNetwork || hasDeceptive || tier !== 'general';

    const findings = {
      piiHits: pii.hits,
      toolTierMax: tier,
      stepCount: wf.steps?.length || 0,
      scannedAt: new Date().toISOString(),
      gate: 'agentic-publish-v2',
      reasons: pii.hits.map((h) => `${h.field}: ${h.hint}`),
    };

    const review = await this.createPending({
      flowId: params.flowId,
      actorId: params.actorId,
      toolTierMax: tier,
      findings,
      piiSummary: pii.hits.length > 0
        ? pii.hits.slice(0, 8).map((h) => `${h.field}:${h.hint}`).join('; ')
        : null,
    });

    if (isRisky) {
      const verdict = hasNetwork || hasDeceptive ? 'blocked' : 'rejected';
      await db
        .update(schema.flowReviews)
        .set({
          verdict,
          updatedAt: new Date().toISOString(),
          findings: JSON.stringify({ ...findings, autoApproved: false, verdictReason: 'Security policy violation' }),
        })
        .where(eq(schema.flowReviews.id, review.$id));

      await WorkflowDbService.setReviewStatus(params.flowId, verdict);
      return {
        reviewId: review.$id,
        verdict: verdict as FlowReviewVerdict,
        needsAgent: false,
        pii,
        isPublic: false,
        error: `Publish rejected: ${pii.hits.map((h) => h.hint).join(', ') || 'Security policy violation'}`,
      };
    }

    await db
      .update(schema.flowReviews)
      .set({
        verdict: 'approved',
        updatedAt: new Date().toISOString(),
        findings: JSON.stringify({ ...findings, autoApproved: true }),
      })
      .where(eq(schema.flowReviews.id, review.$id));

    await WorkflowDbService.setPublishState(params.flowId, {
      isPublic: true,
      isGuest: true,
      actorId: params.actorId,
      reviewStatus: 'approved',
    });

    return {
      reviewId: review.$id,
      verdict: 'approved' as FlowReviewVerdict,
      needsAgent: false,
      pii,
      isPublic: true,
    };
  },
};
