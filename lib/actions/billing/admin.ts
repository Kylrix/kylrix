'use server';

import { getActor } from '@/lib/actions/secure-ops';
import { getAdminStats, listAdminUsers, requireAdmin } from '@/lib/services/internal/admin';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, like, or } from 'drizzle-orm';

export async function getAdminStatsAction(jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  return getAdminStats(user.email);
}

export async function getAdminUsersAction(params: {
  search?: string;
  verifiedOnly?: boolean;
  limit?: number;
  cursorAfter?: string | null;
}, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  return listAdminUsers(params, user.email);
}

export async function getAdminUserByIdAction(userId: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  const rows = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (rows.length === 0) throw new Error('User not found');
  const targetUser = rows[0];
  return {
    id: targetUser.id,
    name: targetUser.name || 'User',
    email: targetUser.email,
  };
}

export async function searchAdminUserByIdAction(userId: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const foundUsers = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!foundUsers.length) throw new Error('User not found');
  const u = foundUsers[0];

  let username: string | undefined;
  let displayName: string | undefined;
  try {
    const p = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
    if (p.length > 0) {
      username = p[0].username || undefined;
      displayName = p[0].displayName || undefined;
    }
  } catch {}

  return {
    id: u.id,
    name: u.name || 'User',
    email: u.email,
    username,
    displayName,
  };
}

export async function searchAdminUserByEmailAction(email: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const cleanEmail = email.trim().toLowerCase();
  const foundUsers = await db.select().from(schema.user).where(eq(schema.user.email, cleanEmail)).limit(1);
  if (!foundUsers.length) return null;
  const u = foundUsers[0];

  let username: string | undefined;
  let displayName: string | undefined;
  try {
    const p = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id)).limit(1);
    if (p.length > 0) {
      username = p[0].username || undefined;
      displayName = p[0].displayName || undefined;
    }
  } catch {}

  return {
    id: u.id,
    name: u.name || 'User',
    email: u.email,
    username,
    displayName,
  };
}

export async function searchGlobalProfilesAction(query: string, limit = 8, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const cleanQuery = query.trim().replace(/^@/, '');
  if (!cleanQuery) return [];

  const searchPattern = `%${cleanQuery.toLowerCase()}%`;
  const foundProfiles = await db
    .select()
    .from(schema.profiles)
    .where(or(like(schema.profiles.username, searchPattern), like(schema.profiles.displayName, searchPattern)))
    .limit(limit);

  if (foundProfiles.length > 0) {
    return foundProfiles.map((p) => ({
      $id: p.id,
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
    }));
  }

  const foundUsers = await db
    .select()
    .from(schema.user)
    .where(or(like(schema.user.name, searchPattern), like(schema.user.email, searchPattern)))
    .limit(limit);

  return foundUsers.map((u) => ({
    $id: u.id,
    userId: u.id,
    username: u.name?.toLowerCase().replace(/\s+/g, '') || u.email.split('@')[0],
    displayName: u.name || 'User',
    email: u.email,
  }));
}
