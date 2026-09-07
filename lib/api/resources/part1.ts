import { ID, Permission, Query, Role } from 'node-appwrite';
import { systemTables, type SystemTablesPort } from '@/lib/data';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import type { ApiActor } from '@/lib/api/guard';
import { requireScope } from '@/lib/api/guard';
import { resolveParentRef } from '@/lib/api/v1/query';
import { listScopeCatalog, type PatScope } from '@/lib/api/scopes';
import { PatService } from '@/lib/services/pats';
import { clampNoteTitle } from '@/constants/noteTitle';
import {
import { WorkflowDbService } from '@/lib/services/workflows';
import {
import {
import {
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';
import { assertActorFeatureAccess } from '@/lib/tools/gate';
import {
  DB,
  NOTES,
  FLOW_DB,
  TASKS,
  WORKFLOWS,
  badRequest,
  notFound,
  forbidden,
  assertOwnedNote,
  assertOwnedGoal,
  CHAT_DB,
  PROJECT_OBJECTS,
  linkObjectToWorkspace,
  unlinkObjectFromWorkspace,
  TAGS_TABLE,
  ensureTagsExist,
  getWorkspaceObjectIds,
  getAllLinkedWorkspaceObjectIds,
  resolveWorkspaceMekBytes,
} from './helpers';

export const apiResourcesPart1 = {
  async me(actor: ApiActor) {
    requireScope(actor, 'profile:read');
    return shapeProfile(actor);
  },

  async listNotes(actor: ApiActor, limit = 25, opts?: { workspaceId?: string | null }) {
    requireScope(actor, 'notes:read');
    const tables = systemTables();
    const { isExcludedNote, ideaListExclusionQueries } = await import('@/lib/appwrite/note');

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const noteIds = await getWorkspaceObjectIds(tables, wsId, 'note');

      const seen = new Set<string>();
      const rows: any[] = [];

      for (const nid of noteIds) {
        if (seen.has(nid)) continue;
        seen.add(nid);
        const row = (await tables
          .getRow({ databaseId: DB, tableId: NOTES, rowId: nid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest) && !isExcludedNote(row)) {
          rows.push(shapeNote(row));
        }
      }

      return rows.slice(0, Math.min(100, Math.max(1, limit)));
    }

    // Personal workspace: strictly exclude items belonging to ANY real workspace
    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'note');
    const res = await tables.listRows({
      databaseId: DB,
      tableId: NOTES,
      queries: [
        Query.equal('userId', actor.userId),
        ...ideaListExclusionQueries(),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows
      .filter((r: any) => !isExcludedNote(r) && !linkedIds.has(r.$id))
      .map(shapeNote);
  },

  async getNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:read');
    const tables = systemTables();
    const row = await assertOwnedNote(tables, actor, id);
    return shapeNote(row);
  },

  async createNote(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const title = clampNoteTitle(String(body?.title || '').trim() || 'Untitled', 'Untitled');
    const content = body?.content != null ? String(body.content) : '';
    const wsId = body?.workspaceId || body?.projectId ? String(body.workspaceId || body.projectId) : null;
    const tables = systemTables();
    const now = new Date().toISOString();
    const noteId = ID.unique();

    const isPublic = body?.isPublic !== undefined ? Boolean(body.isPublic) : true;
    const isGuest = body?.isGuest !== undefined ? Boolean(body.isGuest) : (body?.isPublic !== undefined ? Boolean(body.isPublic) : true);

    const cleanTags = await ensureTagsExist(tables, actor.userId, body?.tags as any[]);

    const permissions = wsId || isPublic || isGuest
      ? [
          Permission.read(Role.any()),
          Permission.update(Role.user(actor.userId)),
          Permission.delete(Role.user(actor.userId)),
        ]
      : [
          Permission.read(Role.user(actor.userId)),
          Permission.update(Role.user(actor.userId)),
          Permission.delete(Role.user(actor.userId)),
        ];

    const metadataObj: Record<string, unknown> = {
      isWorkspace: Boolean(wsId),
    };
    if (wsId) {
      metadataObj.projectId = wsId;
    }

    const note = await tables.createRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: noteId,
      data: {
        userId: actor.userId,
        title,
        content,
        format: 'markdown',
        isPublic,
        isGuest,
        metadata: JSON.stringify(metadataObj),
        tags: cleanTags,
        createdAt: now,
        updatedAt: now,
      },
      permissions,
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'note', noteId, actor.userId, { title });
    }

    return shapeNote(note);
  },

  async updateNote(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'notes:write');
    const tables = systemTables();
    await assertOwnedNote(tables, actor, id);

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.title !== undefined) {
      patch.title = clampNoteTitle(String(body.title || '').trim() || 'Untitled', 'Untitled');
    }
    if (body.content !== undefined) patch.content = String(body.content);
    if (body.isPublic !== undefined) patch.isPublic = Boolean(body.isPublic);
    if (body.isGuest !== undefined) patch.isGuest = Boolean(body.isGuest);
    if (body.tags !== undefined) {
      patch.tags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
    }

    const filtered = filterNoteData(cleanRowData(patch));
    const row = await tables.updateRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: id,
      data: filtered as any,
    });
    return shapeNote(row);
  },

  async deleteNote(actor: ApiActor, id: string) {
    requireScope(actor, 'notes:write');
    const tables = systemTables();
    await assertOwnedNote(tables, actor, id);
    await tables.updateRow({
      databaseId: DB,
      tableId: NOTES,
      rowId: id,
      data: {
        isTrash: true,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'note', id);
    return { id, deleted: true, trashed: true };
  },

  async listGoals(
    actor: ApiActor,
    limit = 25,
    opts?: { workspaceId?: string | null; status?: string | null },
  ) {
    requireScope(actor, 'goals:read');
    const tables = systemTables();
    const cap = Math.min(100, Math.max(1, limit));
    const statusFilter = opts?.status ? String(opts.status) : null;

    const applyFilters = (rows: ReturnType<typeof shapeGoal>[]) => {
      const filtered = statusFilter ? rows.filter((g) => g.status === statusFilter) : rows;
      return filtered.slice(0, cap);
    };

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const goalIds = await getWorkspaceObjectIds(tables, wsId, 'goal');

      const seen = new Set<string>();
      const rows: ReturnType<typeof shapeGoal>[] = [];

      for (const gid of goalIds) {
        if (seen.has(gid)) continue;
        seen.add(gid);
        const row = (await tables
          .getRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: gid })
          .catch(() => null)) as any;
        if (row && (row.userId === actor.userId || row.isPublic || row.isGuest)) {
          rows.push(shapeGoal(row));
        }
      }

      return applyFilters(rows);
    }

    // Personal workspace: strictly exclude items belonging to ANY real workspace
    const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'goal');
    const queries = [
      Query.equal('userId', actor.userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(cap),
    ];
    if (statusFilter) queries.splice(1, 0, Query.equal('status', statusFilter));

    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: TASKS,
      queries,
    });
    return applyFilters(
      res.rows
        .filter((r: any) => !linkedIds.has(r.$id))
        .map(shapeGoal),
    );
  },

  async getGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:read');
    const tables = systemTables();
    const row = await assertOwnedGoal(tables, actor, id);
    return shapeGoal(row);
  },

  async createGoal(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'goals:write');
    const title = String(body?.title || '').trim();
    if (!title) badRequest('title required');
    const wsId = resolveWorkspaceId(body);
    const tables = systemTables();
    const goalId = ID.unique();

    const rowData = buildGoalCreateRow(actor.userId, body);
    if (body?.tags !== undefined) {
      const cleanTags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
      if (cleanTags.length > 0) rowData.tags = cleanTags;
    }

    const row = await tables.createRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: goalId,
      data: rowData as any,
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(actor.userId)),
      ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'goal', goalId, actor.userId, { title });
    }

    return shapeGoal(row);
  },

  async updateGoal(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'goals:write');
    const tables = systemTables();
    await assertOwnedGoal(tables, actor, id);
    const patch = buildGoalUpdatePatch(body);
    if (body.tags !== undefined) {
      patch.tags = await ensureTagsExist(tables, actor.userId, body.tags as any[]);
    }
    const row = await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: id,
      data: patch as any,
    });
    return shapeGoal(row);
  },

  async deleteGoal(actor: ApiActor, id: string) {
    requireScope(actor, 'goals:write');
    const tables = systemTables();
    await assertOwnedGoal(tables, actor, id);
    await tables.updateRow({
      databaseId: FLOW_DB,
      tableId: TASKS,
      rowId: id,
      data: {
        isTrash: true,
        isDeleted: true,
        status: 'trash',
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'goal', id);
    return { id, deleted: true, trashed: true };
  },

  async listFlows(actor: ApiActor, limit = 25) {
    requireScope(actor, 'flows:read');
    const tables = systemTables();
    const res = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: WORKFLOWS,
      queries: [
        Query.equal('ownerId', actor.userId),
        Query.orderDesc('$createdAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    });
    return res.rows.map((r: any) => shapeFlowListItem(r));
  },

  async createFlow(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'flows:write');
    let fields: ReturnType<typeof resolveFlowCreateFields>;
    try {
      fields = resolveFlowCreateFields(body);
    } catch {
      badRequest('name or title required');
    }
    const wf = {
      id: fields.id,
      name: fields.name,
      description: fields.description,
      niche: fields.niche as any,
      steps: fields.steps,
      isPublic: false,
      isAnonymized: false,
      createdAt: new Date().toISOString(),
    };
    await WorkflowDbService.saveWorkflow(wf, actor.userId);
    return await this.getFlow(actor, fields.id);
  },

  async getFlow(actor: ApiActor, id: string) {
    requireScope(actor, 'flows:read');
    const wf = await WorkflowDbService.getByWorkflowId(id);
    if (!wf) badRequest('Flow not found');
    return wf;
  },

  async publishFlow(actor: ApiActor, id: string, body: Record<string, unknown>) {
    requireScope(actor, 'flows:write');
    const { requestFlowPublishSecure } = await import('@/lib/actions/secure-ops/flows');
    const res = await requestFlowPublishSecure({
      flowId: id,
      confirmAware: body.confirmAware !== false,
      actorId: actor.userId,
    });
    if (res.verdict === 'rejected' || res.verdict === 'blocked') {
      return {
        success: false,
        error: (res as any).error || `Publish rejected due to ${res.verdict} security status`,
        verdict: res.verdict,
        pii: res.pii,
      };
    }
    return res;
  },

  async deleteFlow(actor: ApiActor, id: string) {
    requireScope(actor, 'flows:write');
    const wf = await WorkflowDbService.getByWorkflowId(id);
    if (!wf) badRequest('Flow not found');
    await WorkflowDbService.deleteWorkflow(id);
    return { id, deleted: true };
  },

  // ─── Token self-service (rescue hatch — no extra scope required) ───

  async tokenMe(actor: ApiActor) {
    if (actor.kind !== 'pat' || !actor.patId) {
      return shapeTokenMe(actor);
    }
    const pat = await PatService.getOwned({ patId: actor.patId, userId: actor.userId });
    return shapeTokenMe(actor, { pat, catalog: listScopeCatalog() });
  },

  async tokenScopeCatalog(_actor: ApiActor) {
    return shapeTokenScopeCatalog(listScopeCatalog());
  },

  /**
   * Self-service scope refresh on the CURRENT bearer PAT.
   * Intentionally does not require pats:write — this is the rescue hatch so a
   * half-baked token can grant itself new scopes as the catalog grows.
   */
  async tokenUpdateScopes(
    actor: ApiActor,
    body: Record<string, unknown>,
    mode: 'replace' | 'grant' = 'replace',
  ) {
    if (actor.kind !== 'pat' || !actor.patId) {
      badRequest('Only personal access tokens can refresh their own scopes');
    }
    const scopes = body.scopes ?? body.grant ?? body.add;

    if (actor.isAgent) {
      // Guardrail: Agents can self-grant workspace and agentic scopes, but cannot self-grant user private vault or PAT management
      const RESTRICTED_USER_SCOPES = new Set(['vault:read', 'vault:write', 'pats:write', 'admin:keys']);
      const requestedList: string[] = Array.isArray(scopes) ? scopes.map(String) : typeof scopes === 'string' ? [scopes] : [];
      for (const s of requestedList) {
        if (RESTRICTED_USER_SCOPES.has(s) && !actor.scopes.includes(s)) {
          badRequest(`Agentic tokens cannot self-grant restricted scope '${s}'. Manual authorization via owner agent provisioning key is required.`);
        }
      }
    }

    const pat = await PatService.updateScopes({
      patId: actor.patId!,
      userId: actor.userId,
      scopes,
      mode: body.mode === 'grant' || mode === 'grant' ? 'grant' : 'replace',
    });
    return shapeTokenRefreshResult(pat, 'New scopes apply on the next request with this same token (no re-mint).');
  },

  async listPats(actor: ApiActor) {
    requireScope(actor, 'pats:read');
    return PatService.listForUser(actor.userId);
  },

  async createPat(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'pats:write');
    const name = String(body.name || '').trim();
    if (!name) badRequest('name required');
    return PatService.create({
      userId: actor.userId,
      name,
      scopes: body.scopes,
      expiresAt: body.expiresAt != null ? String(body.expiresAt) : null,
    });
  },

  async revokePat(actor: ApiActor, patId: string) {
    requireScope(actor, 'pats:write');
    if (actor.patId && actor.patId === patId) {
      badRequest('Refuse to revoke the token currently authenticating this request');
    }
    return PatService.revoke({ patId, userId: actor.userId });
  },

  async createAgentKey(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('pats:write') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('agents:provision')) {
      requireScope(actor, 'pats:write');
    }
    const name = String(body.name || 'Agent Provisioning Key').trim().slice(0, 128);
    // Root Agent Provisioning Keys have the sole purpose of provisioning agents & minting agentic PATs
    const scopes: PatScope[] = ['agents:provision'];
    
    return PatService.create({
      userId: actor.userId,
      name,
      scopes,
      keyCategory: 'agent_provisioning_key',
      expiresAt: body.expiresAt != null ? String(body.expiresAt) : null,
    });
  },

  async initAgentIdentity(actor: ApiActor, targetAgentId: string, body: Record<string, unknown> = {}) {
    if (!actor.scopes.includes('agents:provision') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('pats:write')) {
      requireScope(actor, 'agents:provision');
    }
    const agentId = String(targetAgentId || '').trim();
    if (!agentId) {
      const err = new Error('Missing required agentId');
      (err as any).status = 400;
      throw err;
    }
    const tables = systemTables();
    const now = new Date().toISOString();

    // 1. Check if agent already exists in agents table
    const existingAgentRow = await tables.getRow({
      databaseId: FLOW_DB,
      tableId: 'agents',
      rowId: agentId,
    }).catch(() => null);

    if (existingAgentRow) {
      if (existingAgentRow.ownerId && existingAgentRow.ownerId !== actor.userId) {
        const err = new Error('Forbidden: You do not own this agent');
        (err as any).status = 403;
        throw err;
      }
      // If keys already initialized and forceReset is not requested, prevent accidental rewriting
      if (existingAgentRow.publicKey && !body.forceReset && !body.reset) {
        let parsedConfig: Record<string, any> = {};
        try {
          parsedConfig = JSON.parse(existingAgentRow.config || '{}');
        } catch {}
        if (parsedConfig.walletAddress) {
          const err = new Error('Conflict: Sovereign cryptographic identity is already sealed for this agent. Pass forceReset: true to regenerate.');
          (err as any).status = 409;
          (err as any).code = 'identity_already_sealed';
          (err as any).data = {
            agentId,
            agentUserId: `agent_${agentId}`,
            username: parsedConfig.username,
            name: parsedConfig.name,
            walletAddress: parsedConfig.walletAddress,
            nostrNpub: existingAgentRow.publicKey,
            publicKey: existingAgentRow.publicKey,
            workspaceId: parsedConfig.workspaceId,
          };
          throw err;
        }
      }
    }

    // 2. Generate autonomous keys, BIP39 mnemonic & multi-chain wallets
    const name = String(body.name || 'Autonomous Agent').trim().slice(0, 128);
    const agentType = String(body.agentType || 'autonomous').trim().slice(0, 64);
    const crypto = await this.deriveAgentSovereignCrypto(typeof body.mnemonic === 'string' ? body.mnemonic : undefined);

    const agentUserId = `agent_${agentId}`;
    const cleanHandle = `ag_${name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || agentId.slice(0, 8)}`;

    // 3. Resolve or create workspace
    let workspaceId = body.workspaceId ? String(body.workspaceId) : null;
    let workspaceTitle = String(body.initialWorkspaceTitle || `${name}'s Workspace`).trim().slice(0, 255);

    if (!workspaceId) {
      const wsRow = await tables.createRow({
        databaseId: FLOW_DB,
        tableId: 'projects',
        rowId: ID.unique(),
        data: {
          title: workspaceTitle,
          summary: `Autonomous workspace for agent ${name}`,
          ownerId: actor.userId,
          visibility: 'private',
          status: 'active',
          kind: 'workspace',
          parentProjectId: null,
          isAgentic: true,
          isPublic: false,
          isGuest: false,
          createdAt: now,
          updatedAt: now,
        },
        permissions: [Permission.read(Role.user(actor.userId))],
      }).catch(() => null);
      if (wsRow) workspaceId = (wsRow as any).$id;
    }

    // 4. Save to agents table
    if (existingAgentRow) {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'agents',
        rowId: agentId,
        data: {
          publicKey: crypto.nostrNpub,
          config: JSON.stringify({
            name,
            agentType,
            agentUserId,
            username: cleanHandle,
            walletAddress: crypto.walletAddressJson,
            walletMap: crypto.walletMap,
            nostrNpub: crypto.nostrNpub,
            workspaceId,
            capabilities: body.capabilities || ['notes', 'goals', 'chats', 'nostr'],
            updatedAt: now,
          }),
          status: 'active',
        },
      }).catch(() => null);
    } else {
      await tables.createRow({
        databaseId: FLOW_DB,
        tableId: 'agents',
        rowId: agentId,
        data: {
          ownerId: actor.userId,
          publicKey: crypto.nostrNpub,
          config: JSON.stringify({
            name,
            agentType,
            agentUserId,
            username: cleanHandle,
            walletAddress: crypto.walletAddressJson,
            walletMap: crypto.walletMap,
            nostrNpub: crypto.nostrNpub,
            workspaceId,
            capabilities: body.capabilities || ['notes', 'goals', 'chats', 'nostr'],
            createdAt: now,
          }),
          status: 'active',
          isPublic: true,
          isGuest: true,
        },
        permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
      }).catch(() => null);
    }

    // 5. Create or sync profile in profiles table
    await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      rowId: agentUserId,
      data: {
        userId: agentUserId,
        username: cleanHandle,
        displayName: `${name.trim()} (Smart Agent)`,
        bio: String(body.bio || body.goal || `Autonomous ${agentType} smart partner`),
        walletAddress: crypto.walletAddressJson,
        publicKey: crypto.nostrNpub,
        status: 'online',
        preferences: JSON.stringify({
          isAgentic: true,
          ownerId: actor.userId,
          agentId,
          agentType,
          role: String(body.role || name),
          goal: String(body.goal || ''),
          nostrNpub: crypto.nostrNpub,
          walletAddress: crypto.walletMap,
          updatedAt: now,
        }),
        isPublic: true,
        isGuest: true,
        isAvatar: true,
        isContact: true,
        isOnlineVisible: true,
      },
      permissions: [Permission.read(Role.any()), Permission.update(Role.user(actor.userId))],
    }).catch(async () => {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
        rowId: agentUserId,
        data: {
          username: cleanHandle,
          displayName: `${name.trim()} (Smart Agent)`,
          walletAddress: crypto.walletAddressJson,
          publicKey: crypto.nostrNpub,
          status: 'online',
          preferences: JSON.stringify({
            isAgentic: true,
            ownerId: actor.userId,
            agentId,
            agentType,
            role: String(body.role || name),
            goal: String(body.goal || ''),
            nostrNpub: crypto.nostrNpub,
            walletAddress: crypto.walletMap,
            updatedAt: now,
          }),
        },
      }).catch(() => null);
    });

    return {
      agentId,
      agentUserId,
      username: cleanHandle,
      name,
      agentType,
      workspaceId,
      workspaceTitle,
      mnemonic: crypto.mnemonic,
      walletAddress: crypto.walletAddressJson,
      walletMap: crypto.walletMap,
      nostrNpub: crypto.nostrNpub,
      nostrNsec: crypto.nostrNsec,
      mekHex: crypto.mekHex,
      publicKey: crypto.nostrNpub,
      ownerId: actor.userId,
      createdAt: now,
    };
  },

  async provisionAgent(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('agents:provision') && !actor.scopes.includes('agents:write') && !actor.scopes.includes('pats:write')) {
      requireScope(actor, 'agents:provision');
    }
    
    const targetAgentId = body.agentId ? String(body.agentId).trim() : ID.unique();
    const initResult = await this.initAgentIdentity(actor, targetAgentId, body);

    const name = String(body.name || initResult.name || 'Autonomous Agent').trim().slice(0, 128);
    const agentScopes = Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes
      : [
          'workspaces:read',
          'workspaces:write',
          'notes:read',
          'notes:write',
          'goals:read',
          'goals:write',
          'vault:read',
          'vault:write',
          'trash:read',
          'trash:write',
          'chats:read',
          'chats:write',
          'agents:read',
          'agents:write',
        ];

    const agentPatResult = await PatService.create({
      userId: actor.userId,
      name: `${name} (Agentic PAT)`,
      scopes: agentScopes,
      keyCategory: 'agentic_pat',
      agentId: initResult.agentId,
    });

    return {
      ...initResult,
      agentToken: agentPatResult.token,
    };
  },

  async listWorkspaces(actor: ApiActor, limit = 25) {
    requireScope(actor, 'workspaces:read');
    const tables = systemTables();
    
    // 1. Owned workspaces
    const ownedRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: 'projects',
      queries: [
        ...ownedWorkspaceListQueries(actor.userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ] as any,
    });

    const ownedList = filterRootWorkspaceProjects(ownedRes.rows).map((r: any) =>
      shapeWorkspace(r, { isShared: false, role: 'owner' }),
    );

    // 2. Workspaces where user/agent is a collaborator
    const collabRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
      queries: [
        Query.equal('userId', actor.userId),
        Query.equal('resourceType', 'project'),
        Query.equal('status', 'accepted'),
        Query.limit(Math.min(100, Math.max(1, limit))),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    const sharedList: any[] = [];
    for (const c of collabRes.rows) {
      if (ownedList.some((w) => w.id === c.resourceId)) continue;
      const ws = (await tables
        .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: c.resourceId })
        .catch(() => null)) as any;
      if (ws && isWorkspaceRecord(ws)) {
        sharedList.push(
          shapeWorkspace(ws, { isShared: true, role: c.permission || 'writer' }),
        );
      }
    }

    return [...ownedList, ...sharedList];
  },

  async getWorkspace(actor: ApiActor, id: string) {
    requireScope(actor, 'workspaces:read');
    const tables = systemTables();
    const row = (await tables
      .getRow({ databaseId: FLOW_DB, tableId: 'projects', rowId: id })
      .catch(() => null)) as any;
    if (!row) notFound('Workspace not found');
    if (!isWorkspaceRecord(row)) notFound('Workspace not found');

    let isCollab = false;
    let role = 'owner';
    if (row.ownerId !== actor.userId) {
      const collabRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators',
        queries: [
          Query.equal('resourceId', id),
          Query.equal('userId', actor.userId),
          Query.equal('status', 'accepted'),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      if (collabRes.rows.length === 0 && !row.isPublic) {
        notFound('Workspace not found');
      }
      isCollab = true;
      role = collabRes.rows[0]?.permission || 'viewer';
    }

    return shapeWorkspace(row, { isShared: isCollab, role });
  },
  async addWorkspaceCollaborator(actor: ApiActor, workspaceId: string, body: Record<string, unknown>) {
    requireScope(actor, 'workspaces:write');
    await this.getWorkspace(actor, workspaceId);
    const targetUserId = String(body.userId || body.agentId || '').trim();
    if (!targetUserId) badRequest('userId or agentId required');
    const permission = String(body.permission || 'write').toLowerCase();
    if (!['read', 'write', 'admin'].includes(permission)) {
      badRequest('permission must be read, write, or admin');
    }

    const tables = systemTables();
    const FLOW_DATABASE_ID = FLOW_DB;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const now = new Date().toISOString();

    // Check existing
    const existing = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', workspaceId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', targetUserId),
      ],
    }).catch(() => ({ rows: [] as any[] }));

    if (existing.rows.length > 0) {
      const updated = await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existing.rows[0].$id,
        data: {
          permission,
          status: 'accepted',
          updatedAt: now,
        },
      });
      return {
        id: (updated as any).$id,
        workspaceId,
        userId: targetUserId,
        permission,
        status: 'accepted',
      };
    }

    const created = await tables.createRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: ID.unique(),
      data: {
        resourceId: workspaceId,
        resourceType: 'project',
        userId: targetUserId,
        permission,
        inviterId: actor.userId,
        status: 'accepted',
        invitedAt: now,
      },
      permissions: [
        Permission.read(Role.user(actor.userId)),
        Permission.read(Role.user(targetUserId)),
      ],
    });

    return {
      id: (created as any).$id,
      workspaceId,
      userId: targetUserId,
      permission,
      status: 'accepted',
    };
  },

};
