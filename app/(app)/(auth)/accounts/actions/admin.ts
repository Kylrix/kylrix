'use server';

import { headers } from 'next/headers';
import { NextRequest } from 'next/server';
import { verifyUser } from '@/lib/api/permission-updater';
import { getAdminStats, listAdminUsers, requireAdmin } from '@/lib/services/internal/admin';

async function getRequestLike() {
  const h = await headers();
  const cookie = h.get('cookie') || '';
  const authorization = h.get('authorization') || '';
  return new NextRequest('http://localhost/internal', {
    headers: {
      cookie,
      authorization,
    },
  });
}

export async function getAdminStatsAction() {
  const req = await getRequestLike();
  const user = await verifyUser(req);
  requireAdmin(user);
  return getAdminStats();
}

export async function getAdminUsersAction(params: {
  search?: string;
  verifiedOnly?: boolean;
  limit?: number;
  cursorAfter?: string | null;
}) {
  const req = await getRequestLike();
  const user = await verifyUser(req);
  requireAdmin(user);
  return listAdminUsers(params);
}
