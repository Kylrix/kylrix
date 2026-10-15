'use server';

import * as shared from './shared';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { PermissionChangeInput } from './shared';

const { getActor } = shared;

export async function grantPermissionSecure(input: PermissionChangeInput) {
  const requester = await getActor(input.jwt);
  if (!requester) {
    throw new Error('Unauthorized');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    const existing = await db
      .select()
      .from(schema.collaborators)
      .where(
        and(
          eq(schema.collaborators.resourceId, input.resourceId),
          eq(schema.collaborators.userId, input.targetUserId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.collaborators)
        .set({
          permission: input.permission,
          status: 'accepted',
          accepted: true,
        })
        .where(eq(schema.collaborators.id, existing[0].id));
    } else {
      await db.insert(schema.collaborators).values({
        id,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        userId: input.targetUserId,
        permission: input.permission,
        inviterId: requester.$id,
        status: 'accepted',
        accepted: true,
        invitedAt: now,
      });
    }
    return { success: true };
  } catch (err: any) {
    console.error('grantPermissionSecure error:', err);
    return { success: false, error: err.message };
  }
}

export async function revokePermissionSecure(input: {
  resourceId: string;
  resourceType: 'note' | 'task' | 'project';
  targetUserId: string;
  jwt?: string;
}) {
  const requester = await getActor(input.jwt);
  if (!requester) throw new Error('Unauthorized');

  try {
    await db
      .delete(schema.collaborators)
      .where(
        and(
          eq(schema.collaborators.resourceId, input.resourceId),
          eq(schema.collaborators.userId, input.targetUserId)
        )
      );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getResourceCollaboratorsSecure(input: {
  resourceId: string;
  resourceType: string;
  jwt?: string;
}) {
  const requester = await getActor(input.jwt);
  if (!requester) throw new Error('Unauthorized');

  try {
    const rows = await db
      .select()
      .from(schema.collaborators)
      .where(eq(schema.collaborators.resourceId, input.resourceId));

    const { UsersService } = await import('@/lib/services/users');
    const collaborators = await Promise.all(
      rows.map(async (collab) => {
        const p = await UsersService.getProfileById(collab.userId);
        if (!p) return null;
        return {
          $id: p.$id,
          userId: p.userId || p.$id,
          username: p.username,
          displayName: p.displayName,
          avatar: p.avatar || null,
          permissionLevel: collab.permission,
          status: collab.status,
          accepted: Boolean(collab.accepted),
        };
      })
    );

    return { collaborators: collaborators.filter(Boolean) };
  } catch {
    return { collaborators: [] };
  }
}

export async function addProjectCollaboratorSecure(projectId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  return grantPermissionSecure({
    userId: targetUserId,
    resourceId: projectId,
    resourceType: 'project',
    resourceTitle: 'Project',
    targetUserId,
    permission: permissionLevel as any,
    actorName: 'User',
    jwt,
  });
}

export async function removeProjectCollaboratorSecure(projectId: string, targetUserId: string, jwt?: string) {
  return revokePermissionSecure({
    resourceId: projectId,
    resourceType: 'project',
    targetUserId,
    jwt,
  });
}

export async function addFormCollaboratorSecure(formId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  return grantPermissionSecure({
    userId: targetUserId,
    resourceId: formId,
    resourceType: 'project',
    resourceTitle: 'Form',
    targetUserId,
    permission: permissionLevel as any,
    actorName: 'User',
    jwt,
  });
}

export async function removeFormCollaboratorSecure(formId: string, targetUserId: string, jwt?: string) {
  return revokePermissionSecure({
    resourceId: formId,
    resourceType: 'project',
    targetUserId,
    jwt,
  });
}
