'use server';

import { getActor } from '@/lib/actions/secure-ops';
import { getAdminStats, listAdminUsers, requireAdmin } from '@/lib/services/internal/admin';

export async function getAdminStatsAction() {
  const user = await getActor();
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
}) {
  const user = await getActor();
  if (!user) {
    throw new Error('Unauthorized');
  }
  requireAdmin(user);
  return listAdminUsers(params, user.email);
}
