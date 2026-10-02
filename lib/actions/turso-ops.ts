'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '@/lib/utils/id';
import { randomBytes, createHash } from 'crypto';

/**
 * Upserts an idea record in Turso.
 */
export async function upsertIdeaTurso(data: typeof schema.ideas.$inferInsert) {
  try {
    const id = data.id || generateId();
    const payload = { ...data, id };
    const existing = await db
      .select({ id: schema.ideas.id })
      .from(schema.ideas)
      .where(eq(schema.ideas.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.ideas)
        .set({
          ...payload,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.ideas.id, id));
    } else {
      await db.insert(schema.ideas).values(payload);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertIdeaTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lists user ideas from Turso.
 */
export async function listIdeasTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.ideas)
      .where(and(eq(schema.ideas.userId, userId), eq(schema.ideas.isTrashed, false)))
      .orderBy(desc(schema.ideas.createdAt));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listIdeasTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Upserts a goal record in Turso.
 */
export async function upsertGoalTurso(data: typeof schema.goals.$inferInsert) {
  try {
    const id = data.id || generateId();
    const payload = { ...data, id };
    const existing = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.goals)
        .set({
          ...payload,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.goals.id, id));
    } else {
      await db.insert(schema.goals).values(payload);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lists user goals from Turso.
 */
export async function listGoalsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId))
      .orderBy(desc(schema.goals.createdAt));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listGoalsTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Upserts a workspace in Turso.
 */
export async function upsertWorkspaceTurso(data: typeof schema.workspaces.$inferInsert) {
  try {
    const id = data.id || generateId();
    const payload = { ...data, id };
    const existing = await db
      .select({ id: schema.workspaces.id })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.workspaces)
        .set({
          ...payload,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.workspaces.id, id));
    } else {
      await db.insert(schema.workspaces).values(payload);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertWorkspaceTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lists user workspaces from Turso.
 */
export async function listWorkspacesTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.creatorId, userId))
      .orderBy(desc(schema.workspaces.createdAt));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listWorkspacesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Creates an authenticated CLI / Agent session in Turso.
 * Bridges CLI tokens seamlessly into the session list.
 */
export async function createCliSessionTurso(params: {
  userId: string;
  clientName?: string;
  workspaceId?: string;
  scopes?: string[];
  expiresInDays?: number;
}) {
  try {
    const sessionId = generateId();
    const token = `kyl_sess_${randomBytes(24).toString('base64url')}`;
    const expiresDays = params.expiresInDays || 30;
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    await db.insert(schema.session).values({
      id: sessionId,
      userId: params.userId,
      token,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      tokenType: 'cli',
      clientName: params.clientName || 'Kylrix CLI',
      workspaceId: params.workspaceId || null,
      scopes: params.scopes ? JSON.stringify(params.scopes) : null,
      lastActiveAt: now,
    });

    return {
      success: true,
      sessionId,
      token,
      expiresAt,
    };
  } catch (err: any) {
    console.error('[turso-ops] createCliSessionTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lists all active authenticated sessions for a user, including:
 * 1. Web browser sessions
 * 2. CLI client sessions
 * 3. API keys marked with displayInSessions: true (e.g. CLI worker tokens)
 */
export async function listUserSessionsTurso(userId: string) {
  try {
    const sessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, userId))
      .orderBy(desc(schema.session.createdAt));

    const mirroredApiKeys = await db
      .select()
      .from(schema.apikey)
      .where(and(eq(schema.apikey.userId, userId), eq(schema.apikey.displayInSessions, true)))
      .orderBy(desc(schema.apikey.createdAt));

    const formattedApiKeySessions = mirroredApiKeys.map((key) => ({
      id: key.id,
      token: key.start ? `${key.start}...` : 'kyl_pat_...',
      tokenType: 'cli' as const,
      clientName: key.clientName || key.name || 'CLI Token',
      workspaceId: key.workspaceId,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      lastActiveAt: key.lastUsedAt || key.lastRequest,
      ipAddress: null,
      userAgent: key.name || 'Kylrix CLI',
      isApiKey: true,
    }));

    return {
      success: true,
      sessions: [...sessions, ...formattedApiKeySessions],
    };
  } catch (err: any) {
    console.error('[turso-ops] listUserSessionsTurso failed:', err);
    return { success: false, sessions: [], error: err.message };
  }
}

/**
 * Creates an API key / PAT in Turso with categories, workspace containment,
 * rate limiting, and optional session mirroring.
 */
export async function createApiKeyTurso(params: {
  userId: string;
  name: string;
  category?: 'user_pat' | 'cli_token' | 'agentic_pat' | 'workspace_pat' | 'punch_token';
  workspaceId?: string;
  scopes?: string[];
  displayInSessions?: boolean;
  clientName?: string;
  expiresInDays?: number;
}) {
  try {
    const id = generateId();
    const prefix = randomBytes(4).toString('base64url');
    const secret = randomBytes(24).toString('base64url');
    const category = params.category || 'user_pat';
    const token = `kyl_${category === 'cli_token' ? 'cli' : category === 'workspace_pat' ? 'wpat' : 'pat'}_${prefix}_${secret}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(schema.apikey).values({
      id,
      name: params.name,
      start: token.slice(0, 16),
      prefix,
      key: tokenHash,
      userId: params.userId,
      category,
      workspaceId: params.workspaceId || null,
      isWorkspace: Boolean(params.workspaceId),
      displayInSessions: Boolean(params.displayInSessions || category === 'cli_token'),
      clientName: params.clientName || params.name,
      permissions: params.scopes ? JSON.stringify(params.scopes) : null,
      createdAt: now,
      updatedAt: now,
      enabled: true,
      expiresAt,
    });

    return {
      success: true,
      id,
      token,
      name: params.name,
      category,
      expiresAt,
    };
  } catch (err: any) {
    console.error('[turso-ops] createApiKeyTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a zero-knowledge keychain entry into Turso.
 */
export async function upsertKeychainTurso(data: typeof schema.keychain.$inferInsert) {
  try {
    const id = data.id || generateId();
    const payload = { ...data, id };
    const existing = await db
      .select({ id: schema.keychain.id })
      .from(schema.keychain)
      .where(eq(schema.keychain.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.keychain)
        .set({
          ...payload,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.keychain.id, id));
    } else {
      await db.insert(schema.keychain).values(payload);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertKeychainTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a zero-knowledge vault item into Turso.
 */
export async function upsertVaultItemTurso(data: typeof schema.vaultItems.$inferInsert) {
  try {
    const id = data.id || generateId();
    const payload = { ...data, id };
    const existing = await db
      .select({ id: schema.vaultItems.id })
      .from(schema.vaultItems)
      .where(eq(schema.vaultItems.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.vaultItems)
        .set({
          ...payload,
          updatedAt: payload.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.vaultItems.id, id));
    } else {
      await db.insert(schema.vaultItems).values(payload);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}
