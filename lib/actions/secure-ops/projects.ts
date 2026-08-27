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
        queries: [
          Query.equal('ownerId', actor.$id),
          Query.notEqual('isTrash', true)
        ]}),
    tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceType', 'project'),
          Query.equal('userId', actor.$id),
        ] as any})
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

  return Array.from(projectsListMap.values());
}

export async function createProjectSecure(data: any, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  // Rigorous runtime validation
  const validated = ProjectSchema.parse(data);

  const userTier = getUserSubscriptionTier(actor);
  const tables = createSystemTablesDB();
  const existingProjects = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
    tableId: 'projects',
    queries: [
      Query.equal('ownerId', actor.$id)
    ] as any
  });
  const maxProjects = getProjectCap(userTier);
  if (existingProjects.rows.length >= maxProjects) {
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

  const permissions = [
    Permission.read(Role.user(actor.$id)),
  ];

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
      throw new Error('Sub-projects require a TEAMS subscription.');
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

  const permissions = [
    Permission.read(Role.user(ownerId))];

  if (currentStatus === 'published') {
    permissions.push(Permission.read(Role.any()));
  }

  // Include physical read permissions for collaborators in the new permissions set
  let settings: any = {};
  try {
    settings = JSON.parse(form.settings || '{}');
  } catch {}
  if (settings.collaborators) {
    Object.keys(settings.collaborators).forEach((userId) => {
      permissions.push(Permission.read(Role.user(userId)));
    });
  }

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
  const permissions = [
    Permission.read(Role.user(ownerId))];

  // Include physical read permissions for all manager guests
  try {
    const guestsRes = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.GUESTS,
      queries: [Query.equal('eventId', eventId)] as any});
    guestsRes.rows.forEach((g: any) => {
      if (g.userId && String(g.role || '').startsWith('manager-')) {
        permissions.push(Permission.read(Role.user(g.userId)));
      }
    });
  } catch (err) {
    console.error('Failed to query manager physical read permissions in updateEventSecure', err);
  }

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

  const permissions = [Permission.read(Role.user(actor.$id))];
  if (data?.isPublic) {
    permissions.push(Permission.read(Role.any()));
  }

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

  const updated = await tables.updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: goalId,
    data: dataPayload as any,
  });

  return JSON.parse(JSON.stringify(updated));
}

export async function deleteGoalSecure(goalId: string, jwt?: string): Promise<void> {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized: Session expired or invalid');
  }

  const tables = createSystemTablesDB();
  try {
    await tables.updateRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      rowId: goalId,
      data: { isTrash: true, isDeleted: true },
    });
  } catch (_err: any) {
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
      tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
      rowId: goalId,
    }).catch(() => {});
  }
}

export async function resolveWorkspaceShareAccessSecure(workspaceId: string, jwt?: string) {
  const actor = await getActor(jwt).catch(() => null);
  const tables = createSystemTablesDB();
  const dbId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = 'projects';

  const row = await tables.getRow({
    databaseId: dbId,
    tableId,
    rowId: workspaceId,
  }).catch(() => null);

  if (!row) {
    return {
      success: false,
      reason: 'not_found' as const,
      message: 'Workspace does not exist or has been deleted.',
    };
  }

  const ownerId = row.ownerId || row.userId || 'unknown';
  const title = row.title || row.name || 'Shared Workspace';
  const isPublic = row.isPublic === true || row.isGuest === true;

  const isAgentic = row.isAgentic === true || String(row.isAgentic) === 'true';
  const agentId = row.agentId || null;

  // 1. Lazy check: If workspace is public, return access immediately!
  if (isPublic) {
    return {
      success: true,
      workspace: {
        id: row.$id,
        title,
        ownerId,
        isPublic: true,
        isAgentic,
        agentId,
        isOwner: actor?.$id ? actor.$id === ownerId : false,
      },
    };
  }

  // 2. If private, check if current actor is the owner
  if (actor?.$id && actor.$id === ownerId) {
    return {
      success: true,
      workspace: {
        id: row.$id,
        title,
        ownerId,
        isPublic: false,
        isAgentic,
        agentId,
        isOwner: true,
      },
    };
  }

  // 3. If private and actor is logged in, check if actor is a collaborator
  if (actor?.$id) {
    const hasAccess = await verifyProjectPermission(workspaceId, actor.$id, 'viewer').catch(() => false);
    if (hasAccess) {
      return {
        success: true,
        workspace: {
          id: row.$id,
          title,
          ownerId,
          isPublic: false,
          isAgentic,
          agentId,
          isCollaborator: true,
        },
      };
    }
  }

  // 4. Inaccessible (private and not a collaborator / unauthenticated):
  let ownerName = 'the workspace owner';
  if (row.ownerName) {
    ownerName = row.ownerName;
  } else if (ownerId && ownerId !== 'unknown') {
    try {
      const { UsersService } = await import('@/lib/services/users');
      const profile = await UsersService.getProfileById(ownerId).catch(() => null);
      if (profile?.displayName || profile?.username) {
        ownerName = profile.displayName || `@${profile.username}`;
      }
    } catch {}
  }

  return {
    success: false,
    reason: 'forbidden' as const,
    ownerName,
    message: `No access to workspace. Ask ${ownerName} to make public or add you to collaborators.`,
  };
}

/**
 * Resolves all entities belonging to a shared workspace across the 7 supported entity kinds:
 * 1. note (ideas/notes)
 * 2. goal (tasks/goals)
 * 3. form (forms)
 * 4. event (events)
 * 5. credential (vault secrets/passwords)
 * 6. totp (vault 2FA secrets)
 * 7. agent_session (Kylie / Sidekick agentic sessions)
 * 
 * Uses privileged Server SDK after verifying workspace accessibility (public/collaborator).
 */
