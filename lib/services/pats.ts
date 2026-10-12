import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, or, desc, count } from 'drizzle-orm';
import { normalizeScopes, type PatScope } from '@/lib/api/scopes';

export type PatCategory = 'user_pat' | 'agent_provisioning_key' | 'agentic_pat' | 'workspace_pat' | 'punch_token';

export type PatRow = {
  $id: string;
  id?: string;
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
  category?: PatCategory;
  agentId?: string | null;
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
  if (category === 'punch_token') {
    return `kyl_punch_${prefix}_${secret}`;
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
  } else if (token.startsWith('kyl_punch_')) {
    category = 'punch_token';
    rest = token.slice('kyl_punch_'.length);
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

function inferCategory(row: any): { category: PatCategory; agentId: string | null } {
  if (row.category) {
    let agentId = null;
    if (row.metadata) {
      try {
        const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        agentId = meta?.agentId || null;
      } catch {}
    }
    return { category: row.category as PatCategory, agentId: agentId || row.workspaceId || null };
  }
  const isWs = row.isWorkspace === true || String(row.isWorkspace) === 'true' || row.isWorkspace === 1;
  if (isWs) return { category: 'workspace_pat', agentId: null };

  const scopes = normalizeScopes(row.scopes || row.permissions);
  const name = row.name || '';
  
  if (name.includes('(Agentic PAT)') || name.toLowerCase().startsWith('agent:') || name.toLowerCase().includes('agentic')) {
    return { category: 'agentic_pat', agentId: row.workspaceId || null };
  }
  if (name.toLowerCase().includes('punch') || name.toLowerCase().includes('pairing') || name.toLowerCase().includes('device code')) {
    return { category: 'punch_token', agentId: null };
  }
  if (scopes.length === 1 && scopes.includes('agents:provision')) {
    return { category: 'agent_provisioning_key', agentId: null };
  }
  if (name.toLowerCase().includes('provisioning key') || name.toLowerCase().includes('agent key')) {
    return { category: 'agent_provisioning_key', agentId: null };
  }
  return { category: 'user_pat', agentId: null };
}

function toPublic(row: any): PatPublic {
  const isWs = row.isWorkspace === true || String(row.isWorkspace) === 'true' || row.isWorkspace === 1;
  const { category, agentId } = inferCategory(row);
  return {
    id: row.id || row.$id,
    name: row.name || '',
    tokenPrefix: row.prefix || row.start || row.tokenPrefix || '',
    scopes: normalizeScopes(row.permissions || row.scopes),
    status: (row.enabled === true || row.enabled === 1 || row.status === 'active') ? 'active' : 'revoked',
    expiresAt: row.expiresAt ? (row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt)) : null,
    lastUsedAt: row.lastUsedAt ? (row.lastUsedAt instanceof Date ? row.lastUsedAt.toISOString() : String(row.lastUsedAt)) : null,
    isWorkspace: isWs,
    workspaceId: row.workspaceId || null,
    category,
    agentId: agentId || row.agentId || null,
    createdAt: row.createdAt ? (row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)) : null,
  };
}

const verifiedPatCache = new Map<string, { data: { pat: PatRow; scopes: PatScope[]; userId: string }; ts: number }>();

