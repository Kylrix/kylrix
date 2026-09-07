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

export const apiResourcesPart3 = {
  async listVaultItems(
    actor: ApiActor,
    limit = 25,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const lim = Math.min(100, Math.max(1, limit));

    let rows: any[] = [];

    if (opts?.workspaceId) {
      const wsId = opts.workspaceId;
      const credIds = await getWorkspaceObjectIds(tables, wsId, 'credential');
      const seen = new Set<string>();

      for (const cid of credIds) {
        if (seen.has(cid)) continue;
        seen.add(cid);
        const row = (await tables
          .getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
            rowId: cid,
          })
          .catch(() => null)) as any;

        if (row && row.userId === actor.userId && !row.isDeleted) {
          rows.push(row);
        }
      }
      rows = rows.slice(0, lim);
    } else {
      const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'credential');
      const res = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', false),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      });

      rows = res.rows.filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id));
    }

    return Promise.all(
      rows.map(async (r: any) => {
        const unsealed = mekBytes
          ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.credentials, mekBytes)
          : {};

        return shapeVaultItem(r, {
          unsealed,
          hasMek: !!mekBytes,
          looksEncrypted,
        });
      }),
    );
  },

  async getVaultItem(
    actor: ApiActor,
    id: string,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || r.userId !== actor.userId || r.isDeleted) notFound('Vault item not found');

    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const unsealed = mekBytes
      ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.credentials, mekBytes)
      : {};

    return shapeVaultItem(r, {
      unsealed,
      hasMek: !!mekBytes,
      looksEncrypted,
    });
  },

  async createVaultItem(
    actor: ApiActor,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const name = String(body.name || body.title || '').trim();
    if (!name) badRequest('name required');

    const tables = systemTables();
    const wsId = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const agId = (body.agentId || opts?.agentId) as string | undefined;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
      workspaceId: wsId,
      agentId: agId,
      mek: opts?.mek || (body.mek as string),
    });

    if (!mekBytes) {
      const err = new Error('Vault creation requires MEK or an Agentic Workspace context (pass X-Kylrix-MEK, mek, or workspaceId)');
      (err as any).status = 400;
      (err as any).code = 'mek_required';
      throw err;
    }

    let rawSecret = body.secret != null ? String(body.secret) : (body.password != null ? String(body.password) : '');
    let wasGenerated = false;

    if (!rawSecret && (body.itemType === 'login' || !body.itemType || body.type === 'login')) {
      const genOptions = (body.generateOptions && typeof body.generateOptions === 'object' ? body.generateOptions : {}) as any;
      rawSecret = generateRandomVaultSecret(genOptions);
      wasGenerated = true;
    }

    const payloadToSeal: Record<string, any> = {
      name,
      username: body.username != null ? String(body.username) : null,
      password: rawSecret || null,
      url: body.url != null ? String(body.url) : null,
      notes: body.notes != null ? String(body.notes) : null,
      customFields: body.customFields != null ? (typeof body.customFields === 'object' ? JSON.stringify(body.customFields) : String(body.customFields)) : null,
      cardNumber: body.cardNumber != null ? String(body.cardNumber) : null,
      cardholderName: body.cardholderName != null ? String(body.cardholderName) : null,
      cardExpiry: body.cardExpiry != null ? String(body.cardExpiry) : null,
      cardCVV: body.cardCVV != null ? String(body.cardCVV) : null,
      cardPIN: body.cardPIN != null ? String(body.cardPIN) : null,
    };

    const { encryptedFields, wrappedDek } = await sealRowFields(
      payloadToSeal,
      VAULT_ENCRYPTED_FIELDS.credentials,
      mekBytes
    );

    const itemId = ID.unique();
    const now = new Date().toISOString();
    const itemType = String(body.itemType || body.type || 'login').slice(0, 50);

    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: itemId,
      data: {
        userId: actor.userId,
        name: encryptedFields.name || name.slice(0, 100),
        username: encryptedFields.username ?? null,
        password: encryptedFields.password ?? null,
        dek: wrappedDek,
        url: encryptedFields.url ?? null,
        notes: encryptedFields.notes ?? null,
        customFields: encryptedFields.customFields ?? null,
        cardNumber: encryptedFields.cardNumber ?? null,
        cardholderName: encryptedFields.cardholderName ?? null,
        cardExpiry: encryptedFields.cardExpiry ?? null,
        cardCVV: encryptedFields.cardCVV ?? null,
        cardPIN: encryptedFields.cardPIN ?? null,
        itemType,
        folderId: body.folderId != null ? String(body.folderId) : null,
        isFavorite: body.isFavorite === true,
        isPinned: body.isPinned === true,
        isDeleted: false,
        isEnv: body.isEnv === true,
        tags,
        createdAt: now,
        updatedAt: now,
      },
      permissions: wsId
        ? [
            Permission.read(Role.any()),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ]
        : [
            Permission.read(Role.user(actor.userId)),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'credential', itemId, actor.userId, { title: name });
      await linkObjectToWorkspace(tables, wsId, 'secret', itemId, actor.userId, { title: name });
    }

    return {
      id: (row as any).$id,
      name,
      username: body.username != null ? String(body.username) : null,
      itemType,
      url: body.url != null ? String(body.url) : null,
      folderId: (row as any).folderId,
      isFavorite: !!(row as any).isFavorite,
      isPinned: !!(row as any).isPinned,
      tags,
      secret: rawSecret || null,
      password: rawSecret || null,
      notes: body.notes != null ? String(body.notes) : null,
      customFields: body.customFields ?? null,
      cardNumber: body.cardNumber != null ? String(body.cardNumber) : null,
      cardholderName: body.cardholderName != null ? String(body.cardholderName) : null,
      cardExpiry: body.cardExpiry != null ? String(body.cardExpiry) : null,
      cardCVV: body.cardCVV != null ? String(body.cardCVV) : null,
      cardPIN: body.cardPIN != null ? String(body.cardPIN) : null,
      generated: wasGenerated,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateVaultItem(
    actor: ApiActor,
    id: string,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('Vault item not found');

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.itemType !== undefined) patch.itemType = String(body.itemType).slice(0, 50);
    if (body.folderId !== undefined) patch.folderId = body.folderId == null ? null : String(body.folderId);
    if (body.isFavorite !== undefined) patch.isFavorite = !!body.isFavorite;
    if (body.isPinned !== undefined) patch.isPinned = !!body.isPinned;
    if (body.isEnv !== undefined) patch.isEnv = !!body.isEnv;
    if (body.tags !== undefined && Array.isArray(body.tags)) patch.tags = body.tags.map(String);

    const hasEncryptedField =
      body.name !== undefined ||
      body.username !== undefined ||
      body.url !== undefined ||
      body.secret !== undefined ||
      body.password !== undefined ||
      body.notes !== undefined ||
      body.customFields !== undefined ||
      body.cardNumber !== undefined ||
      body.cardholderName !== undefined ||
      body.cardExpiry !== undefined ||
      body.cardCVV !== undefined ||
      body.cardPIN !== undefined;

    if (hasEncryptedField) {
      const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
        workspaceId: (body.workspaceId || body.projectId || opts?.workspaceId) as string,
        agentId: (body.agentId || opts?.agentId) as string,
        mek: opts?.mek || (body.mek as string),
      });

      if (!mekBytes) {
        badRequest('Updating encrypted vault fields requires MEK header X-Kylrix-MEK, mek body property, or agentic workspace context');
      }

      const payloadToSeal: Record<string, any> = {};
      if (body.name !== undefined) payloadToSeal.name = String(body.name).trim();
      if (body.username !== undefined) payloadToSeal.username = body.username == null ? null : String(body.username);
      if (body.url !== undefined) payloadToSeal.url = body.url == null ? null : String(body.url);
      if (body.secret !== undefined || body.password !== undefined) {
        payloadToSeal.password = String(body.secret ?? body.password ?? '');
      }
      if (body.notes !== undefined) payloadToSeal.notes = body.notes == null ? null : String(body.notes);
      if (body.customFields !== undefined) {
        payloadToSeal.customFields = body.customFields == null ? null : (typeof body.customFields === 'object' ? JSON.stringify(body.customFields) : String(body.customFields));
      }
      if (body.cardNumber !== undefined) payloadToSeal.cardNumber = body.cardNumber == null ? null : String(body.cardNumber);
      if (body.cardholderName !== undefined) payloadToSeal.cardholderName = body.cardholderName == null ? null : String(body.cardholderName);
      if (body.cardExpiry !== undefined) payloadToSeal.cardExpiry = body.cardExpiry == null ? null : String(body.cardExpiry);
      if (body.cardCVV !== undefined) payloadToSeal.cardCVV = body.cardCVV == null ? null : String(body.cardCVV);
      if (body.cardPIN !== undefined) payloadToSeal.cardPIN = body.cardPIN == null ? null : String(body.cardPIN);

      const { encryptedFields, wrappedDek } = await sealRowFields(
        payloadToSeal,
        Object.keys(payloadToSeal),
        mekBytes,
        existing.dek
      );

      Object.assign(patch, encryptedFields);
      patch.dek = wrappedDek;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: id,
      data: patch as any,
    });

    return this.getVaultItem(actor, id, opts);
  },

  async deleteVaultItem(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('Vault item not found');

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
      rowId: id,
      data: {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'credential', id);

    return { id, deleted: true, trashed: true };
  },

  // --- TOTP Secrets ---
  async listTotpSecrets(
    actor: ApiActor,
    limit = 50,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const lim = Math.min(100, Math.max(1, limit));
    const wsId = opts?.workspaceId;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);

    let rows: any[] = [];
    if (wsId) {
      const totpIds = await getWorkspaceObjectIds(tables, wsId, 'totp');
      const seen = new Set<string>();

      for (const tid of totpIds) {
        if (seen.has(tid)) continue;
        seen.add(tid);
        const row = (await tables
          .getRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
            rowId: tid,
          })
          .catch(() => null)) as any;

        if (row && row.userId === actor.userId && !row.isDeleted) {
          rows.push(row);
        }
      }
      rows = rows.slice(0, lim);
    } else {
      const linkedIds = await getAllLinkedWorkspaceObjectIds(tables, 'totp');
      const res = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', false),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      });

      rows = res.rows.filter((r: any) => !r.isWorkspace && !r.projectId && !linkedIds.has(r.$id));
    }

    return Promise.all(
      rows.map(async (r: any) => {
        const unsealed = mekBytes
          ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.totpSecrets, mekBytes)
          : {};

        return shapeTotpSecret(r, {
          unsealed,
          hasMek: !!mekBytes,
          looksEncrypted,
        });
      }),
    );
  },

  async getTotpSecret(
    actor: ApiActor,
    id: string,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:read');
    const tables = systemTables();
    const r = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!r || r.userId !== actor.userId || r.isDeleted) notFound('TOTP secret not found');

    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, opts);
    const unsealed = mekBytes
      ? await unsealRowFields(r, VAULT_ENCRYPTED_FIELDS.totpSecrets, mekBytes)
      : {};

    return shapeTotpSecret(r, {
      unsealed,
      hasMek: !!mekBytes,
      looksEncrypted,
    });
  },

  async createTotpSecret(
    actor: ApiActor,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const secretKey = String(body.secretKey || body.secret || '').trim();
    if (!secretKey) badRequest('secretKey required');

    const tables = systemTables();
    const wsId = (body.workspaceId || body.projectId || opts?.workspaceId) as string | undefined;
    const agId = (body.agentId || opts?.agentId) as string | undefined;
    const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
      workspaceId: wsId,
      agentId: agId,
      mek: opts?.mek || (body.mek as string),
    });

    if (!mekBytes) {
      const err = new Error('TOTP creation requires MEK or an Agentic Workspace context (pass X-Kylrix-MEK, mek, or workspaceId)');
      (err as any).status = 400;
      (err as any).code = 'mek_required';
      throw err;
    }

    const issuer = String(body.issuer || body.name || body.title || 'App').trim();
    const accountName = body.accountName != null ? String(body.accountName).trim() : null;
    const url = body.url != null ? String(body.url).trim() : null;

    const payloadToSeal: Record<string, any> = {
      issuer,
      accountName,
      secretKey,
      url,
    };

    const { encryptedFields, wrappedDek } = await sealRowFields(
      payloadToSeal,
      VAULT_ENCRYPTED_FIELDS.totpSecrets,
      mekBytes
    );

    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];
    const itemId = ID.unique();
    const now = new Date().toISOString();

    const row = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
      rowId: itemId,
      data: {
        userId: actor.userId,
        issuer: encryptedFields.issuer || issuer.slice(0, 100),
        accountName: encryptedFields.accountName ?? null,
        secretKey: encryptedFields.secretKey ?? null,
        dek: wrappedDek,
        url: encryptedFields.url ?? null,
        algorithm: String(body.algorithm || 'SHA1'),
        digits: Number(body.digits || 6),
        period: Number(body.period || 30),
        folderId: body.folderId != null ? String(body.folderId) : null,
        isFavorite: body.isFavorite === true,
        isDeleted: false,
        tags,
        createdAt: now,
        updatedAt: now,
      },
      permissions: wsId
        ? [
            Permission.read(Role.any()),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ]
        : [
            Permission.read(Role.user(actor.userId)),
            Permission.update(Role.user(actor.userId)),
            Permission.delete(Role.user(actor.userId)),
          ],
    });

    if (wsId) {
      await linkObjectToWorkspace(tables, wsId, 'totp', itemId, actor.userId, { title: issuer });
    }

    return {
      id: (row as any).$id,
      issuer,
      accountName,
      url,
      algorithm: (row as any).algorithm,
      digits: (row as any).digits,
      period: (row as any).period,
      folderId: (row as any).folderId,
      isFavorite: !!(row as any).isFavorite,
      tags,
      secretKey,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateTotpSecret(
    actor: ApiActor,
    id: string,
    body: Record<string, unknown>,
    opts?: { mek?: string | null; workspaceId?: string | null; agentId?: string | null }
  ) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('TOTP secret not found');

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.algorithm !== undefined) patch.algorithm = String(body.algorithm);
    if (body.digits !== undefined) patch.digits = Number(body.digits);
    if (body.period !== undefined) patch.period = Number(body.period);
    if (body.folderId !== undefined) patch.folderId = body.folderId == null ? null : String(body.folderId);
    if (body.isFavorite !== undefined) patch.isFavorite = !!body.isFavorite;
    if (body.tags !== undefined && Array.isArray(body.tags)) patch.tags = body.tags.map(String);

    const hasEncryptedField =
      body.issuer !== undefined ||
      body.name !== undefined ||
      body.accountName !== undefined ||
      body.secretKey !== undefined ||
      body.secret !== undefined ||
      body.url !== undefined;

    if (hasEncryptedField) {
      const mekBytes = await resolveWorkspaceMekBytes(tables, actor, {
        workspaceId: (body.workspaceId || body.projectId || opts?.workspaceId) as string,
        agentId: (body.agentId || opts?.agentId) as string,
        mek: opts?.mek || (body.mek as string),
      });

      if (!mekBytes) {
        badRequest('Updating encrypted TOTP fields requires MEK header X-Kylrix-MEK, mek body property, or agentic workspace context');
      }

      const payloadToSeal: Record<string, any> = {};
      if (body.issuer !== undefined || body.name !== undefined) {
        payloadToSeal.issuer = String(body.issuer ?? body.name ?? '').trim();
      }
      if (body.accountName !== undefined) payloadToSeal.accountName = body.accountName == null ? null : String(body.accountName);
      if (body.secretKey !== undefined || body.secret !== undefined) {
        payloadToSeal.secretKey = String(body.secretKey ?? body.secret ?? '').trim();
      }
      if (body.url !== undefined) payloadToSeal.url = body.url == null ? null : String(body.url);

      const { encryptedFields, wrappedDek } = await sealRowFields(
        payloadToSeal,
        Object.keys(payloadToSeal),
        mekBytes,
        existing.dek
      );

      Object.assign(patch, encryptedFields);
      patch.dek = wrappedDek;
    }

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
      rowId: id,
      data: patch as any,
    });

    return this.getTotpSecret(actor, id, opts);
  },

  async deleteTotpSecret(actor: ApiActor, id: string) {
    requireScope(actor, 'vault:write');
    const tables = systemTables();
    const existing = (await tables
      .getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
        rowId: id,
      })
      .catch(() => null)) as any;

    if (!existing || existing.userId !== actor.userId) notFound('TOTP secret not found');

    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
      tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS || 'totpSecrets',
      rowId: id,
      data: {
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await unlinkObjectFromWorkspace(tables, 'totp', id);

    return { id, deleted: true, trashed: true };
  },
  async listTrash(actor: ApiActor, limit = 50, opts?: { kind?: string | null }) {
    if (!actor.scopes.includes('trash:read') && !actor.scopes.includes('notes:read') && !actor.scopes.includes('vault:read')) {
      requireScope(actor, 'trash:read');
    }
    const tables = systemTables();
    const targetKind = opts?.kind ? String(opts.kind).toLowerCase() : null;
    const items: any[] = [];
    const lim = Math.min(100, Math.max(1, limit));

    // 1. Trashed Notes
    if (!targetKind || targetKind === 'note' || targetKind === 'notes') {
      const notesRes = await tables.listRows({
        databaseId: DB,
        tableId: NOTES,
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of notesRes.rows) {
        items.push(shapeTrashNoteItem(r));
      }
    }

    // 2. Trashed Goals / Tasks
    if (!targetKind || targetKind === 'goal' || targetKind === 'goals' || targetKind === 'task' || targetKind === 'tasks') {
      const tasksRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: TASKS,
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of tasksRes.rows) {
        items.push(shapeTrashGoalItem(r));
      }
    }

    // 3. Trashed Vault Credentials
    if (!targetKind || targetKind === 'vault' || targetKind === 'secret' || targetKind === 'credential' || targetKind === 'credentials') {
      const vaultRes = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of vaultRes.rows) {
        items.push(shapeTrashVaultItem(r));
      }
    }

    // 4. Trashed Events
    if (!targetKind || targetKind === 'event' || targetKind === 'events') {
      const eventRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'events',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of eventRes.rows) {
        items.push(shapeTrashEventItem(r));
      }
    }

    // 5. Trashed Forms
    if (!targetKind || targetKind === 'form' || targetKind === 'forms') {
      const formRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: 'forms',
        queries: [
          Query.equal('userId', actor.userId),
          Query.equal('isDeleted', true),
          Query.orderDesc('$updatedAt'),
          Query.limit(lim),
        ],
      }).catch(() => ({ rows: [] as any[] }));
      for (const r of formRes.rows) {
        items.push(shapeTrashFormItem(r));
      }
    }

    items.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
    return items.slice(0, lim);
  },

  async restoreTrash(actor: ApiActor, body: Record<string, unknown>) {
    if (!actor.scopes.includes('trash:write') && !actor.scopes.includes('notes:write') && !actor.scopes.includes('vault:write')) {
      requireScope(actor, 'trash:write');
    }
    const id = String(body.id || body.resourceId || '').trim();
    if (!id) badRequest('id required');
    const kind = String(body.kind || body.type || 'note').toLowerCase();
    const tables = systemTables();
    const now = new Date().toISOString();

    if (kind === 'vault' || kind === 'secret' || kind === 'credential') {
      await tables.updateRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
        data: { isDeleted: false, updatedAt: now },
      });
      return { id, kind: 'vault', restored: true };
    }

    if (kind === 'note') {
      await tables.updateRow({
        databaseId: DB,
        tableId: NOTES,
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'note', restored: true };
    }

    if (kind === 'goal' || kind === 'task') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: TASKS,
        rowId: id,
        data: { isDeleted: false, isTrash: false, status: 'todo', updatedAt: now },
      });
      return { id, kind: 'goal', restored: true };
    }

    if (kind === 'event') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'events',
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'event', restored: true };
    }

    if (kind === 'form') {
      await tables.updateRow({
        databaseId: FLOW_DB,
        tableId: 'forms',
        rowId: id,
        data: { isDeleted: false, isTrash: false, updatedAt: now },
      });
      return { id, kind: 'form', restored: true };
    }

    badRequest(`Unknown trash kind: ${kind}`);
  },

  async purgeTrash(actor: ApiActor, body: Record<string, unknown>) {
    requireScope(actor, 'trash:write');
    const id = String(body.id || body.resourceId || '').trim();
    if (!id) badRequest('id required');
    const kind = String(body.kind || body.type || 'note').toLowerCase();
    const tables = systemTables();

    if (kind === 'vault' || kind === 'secret' || kind === 'credential') {
      await tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS || 'credentials',
        rowId: id,
      });
      return { id, kind: 'vault', purged: true };
    }

    if (kind === 'note') {
      await tables.deleteRow({ databaseId: DB, tableId: NOTES, rowId: id });
      return { id, kind: 'note', purged: true };
    }

    if (kind === 'goal' || kind === 'task') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: TASKS, rowId: id });
      return { id, kind: 'goal', purged: true };
    }

    if (kind === 'event') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'events', rowId: id });
      return { id, kind: 'event', purged: true };
    }

    if (kind === 'form') {
      await tables.deleteRow({ databaseId: FLOW_DB, tableId: 'forms', rowId: id });
      return { id, kind: 'form', purged: true };
    }

    badRequest(`Unknown trash kind: ${kind}`);
  },

};
