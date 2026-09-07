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

export async function getPublicGoalDataSecure(goalId: string) {
  const tables = createSystemTablesDB();
  const row = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: goalId}).catch(() => null);

  if (!row) return null;

  const isGuest = row.isGuest === true;
  const isPublic = row.isPublic === true;
  if (!isGuest && !isPublic) return null;

  return JSON.parse(JSON.stringify({
    id: row.$id,
    title: row.title || 'Untitled goal',
    description: row.description || null,
    status: row.status || 'todo',
    priority: row.priority || 'medium',
    dueDate: row.dueDate || null,
    userId: row.userId || null,
    isPublic,
    isGuest,
    // Locked when dek is non-empty (do not expose wrapped dek to guests)
    locked: typeof row.dek === 'string' && row.dek.trim().length > 0,
    updatedAt: row.$updatedAt}));
}

export async function createAccountEventSecure(params: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const { databases } = createSystemClient();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

  const type = String(params.type || '').trim().toLowerCase();
  if (!type) throw new Error('type is required');

  const targetUserIds = Array.isArray(params.targetUserIds) ? params.targetUserIds : [params.userId || actor.$id];
  
  const created: any[] = [];
  for (const targetUserId of targetUserIds) {
    const payload = {
      userId: targetUserId,
      type,
      actorId: actor.$id,
      relatedUserId: params.relatedUserId || targetUserId,
      status: params.status || 'active',
      delta: params.delta ?? null,
      discountPercent: params.discountPercent ?? null,
      expiresAt: params.expiresAt || null,
      metadata: typeof params.metadata === 'string' ? params.metadata : JSON.stringify(params.metadata || {})};

    const row = await databases.createRow(dbId, tableId, ID.unique(), payload, [Permission.read(Role.user(targetUserId))]);
    created.push(row);
  }

  return { success: true, count: created.length, rows: created };
}

export async function listProjectsWithCollaborationsSecure(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const CHAT_DATABASE_ID = APPWRITE_CONFIG.DATABASES.CHAT;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // Parallel Fetch: Owned projects + Collaborator rows
  const [ownedProjectsRes, collabRowsRes] = await Promise.all([
    tables.listRows({
        databaseId: CHAT_DATABASE_ID,
        tableId: 'projects',
        queries: ownedWorkspaceListQueries(actor.$id) as any,
    }),
    tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceType', 'project'),
          Query.equal('userId', actor.$id),
        ] as any}),
  ]);

  const projectsListMap = new Map<string, any>();

  // Initialize map with owned projects
  for (const proj of ownedProjectsRes.rows) {
    projectsListMap.set(proj.$id, {
      ...proj,
      collabStatus: 'owner',
      isPending: false});
  }

  // Identify unique project IDs to fetch that are NOT owned by the user
  const projectsToFetch = collabRowsRes.rows.filter(row => !projectsListMap.has(row.resourceId));
  
  if (projectsToFetch.length > 0) {
    // Optimized Batch Fetch: Details for all collaborated projects in one query
    const targetProjectIds = projectsToFetch.map(r => r.resourceId);
    
    try {
        const collaboratedProjectsRes = await tables.listRows({
            databaseId: CHAT_DATABASE_ID,
            tableId: 'projects',
            queries: [Query.equal('$id', targetProjectIds)]});

        for (const proj of collaboratedProjectsRes.rows) {
            if (!isWorkspaceRecord(proj)) continue;
            const collabRow = projectsToFetch.find(r => r.resourceId === proj.$id);
            if (collabRow) {
                const isRealInvite = collabRow.status === 'pending' && collabRow.inviterId && collabRow.inviterId !== '';
                const isJoinRequest = collabRow.status === 'pending' && (!collabRow.inviterId || collabRow.inviterId === '');
                projectsListMap.set(proj.$id, {
                    ...proj,
                    collabStatus: isJoinRequest ? 'requested' : collabRow.status,
                    isPending: isRealInvite,
                    isRequested: isJoinRequest,
                    role: collabRow.permission === 'admin' ? 'admin' : (collabRow.permission === 'write' ? 'editor' : 'viewer')});
            }
        }
    } catch (e) {
        console.error('[listProjectsWithCollaborationsSecure] Batch project fetch failed:', e);
    }
  }

  return filterRootWorkspaceProjects(Array.from(projectsListMap.values()));
}

