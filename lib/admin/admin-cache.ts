/**
 * Account-scoped cache key generators for Admin LocalEngine integration.
 * Guarantees that local engine admin data is strictly partitioned by user account ID.
 */

export function getAdminStatsCacheKey(userId?: string | null): string | null {
  if (!userId) return null;
  return `admin_stats:${userId}`;
}

export function getAdminUsersCacheKey(userId?: string | null, search = ''): string | null {
  if (!userId) return null;
  return `admin_users:${userId}:${search.trim().toLowerCase()}`;
}

export function getAdminVerifiedUsersCacheKey(userId?: string | null, cursorAfter?: string | null): string | null {
  if (!userId) return null;
  return `admin_verified_users:${userId}:${cursorAfter || 'root'}`;
}

export function getAdminCouponsCacheKey(userId?: string | null): string | null {
  if (!userId) return null;
  return `admin_coupons:${userId}`;
}
