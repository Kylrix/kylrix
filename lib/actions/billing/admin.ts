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

  const { users, databases } = createAdminClient(user.email);

  // 1. Try profiles table first
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
  } catch {
    // profiles table miss – not fatal
  }

  // 2. Always resolve account details from Appwrite Users API
  const targetUser = await users.get(userId);
  return {
    id: targetUser.$id,
    name: targetUser.name,
    email: targetUser.email,
    username,
    displayName};
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

  const { users, databases } = createAdminClient(user.email);

  // 1. Search accounts by email
  const results = await users.list([Query.equal('email', email.trim().toLowerCase()), Query.limit(1)]);
  if (!results.users.length) return null;

  const targetUser = results.users[0];

  // 2. Try profiles table for username/displayName
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
  } catch {
    // profiles table miss – not fatal
  }

  return {
    id: targetUser.$id,
    name: targetUser.name,
    email: targetUser.email,
    username,
    displayName};
}
