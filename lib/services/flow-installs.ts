import {
  buildFlowScopeKey,
  FLOW_CHILD_KIND,
  type FlowScopeInput,
  type FlowScopeType,
} from '@/lib/flows/bindings';
import { WorkflowDbService } from '@/lib/services/workflows';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export type FlowInstallRow = {
  $id: string;
  id: string;
  flowId: string;
  installerId: string;
  scopeKey: string;
  scopeType: FlowScopeType;
  grants: string | null;
  status: 'active' | 'revoked';
  installedHash: string | null;
  pinnedVersion: number | null;
  autoUpdate: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function serializeGrants(grants?: Record<string, unknown> | string | null) {
  if (!grants) return null;
  return typeof grants === 'string' ? grants : JSON.stringify(grants);
}

export const FlowInstallService = {
  async findActive(flowId: string, installerId: string, scopeKey: string) {
    try {
      const rows = await db
        .select()
        .from(schema.flowInstalls)
        .where(
          and(
            eq(schema.flowInstalls.flowId, flowId),
            eq(schema.flowInstalls.installerId, installerId),
            eq(schema.flowInstalls.scopeKey, scopeKey),
            eq(schema.flowInstalls.status, 'installed')
          )
        )
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          ...r,
          $id: r.id,
          status: 'active',
          scopeType: r.scopeType as FlowScopeType,
          autoUpdate: Boolean(r.autoUpdate),
        } as FlowInstallRow;
      }
    } catch {}
    return null;
  },

  async install(params: {
    flowId: string;
    installerId: string;
    scope: FlowScopeInput;
    grants?: Record<string, unknown> | null;
    bindObject?: boolean;
    contentHash?: string | null;
  }): Promise<{
    install: FlowInstallRow;
    created: boolean;
    installCount: number | null;
  }> {
    const scopeKey = buildFlowScopeKey(params.scope);
    const scopeType = params.scope.type as FlowScopeType;
    const now = new Date().toISOString();

    const existing = await this.findActive(params.flowId, params.installerId, scopeKey);
    if (existing) {
      const wf = await WorkflowDbService.getByWorkflowId(params.flowId);
      return {
        install: existing,
        created: false,
        installCount: (wf as any)?.installCount ?? null,
      };
    }

    const wf = await WorkflowDbService.getByWorkflowId(params.flowId);
    const isBuiltin = params.flowId.startsWith('kylrix-');
    if (!wf && !isBuiltin) throw new Error('Flow not found');

    const id = crypto.randomUUID();
    await db.insert(schema.flowInstalls).values({
      id,
      flowId: params.flowId,
      installerId: params.installerId,
      scopeKey,
      scopeType,
      grants: serializeGrants(params.grants),
      status: 'installed',
      installedHash: params.contentHash ?? null,
      autoUpdate: true,
      createdAt: now,
      updatedAt: now,
    });

    const row: FlowInstallRow = {
      $id: id,
      id,
      flowId: params.flowId,
      installerId: params.installerId,
      scopeKey,
      scopeType,
      grants: serializeGrants(params.grants),
      status: 'active',
      installedHash: params.contentHash ?? null,
      pinnedVersion: 1,
      autoUpdate: true,
      createdAt: now,
      updatedAt: now,
    };

    let installCount: number | null = null;
    if (wf) {
      installCount = await WorkflowDbService.incrementInstallCount(params.flowId);
    }

    return { install: row, created: true, installCount };
  },

  async listForInstaller(installerId: string) {
    try {
      const rows = await db
        .select()
        .from(schema.flowInstalls)
        .where(
          and(
            eq(schema.flowInstalls.installerId, installerId),
            eq(schema.flowInstalls.status, 'installed')
          )
        );

      return rows.map((r) => ({
        ...r,
        $id: r.id,
        status: 'active',
        scopeType: r.scopeType as FlowScopeType,
        autoUpdate: Boolean(r.autoUpdate),
      })) as FlowInstallRow[];
    } catch {
      return [];
    }
  },

  async revoke(params: { installId: string; installerId: string }) {
    await db
      .update(schema.flowInstalls)
      .set({ status: 'revoked', updatedAt: new Date().toISOString() })
      .where(eq(schema.flowInstalls.id, params.installId));

    return { success: true };
  },

  async checkAndApplyUpdates(_installerId: string): Promise<
    Record<string, { steps: unknown[]; version: number; contentHash: string }>
  > {
    return {};
  },
};