export async function getSharedWorkspaceEntitiesSecure(
  workspaceId: string,
  entityKind: string,
  jwt?: string,
): Promise<{ success: boolean; rows: any[]; message?: string; error?: string }> {
  try {
    if (!workspaceId) {
      return { success: false, rows: [], message: 'Workspace ID required' };
    }

    const access = await resolveWorkspaceShareAccessSecure(workspaceId, jwt);
    if (!access.success) {
      return { success: false, rows: [], message: access.message || 'No access to workspace' };
    }

    const tables = createSystemTablesDB();
    const dbId = APPWRITE_CONFIG.DATABASES.CHAT;

    let normKind = entityKind.toLowerCase().trim();
    if (normKind === 'ideas' || normKind === 'notes' || normKind === 'idea') normKind = 'note';
    if (normKind === 'goals' || normKind === 'tasks' || normKind === 'task') normKind = 'goal';
    if (normKind === 'forms') normKind = 'form';
    if (normKind === 'events') normKind = 'event';
    if (normKind === 'credentials' || normKind === 'secrets' || normKind === 'secret' || normKind === 'password') normKind = 'credential';
    if (normKind === 'totps') normKind = 'totp';
    if (normKind === 'agent_sessions' || normKind === 'agentic_session' || normKind === 'agentic_sessions' || normKind === 'session' || normKind === 'sessions') normKind = 'agent_session';

    // 1. Query project_objects join table for this workspace
    const poRes = await tables.listRows({
      databaseId: dbId,
      tableId: 'project_objects',
      queries: [
        Query.equal('projectId', workspaceId),
        Query.limit(500),
      ] as any,
    }).catch(() => ({ rows: [] as any[] }));

    const matchingEntityIds: string[] = [];
    (poRes.rows || []).forEach((po: any) => {
      let k = (po.entityKind || '').toLowerCase();
      if (k === 'ideas' || k === 'notes' || k === 'idea') k = 'note';
      if (k === 'goals' || k === 'tasks' || k === 'task') k = 'goal';
      if (k === 'forms') k = 'form';
      if (k === 'events') k = 'event';
      if (k === 'credentials' || k === 'secrets' || k === 'secret' || k === 'password') k = 'credential';
      if (k === 'totps') k = 'totp';
      if (k === 'agent_sessions' || k === 'agentic_session' || k === 'agentic_sessions' || k === 'session' || k === 'sessions') k = 'agent_session';

      if (k === normKind && po.entityId) {
        matchingEntityIds.push(String(po.entityId));
      }
    });

    const rowsById = new Map<string, any>();

    // Helper to fetch individual rows by matching entityId (from project_objects) and by tags
    const queryAndCollect = async (tableId: string, hasTags = false) => {
      // 1. Fetch all matching entity IDs directly via getRow
      if (matchingEntityIds.length > 0) {
        const rowFetches = matchingEntityIds.map((rowId) =>
          tables
            .getRow({
              databaseId: dbId,
              tableId,
              rowId,
            })
            .catch(() => null)
        );
        const fetchedRows = await Promise.all(rowFetches);
        fetchedRows.forEach((r: any) => {
          if (r && (r.$id || r.id)) {
            const rowId = r.$id || r.id;
            rowsById.set(rowId, {
              ...r,
              id: rowId,
              $id: rowId,
              projectId: workspaceId,
              isWorkspace: true,
            });
          }
        });
      }

      // 2. For tables supporting tags (notes, tasks), also query tags
      if (hasTags) {
        try {
          const [wsTagsRes, projTagsRes] = await Promise.all([
            tables
              .listRows({
                databaseId: dbId,
                tableId,
                queries: [Query.contains('tags', `workspace:${workspaceId}`), Query.limit(200)] as any,
              })
              .catch(() => ({ rows: [] })),
            tables
              .listRows({
                databaseId: dbId,
                tableId,
                queries: [Query.contains('tags', `project:${workspaceId}`), Query.limit(200)] as any,
              })
              .catch(() => ({ rows: [] })),
          ]);

          const tagRows = [
            ...(Array.isArray(wsTagsRes?.rows) ? wsTagsRes.rows : []),
            ...(Array.isArray(projTagsRes?.rows) ? projTagsRes.rows : []),
          ];

          tagRows.forEach((r: any) => {
            if (r && (r.$id || r.id)) {
              const rowId = r.$id || r.id;
              rowsById.set(rowId, {
                ...r,
                id: rowId,
                $id: rowId,
                projectId: workspaceId,
                isWorkspace: true,
              });
            }
          });
        } catch {}
      }
    };

    switch (normKind) {
      case 'note':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.NOTE.NOTES, true);
        break;
      case 'goal':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.TASKS, true);
        break;
      case 'event':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.EVENTS, false);
        break;
      case 'form':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.FLOW.FORMS, false);
        break;
      case 'credential':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, false);
        break;
      case 'totp':
        await queryAndCollect(APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, false);
        break;
      case 'agent_session':
        await queryAndCollect('agentic_sessions', false);
        break;
      default:
        break;
    }

    const finalRows = Array.from(rowsById.values()).filter((r) => r.isTrash !== true && r.trash !== true);
    return {
      success: true,
      rows: JSON.parse(JSON.stringify(finalRows)),
    };
  } catch (err: any) {
    console.error('[getSharedWorkspaceEntitiesSecure] Error:', err);
    return {
      success: false,
      rows: [],
      error: err?.message || 'Failed to fetch shared workspace entities',
    };
  }
}

