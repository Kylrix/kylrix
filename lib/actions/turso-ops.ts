'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Upserts an idea record in Turso.
 */
export async function upsertIdeaTurso(data: typeof schema.ideas.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.ideas.id })
      .from(schema.ideas)
      .where(eq(schema.ideas.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.ideas)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.ideas.id, data.id));
    } else {
      await db.insert(schema.ideas).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertIdeaTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/** Legacy alias for ideas */
export const upsertNoteTurso = upsertIdeaTurso;

/**
 * Lists user ideas from Turso.
 */
export async function listIdeasTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.ideas)
      .where(and(eq(schema.ideas.userId, userId), eq(schema.ideas.isTrashed, false)));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listIdeasTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/** Legacy alias for listIdeasTurso */
export const listNotesTurso = listIdeasTurso;

/**
 * Upserts a goal record in Turso.
 */
export async function upsertGoalTurso(data: typeof schema.goals.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.goals.id })
      .from(schema.goals)
      .where(eq(schema.goals.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.goals)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.goals.id, data.id));
    } else {
      await db.insert(schema.goals).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertGoalTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/** Legacy alias for goals */
export const upsertTaskTurso = upsertGoalTurso;

/**
 * Lists user goals from Turso.
 */
export async function listGoalsTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.userId, userId));
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
    const existing = await db
      .select({ id: schema.workspaces.id })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.workspaces)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.workspaces.id, data.id));
    } else {
      await db.insert(schema.workspaces).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertWorkspaceTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/** Legacy alias for workspaces */
export const upsertProjectTurso = upsertWorkspaceTurso;

/**
 * Upserts a zero-knowledge keychain entry into Turso.
 */
export async function upsertKeychainTurso(data: typeof schema.keychain.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.keychain.id })
      .from(schema.keychain)
      .where(eq(schema.keychain.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.keychain)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.keychain.id, data.id));
    } else {
      await db.insert(schema.keychain).values(data);
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
    const existing = await db
      .select({ id: schema.vaultItems.id })
      .from(schema.vaultItems)
      .where(eq(schema.vaultItems.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.vaultItems)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.vaultItems.id, data.id));
    } else {
      await db.insert(schema.vaultItems).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertVaultItemTurso failed:', err);
    return { success: false, error: err.message };
  }
}