export async function listSubProjectsForWorkspaceSecure(workspaceId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const hasAccess = await verifyProjectPermission(workspaceId, actor.$id, 'viewer');
  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient permissions to view projects in this workspace');
  }

  const tables = createSystemTablesDB();
  const res = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    queries: subProjectsListQueries(workspaceId) as any,
  });

  return res.rows;
}

export async function createProjectSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Rigorous runtime validation
  const validated = ProjectSchema.parse(data);
  const userTier = getUserSubscriptionTier(actor);
  const kind = validated.kind ?? 'workspace';
  const parentProjectId = validated.parentProjectId ?? null;

  if (kind === 'project') {
    if (!parentProjectId) {
      throw new Error('parentProjectId is required when creating a project');
    }
    if (!allowsCollaboratorSharing(userTier, 'project')) {
      throw new Error('Projects require a Teams plan. Upgrade to organize work inside workspaces.');
    }
    const canManageParent = await verifyProjectPermission(parentProjectId, actor.$id, 'editor');
    if (!canManageParent) {
      throw new Error('Forbidden: Cannot create a project in this workspace');
    }
  }

  const tables = createSystemTablesDB();
  const existingProjects = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    queries: [
      ...ownedWorkspaceListQueries(actor.$id),
    ] as any
  });
  const maxProjects = getProjectCap(userTier);
  if (kind !== 'project' && existingProjects.rows.length >= maxProjects) {
    throw new Error(`Limit reached: ${userTier} plan is limited to ${maxProjects} project${maxProjects === 1 ? '' : 's'}. Upgrade to PRO or TEAMS to create more projects.`);
  }

  // Mathematically tie the create operation to the current user
  const visibility = validated.visibility ?? 'public';
  const projectData: any = {
    ...validated,
    status: validated.status ?? 'active',
    visibility,
    isPublic: validated.isPublic ?? visibility === 'public',
    isGuest: validated.isGuest ?? visibility === 'public',
    kind,
    parentProjectId: kind === 'project' ? parentProjectId : null,
    ownerId: actor.$id};

  const isCreateAllowed = await verifyResourcePermissionSecure({
    actorId: actor.$id,
    action: 'create',
    ownerFields: ['ownerId'],
    data: projectData});
  if (!isCreateAllowed) {
    throw new Error('Forbidden: Create operation must be mathematically tied to the current user');
  }

  const now = new Date().toISOString();
  const projectId = ID.unique();

  const { ownerRowPermissions } = await import('@/lib/appwrite/owner-acl');
  const permissions = ownerRowPermissions(actor.$id);

  const project = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: {
      ...projectData,
      createdAt: now,
      updatedAt: now},
      permissions: permissions});
  return JSON.parse(JSON.stringify(project));
}

export async function updateProjectSecure(projectId: string, data: any, permissions?: string[], jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to update this project');
  }

  const tables = createSystemTablesDB();
  const existing = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId}) as { ownerId?: string };

  const patch = { ...data };
  if (Object.prototype.hasOwnProperty.call(patch, 'isPinned') && existing.ownerId !== actor.$id) {
    delete patch.isPinned;
  }

  const validated = ProjectSchema.partial().parse(patch);
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };
  for (const key of Object.keys(patch)) {
    if (key in validated && validated[key as keyof typeof validated] !== undefined) {
      updateData[key] = validated[key as keyof typeof validated];
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(updateData, 'visibility') ||
    Object.prototype.hasOwnProperty.call(updateData, 'isPublic') ||
    Object.prototype.hasOwnProperty.call(updateData, 'isGuest')
  ) {
    const existingRow = existing as { visibility?: string; isPublic?: boolean; isGuest?: boolean };
    const visibility = (updateData.visibility as string | undefined) ?? existingRow.visibility ?? 'public';
    const isPublic = (updateData.isPublic as boolean | undefined) ?? existingRow.isPublic ?? visibility === 'public';
    const isGuest = (updateData.isGuest as boolean | undefined) ?? existingRow.isGuest ?? false;
    const isWorldVisible = visibility === 'public' || isPublic || isGuest;

    updateData.visibility = isWorldVisible ? 'public' : 'private';
    updateData.isPublic = isWorldVisible;
    updateData.isGuest = isWorldVisible ? isGuest : false;
  }
  
  const project = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: updateData,
      permissions: permissions});

  return JSON.parse(JSON.stringify(project));
}

