'use server';

import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { hasPaidKylrixPlan, getUserSubscriptionTier } from '@/lib/utils';
import {
  allowsCollaboratorSharing,
  getProjectCap
} from '@/lib/entitlements';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { provisionHybridTeamExpansionSecure } from '@/lib/api/permission-updater';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import {
  ProjectSchema
} from '@/lib/validations/schemas';
import { filterRootWorkspaceProjects, isWorkspaceRecord } from '@/lib/projects/sub-projects';
import { ownedWorkspaceListQueries, subProjectsListQueries } from '@/lib/projects/workspace-queries';

// Import interfaces / types from shared

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  verifyResourcePermissionSecure,
  verifyProjectPermission,
  verifyFormPermission,
  verifyEventPermission,
  sanitizeEventData,
  rowCache} = shared;

export async function upsertSweptConfigSecure(
  projectId: string,
  patch: { enabled?: boolean; scopeType?: string; anchorKind?: string; anchors?: string | null; policy?: string | null },
  jwt?: string,
) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const hasAccess = await verifyProjectPermission(projectId, actor.$id, 'editor').catch(() => false);
  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient permissions to update project settings');
  }

  const tables = createSystemTablesDB();
  const tableId = APPWRITE_CONFIG.TABLES.SWEPT || 'swept';
  const now = new Date().toISOString();
  const existing = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASE_ID,
    tableId,
    queries: [
      Query.equal('userId', actor.$id),
      Query.equal('projectId', projectId),
      Query.limit(1),
    ] as any});

  if (patch.enabled === false) {
    if (existing.rows[0]) {
      await tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASE_ID,
        tableId,
        rowId: existing.rows[0].$id});
    }
    return JSON.parse(JSON.stringify({
      userId: actor.$id,
      projectId,
      enabled: false,
      scopeType: patch.scopeType ?? 'project',
      anchorKind: patch.anchorKind ?? 'tag',
      anchors: null,
      policy: null}));
  }

  if (existing.rows[0]) {
    const row = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASE_ID,
      tableId,
      rowId: existing.rows[0].$id,
      data: {
        ...patch,
        enabled: true,
        updatedAt: now}});
    return JSON.parse(JSON.stringify(row));
  }

  const row = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASE_ID,
    tableId,
    rowId: ID.unique(),
    data: {
      userId: actor.$id,
      projectId,
      enabled: true,
      scopeType: patch.scopeType ?? 'project',
      anchorKind: patch.anchorKind ?? 'tag',
      anchors: patch.anchors ?? null,
      policy: patch.policy ?? null,
      createdAt: now,
      updatedAt: now},
    permissions: [
      Permission.read(Role.user(actor.$id)),
    ]});
  return JSON.parse(JSON.stringify(row));
}

export async function removeObjectFromProjectSecure(objectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();

  const obj = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: objectId});

  const projectId = obj.projectId;
  const isOwner = obj.$permissions?.some((p: string) => p.includes(actor.$id));
  const isProjectAdmin = await verifyProjectPermission(projectId, actor.$id, 'admin').catch(() => false);

  if (!isOwner && !isProjectAdmin) {
    throw new Error('Forbidden: Insufficient permissions to remove this object from the project');
  }

  const result = await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: objectId});

  return JSON.parse(JSON.stringify(result));
}

export async function createFormSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data});
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const permissions = [
    Permission.read(Role.user(actor.$id)),
    Permission.read(Role.any()), // Allow public discovery via listRows filter
    ];

  const form = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: ID.unique(),
      data: {
      ...data,
      userId: actor.$id,
      status: data.status || 'published',
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      isGuest: data.isGuest !== undefined ? data.isGuest : true},
      permissions: permissions});

  return JSON.parse(JSON.stringify(form));
}

export async function listUserFormsSecure(userId?: string, jwt?: string) {
  let actor: any = null;
  try {
    actor = await getActor(jwt);
  } catch (_) {}

  const targetUserId = userId || actor?.$id;
  if (!targetUserId) {
    return { rows: [], total: 0 };
  }

  // Use admin SDK directly - bypasses RLS so we always get the user's own forms
  const systemTables = createSystemTablesDB();

  const result = await systemTables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    queries: [
      Query.equal('userId', targetUserId),
      Query.notEqual('isTrash', true),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]});

  return JSON.parse(JSON.stringify(result));
}

export async function updateFormSecure(formId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyFormPermission(formId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this form');
  }

  const tables = createSystemTablesDB();

  const form = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId});

  const ownerId = form.userId;
  const currentStatus = data.status || form.status;

  if (Object.prototype.hasOwnProperty.call(data, 'isPinned') && ownerId !== actor.$id) {
    delete data.isPinned;
  }

  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}

  const { ownerRowPermissions } = await import('@/lib/appwrite/owner-acl');
  const extraReadUserIds =
    settings.collaborators && typeof settings.collaborators === 'object'
      ? Object.keys(settings.collaborators)
      : [];
  const permissions = ownerRowPermissions(ownerId || actor.$id, {
    isPublic: currentStatus === 'published',
    extraReadUserIds,
  });

  const updatedForm = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: data,
      permissions: permissions});

  return JSON.parse(JSON.stringify(updatedForm));
}

