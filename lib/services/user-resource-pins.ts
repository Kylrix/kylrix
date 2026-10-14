'use client';

import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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
  | 'message'
  | 'call'
  | 'moment';

export interface UserResourcePinRow {
  $id: string;
  id: string;
  userId: string;
  resourceType: PinnableResourceType;
  resourceId: string;
  pinnedAt?: string | null;
}

export const UserResourcePinService = {
  async listForUser(userId: string, resourceType?: PinnableResourceType): Promise<UserResourcePinRow[]> {
    try {
      const conditions = [eq(schema.userResourcePins.userId, userId)];
      if (resourceType) {
        conditions.push(eq(schema.userResourcePins.resourceType, resourceType));
      }
      const rows = await db
        .select()
        .from(schema.userResourcePins)
        .where(and(...conditions));

      return rows.map((r) => ({
        ...r,
        $id: r.id,
        resourceType: r.resourceType as PinnableResourceType,
      }));
    } catch {
      return [];
    }
  },

  async pin(userId: string, resourceType: PinnableResourceType, resourceId: string): Promise<UserResourcePinRow> {
    const existing = await this.findPin(userId, resourceType, resourceId);
    if (existing) return existing;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      userId,
      resourceType,
      resourceId,
      pinnedAt: now,
    };

    try {
      await db.insert(schema.userResourcePins).values(row);
    } catch {}

    return { ...row, $id: id };
  },

  async unpin(userId: string, resourceType: PinnableResourceType, resourceId: string): Promise<void> {
    try {
      await db
        .delete(schema.userResourcePins)
        .where(
          and(
            eq(schema.userResourcePins.userId, userId),
            eq(schema.userResourcePins.resourceType, resourceType),
            eq(schema.userResourcePins.resourceId, resourceId)
          )
        );
    } catch {}
  },

  async findPin(
    userId: string,
    resourceType: PinnableResourceType,
    resourceId: string
  ): Promise<UserResourcePinRow | null> {
    try {
      const rows = await db
        .select()
        .from(schema.userResourcePins)
        .where(
          and(
            eq(schema.userResourcePins.userId, userId),
            eq(schema.userResourcePins.resourceType, resourceType),
            eq(schema.userResourcePins.resourceId, resourceId)
          )
        )
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          ...r,
          $id: r.id,
          resourceType: r.resourceType as PinnableResourceType,
        };
      }
    } catch {}

    return null;
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
  resourceType?: PinnableResourceType
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
  if (actorId === owner) {
    return rowIsPinned === true || String(rowIsPinned) === 'true' || collaboratorPinIds.has(resourceId);
  }
  return collaboratorPinIds.has(resourceId);
}