export async function deleteProjectSecure(
  projectId: string,
  _deleteMode: 'detach' | 'created_within' | 'all' = 'detach',
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'admin');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to delete this project');
  }

  const tables = createSystemTablesDB();

  const result = await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'projects',
      rowId: projectId,
      data: { isTrash: true }
    });

  return JSON.parse(JSON.stringify(result));
}

export async function requestProjectAccessSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // Get project
  const project = await tables.getRow<any>({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId}).catch(() => null);

  if (!project) throw new Error('Project not found');
  if (project.visibility !== 'public') {
    throw new Error('Forbidden: Cannot request access to a private project');
  }

  // Check if they already have an entry
  const existingCollab = await tables.listRows({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    queries: [
      Query.equal('resourceId', projectId),
      Query.equal('resourceType', 'project'),
      Query.equal('userId', actor.$id)
    ] as any
  });

  if (existingCollab.rows.length > 0) {
    const col = existingCollab.rows[0];
    if (col.status === 'declined') {
      throw new Error('Forbidden: Your request to join this project was declined.');
    }
    // If already exists, return success
    return { success: true, status: col.status };
  }

  // Create a collaborator row with status: 'pending'
  await tables.createRow({
    databaseId: FLOW_DATABASE_ID,
    tableId: COLLABORATORS_TABLE,
    rowId: ID.unique(),
    data: {
      resourceId: projectId,
      resourceType: 'project',
      userId: actor.$id,
      permission: 'read', // default request permission
      invitedAt: new Date().toISOString(),
      accepted: false,
      status: 'pending',
      role: 'collaborator',
      inviterId: ''
    }
  });

  return { success: true, status: 'requested' };
}

export async function acceptProjectInviteSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();
  const project = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId}).catch(() => null);

  if (!project) {
    throw new Error('Project not found');
  }

  const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // 1. Verify invite via polymorphic collaborators table or legacy fallback
  let permissionLevel = 'viewer';
  let isInvited = false;
  let collabId = null;

  try {
    const collabsRes = await tables.listRows({
      databaseId: FLOW_DATABASE_ID,
      tableId: COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', projectId),
        Query.equal('resourceType', 'project'),
        Query.equal('userId', actor.$id)
      ] as any
    });

    if (collabsRes.rows.length > 0) {
      const c = collabsRes.rows[0];
      permissionLevel = c.permission === 'admin' ? 'admin' : (c.permission === 'write' ? 'editor' : 'viewer');
      collabId = c.$id;
      isInvited = true;
    } else {
      // Legacy fallback
      let metadata: any = {};
      try {
        metadata = JSON.parse(project.metadata || '{}');
      } catch {}
      const collaborators = metadata.collaborators || {};
      if (collaborators[actor.$id]) {
        permissionLevel = collaborators[actor.$id];
        isInvited = true;
      }
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Verification failed:', err);
  }

  if (!isInvited) {
    throw new Error('You are not invited to collaborate on this project');
  }

  // 2. Update polymorphic collaborators table to 'accepted' and accepted: true
  try {
    if (collabId) {
      await tables.updateRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: collabId,
        data: {
          status: 'accepted',
          accepted: true
        }
      });
    } else {
      // If legacy invite accepted, create the row now to make it primary!
      await tables.createRow({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        rowId: ID.unique(),
        data: {
          resourceId: projectId,
          resourceType: 'project',
          userId: actor.$id,
          permission: permissionLevel === 'admin' ? 'admin' : (permissionLevel === 'editor' ? 'write' : 'read'),
          invitedAt: new Date().toISOString(),
          accepted: true,
          status: 'accepted',
          role: 'collaborator'
        }
      });
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Failed to update polymorphic status:', err);
  }

  // 3. Grant physical Appwrite read permission
  const newPermissions = new Set(project.$permissions || []);
  newPermissions.add(`read("user:${actor.$id}")`);

  const { users, databases } = createSystemClient();
  const owner = await users.get(project.ownerId);
  const isPro = hasPaidKylrixPlan(owner);

  if (isPro) {
    try {
      const { isTeamExpanded, newAcl } = await provisionHybridTeamExpansionSecure(
        databases, projectId, 'project', project.ownerId, actor.$id, permissionLevel
      );
      if (isTeamExpanded && newAcl) {
        newPermissions.add(newAcl);
      }
    } catch (teamErr: any) {
      console.warn('[acceptProjectInviteSecure] Hybrid Team expansion skipped or failed:', teamErr?.message);
    }
  }

  let metadata: any = {};
  try {
    metadata = JSON.parse(project.metadata || '{}');
  } catch {}

  await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    rowId: projectId,
    data: {
      metadata: JSON.stringify(metadata)
    },
    permissions: Array.from(newPermissions)
  });

  // 3. Create object link in project_objects
  const now = new Date().toISOString();
  try {
    const existingObjects = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', projectId),
        Query.equal('entityKind', 'collaborator'),
        Query.equal('entityId', actor.$id)
      ] as any});

    if (existingObjects.rows.length === 0) {
      await tables.createRow({
        databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
        tableId: 'project_objects',
        rowId: ID.unique(),
        data: {
          projectId,
          entityKind: 'collaborator',
          entityId: actor.$id,
          role: permissionLevel,
          createdAt: now,
          updatedAt: now},
        permissions: [
          Permission.read(Role.user(project.ownerId)),
          Permission.read(Role.user(actor.$id))
        ]
      });
    }
  } catch (err) {
    console.error('[acceptProjectInviteSecure] Failed to write project_objects link:', err);
  }

  // 4. Create encrypted chat membership (if present)
  if (metadata.encryptedGroupId) {
    try {
      const existingMembers = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: 'conversationMembers',
        queries: [
          Query.equal('conversationId', metadata.encryptedGroupId),
          Query.equal('userId', actor.$id)
        ] as any
      }).catch(() => ({ rows: [] }));

      if (existingMembers.rows.length === 0) {
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
          tableId: 'conversationMembers',
          rowId: ID.unique(),
          data: {
            conversationId: metadata.encryptedGroupId,
            userId: actor.$id},
          permissions: [
            Permission.read(Role.user(project.ownerId)),
            Permission.read(Role.user(actor.$id))
          ]
        });
      }
    } catch (e) {
      console.warn('[acceptProjectInviteSecure] Failed to sync to E2E project group:', e);
    }
  }

  return { success: true };
}