export async function deleteFormSecure(formId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Clear memory row cache to prevent stale ownership/permission state from blocking the delete
  const cacheKey = `${APPWRITE_CONFIG.DATABASES.FLOW}:${APPWRITE_CONFIG.TABLES.FLOW.FORMS}:${formId}`;
  rowCache.delete(cacheKey);

  // Directly retrieve the form details using system privileges to verify owner identity
  const systemTables = createSystemTablesDB();
  let formRow = null;
  try {
      formRow = await systemTables.getRow(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, formId);
  } catch (err) {
      console.warn('[deleteFormSecure] Failed to retrieve form row:', err);
  }

  // If the actor is the direct owner, bypass the regular permission check to avoid any issues
  const isOwner = formRow && String(formRow.userId || '').trim() === actor.$id;
  const isAllowed = isOwner || (await verifyFormPermission(formId, actor.$id, 'admin'));

  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this form');
  }

  try {
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, formId);
  } catch (err: any) {
    console.error('deleteFormSecure cascade cleanup failed:', err);
  }

  const result = await systemTables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
      rowId: formId,
      data: { isTrash: true }
    });

  // Also remove the cache entry post-delete
  rowCache.delete(cacheKey);

  return JSON.parse(JSON.stringify(result));
}

export async function createEventSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Mathematically tie the create operation to the current user
  if (!data) {
    data = {};
  }
  data.userId = actor.$id;

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['userId'],
    data});
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const tables = createSystemTablesDB();
  const permissions = [
    Permission.read(Role.user(actor.$id))];

  const sanitizedData = sanitizeEventData({
    ...data,
    isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
    isGuest: data.isGuest !== undefined ? Boolean(data.isGuest) : true,
    userId: actor.$id,
  });

  const event = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: ID.unique(),
      data: sanitizedData,
      permissions: permissions});

  return JSON.parse(JSON.stringify(event));
}

export async function updateEventSecure(eventId: string, data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this event');
  }

  const tables = createSystemTablesDB();

  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId});

  const ownerId = event.userId;
  const { ownerRowPermissions } = await import('@/lib/appwrite/owner-acl');
  const extraReadUserIds: string[] = [];

  // Include physical read permissions for all manager guests
  try {
    const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [Query.equal('eventId', eventId)] as any});
    guestsRes.rows.forEach((g: any) => {
      if (g.userId && String(g.role || '').startsWith('manager-')) {
        extraReadUserIds.push(g.userId);
      }
    });
  } catch (err) {
    console.error('Failed to query manager physical read permissions in updateEventSecure', err);
  }

  const permissions = ownerRowPermissions(ownerId || actor.$id, {
    isPublic: !!(data as any)?.isPublic || !!(event as any)?.isPublic,
    extraReadUserIds,
  });

  const sanitizedData = sanitizeEventData(data);

  const updatedEvent = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: sanitizedData,
      permissions: permissions});

  return JSON.parse(JSON.stringify(updatedEvent));
}

export async function deleteEventSecure(eventId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
  if (!isValidAppwriteRowId(eventId)) {
    // Offline-only / ephemeral draft event (not synced to Appwrite yet) — local delete is clean success
    return { success: true, offline: true };
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this event');
  }

  const tables = createSystemTablesDB();

  // Cascade delete guests
  try {
    await executeCascadeDeleteSecure(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.EVENTS, eventId);
  } catch (err: any) {
    console.error('deleteEventSecure cascade guests cleanup failed:', err);
  }

  const result = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: { isTrash: true }
    });

  return JSON.parse(JSON.stringify(result));
}

export async function addEventManagerSecure(eventId: string, targetUserId: string, permissionLevel: string = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const tables = createSystemTablesDB();

  // 1. Fetch current event to update permissions
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId});

  // Update physical permissions: add READ permission only
  const permissions = new Set(event.$permissions || []);
  permissions.add(`read("user:${targetUserId}")`);

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: Array.from(permissions)});

  // 2. Add or update Guest entry
  const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
      Query.equal('eventId', eventId),
      Query.equal('userId', targetUserId)] as any});

  const virtualRole = `manager-${permissionLevel}`;
  let guestRow;
  if (guestsRes.rows.length > 0) {
    // Update role
    guestRow = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: guestsRes.rows[0].$id,
      data: {
        role: virtualRole}});
  } else {
    // Create new
    guestRow = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: ID.unique(),
      data: {
        eventId,
        userId: targetUserId,
        role: virtualRole,
        status: 'attending'}});
  }

  // 3. Polyfill/Primary write to polymorphic whisperrflow.Collaborators table
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
  try {
    const existingCollab = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', targetUserId),
        Query.limit(1),
      ] as any});

    const permission = permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read');

    if (existingCollab.rows.length > 0) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: existingCollab.rows[0].$id,
        data: {
          permission,
          invitedAt: existingCollab.rows[0].invitedAt || new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'manager'}});
    } else {
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: eventId,
          resourceType: 'event',
          userId: targetUserId,
          permission,
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'manager'}});
    }
  } catch (err) {
    console.error('[Event secure action] Polymorphic write failed:', err);
  }

  return JSON.parse(JSON.stringify(guestRow));
}

