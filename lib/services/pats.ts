import { createHash, randomBytes } from 'crypto';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { normalizeScopes, type PatScope } from '@/lib/api/scopes';

const DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TABLE = 'pats';

export type PatCategory = 'user_pat' | 'agent_provisioning_key' | 'agentic_pat' | 'workspace_pat';

export type PatRow = {
  $id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string;
  status: 'active' | 'revoked';
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  isWorkspace?: string | boolean | null;
  workspaceId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PatPublic = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: PatScope[];
  status: 'active' | 'revoked';
  expiresAt: string | null;
  lastUsedAt: string | null;
  isWorkspace: boolean;
  workspaceId: string | null;
  category: PatCategory;
  agentId: string | null;
  createdAt: string | null;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function makeSecret() {
  return randomBytes(24).toString('base64url');
}

/** Full token format: kyl_<type>_<prefix>_<secret> */
export function formatPatToken(
  prefix: string, 
  secret: string, 
  category: PatCategory = 'user_pat'
) {
  if (category === 'agent_provisioning_key') {
    return `kyl_apk_${prefix}_${secret}`;
  }
  if (category === 'agentic_pat') {
    return `kyl_apat_${prefix}_${secret}`;
  }
  if (category === 'workspace_pat') {
    return `kyl_wpat_${prefix}_${secret}`;
  }
  return `kyl_pat_${prefix}_${secret}`;
}

export function parsePatToken(raw: string): { prefix: string; token: string; category: PatCategory } | null {
  const token = String(raw || '').trim();
  let category: PatCategory = 'user_pat';
  let rest = '';

  if (token.startsWith('kyl_apk_')) {
    category = 'agent_provisioning_key';
    rest = token.slice('kyl_apk_'.length);
  } else if (token.startsWith('kyl_apat_')) {
    category = 'agentic_pat';
    rest = token.slice('kyl_apat_'.length);
  } else if (token.startsWith('kyl_wpat_')) {
    category = 'workspace_pat';
    rest = token.slice('kyl_wpat_'.length);
  } else if (token.startsWith('kyl_pat_')) {
    category = 'user_pat';
    rest = token.slice('kyl_pat_'.length);
  } else if (token.startsWith('pat_')) {
    category = 'user_pat';
    rest = token.slice('pat_'.length);
  } else {
    return null;
  }

  const idx = rest.indexOf('_');
  if (idx < 4) return null;
  const prefix = rest.slice(0, idx);
  if (!prefix || rest.length <= idx + 8) return null;
  return { prefix, token, category };
}

function inferCategory(row: PatRow): { category: PatCategory; agentId: string | null } {
  const isWs = row.isWorkspace === true || String(row.isWorkspace) === 'true';
  if (isWs) return { category: 'workspace_pat', agentId: null };

  const scopes = normalizeScopes(row.scopes);
  const name = row.name || '';
  
  if (name.includes('(Agentic PAT)') || name.toLowerCase().startsWith('agent:') || name.toLowerCase().includes('agentic')) {
    return { category: 'agentic_pat', agentId: row.workspaceId || null };
  }
  if (scopes.length === 1 && scopes.includes('agents:provision')) {
    return { category: 'agent_provisioning_key', agentId: null };
  }
  if (name.toLowerCase().includes('provisioning key') || name.toLowerCase().includes('agent key')) {
    return { category: 'agent_provisioning_key', agentId: null };
  }
  return { category: 'user_pat', agentId: null };
}

function toPublic(row: PatRow): PatPublic {
  const isWs = row.isWorkspace === true || String(row.isWorkspace) === 'true';
  const { category, agentId } = inferCategory(row);
  return {
    id: row.$id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: normalizeScopes(row.scopes),
    status: row.status,
    expiresAt: row.expiresAt || null,
    lastUsedAt: row.lastUsedAt || null,
    isWorkspace: isWs,
    workspaceId: row.workspaceId || null,
    category,
    agentId,
    createdAt: row.createdAt || row.$id ? (row as any).$createdAt || row.createdAt || null : null,
  };
}

const verifiedPatCache = new Map<string, { data: { pat: PatRow; scopes: PatScope[]; userId: string }; ts: number }>();

export const PatService = {
  toPublic,

  invalidateVerificationCache(patId?: string) {
    if (patId) {
      for (const [key, val] of verifiedPatCache.entries()) {
        if (val.data.pat.$id === patId) {
          verifiedPatCache.delete(key);
        }
      }
    } else {
      verifiedPatCache.clear();
    }
  },

  async create(params: {
    userId: string;
    name: string;
    scopes: unknown;
    expiresAt?: string | null;
    isWorkspace?: boolean;
    workspaceId?: string | null;
    keyCategory?: PatCategory;
    agentId?: string | null;
  }): Promise<{ pat: PatPublic; token: string }> {
    const scopes = normalizeScopes(params.scopes);
    if (scopes.length === 0) throw new Error('Select at least one permission');

    const name = String(params.name || '').trim().slice(0, 128);
    if (!name) throw new Error('Name is required');

    let category: PatCategory = params.keyCategory || 'user_pat';
    if (!params.keyCategory) {
      if (params.isWorkspace) category = 'workspace_pat';
      else if (params.agentId || name.includes('(Agentic PAT)')) category = 'agentic_pat';
      else if (scopes.length === 1 && scopes.includes('agents:provision')) category = 'agent_provisioning_key';
    }

    const rowId = ID.unique();
    const tokenPrefix = randomBytes(6).toString('base64url').slice(0, 8);
    const secret = makeSecret();
    const token = formatPatToken(tokenPrefix, secret, category);
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const tables = createSystemTablesDB();

    const isWs = params.isWorkspace === true;

    const row = await tables.createRow({
      databaseId: DB,
      tableId: TABLE,
      rowId,
      data: {
        userId: params.userId,
        name,
        tokenPrefix,
        tokenHash,
        scopes: JSON.stringify(scopes),
        status: 'active',
        expiresAt: params.expiresAt || null,
        lastUsedAt: null,
        isWorkspace: isWs ? 'true' : 'false',
        workspaceId: params.workspaceId || params.agentId || null,
        createdAt: now,
        updatedAt: now,
      },
      permissions: [
        Permission.read(Role.user(params.userId)),
      ],
    });

    // Universal object graph: user → pat
    try {
      await tables.createRow({
        databaseId: DB,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects',
        rowId: ID.unique(),
        data: {
          parentId: isWs && params.workspaceId ? params.workspaceId : params.userId,
          parentKind: isWs ? 'workspace' : 'user',
          childId: row.$id,
          childKind: 'pat',
          userId: params.userId,
          metadata: JSON.stringify({ tokenPrefix: rowId, name, isWorkspace: isWs, workspaceId: params.workspaceId }),
          createdAt: now,
          updatedAt: now,
          isPublic: false,
          isGuest: false,
          isGeneral: false,
        },
        permissions: [
          Permission.read(Role.user(params.userId)),
        ],
      });
    } catch {
      /* non-fatal */
    }

    return { pat: toPublic(row as unknown as PatRow), token };
  },

  async listForUser(
    userId: string, 
    opts?: { 
      isWorkspace?: boolean; 
      workspaceId?: string; 
      category?: PatCategory;
      agentId?: string;
    }
  ): Promise<PatPublic[]> {
    const tables = createSystemTablesDB();
    const queries = [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ];
    const res = await tables.listRows({
      databaseId: DB,
      tableId: TABLE,
      queries,
    });
    const all = (res.rows as unknown as PatRow[]).map(toPublic);
    return all.filter((p) => {
      if (opts?.isWorkspace !== undefined && p.isWorkspace !== opts.isWorkspace) return false;
      if (opts?.workspaceId && p.workspaceId !== opts.workspaceId) return false;
      if (opts?.category && p.category !== opts.category) return false;
      if (opts?.agentId && p.agentId !== opts.agentId && p.workspaceId !== opts.agentId) return false;
      return true;
    });
  },

  async revoke(params: { patId: string; userId: string }) {
    const tables = createSystemTablesDB();
    const row = (await tables.getRow({
      databaseId: DB,
      tableId: TABLE,
      rowId: params.patId,
    }).catch(() => null)) as PatRow | null;
    if (!row) throw new Error('Token not found');
    if (row.userId !== params.userId) throw new Error('Forbidden');
    await tables.updateRow({
      databaseId: DB,
      tableId: TABLE,
      rowId: params.patId,
      data: { status: 'revoked', updatedAt: new Date().toISOString() },
    });
    this.invalidateVerificationCache(params.patId);
    return { success: true };
  },

  /**
   * Replace scopes on a PAT the caller owns.
   * Used by the self-service rescue hatch (PATCH /api/v1/token/scopes).
   */
  async updateScopes(params: {
    patId: string;
    userId: string;
    scopes: unknown;
    mode?: 'replace' | 'grant';
  }): Promise<PatPublic> {
    const tables = createSystemTablesDB();
    const row = (await tables.getRow({
      databaseId: DB,
      tableId: TABLE,
      rowId: params.patId,
    }).catch(() => null)) as PatRow | null;
    if (!row) {
      const err = new Error('Token not found');
      (err as any).status = 404;
      throw err;
    }
    if (row.userId !== params.userId) {
      const err = new Error('Forbidden');
      (err as any).status = 403;
      throw err;
    }
    if (row.status !== 'active') {
      const err = new Error('Token is revoked');
      (err as any).status = 400;
      throw err;
    }

    const incoming = normalizeScopes(params.scopes);
    if (incoming.length === 0) {
      const err = new Error('Select at least one permission');
      (err as any).status = 400;
      throw err;
    }

    const next =
      params.mode === 'grant'
        ? normalizeScopes([...normalizeScopes(row.scopes), ...incoming])
        : incoming;

    const updated = (await tables.updateRow({
      databaseId: DB,
      tableId: TABLE,
      rowId: params.patId,
      data: {
        scopes: JSON.stringify(next),
        updatedAt: new Date().toISOString(),
      },
    })) as unknown as PatRow;

    this.invalidateVerificationCache(params.patId);
    return toPublic(updated);
  },

  async getOwned(params: { patId: string; userId: string }): Promise<PatPublic | null> {
    const tables = createSystemTablesDB();
    const row = (await tables.getRow({
      databaseId: DB,
      tableId: TABLE,
      rowId: params.patId,
    }).catch(() => null)) as PatRow | null;
    if (!row || row.userId !== params.userId) return null;
    return toPublic(row);
  },

  async verifyBearer(rawToken: string): Promise<{
    pat: PatRow;
    scopes: PatScope[];
    userId: string;
  } | null> {
    const parsed = parsePatToken(rawToken);
    if (!parsed) return null;

    const hash = hashToken(parsed.token);

    // 1. Check in-memory verification cache (60s TTL)
    const cached = verifiedPatCache.get(hash);
    if (cached && Date.now() - cached.ts < 1000 * 60) {
      return cached.data;
    }

    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: TABLE,
      queries: [
        Query.equal('tokenPrefix', parsed.prefix),
        Query.equal('status', 'active'),
        Query.limit(1),
      ],
    });
    const row = res.rows[0] as unknown as PatRow | undefined;
    if (!row) return null;

    if (hash !== row.tokenHash) return null;

    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Fire-and-forget lastUsedAt (best effort, throttled)
    const lastUsed = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
    if (Date.now() - lastUsed > 1000 * 60 * 5) {
      void tables
        .updateRow({
          databaseId: DB,
          tableId: TABLE,
          rowId: row.$id,
          data: { lastUsedAt: new Date().toISOString() },
        })
        .catch(() => null);
    }

    const result = {
      pat: row,
      scopes: normalizeScopes(row.scopes),
      userId: row.userId,
    };

    verifiedPatCache.set(hash, { data: result, ts: Date.now() });

    return result;
  },
};
