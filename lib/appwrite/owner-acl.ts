import { Permission, Role } from 'appwrite';

/**
 * Owner row ACL: read + update + delete for the owner.
 * Collaborators stay read-only at the ACL layer; cross-owner writes still use secure-ops.
 * Public discovery adds read(any) only — never write(any).
 */
export function ownerRowPermissions(
  ownerId: string,
  opts?: { isPublic?: boolean; extraReadUserIds?: string[] },
): string[] {
  const uid = String(ownerId || '').trim();
  if (!uid) return [];

  const permissions = [
    Permission.read(Role.user(uid)),
    Permission.update(Role.user(uid)),
    Permission.delete(Role.user(uid)),
  ];

  for (const extra of opts?.extraReadUserIds || []) {
    const id = String(extra || '').trim();
    if (id && id !== uid) permissions.push(Permission.read(Role.user(id)));
  }

  if (opts?.isPublic) {
    permissions.push(Permission.read(Role.any()));
  }

  return permissions;
}

/** True when local payload proves the signed-in user is the sole owner (no secure-ops needed for mutate). */
export function isSoleOwnerActor(
  actorId: string | null | undefined,
  row: Record<string, unknown> | null | undefined,
): boolean {
  const uid = String(actorId || '').trim();
  if (!uid || uid === 'guest') return false;
  if (!row || typeof row !== 'object') return false;

  const owner = String(
    row.userId || row.creatorId || row.ownerId || '',
  ).trim();
  if (!owner || owner === 'guest' || owner === 'thread') return false;
  return owner === uid;
}
