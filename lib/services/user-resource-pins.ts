'use client';

import { ID, Permission, Query, Role } from 'appwrite';
import { databases } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export type PinnableResourceType =
  | 'note'
  | 'credential'
  | 'totp'
  | 'task'
  | 'calendar'
  | 'event'
  | 'form'
  | 'project'
  | 'conversation'
  | 'message';

export interface UserResourcePinRow {
  $id: string;
  userId: string;
  resourceType: PinnableResourceType;
  resourceId: string;
  pinnedAt?: string | null;
}

const DATABASE_ID = APPWRITE_CONFIG.DATABASE_ID;
const TABLE_ID = 'user_resource_pins';

function pinPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
    Permission.create(Role.user(userId)),
  ];
}

export const UserResourcePinService = {
  async listForUser(userId: string, resourceType?: PinnableResourceType): Promise<UserResourcePinRow[]> {
    const queries = [Query.equal('userId', userId), Query.limit(500), Query.orderDesc('pinnedAt')];
    if (resourceType) {
      queries.unshift(Query.equal('resourceType', resourceType));
    }
    const res = await databases.listRows<UserResourcePinRow>(DATABASE_ID, TABLE_ID, queries);
    return res.rows;
  },

  async pin(userId: string, resourceType: PinnableResourceType, resourceId: string): Promise<UserResourcePinRow> {
    const existing = await this.findPin(userId, resourceType, resourceId);
    if (existing) return existing;

    const now = new Date().toISOString();
    return await databases.createRow<UserResourcePinRow>(
      DATABASE_ID,
      TABLE_ID,
      ID.unique(),
      {
        userId,
        resourceType,
        resourceId,
        pinnedAt: now,
      },
      pinPermissions(userId),
    );
  },

  async unpin(userId: string, resourceType: PinnableResourceType, resourceId: string): Promise<void> {
    const existing = await this.findPin(userId, resourceType, resourceId);
    if (!existing) return;
    await databases.deleteRow(DATABASE_ID, TABLE_ID, existing.$id);
  },

  async findPin(
    userId: string,
    resourceType: PinnableResourceType,
    resourceId: string,
  ): Promise<UserResourcePinRow | null> {
    const res = await databases.listRows<UserResourcePinRow>(DATABASE_ID, TABLE_ID, [
      Query.equal('userId', userId),
      Query.equal('resourceType', resourceType),
      Query.equal('resourceId', resourceId),
      Query.limit(1),
    ]);
    return res.rows[0] ?? null;
  },

  async isPinned(userId: string, resourceType: PinnableResourceType, resourceId: string): Promise<boolean> {
    const row = await this.findPin(userId, resourceType, resourceId);
    return !!row;
  },
};

export function resolveEffectivePinned(
  actorId: string | null | undefined,
  ownerId: string | null | undefined,
  resourceId: string,
  rowIsPinned: boolean | string[] | null | undefined,
  collaboratorPinIds: ReadonlySet<string>,
  resourceType?: PinnableResourceType,
): boolean {
  if (!actorId) return false;

  if (resourceType === 'message') {
    return collaboratorPinIds.has(resourceId);
  }

  if (resourceType === 'conversation') {
    if (collaboratorPinIds.has(resourceId)) return true;
    if (Array.isArray(rowIsPinned)) return rowIsPinned.includes(actorId);
    return false;
  }

  const owner = ownerId || '';
  if (actorId === owner) return rowIsPinned === true || String(rowIsPinned) === 'true';
  return collaboratorPinIds.has(resourceId);
}