export async function addObjectToProjectSecure(
  projectId: string,
  entityKind: string,
  entityId: string,
  role?: string,
  metadata?: any,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const isAllowed = await verifyProjectPermission(projectId, actor.$id, 'editor');
  if (!isAllowed) {
    throw new Error('Forbidden: Insufficient permissions to manage objects in this project');
  }

  const tables = createSystemTablesDB();
  const now = new Date().toISOString();

  const duplicateRes = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'project_objects',
    queries: [
      Query.equal('projectId', projectId),
      Query.equal('entityKind', entityKind),
      Query.equal('entityId', entityId),
      Query.limit(1),
    ] as any});
  if (duplicateRes.rows.length > 0) {
    throw new Error('ALREADY_ADDED: This item is already linked to the project.');
  }

  if (entityKind === 'project') {
    const { getUserSubscriptionTierServer } = await import('@/lib/services/internal/subscription-entitlement');
    const tier = await getUserSubscriptionTierServer(actor.$id);
    if (!allowsCollaboratorSharing(tier, 'project')) {
      throw new Error('Nested projects require a plan that includes Projects.');
    }
  }

  const permissions = [
    Permission.read(Role.user(actor.$id))];

  const obj = await tables.createRow({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: 'project_objects',
      rowId: ID.unique(),
      data: {
      projectId,
      entityKind,
      entityId,
      role: role || 'member',
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      createdAt: now,
      updatedAt: now},
      permissions: permissions});

  // Authoritative sync to polymorphic objects table
  try {
    const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
    const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';
    await tables.createRow({
      databaseId,
      tableId,
      rowId: ID.unique(),
      data: {
        parentId: projectId,
        parentKind: 'project',
        childId: entityId,
        childKind: entityKind,
        userId: actor.$id,
        metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        createdAt: now,
        updatedAt: now,
        isPublic: !!obj.isPublic,
        isGuest: !!obj.isGuest,
        isGeneral: !!obj.isGeneral
      },
      permissions: permissions
    });
  } catch (e) {
    console.warn('[projects] Generic objects sync failed:', e);
  }

  return JSON.parse(JSON.stringify(obj));
}

type TaggedResourceBundle = {
  notes: any[];
  tasks: any[];
  credentials: any[];
  totps: any[];
  events: any[];
  forms: any[];
  moments: any[];
};

const EMPTY_TAGGED: TaggedResourceBundle = {
  notes: [],
  tasks: [],
  credentials: [],
  totps: [],
  events: [],
  forms: [],
  moments: []};

