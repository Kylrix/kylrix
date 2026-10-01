'use server';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Upserts a note record in Turso.
 */
export async function upsertNoteTurso(data: typeof schema.notes.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.notes.id })
      .from(schema.notes)
      .where(eq(schema.notes.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.notes)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.notes.id, data.id));
    } else {
      await db.insert(schema.notes).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertNoteTurso failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upserts a project / workspace in Turso.
 */
export async function upsertProjectTurso(data: typeof schema.projects.$inferInsert) {
  try {
    const existing = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.projects)
        .set({
          ...data,
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
        .where(eq(schema.projects.id, data.id));
    } else {
      await db.insert(schema.projects).values(data);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[turso-ops] upsertProjectTurso failed:', err);
    return { success: false, error: err.message };
  }
}

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

/**
 * Lists user notes from Turso.
 */
export async function listNotesTurso(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.notes)
      .where(and(eq(schema.notes.userId, userId), eq(schema.notes.isTrashed, false)));
    return { success: true, rows };
  } catch (err: any) {
    console.error('[turso-ops] listNotesTurso failed:', err);
    return { success: false, rows: [], error: err.message };
  }
}
