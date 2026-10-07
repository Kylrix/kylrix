'use server';

import { Query } from 'node-appwrite';
import { getActor } from '@/lib/actions/secure-ops';
import { getAdminStats, listAdminUsers, requireAdmin } from '@/lib/services/internal/admin';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

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
  const { users } = createAdminClient(user.email);
  const targetUser = await users.get(userId);
  return {
    id: targetUser.$id,
    name: targetUser.name,
    email: targetUser.email};
}

/**
 * Search a user by their Appwrite userId.
 * 1. First tries the profiles table to resolve username/displayName.
 * 2. Falls back to Appwrite Users API to get account name and email.
 */
export async function searchAdminUserByIdAction(userId: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  // 1. Try Appwrite if configured
  try {
    if (process.env.APPWRITE_API) {
      const { users, databases } = createAdminClient(user.email);
      let username: string | undefined;
      let displayName: string | undefined;
      try {
        const profilesDb = APPWRITE_CONFIG.DATABASES.CONNECT;
        const profilesTable = APPWRITE_CONFIG.TABLES.CONNECT.PROFILES;
        const res = await databases.listDocuments(profilesDb, profilesTable, [
          Query.equal('userId', userId),
          Query.limit(1),
        ]);
        if (res.documents.length > 0) {
          const p = res.documents[0] as any;
          username = p.username;
          displayName = p.displayName;
        }
      } catch {}

      const targetUser = await users.get(userId);
      return {
        id: targetUser.$id,
        name: targetUser.name,
        email: targetUser.email,
        username,
        displayName,
      };
    }
  } catch (err: any) {
    console.warn('[searchAdminUserByIdAction] Appwrite search warning, falling back to Turso:', err.message);
  }

  // 2. Fallback to Turso / SQLite
  try {
    const { db } = await import('@/lib/db');
    const { user: userTable, profiles: profilesTable } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const foundUsers = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    if (!foundUsers.length) throw new Error('User not found');
    const u = foundUsers[0];

    let username: string | undefined;
    let displayName: string | undefined;
    try {
      const p = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
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
  } catch (err: any) {
    throw new Error(err.message || 'User not found');
  }
}

/**
 * Search a user by their email address.
 * 1. Queries Appwrite Users API directly.
 * 2. Tries to resolve the username from the profiles table using the found userId.
 */
export async function searchAdminUserByEmailAction(email: string, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const cleanEmail = email.trim().toLowerCase();

  // 1. Try Appwrite if configured
  try {
    if (process.env.APPWRITE_API) {
      const { users, databases } = createAdminClient(user.email);
      const results = await users.list([Query.equal('email', cleanEmail), Query.limit(1)]);
      if (results.users.length > 0) {
        const targetUser = results.users[0];
        let username: string | undefined;
        let displayName: string | undefined;
        try {
          const profilesDb = APPWRITE_CONFIG.DATABASES.CONNECT;
          const profilesTable = APPWRITE_CONFIG.TABLES.CONNECT.PROFILES;
          const res = await databases.listDocuments(profilesDb, profilesTable, [
            Query.equal('userId', targetUser.$id),
            Query.limit(1),
          ]);
          if (res.documents.length > 0) {
            const p = res.documents[0] as any;
            username = p.username;
            displayName = p.displayName;
          }
        } catch {}

        return {
          id: targetUser.$id,
          name: targetUser.name,
          email: targetUser.email,
          username,
          displayName,
        };
      }
    }
  } catch (err: any) {
    console.warn('[searchAdminUserByEmailAction] Appwrite search warning, falling back to Turso:', err.message);
  }

  // 2. Fallback to Turso / SQLite
  try {
    const { db } = await import('@/lib/db');
    const { user: userTable, profiles: profilesTable } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const foundUsers = await db.select().from(userTable).where(eq(userTable.email, cleanEmail)).limit(1);
    if (!foundUsers.length) return null;
    const u = foundUsers[0];

    let username: string | undefined;
    let displayName: string | undefined;
    try {
      const p = await db.select().from(profilesTable).where(eq(profilesTable.userId, u.id)).limit(1);
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
  } catch (err: any) {
    console.warn('[searchAdminUserByEmailAction] Turso fallback warning:', err.message);
    return null;
  }
}

/**
 * Searches profiles across Appwrite with fallback to Turso profiles & users table.
 */
export async function searchGlobalProfilesAction(query: string, limit = 8, jwt?: string) {
  const user = await getActor(jwt);
  if (!user) throw new Error('Unauthorized');
  requireAdmin(user);

  const cleanQuery = query.trim().replace(/^@/, '');
  if (!cleanQuery) return [];

  // 1. Try Appwrite if configured
  try {
    if (process.env.APPWRITE_API) {
      const { AppwriteService } = await import('@/lib/appwrite');
      const docs = await AppwriteService.searchGlobalProfiles(cleanQuery, limit);
      if (docs && docs.length > 0) return docs;
    }
  } catch (err: any) {
    console.warn('[searchGlobalProfilesAction] Appwrite search warning, falling back to Turso:', err.message);
  }

  // 2. Fallback to Turso / SQLite
  try {
    const { db } = await import('@/lib/db');
    const { user: userTable, profiles: profilesTable } = await import('@/lib/db/schema');
    const { like, or } = await import('drizzle-orm');

    const searchPattern = `%${cleanQuery.toLowerCase()}%`;
    const foundProfiles = await db
      .select()
      .from(profilesTable)
      .where(or(like(profilesTable.username, searchPattern), like(profilesTable.displayName, searchPattern)))
      .limit(limit);

    if (foundProfiles.length > 0) {
      return foundProfiles.map((p) => ({
        $id: p.id,
        userId: p.userId,
        username: p.username,
        displayName: p.displayName,
      }));
    }

    // Fall back to searching users table
    const foundUsers = await db
      .select()
      .from(userTable)
      .where(or(like(userTable.name, searchPattern), like(userTable.email, searchPattern)))
      .limit(limit);

    return foundUsers.map((u) => ({
      $id: u.id,
      userId: u.id,
      username: u.name?.toLowerCase().replace(/\s+/g, '') || u.email.split('@')[0],
      displayName: u.name || 'User',
      email: u.email,
    }));
  } catch (err: any) {
    console.warn('[searchGlobalProfilesAction] Turso fallback warning:', err.message);
    return [];
  }
}

