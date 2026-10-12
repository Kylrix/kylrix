import { describe, it, expect } from 'vitest';
import {
  getAdminStatsCacheKey,
  getAdminUsersCacheKey,
  getAdminVerifiedUsersCacheKey,
  getAdminCouponsCacheKey,
} from '@/lib/admin/admin-cache';

describe('Admin LocalEngine Account-Scoped Caching Keys', () => {
  it('should return null when user ID is missing or empty', () => {
    expect(getAdminStatsCacheKey(null)).toBeNull();
    expect(getAdminStatsCacheKey(undefined)).toBeNull();
    expect(getAdminStatsCacheKey('')).toBeNull();

    expect(getAdminUsersCacheKey(null, 'test')).toBeNull();
    expect(getAdminVerifiedUsersCacheKey(undefined, 'cursor1')).toBeNull();
    expect(getAdminCouponsCacheKey(null)).toBeNull();
  });

  it('should generate account-scoped stats cache key correctly', () => {
    const userAKey = getAdminStatsCacheKey('user_admin_123');
    const userBKey = getAdminStatsCacheKey('user_admin_456');

    expect(userAKey).toBe('admin_stats:user_admin_123');
    expect(userBKey).toBe('admin_stats:user_admin_456');
    expect(userAKey).not.toBe(userBKey);
  });

  it('should generate account-scoped users search cache key correctly', () => {
    const keyA = getAdminUsersCacheKey('user_123', '  John Doe ');
    const keyB = getAdminUsersCacheKey('user_456', 'John Doe');

    expect(keyA).toBe('admin_users:user_123:john doe');
    expect(keyB).toBe('admin_users:user_456:john doe');
    expect(keyA).not.toBe(keyB);
  });

  it('should generate account-scoped verified users cache key correctly', () => {
    const keyDefault = getAdminVerifiedUsersCacheKey('user_123', null);
    const keyWithCursor = getAdminVerifiedUsersCacheKey('user_123', 'cursor_abc');

    expect(keyDefault).toBe('admin_verified_users:user_123:root');
    expect(keyWithCursor).toBe('admin_verified_users:user_123:cursor_abc');
  });

  it('should generate account-scoped coupons cache key correctly', () => {
    const keyA = getAdminCouponsCacheKey('user_123');
    const keyB = getAdminCouponsCacheKey('user_456');

    expect(keyA).toBe('admin_coupons:user_123');
    expect(keyB).toBe('admin_coupons:user_456');
    expect(keyA).not.toBe(keyB);
  });
});
