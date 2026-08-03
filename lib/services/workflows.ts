import { ID, Query } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { WorkflowChain } from '@/lib/workflow-engine';
import { TelemetryNiche } from '@/lib/context-engine';
import crypto from 'crypto';

const DATABASE_ID = 'passwordManagerDb';
const TABLE_ID = 'workflows';

/** Deterministic SHA-256 of the canonical steps JSON. Server-only. */
function computeContentHash(steps: unknown[]): string {
  const canonical = JSON.stringify(steps ?? []);
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 64);
}

export const WorkflowDbService = {
  /**
   * Persist a workflow chain in the Appwrite database.
   * If the workflow already exists, updates it.
   */
  async saveWorkflow(wf: WorkflowChain, userId?: string): Promise<string> {
    try {
      const tables = createSystemTablesDB();
      const extra = wf as WorkflowChain & {
        flowKind?: string;
        toolTierMax?: string;
        publisherHandle?: string;
      };
      const stepsArr = Array.isArray(wf.steps) ? wf.steps : [];
      const newHash = computeContentHash(stepsArr);
      const payload: Record<string, unknown> = {
        workflowId: wf.id,
        name: wf.name,
        description: wf.description,
        niche: wf.niche,
        isPublic: wf.isPublic,
        isAnonymized: wf.isAnonymized,
        steps: JSON.stringify(stepsArr),
        contentHash: newHash,
        metadata: JSON.stringify({
          originalCreatedAt: wf.createdAt,
          savedAt: new Date().toISOString()
        }),
      };
      if (userId) payload.ownerId = userId;
      if (extra.flowKind) payload.flowKind = extra.flowKind;
      if (extra.toolTierMax) payload.toolTierMax = extra.toolTierMax;
      if (extra.publisherHandle) payload.publisherHandle = extra.publisherHandle;

      const permissions = userId ? [
        `read("user:${userId}")`,
        `write("user:${userId}")`
      ] : undefined;

      const existing = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.equal('workflowId', wf.id), Query.limit(1)]
      });

      if (existing.rows.length > 0) {
        const row = existing.rows[0] as any;
        const oldHash = row.contentHash as string | null;
        // Only bump version when steps actually changed
        if (oldHash !== newHash) {
          payload.version = Math.max(0, Number(row.version ?? 0)) + 1;
        }
        await tables.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: row.$id,
          data: payload,
          permissions
        });
        return wf.id;
      } else {
        await tables.createRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: ID.unique(),
          data: {
            ...payload,
            version: 0,
            installCount: 0,
            reviewStatus: 'draft',
            verifiedKind: 'none',
            toolTierMax: extra.toolTierMax || 'general',
            flowKind: extra.flowKind || 'workflow',
          },
          permissions
        });
        return wf.id;
      }
    } catch (err) {
      console.error('[WorkflowDbService] Failed to save workflow:', err);
      throw err;
    }
  },

  /**
   * List all user-accessible workflows (Appwrite document security filters this natively)
   */
  async listWorkflows(): Promise<WorkflowChain[]> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.orderDesc('$createdAt'), Query.limit(100)]
      });

      return res.rows.map(row => {
        let steps = [];
        try {
          steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : [];
        } catch {
          // Fallback
        }

        return {
          id: row.workflowId,
          name: row.name,
          description: row.description,
          niche: row.niche as TelemetryNiche,
          steps,
          isPublic: row.isPublic,
          isAnonymized: row.isAnonymized,
          createdAt: row.$createdAt
        };
      });
    } catch (err) {
      console.error('[WorkflowDbService] Failed to list workflows:', err);
      return [];
    }
  },

  /**
   * List all shared public workflows across the platform
   */
  async listPublicWorkflows(): Promise<WorkflowChain[]> {
    try {
      const tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [
          Query.equal('isPublic', true),
          Query.orderDesc('$createdAt'),
          Query.limit(100)
        ]
      });

      return res.rows.map(row => {
        let steps = [];
        try {
          steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : [];
        } catch {
          // Fallback
        }

        return {
          id: row.workflowId,
          name: row.name,
          description: row.description,
          niche: row.niche as TelemetryNiche,
          steps,
          isPublic: row.isPublic,
          isAnonymized: row.isAnonymized,
          createdAt: row.$createdAt,
          metadata: row.metadata,
        } as WorkflowChain & { metadata?: string | null };
      });
    } catch (err) {
      console.error('[WorkflowDbService] Failed to list public workflows:', err);
      return [];
    }
  },

  /**
   * Delete a workflow by its unique ID
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      const tables = createSystemTablesDB();
      const existing = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.equal('workflowId', workflowId), Query.limit(1)]
      });

      if (existing.rows.length > 0) {
        await tables.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLE_ID,
          rowId: existing.rows[0].$id
        });
      }
    } catch (err) {
      console.error('[WorkflowDbService] Failed to delete workflow:', err);
      throw err;
    }
  },

  rowToChain(row: Record<string, any>): WorkflowChain & {
    $id?: string;
    $permissions?: string[];
    metadata?: string | null;
    ownerId?: string | null;
    installCount?: number;
    flowKind?: string;
    toolTierMax?: string;
    reviewStatus?: string;
    publisherHandle?: string | null;
    verifiedKind?: string;
    version?: number;
    contentHash?: string | null;
  } {
    let steps = [];
    try {
      steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps || [];
    } catch {
      steps = [];
    }
    return {
      id: row.workflowId,
      name: row.name,
      description: row.description || '',
      niche: row.niche as TelemetryNiche,
      steps,
      isPublic: !!row.isPublic,
      isAnonymized: !!row.isAnonymized,
      createdAt: row.$createdAt,
      $id: row.$id,
      $permissions: row.$permissions,
      metadata: row.metadata ?? null,
      ownerId: row.ownerId ?? null,
      installCount: typeof row.installCount === 'number' ? row.installCount : 0,
      flowKind: row.flowKind || 'workflow',
      toolTierMax: row.toolTierMax || 'general',
      reviewStatus: row.reviewStatus || 'draft',
      publisherHandle: row.publisherHandle ?? null,
      verifiedKind: row.verifiedKind || 'none',
      version: typeof row.version === 'number' ? row.version : 0,
      contentHash: row.contentHash ?? null,
    };
  },

  async getByWorkflowId(workflowId: string) {
    try {
      const tables = createSystemTablesDB();
      const existing = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLE_ID,
        queries: [Query.equal('workflowId', workflowId), Query.limit(1)],
      });
      if (existing.rows.length === 0) return null;
      return this.rowToChain(existing.rows[0] as any);
    } catch (err) {
      console.error('[WorkflowDbService] Failed to get workflow:', err);
      return null;
    }
  },

  /** System-only counter punch — never expose to client RLS writes. */
  async incrementInstallCount(workflowId: string): Promise<number> {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [Query.equal('workflowId', workflowId), Query.limit(1)],
    });
    if (existing.rows.length === 0) return 0;
    const row = existing.rows[0] as any;
    const next = Math.max(0, Number(row.installCount || 0) + 1);
    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: row.$id,
      data: { installCount: next },
    });
    return next;
  },

  async setPublishState(
    workflowId: string,
    opts: {
      isPublic: boolean;
      isGuest?: boolean;
      actorId: string;
      reviewStatus?: string;
    }
  ): Promise<WorkflowChain> {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [Query.equal('workflowId', workflowId), Query.limit(1)],
    });
    if (existing.rows.length === 0) throw new Error('Flow not found');

    const row = existing.rows[0] as any;
    const perms: string[] = Array.isArray(row.$permissions) ? row.$permissions : [];
    const owns =
      row.ownerId === opts.actorId ||
      perms.some(
        (p: string) =>
          p.includes(`user:${opts.actorId}`) && (p.startsWith('write(') || p.startsWith('update('))
      );
    if (!owns) throw new Error('Only the owner can publish this flow');

    if (opts.isPublic) {
      if (row.toolTierMax === 'system') {
        throw new Error('System-tier flows cannot be published');
      }
      if (row.toolTierMax === 'fine' && row.reviewStatus !== 'approved' && opts.reviewStatus !== 'approved') {
        throw new Error('Fine-grained flows need agent review before publish');
      }
    }

    const nextPerms = opts.isPublic
      ? Array.from(new Set([...perms, 'read("any")', 'read("users")']))
      : perms.filter((p: string) => p !== 'read("any")');

    const data: Record<string, unknown> = {
      isPublic: opts.isPublic,
      isGuest: opts.isGuest ?? opts.isPublic,
    };
    if (opts.reviewStatus) data.reviewStatus = opts.reviewStatus;

    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: row.$id,
      data,
      permissions: nextPerms,
    });

    return {
      ...this.rowToChain(row),
      isPublic: opts.isPublic,
    } as any;
  },

  async setReviewStatus(
    workflowId: string,
    reviewStatus: string,
    extra?: { isPublic?: boolean }
  ) {
    const tables = createSystemTablesDB();
    const existing = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      queries: [Query.equal('workflowId', workflowId), Query.limit(1)],
    });
    if (existing.rows.length === 0) throw new Error('Flow not found');
    const row = existing.rows[0] as any;
    const data: Record<string, unknown> = { reviewStatus };
    if (typeof extra?.isPublic === 'boolean') {
      data.isPublic = extra.isPublic;
      data.isGuest = extra.isPublic;
    }
    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      rowId: row.$id,
      data,
    });
    return this.rowToChain({ ...row, ...data });
  },
};
