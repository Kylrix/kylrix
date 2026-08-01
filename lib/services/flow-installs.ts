import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import {
  buildFlowScopeKey,
  FLOW_CHILD_KIND,
  type FlowScopeInput,
  type FlowScopeType,
} from '@/lib/flows/bindings';
import { WorkflowDbService } from '@/lib/services/workflows';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const INSTALLS_TABLE = 'flow_installs';
const OBJECTS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

export type FlowInstallRow = {
  $id: string;
  flowId: string;
  installerId: string;
  scopeKey: string;
  scopeType: FlowScopeType;
  grants: string | null;
  status: 'active' | 'revoked';
  createdAt?: string | null;
  updatedAt?: string | null;
};

function serializeGrants(grants?: Record<string, unknown> | string | null) {
  if (!grants) return null;
  return typeof grants === 'string' ? grants : JSON.stringify(grants);
}

export const FlowInstallService = {
  async findActive(flowId: string, installerId: string, scopeKey: string) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: INSTALLS_TABLE,
      queries: [
        Query.equal('flowId', flowId),
        Query.equal('installerId', installerId),
        Query.equal('scopeKey', scopeKey),
        Query.equal('status', 'active'),
        Query.limit(1),
      ],
    });
    return (res.rows[0] as unknown as FlowInstallRow | undefined) || null;
  },

  /**
   * Secure install punch:
   * 1) Create installer-owned flow_installs row (unique on flow+installer+scope)
   * 2) Only on first create: system-increment workflows.installCount
   * 3) Optionally bind via objects (host ← flow)
   */
  async install(params: {
    flowId: string;
    installerId: string;
    scope: FlowScopeInput;
    grants?: Record<string, unknown> | null;
    bindObject?: boolean;
  }): Promise<{
    install: FlowInstallRow;
    created: boolean;
    installCount: number | null;
  }> {
    const tables = createSystemTablesDB();
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

    // Ensure target is installable (public, approved builtin id, or owner)
    const wf = await WorkflowDbService.getByWorkflowId(params.flowId);
    const isBuiltin = params.flowId.startsWith('kylrix-');
    if (!wf && !isBuiltin) throw new Error('Flow not found');
    if (wf && !wf.isPublic && !isBuiltin) {
      const perms = (wf as any).$permissions || [];
      const owns = perms.some(
        (p: string) =>
          p.includes(`user:${params.installerId}`) &&
          (p.startsWith('write(') || p.startsWith('update('))
      );
      if (!owns) throw new Error('Flow is private');
    }
    if (wf && (wf as any).toolTierMax === 'system') {
      throw new Error('System flows cannot be installed by users');
    }
    if (
      wf &&
      (wf as any).reviewStatus &&
      !['approved', 'draft', null, undefined].includes((wf as any).reviewStatus) &&
      wf.isPublic
    ) {
      // Published but blocked/rejected — refuse new installs
      if (['blocked', 'rejected'].includes((wf as any).reviewStatus)) {
        throw new Error('Flow is not available for install');
      }
    }

    let row: FlowInstallRow;
    try {
      const created = await tables.createRow({
        databaseId: DATABASE_ID,
        tableId: INSTALLS_TABLE,
        rowId: ID.unique(),
        data: {
          flowId: params.flowId,
          installerId: params.installerId,
          scopeKey,
          scopeType,
          grants: serializeGrants(params.grants),
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        permissions: [
          Permission.read(Role.user(params.installerId)),
          Permission.update(Role.user(params.installerId)),
          Permission.delete(Role.user(params.installerId)),
        ],
      });
      row = created as unknown as FlowInstallRow;
    } catch (err: any) {
      // Unique race — treat as existing
      const raced = await this.findActive(params.flowId, params.installerId, scopeKey);
      if (raced) {
        const current = await WorkflowDbService.getByWorkflowId(params.flowId);
        return {
          install: raced,
          created: false,
          installCount: (current as any)?.installCount ?? null,
        };
      }
      throw err;
    }

    let installCount: number | null = null;
    if (wf) {
      installCount = await WorkflowDbService.incrementInstallCount(params.flowId);
    }

    if (params.bindObject !== false) {
      await this.ensureObjectBinding({
        flowId: params.flowId,
        installerId: params.installerId,
        scope: params.scope,
        installId: row.$id,
        scopeKey,
      });
    }

    return { install: row, created: true, installCount };
  },

  async ensureObjectBinding(params: {
    flowId: string;
    installerId: string;
    scope: FlowScopeInput;
    installId: string;
    scopeKey: string;
  }) {
    const tables = createSystemTablesDB();
    let parentKind = 'user';
    let parentId = params.installerId;

    if (params.scope.type === 'object') {
      parentKind = params.scope.kind;
      parentId = params.scope.id;
    } else if (params.scope.type === 'kind') {
      // Kind-wide installs bind to the installer user with metadata.kind
      parentKind = 'user';
      parentId = params.installerId;
    } else if (params.scope.type === 'all') {
      parentKind = 'user';
      parentId = params.installerId;
    }

    const existing = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: OBJECTS_TABLE,
      queries: [
        Query.equal('parentId', parentId),
        Query.equal('parentKind', parentKind),
        Query.equal('childId', params.flowId),
        Query.equal('childKind', FLOW_CHILD_KIND),
        Query.limit(1),
      ],
    });
    if (existing.rows.length > 0) return existing.rows[0];

    const now = new Date().toISOString();
    return tables.createRow({
      databaseId: DATABASE_ID,
      tableId: OBJECTS_TABLE,
      rowId: ID.unique(),
      data: {
        parentId,
        parentKind,
        childId: params.flowId,
        childKind: FLOW_CHILD_KIND,
        userId: params.installerId,
        metadata: JSON.stringify({
          installId: params.installId,
          scopeKey: params.scopeKey,
          scopeType: params.scope.type,
        }),
        createdAt: now,
        updatedAt: now,
        isPublic: false,
        isGuest: false,
        isGeneral: params.scope.type === 'all',
      },
      permissions: [
        Permission.read(Role.user(params.installerId)),
        Permission.write(Role.user(params.installerId)),
      ],
    });
  },

  async listForInstaller(installerId: string) {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: INSTALLS_TABLE,
      queries: [
        Query.equal('installerId', installerId),
        Query.equal('status', 'active'),
        Query.orderDesc('$createdAt'),
        Query.limit(200),
      ],
    });
    return res.rows as unknown as FlowInstallRow[];
  },

  async revoke(params: { installId: string; installerId: string }) {
    const tables = createSystemTablesDB();
    const row = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: INSTALLS_TABLE,
      rowId: params.installId,
    }).catch(() => null) as FlowInstallRow | null;
    if (!row) throw new Error('Install not found');
    if (row.installerId !== params.installerId) throw new Error('Forbidden');

    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: INSTALLS_TABLE,
      rowId: params.installId,
      data: { status: 'revoked', updatedAt: new Date().toISOString() },
    });

    // Do not decrement installCount (lifetime installs). Revoke only.
    return { success: true };
  },
};
