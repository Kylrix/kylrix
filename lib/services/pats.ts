import { createHash, randomBytes } from 'crypto';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { normalizeScopes, type PatScope } from '@/lib/api/scopes';

const DB = APPWRITE_CONFIG.DATABASES.FLOW;
const TABLE = 'pats';

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
  createdAt: string | null;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function makeSecret() {
  return randomBytes(24).toString('base64url');
}

/** Full token shown once: kyl_pat_<appwriteUniqueId>_<secret> */
export function formatPatToken(prefix: string, secret: string) {
  return `kyl_pat_${prefix}_${secret}`;
}

export function parsePatToken(raw: string): { prefix: string; token: string } | null {
  const token = String(raw || '').trim();
  if (!token.startsWith('kyl_pat_')) return null;
  const rest = token.slice('kyl_pat_'.length);
  const idx = rest.indexOf('_');
  if (idx < 4) return null;
  const prefix = rest.slice(0, idx);
  if (!prefix || rest.length <= idx + 8) return null;
  return { prefix, token };
}

function toPublic(row: PatRow): PatPublic {
  return {
    id: row.$id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: normalizeScopes(row.scopes),
    status: row.status,
    expiresAt: row.expiresAt || null,
    lastUsedAt: row.lastUsedAt || null,
    createdAt: row.createdAt || row.$id ? (row as any).$createdAt || row.createdAt || null : null,
  };
}

export const PatService = {
  toPublic,

  async create(params: {
    userId: string;
    name: string;
    scopes: unknown;
    expiresAt?: string | null;
  }): Promise<{ pat: PatPublic; token: string }> {
    const scopes = normalizeScopes(params.scopes);
    if (scopes.length === 0) throw new Error('Select at least one permission');

    const name = String(params.name || '').trim().slice(0, 128);
    if (!name) throw new Error('Name is required');

    const rowId = ID.unique();
    const secret = makeSecret();
    const token = formatPatToken(rowId, secret);
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const tables = createSystemTablesDB();

    const row = await tables.createRow({
      databaseId: DB,
      tableId: TABLE,
      rowId,
      data: {
        userId: params.userId,
        name,
        tokenPrefix: rowId,
        tokenHash,
        scopes: JSON.stringify(scopes),
        status: 'active',
        expiresAt: params.expiresAt || null,
        lastUsedAt: null,
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
          parentId: params.userId,
          parentKind: 'user',
          childId: row.$id,
          childKind: 'pat',
          userId: params.userId,
          metadata: JSON.stringify({ tokenPrefix: rowId, name }),
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

  async listForUser(userId: string): Promise<PatPublic[]> {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: DB,
      tableId: TABLE,
      queries: [
        Query.equal('userId', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ],
    });
    return (res.rows as unknown as PatRow[]).map(toPublic);
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

    const hash = hashToken(parsed.token);
    if (hash !== row.tokenHash) return null;

    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Fire-and-forget lastUsedAt (best effort)
    void tables
      .updateRow({
        databaseId: DB,
        tableId: TABLE,
        rowId: row.$id,
        data: { lastUsedAt: new Date().toISOString() },
      })
      .catch(() => null);

    return {
      pat: row,
      scopes: normalizeScopes(row.scopes),
      userId: row.userId,
    };
  },
};
