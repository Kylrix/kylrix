import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { detectFlowPii } from '@/lib/flows/pii';
import { WorkflowDbService } from '@/lib/services/workflows';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const TABLE_ID = 'flow_reviews';

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
  }) {
    const tables = createSystemTablesDB();
    const now = new Date().toISOString();
    return tables.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: ID.unique(),
      data: {
        flowId: params.flowId,
        actorId: params.actorId,
        sessionId: params.sessionId || null,
        verdict: 'pending',
        toolTierMax: params.toolTierMax || 'general',
        findings: params.findings ? JSON.stringify(params.findings) : null,
        piiSummary: params.piiSummary || null,
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(params.actorId)),
        Permission.update(Role.user(params.actorId)),
      ],
    });
  },

  async latestForFlow(flowId: string) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [
        Query.equal('flowId', flowId),
        Query.orderDesc('$createdAt'),
        Query.limit(1),
      ],
    });
    return res.rows[0] || null;
  },

  /**
   * Agentic publish gate punch-hole.
   * Always creates a review row. Approves immediately only for general-tier
   * with no PII and no system tools — otherwise stays pending for agent.
   */
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
    const findings = {
      piiHits: pii.hits,
      toolTierMax: tier,
      stepCount: wf.steps?.length || 0,
      scannedAt: new Date().toISOString(),
      gate: 'agentic-publish-v1',
    };

    await WorkflowDbService.setReviewStatus(params.flowId, 'pending');

    const review = await this.createPending({
      flowId: params.flowId,
      actorId: params.actorId,
      toolTierMax: tier,
      findings,
      piiSummary: pii.hasPii
        ? pii.hits
            .slice(0, 8)
            .map((h) => `${h.field}:${h.hint}`)
            .join('; ')
        : null,
    });

    // Narrow auto-approve: general tier + no PII only.
    // Fine/system or PII → stays pending for agentic investigation.
    const canAuto = tier === 'general' && !pii.hasPii;

    if (canAuto) {
      const tables = createSystemTablesDB();
      await tables.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        rowId: review.$id,
        data: {
          verdict: 'approved',
          updatedAt: new Date().toISOString(),
          findings: JSON.stringify({ ...findings, autoApproved: true }),
        },
      });
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
    }

    return {
      reviewId: review.$id,
      verdict: 'pending' as FlowReviewVerdict,
      needsAgent: true,
      pii,
      isPublic: false,
    };
  },
};