export async function removeEventManagerSecure(eventId: string, targetUserId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyEventPermission(eventId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage managers');
  }

  const tables = createSystemTablesDB();

  // 1. Fetch current event to update permissions
  const event = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId});

  // Remove physical read permission
  const rawPermissions = event.$permissions || [];
  const updatedPerms = rawPermissions.filter((p: string) => {
    return p !== `read("user:${targetUserId}")`;
  });

  await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
      rowId: eventId,
      data: {},
      permissions: updatedPerms});

  // 2. Remove Guest entry if it was a manager
  try {
    const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [
        Query.equal('eventId', eventId),
        Query.equal('userId', targetUserId)] as any});
    await Promise.all(
      guestsRes.rows.map((g: any) => {
        if (String(g.role || '').startsWith('manager-')) {
          return tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      rowId: g.$id});
        }
        return Promise.resolve();
      })
    );
  } catch (err) {
    console.error('removeEventManagerSecure cleanup failed:', err);
  }

  // 3. Remove entry from polymorphic whisperrflow.Collaborators table
  try {
    const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
    const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', eventId),
        Query.equal('resourceType', 'event'),
        Query.equal('userId', targetUserId),
      ] as any});
    await Promise.all(
      collabsRes.rows.map((row: any) =>
        tables.deleteRow({
          databaseId: FLOW_DATABASE_ID,
          tableId: COLLABORATORS_TABLE,
          rowId: row.$id})
      )
    );
  } catch (err) {
    console.error('[Event secure action] Polymorphic delete failed:', err);
  }

  return { success: true };
}

export async function convertResponseToGoalSecure(submissionId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const submission = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: 'formSubmissions',
    rowId: submissionId
  });

  if (!submission) {
    throw new Error('Submission not found');
  }

  // Parse payload to build a nice description
  let payload: any = {};
  try {
    payload = JSON.parse(submission.payload);
  } catch {
    payload = { data: submission.payload };
  }

  let desc = `Derived from Form Response ${submission.$id.slice(-8)} submitted by ${submission.submitterName || 'Anonymous'}.\n\n`;
  for (const [k, v] of Object.entries(payload)) {
    desc += `**${k.toUpperCase()}**: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`;
  }

  const now = new Date().toISOString();
  const permissions = [Permission.read(Role.user(actor.$id))];
  
  // Create task in whisperrflow
  const task = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: 'tasks',
    rowId: ID.unique(),
    data: {
      title: `Action: Form Response ${submission.$id.slice(-8)}`,
      description: desc,
      status: 'todo',
      priority: 'high',
      userId: actor.$id,
      createdAt: now,
      updatedAt: now,
      metadata: JSON.stringify({ origin: 'form_response', submissionId: submission.$id, formId: submission.formId })
    },
    permissions: permissions
  });

  // Link task to parent projects if the form is linked to any
  try {
    const parentLinks = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('entityId', submission.formId),
        Query.equal('entityKind', 'form')
      ] as any
    });

    for (const link of parentLinks.rows) {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        rowId: ID.unique(),
        data: {
          projectId: link.projectId,
          entityKind: 'goal',
          entityId: task.$id,
          role: 'member',
          createdAt: now,
          updatedAt: now,
          isGeneral: true // Default project internal eyes-on visibility flag
        },
        permissions: permissions
      });
    }
  } catch (err) {
    console.error('Failed to link converted goal to parent projects:', err);
  }

  return JSON.parse(JSON.stringify(task));
}

export async function initGoalDiscussionSecure(taskId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const goal = await tables.getRow<any>(
    APPWRITE_CONFIG.DATABASES.FLOW,
    APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    taskId
  );
  if (!goal) throw new Error('Goal not found');

  const { ThreadService } = await import('@/lib/services/threads');

  if (goal.primaryThreadId) {
    return { discussionId: goal.primaryThreadId, threadId: goal.primaryThreadId, created: false };
  }

  const { thread, created } = await ThreadService.getOrCreate({
    parentKind: 'goal',
    parentId: taskId,
    channel: ThreadService.CHANNEL_DISCUSS,
    ownerId: actor.$id,
    title: `Goal discussion: ${goal.title || taskId}`,
    legacyNoteId: goal.discussionId || null,
  });

  // Keep discussionId for older UI that still reads it — point at canonical thread
  const now = new Date().toISOString();
  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: taskId,
    data: {
      primaryThreadId: thread.id,
      discussionId: goal.discussionId || thread.id,
      updatedAt: now,
    },
  }).catch(() => null);

  return { discussionId: thread.id, threadId: thread.id, created };
}