export async function listProjectTaggedResourcesSecure(
  projectId: string,
  tagIds: string[],
  jwt?: string,
): Promise<TaggedResourceBundle> {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const hasAccess = await verifyProjectPermission(projectId, actor.$id, 'viewer').catch(() => false);
  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient permissions to view this project');
  }

  if (!tagIds?.length) {
    return { ...EMPTY_TAGGED };
  }

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASE_ID;
  const pivotTable = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'resource_tags';
  const tagsTable = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const tagsRes = await tables.listRows({
    databaseId,
    tableId: tagsTable,
    queries: [Query.equal('$id', tagIds), Query.limit(100)] as any});
  const tagNames = tagsRes.rows.map((t: any) => t.name).filter(Boolean);

  const sweptRes = await tables.listRows({
    databaseId,
    tableId: APPWRITE_CONFIG.TABLES.SWEPT || 'swept',
    queries: [Query.equal('projectId', projectId), Query.limit(500)] as any});
  const sweptByUser = new Map<string, boolean>(
    sweptRes.rows.map((row: any) => [row.userId, row.enabled === true]),
  );
  const isSweepEnabled = (ownerId?: string | null) => {
    if (!ownerId) return false;
    return sweptByUser.get(ownerId) === true;
  };

  const [pivotById, pivotByName] = await Promise.all([
    tables.listRows({
      databaseId,
      tableId: pivotTable,
      queries: [Query.equal('tagId', tagIds), Query.limit(5000)] as any}),
    tagNames.length
      ? tables.listRows({
          databaseId,
          tableId: pivotTable,
          queries: [Query.equal('tag', tagNames), Query.limit(5000)] as any})
      : Promise.resolve({ rows: [] as any[] }),
  ]);

  const seenPivotIds = new Set<string>();
  const allPivotRows = [...pivotById.rows, ...pivotByName.rows].filter((p: any) => {
    if (seenPivotIds.has(p.$id)) return false;
    seenPivotIds.add(p.$id);
    return isSweepEnabled(p.userId);
  });

  if (!allPivotRows.length) {
    return { ...EMPTY_TAGGED };
  }

  const resourceIdsByType: Record<string, Set<string>> = {};
  allPivotRows.forEach((p: any) => {
    const type = p.resourceType;
    const id = p.resourceId;
    if (!type || !id) return;

    let normalized = type;
    if (type === 'productivity.task' || type === 'goal') normalized = 'task';
    if (type === 'password' || type === 'secret') normalized = 'credential';

    if (!resourceIdsByType[normalized]) resourceIdsByType[normalized] = new Set();
    resourceIdsByType[normalized].add(id);
  });

  const notesPromise = resourceIdsByType.note?.size
    ? tables.listRows({
        databaseId,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.note)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const tasksPromise = resourceIdsByType.task?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.task)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const credentialsPromise = resourceIdsByType.credential?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.credential)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const totpsPromise = resourceIdsByType.totp?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.totp)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const eventsPromise = resourceIdsByType.event?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.event)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const formsPromise = resourceIdsByType.form?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
        tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.form)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const momentsPromise = resourceIdsByType.moment?.size
    ? tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.CONNECT,
        tableId: APPWRITE_CONFIG.TABLES.CONNECT.MOMENTS,
        queries: [Query.equal('$id', Array.from(resourceIdsByType.moment)), Query.limit(500)] as any}).then((r) => r.rows).catch(() => [])
    : Promise.resolve([]);

  const [notes, tasks, credentials, totps, events, forms, moments] = await Promise.all([
    notesPromise,
    tasksPromise,
    credentialsPromise,
    totpsPromise,
    eventsPromise,
    formsPromise,
    momentsPromise,
  ]);

  return JSON.parse(JSON.stringify({ notes, tasks, credentials, totps, events, forms, moments }));
}

export async function getSweptConfigSecure(projectId: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const hasAccess = await verifyProjectPermission(projectId, actor.$id, 'viewer').catch(() => false);
  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient permissions to view this project');
  }

  const tables = createSystemTablesDB();
  const existing = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASE_ID,
    tableId: APPWRITE_CONFIG.TABLES.SWEPT || 'swept',
    queries: [
      Query.equal('userId', actor.$id),
      Query.equal('projectId', projectId),
      Query.limit(1),
    ] as any});

  if (existing.rows[0]) {
    return JSON.parse(JSON.stringify(existing.rows[0]));
  }

  return {
    userId: actor.$id,
    projectId,
    enabled: false,
    scopeType: 'project',
    anchorKind: 'tag',
    anchors: null,
    policy: null};
}