export const PatService = {
  toPublic,

  invalidateVerificationCache(patId?: string) {
    if (patId) {
      for (const [key, val] of verifiedPatCache.entries()) {
        if (val.data.pat.$id === patId || (val.data.pat as any).id === patId) {
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

    const id = 'pat_' + randomBytes(12).toString('hex');
    const tokenPrefix = randomBytes(6).toString('base64url').slice(0, 8);
    const secret = makeSecret();
    const token = formatPatToken(tokenPrefix, secret, category);
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = params.expiresAt ? new Date(params.expiresAt) : null;

    // Enforce active PAT ceiling to prevent unbounded database rows
    const existingActive = await db
      .select({ count: count() })
      .from(schema.apikey)
      .where(and(eq(schema.apikey.userId, params.userId), eq(schema.apikey.enabled, true)));

    const MAX_ACTIVE_PATS = 25;
    if ((existingActive[0]?.count ?? 0) >= MAX_ACTIVE_PATS) {
      throw new Error(`Active access token limit reached (maximum ${MAX_ACTIVE_PATS} active tokens). Please revoke unused tokens.`);
    }

    const isWs = params.isWorkspace === true;

    await db.insert(schema.apikey).values({
      id,
      name,
      start: tokenPrefix,
      prefix: tokenPrefix,
      key: tokenHash,
      userId: params.userId,
      enabled: true,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      permissions: JSON.stringify(scopes),
      metadata: JSON.stringify({ agentId: params.agentId || null }),
      category,
      workspaceId: params.workspaceId || params.agentId || null,
      isWorkspace: isWs,
    });

    if (isWs && params.workspaceId) {
      try {
        await db.insert(schema.workspaceObjects).values({
          id: 'wo_' + randomBytes(10).toString('hex'),
          workspaceId: params.workspaceId,
          entityKind: 'pat',
          entityId: id,
          userId: params.userId,
          createdAt: now.toISOString(),
        });
      } catch {
        /* non-fatal */
      }
    }

    const publicPat: PatPublic = {
      id,
      name,
      tokenPrefix,
      scopes,
      status: 'active',
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      lastUsedAt: null,
      isWorkspace: isWs,
      workspaceId: params.workspaceId || params.agentId || null,
      category,
      agentId: params.agentId || null,
      createdAt: now.toISOString(),
    };

    return { pat: publicPat, token };
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
    const rows = await db
      .select()
      .from(schema.apikey)
      .where(eq(schema.apikey.userId, userId))
      .orderBy(desc(schema.apikey.createdAt))
      .limit(100);

    const all = rows.map(toPublic);
    return all.filter((p) => {
      if (opts?.isWorkspace !== undefined && p.isWorkspace !== opts.isWorkspace) return false;
      if (opts?.workspaceId && p.workspaceId !== opts.workspaceId) return false;
      if (opts?.category && p.category !== opts.category) return false;
      if (opts?.agentId && p.agentId !== opts.agentId && p.workspaceId !== opts.agentId) return false;
      return true;
    });
  },

  async revoke(params: { patId: string; userId: string }) {
    const rows = await db
      .select()
      .from(schema.apikey)
      .where(eq(schema.apikey.id, params.patId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error('Token not found');
    if (row.userId !== params.userId) throw new Error('Forbidden');

    await db
      .update(schema.apikey)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(schema.apikey.id, params.patId));

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
    const rows = await db
      .select()
      .from(schema.apikey)
      .where(eq(schema.apikey.id, params.patId))
      .limit(1);
    const row = rows[0];
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
    if (!row.enabled) {
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

    const currentScopes = normalizeScopes(row.permissions);
    const next =
      params.mode === 'grant'
        ? normalizeScopes([...currentScopes, ...incoming])
        : incoming;

    const now = new Date();
    await db
      .update(schema.apikey)
      .set({
        permissions: JSON.stringify(next),
        updatedAt: now,
      })
      .where(eq(schema.apikey.id, params.patId));

    this.invalidateVerificationCache(params.patId);
    return toPublic({
      ...row,
      permissions: JSON.stringify(next),
      updatedAt: now,
    });
  },

  async getOwned(params: { patId: string; userId: string }): Promise<PatPublic | null> {
    const rows = await db
      .select()
      .from(schema.apikey)
      .where(and(eq(schema.apikey.id, params.patId), eq(schema.apikey.userId, params.userId)))
      .limit(1);
    if (!rows[0]) return null;
    return toPublic(rows[0]);
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

    // 2. Query Turso by prefix and enabled
    const rows = await db
      .select()
      .from(schema.apikey)
      .where(
        and(
          or(eq(schema.apikey.prefix, parsed.prefix), eq(schema.apikey.start, parsed.prefix)),
          eq(schema.apikey.enabled, true)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    if (hash !== row.key) return null;

    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return null;
    }

    // Fire-and-forget lastUsedAt (best effort, throttled)
    const lastUsed = row.lastUsedAt ? row.lastUsedAt.getTime() : 0;
    if (Date.now() - lastUsed > 1000 * 60 * 5) {
      void db
        .update(schema.apikey)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.apikey.id, row.id))
        .catch(() => null);
    }

    let agentId: string | null = null;
    if (row.metadata) {
      try {
        const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        agentId = meta?.agentId || null;
      } catch {}
    }

    const patRow: PatRow = {
      $id: row.id,
      id: row.id,
      userId: row.userId,
      name: row.name || '',
      tokenPrefix: row.prefix || row.start || parsed.prefix,
      tokenHash: row.key,
      scopes: row.permissions || '[]',
      status: row.enabled ? 'active' : 'revoked',
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      isWorkspace: Boolean(row.isWorkspace),
      workspaceId: row.workspaceId || null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      category: (row.category as PatCategory) || 'user_pat',
      agentId: agentId || row.workspaceId || null,
    };

    const result = {
      pat: patRow,
      scopes: normalizeScopes(row.permissions),
      userId: row.userId,
    };

    verifiedPatCache.set(hash, { data: result, ts: Date.now() });

    return result;
  },
};
