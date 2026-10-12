/**
 * Sync admin gate for privileged billing operations (server-only).
 * Uses ADMINS env: comma-separated emails (same convention as accounts admin checks).
 */
export function assertEmailIsBillingAdmin(email: string | null | undefined): void {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('Admin authentication required');

  const adminList = String(process.env.ADMINS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminList.includes(normalized)) {
    throw new Error('Forbidden: billing admin only');
  }
}
