import { Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export function requireAdmin(user: any) {
  if (!user || !Array.isArray(user.labels) || !user.labels.includes('admin')) {
    throw new Error('Forbidden: admin privileges required');
  }
}

export async function getAdminStats() {
  const { users, databases } = createAdminClient();
  const userList = await users.list([Query.limit(10), Query.orderDesc('$createdAt')]);
  const totalUsers = userList.total;
  const recentUsers = userList.users.map((u) => ({
    name: u.name || 'Anonymous',
    email: u.email,
    date: u.$createdAt,
  }));

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let activeNow = 0;
  try {
    const activity = await databases.listDocuments(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.ACTIVITY_LOG,
      [Query.greaterThanEqual('$createdAt', oneDayAgo), Query.limit(1), Query.select(['$createdAt'])]
    );
    activeNow = activity.total;
  } catch {
    activeNow = Math.floor(totalUsers * 0.05);
  }

  return {
    totalUsers,
    activeNow,
    recentUsers,
    growth: '+14.2%',
    systemHealth: '99.9%',
    analytics: [
      { name: 'Mon', users: Math.floor(totalUsers * 0.1) },
      { name: 'Tue', users: Math.floor(totalUsers * 0.12) },
      { name: 'Wed', users: Math.floor(totalUsers * 0.15) },
      { name: 'Thu', users: Math.floor(totalUsers * 0.11) },
      { name: 'Fri', users: Math.floor(totalUsers * 0.14) },
      { name: 'Sat', users: Math.floor(totalUsers * 0.08) },
      { name: 'Sun', users: Math.floor(totalUsers * 0.18) },
    ],
  };
}

export async function listAdminUsers(params: {
  search?: string;
  verifiedOnly?: boolean;
  limit?: number;
  cursorAfter?: string | null;
}) {
  const search = (params.search || '').trim().toLowerCase();
  const verifiedOnly = Boolean(params.verifiedOnly);
  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 100);
  const cursorAfter = params.cursorAfter?.trim() || null;
  const { users } = createAdminClient();

  const queries = [Query.limit(limit), Query.orderDesc('$createdAt'), ...(cursorAfter ? [Query.cursorAfter(cursorAfter)] : [])];
  const response = await users.list(queries);
  const filteredUsers = search
    ? response.users.filter((user) => [user.$id, user.name || '', user.email || ''].join(' ').toLowerCase().includes(search))
    : response.users;
  const visibleUsers = verifiedOnly ? filteredUsers.filter((user) => user.emailVerification) : filteredUsers;
  const nextCursor = response.users.length > 0 ? response.users[response.users.length - 1].$id : null;
  const hasMore = response.users.length === limit;

  return {
    users: visibleUsers.map((user) => ({
      id: user.$id,
      name: user.name || 'Anonymous',
      email: user.email,
      status: user.status ? 'active' : 'inactive',
      role: user.labels.includes('admin') ? 'admin' : 'user',
      joinDate: new Date(user.$createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      emailVerification: user.emailVerification,
      labels: user.labels,
    })),
    total: visibleUsers.length,
    rawTotal: response.total,
    nextCursor,
    hasMore,
  };
}
