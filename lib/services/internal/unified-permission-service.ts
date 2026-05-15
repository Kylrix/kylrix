import { permissionsInternal } from './permissions';
import { dispatchEmail } from './emailDispatch';
import { createAdminClient } from '@/lib/appwrite-admin';
import { Databases } from 'node-appwrite';

export type PermissionLevel = 'view' | 'edit' | 'admin';

export interface PermissionChangeInput {
  userId: string;
  resourceId: string;
  resourceType: 'note' | 'task';
  resourceTitle: string;
  targetUserId: string;
  targetEmail: string;
  permission: PermissionLevel;
  actorName: string;
}

export async function grantPermissionSecure(input: PermissionChangeInput) {
  const { client } = createAdminClient();
  const databases = new Databases(client);
  const appwritePerm = input.permission === 'admin' ? 'delete' : input.permission === 'edit' ? 'update' : 'read';

  // 1. Grant via existing secure internal permissions service
  await permissionsInternal('POST', {
    action: 'grant',
    permission: appwritePerm,
    targetUserId: input.targetUserId,
    resourceId: input.resourceId,
    resourceType: input.resourceType === 'note' ? 'ghost_note' : 'task',
    databaseId: 'chat',
    tableId: input.resourceType === 'note' ? 'notes' : 'tasks',
    rowId: input.resourceId,
  });

  // 2. Automated Email
  await dispatchEmail({
    eventType: 'resource_shared',
    sourceApp: 'kylrix',
    actorName: input.actorName,
    recipientEmails: [input.targetEmail],
    resourceId: input.resourceId,
    resourceTitle: input.resourceTitle,
    resourceType: input.resourceType,
    rightsLabel: input.permission,
    templateKey: 'RESOURCE_SHARED_NOTIFY',
    metadata: {
      permissionType: input.permission,
      iconUrl: 'https://kylrix.space/logo.svg' // Add logo requirement here
    }
  });

  return { success: true };
}
