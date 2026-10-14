import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { WorkflowChain } from '@/lib/workflow-engine';
import { TelemetryNiche } from '@/lib/context-engine';

export const WorkflowDbService = {
  async saveWorkflow(wf: WorkflowChain, userId?: string): Promise<string> {
    const id = wf.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const stepsArr = Array.isArray(wf.steps) ? wf.steps : [];

    const payload = {
      id,
      workflowId: wf.id,
      name: wf.name,
      description: wf.description || '',
      niche: wf.niche,
      isPublic: Boolean(wf.isPublic),
      steps: JSON.stringify(stepsArr),
      ownerId: userId || null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const existing = await db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.workflowId, wf.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(schema.workflows)
          .set({ ...payload, updatedAt: now })
          .where(eq(schema.workflows.id, existing[0].id));
      } else {
        await db.insert(schema.workflows).values(payload);
      }
    } catch {}

    return id;
  },

  async listWorkflows(): Promise<WorkflowChain[]> {
    try {
      const rows = await db
        .select()
        .from(schema.workflows)
        .orderBy(desc(schema.workflows.createdAt))
        .limit(100);

      return rows.map((row) => ({
        id: row.workflowId,
        name: row.name,
        description: row.description || '',
        niche: row.niche as TelemetryNiche,
        steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : [],
        isPublic: Boolean(row.isPublic),
        isAnonymized: false,
        createdAt: row.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  async listPublicWorkflows(): Promise<WorkflowChain[]> {
    try {
      const rows = await db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.isPublic, true))
        .orderBy(desc(schema.workflows.createdAt))
        .limit(100);

      return rows.map((row) => ({
        id: row.workflowId,
        name: row.name,
        description: row.description || '',
        niche: row.niche as TelemetryNiche,
        steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : [],
        isPublic: true,
        isAnonymized: false,
        createdAt: row.createdAt || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      await db.delete(schema.workflows).where(eq(schema.workflows.workflowId, workflowId));
    } catch {}
  },

  async getByWorkflowId(workflowId: string) {
    try {
      const rows = await db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.workflowId, workflowId))
        .limit(1);

      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        id: row.workflowId,
        name: row.name,
        description: row.description || '',
        niche: row.niche as TelemetryNiche,
        steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : [],
        isPublic: Boolean(row.isPublic),
        isAnonymized: false,
        createdAt: row.createdAt || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async incrementInstallCount(workflowId: string): Promise<number> {
    return 1;
  },

  async setPublishState(
    workflowId: string,
    opts: { isPublic: boolean; isGuest?: boolean; actorId: string; reviewStatus?: string }
  ): Promise<any> {
    await db
      .update(schema.workflows)
      .set({ isPublic: opts.isPublic, updatedAt: new Date().toISOString() })
      .where(eq(schema.workflows.workflowId, workflowId));

    return { id: workflowId, isPublic: opts.isPublic };
  },

  async setReviewStatus(workflowId: string, reviewStatus: string, extra?: { isPublic?: boolean }) {
    await db
      .update(schema.workflows)
      .set({
        reviewStatus,
        ...(typeof extra?.isPublic === 'boolean' ? { isPublic: extra.isPublic } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.workflows.workflowId, workflowId));

    return { id: workflowId, reviewStatus };
  },
};