export async function approveProjectJoinRequestSecure(projectId: string, targetUserId: string, permissionLevel: 'admin' | 'editor' | 'viewer' = 'viewer', jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Only owners and admins can approve join requests');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId}).catch(() => null);

  if (!project) throw new Error('Project not found');

  // 2. Find request row
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project'),
      Query.equal('userId', targetUserId)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    await tables.updateRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: existingCollab.rows[0].$id,
      data: {
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        status: 'accepted',
        accepted: true,
        role: 'collaborator'
      }
    });
  } else {
    // If no request exists, just create an accepted collaborator
    await tables.createRow({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      rowId: ID.unique(),
      data: {
        resourceId: projectId,
        resourceType: 'project',
        userId: targetUserId,
        permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
        invitedAt: new Date().toISOString(),
        accepted: true,
        status: 'accepted',
        role: 'collaborator'
      }
    });
  }

  // 3. Grant Appwrite read permissions
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${targetUserId}")`);

  const { databases } = createSystemClient();
  const permissionsList = Array.from(newPermissions);
  await databases.updateRow(
    APPWRITE_CONFIG.DATABASES.CHAT,
    'projects',
    projectId,
    { $permissions: permissionsList },
    permissionsList
  );

  return { success: true };
}

export async function createGoalSecure(data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { isValidAppwriteRowId } = await import('@/lib/utils/resource-ids');
  const { pickGoalAutosavePayload } = await import('@/lib/goals/pick-goal-autosave-payload');

  const tables = createSystemTablesDB();
  const reservedRowId = [data?.$id, data?.id].find(
    (id) => typeof id === 'string' && isValidAppwriteRowId(id),
  ) as string | undefined;

  if (reservedRowId) {
    try {
      const existing = (await tables.getRow({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
        rowId: reservedRowId,
      })) as { userId?: string | null; creatorId?: string | null };
      const ownerId = String(existing?.creatorId || existing?.userId || '').trim();
      if (ownerId && (ownerId === actor.$id || ownerId === 'guest')) {
        return updateGoalSecure(reservedRowId, data, jwt);
      }
    } catch {
      // Row not found — proceed with create using reserved ID.
    }
  }

  const rawGoal: any = {
    ...data,
    userId: actor.$id,
    creatorId: actor.$id,
  };

  const dataPayload = pickGoalAutosavePayload(rawGoal);
  (dataPayload as any).userId = actor.$id;

  const { ownerRowPermissions } = await import('@/lib/appwrite/owner-acl');
  const permissions = ownerRowPermissions(actor.$id, { isPublic: !!data?.isPublic });

  const result = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: reservedRowId || ID.unique(),
    data: dataPayload as any,
    permissions,
  });

  return JSON.parse(JSON.stringify(result));
}

export async function updateGoalSecure(goalId: string, data: any, jwt?: string): Promise<any> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const { pickGoalAutosavePayload } = await import('@/lib/goals/pick-goal-autosave-payload');

  const tables = createSystemTablesDB();
  const existing = (await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: goalId,
  })) as { userId?: string | null; creatorId?: string | null };

  const ownerId = String(existing?.creatorId || existing?.userId || '').trim();
  if (ownerId && ownerId !== actor.$id && ownerId !== 'guest' && ownerId !== 'thread') {
    throw new Error('Forbidden: Insufficient permissions on goal');
  }

  const merged = {
    ...existing,
    ...data,
    userId: ownerId && ownerId !== 'guest' ? ownerId : actor.$id,
    creatorId: ownerId && ownerId !== 'guest' ? ownerId : actor.$id,
  };

  const dataPayload = pickGoalAutosavePayload(merged);
  delete (dataPayload as any).$id;
  delete (dataPayload as any).$createdAt;
  delete (dataPayload as any).$updatedAt;
  delete (dataPayload as any).$permissions;
  delete (dataPayload as any).$databaseId;
  delete (dataPayload as any).$tableId;

  const { ownerRowPermissions } = await import('@/lib/appwrite/owner-acl');
  const updated = await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: goalId,
    data: dataPayload as any,
    permissions: ownerRowPermissions(ownerId && ownerId !== 'guest' ? ownerId : actor.$id, {
      isPublic: !!(dataPayload as any)?.isPublic,
    }),
  });

  return JSON.parse(JSON.stringify(updated));
}

