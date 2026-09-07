'use server';

import * as shared from './shared';
import {
  ID, Permission, Query, Role
} from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';


import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { withSystemTransaction } from '@/lib/services/internal/transaction';
import { Registry } from '@/lib/core/di/registry';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';
import { dispatchEmail } from '@/lib/services/internal/emailDispatch';
import { executeCascadeDeleteSecure } from '../cascade-delete';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { PublicResourceType } from '@/lib/share/resource-types';
import {
  IDSchema,
  JWTSchema,
  CreateRowSchema,
  UpdateRowSchema,
  CRUDParamsSchema,
  ListParamsSchema
} from '@/lib/validations/schemas';

// Import interfaces / types from shared
import { TokenAction } from './shared';

// Bind shared helper properties and variables to local scope for convenience
const {
  getActor,
  getRowCached,
  isEnvAdminUser,
  isEnvSERVERSDKUser,
  verifyResourcePermissionSecure
} = shared;



async function getIsSpecializedTable(tableId: string): Promise<boolean> {
  return (
    tableId === APPWRITE_CONFIG.TABLES.FLOW.GUESTS || 
    tableId === 'Collaborators' || 
    tableId === 'collaborators' ||
    tableId === 'formSubmissions' ||
    tableId === 'wallets' ||
    tableId === 'walletMap' ||
    tableId === 'follows' ||
    tableId === 'activityLog' ||
    tableId === 'conversations' ||
    tableId === 'conversationMembers'
  );
}

export async function batchTrashFormSubmissionsSecure(
  formId: string,
  submissionIds: string[],
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const fId = String(formId || '').trim();
  const ids = (submissionIds || []).map(id => String(id).trim()).filter(Boolean);
  if (!fId || !ids.length) return { success: true, count: 0 };

  const dbId = APPWRITE_CONFIG.DATABASES.FLOW;
  const formsTable = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
  const submissionsTable = APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS;

  // Single permission check for the parent form
  const isFormOwner = await verifyResourcePermissionSecure({
    databaseId: dbId,
    tableId: formsTable,
    rowId: fId,
    actorId: actor.$id,
    action: 'delete',
    ownerFields: ['userId', 'creatorId', 'ownerId'],
    metadataField: 'settings'
  });

  if (!isFormOwner) {
    // If not form owner, verify each submission belongs to the submitter
    const tables: any = createSystemTablesDB();
    for (const subId of ids) {
      try {
        const sub = await tables.getRow({ databaseId: dbId, tableId: submissionsTable, rowId: subId });
        if (sub?.submitterId !== actor.$id) throw new Error('Forbidden');
      } catch (_err: any) {
        throw new Error(`Forbidden: Cannot delete submission ${subId}`);
      }
    }
  }

  // Atomically update all submissions to isTrash: true using Appwrite Transactions API
  try {
    await withSystemTransaction(async (txId) => {
      const tables: any = createSystemTablesDB();
      for (const subId of ids) {
        await tables.updateRow({
          databaseId: dbId,
          tableId: submissionsTable,
          rowId: subId,
          data: { isTrash: true },
          transactionId: txId
        });
      }
    }, { ttl: 60 });
  } catch (_err) {
    // Fallback: batch update with system client
    const tables: any = createSystemTablesDB();
    await Promise.all(
      ids.map(subId =>
        tables.updateRow({
          databaseId: dbId,
          tableId: submissionsTable,
          rowId: subId,
          data: { isTrash: true }
        }).catch(() => null)
      )
    );
  }

  return JSON.parse(JSON.stringify({ success: true, count: ids.length }));
}

export async function searchGlobalUsersSecure(query: string, limit = 10) {
  const cleaned = String(query || '').trim().replace(/^@/, '');
  if (!cleaned) return [];

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;
  const isEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);

  if (isEmailQuery) {
    try {
      const { users } = createSystemClient();
      const userList = await users.list([
        Query.equal('email', cleaned.toLowerCase()),
        Query.limit(1),
      ]).catch(() => ({ users: [] as any[] }));

      const authUser = userList.users?.[0];
      if (!authUser) return [];

      let profile: any = null;
      try {
        profile = await tables.getRow({
          databaseId,
          tableId,
          rowId: authUser.$id});
      } catch {
        const profRes = await tables.listRows({
          databaseId,
          tableId,
          queries: [Query.equal('userId', authUser.$id), Query.limit(1)] as any});
        profile = profRes.rows?.[0] || null;
      }

      return [JSON.parse(JSON.stringify({
        $id: authUser.$id,
        id: authUser.$id,
        userId: authUser.$id,
        username: profile?.username || null,
        displayName: profile?.displayName || authUser.name || null,
        avatar: profile?.avatar || null,
        bio: profile?.bio || null,
        publicKey: profile?.publicKey || null,
        email: authUser.email,
        $createdAt: profile?.$createdAt || null,
        last_username_edit: profile?.last_username_edit || null,
        tier: profile?.tier || null}))];
    } catch (error: any) {
      console.warn('[searchGlobalUsersSecure] Email search failed:', error?.message);
      return [];
    }
  }

  try {
    const res = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.or([
          Query.startsWith('username', cleaned.toLowerCase()),
          Query.startsWith('displayName', cleaned),
          Query.startsWith('userId', cleaned)
        ]),
        Query.notEqual('isPublic', false),
        Query.limit(limit)
      ] as any});

    return JSON.parse(JSON.stringify(res.rows));
  } catch (error: any) {
    console.warn('[searchGlobalUsersSecure] Search failed:', error?.message);
    return [];
  }
}

export async function getProfileByUsernameSecure(username: string) {
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '');
  if (!normalized) return null;

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.CHAT;
  const tableId = APPWRITE_CONFIG.TABLES.CHAT.PROFILES;

  try {
    const res = await tables.listRows({
      databaseId,
      tableId,
      queries: [
        Query.equal('username', normalized),
        Query.limit(1)
      ] as any});

    return JSON.parse(JSON.stringify(res.rows[0] || null));
  } catch (error: any) {
    console.warn('[getProfileByUsernameSecure] Failed:', error?.message);
    return null;
  }
}

export async function listRowsSecure(databaseId: string, tableId: string, queries: string[] = [], jwt?: string) {
  // Rigorous runtime validation
  const validated = ListParamsSchema.parse({ databaseId, tableId, queries });
  
  try {
    const res = await Registry.getDatabase().listRows<any>(validated.databaseId, validated.tableId, validated.queries, { jwt });
    console.log('[listRowsSecure] Success via DatabasePort. Total:', res.total, 'Count:', res.rows?.length);
    // Unified response: 'rows' is now the primary key, 'documents' is legacy
    return JSON.parse(JSON.stringify({
        total: res.total,
        rows: res.rows}));
  } catch (error: any) {
    console.error('[listRowsSecure] Failed:', error?.message);
    throw error;
  }
}

export async function getRowSecure(databaseId: string, tableId: string, rowId: string, jwt?: string) {
  console.log('[getRowSecure] Request:', { databaseId, tableId, rowId });
  
  try {
    const res = await Registry.getDatabase().getRow<any>(databaseId, tableId, rowId, { jwt });
    return JSON.parse(JSON.stringify(res));
  } catch (error: any) {
    console.warn('[getRowSecure] User-scoped fetch failed, checking admin fallback for RLS bypass:', error?.message);
    
    // Attempt dynamic admin fallback for Chat Conversations or Notes
    const isChatConv = databaseId === APPWRITE_CONFIG.DATABASES.CHAT && tableId === APPWRITE_CONFIG.TABLES.CHAT.CONVERSATIONS;
    const isNote = databaseId === APPWRITE_CONFIG.DATABASES.NOTE && tableId === APPWRITE_CONFIG.TABLES.NOTE.NOTES;
    
    if (isChatConv || isNote) {
      try {
        const actor = await getActor(jwt);
        if (actor?.$id) {
          const adminTables = createSystemTablesDB();
          const adminRes = await adminTables.getRow({
            databaseId,
            tableId,
            rowId});
          
          if (adminRes) {
            let isAuthorized = false;
            
            if (isChatConv) {
              const participants = adminRes.participants || [];
              if (participants.includes(actor.$id)) {
                isAuthorized = true;
              } else {
                const memberRows = await adminTables.listRows({
                  databaseId: databaseId,
                  tableId: 'conversationMembers',
                  queries: [
                    Query.equal('conversationId', rowId),
                    Query.equal('userId', actor.$id),
                    Query.limit(1)
                  ]
                }).catch(() => ({ total: 0, rows: [] }));
                if (memberRows.total > 0) {
                  isAuthorized = true;
                }
              }
            } else if (isNote) {
              const collaborators = adminRes.collaborators || [];
              if (adminRes.userId === actor.$id || collaborators.includes(actor.$id)) {
                isAuthorized = true;
              } else {
                const collabRows = await adminTables.listRows({
                  databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
                  tableId: 'Collaborators',
                  queries: [
                    Query.equal('resourceId', rowId),
                    Query.equal('userId', actor.$id),
                    Query.limit(1)
                  ]
                }).catch(() => ({ total: 0, rows: [] }));
                if (collabRows.total > 0) {
                  isAuthorized = true;
                }
              }
            }
            
            if (isAuthorized) {
              console.log('[getRowSecure] Admin RLS bypass authorized successfully for user:', actor.$id);
              return JSON.parse(JSON.stringify(adminRes));
            }
          }
        }
      } catch (adminErr) {
        console.error('[getRowSecure] Admin fallback exception:', adminErr);
      }
    }

    if (error?.code === 404 || error?.status === 404 || error?.message?.includes('could not be found')) {
      return null;
    }
    
    throw error;
  }
}

export async function getFilePreviewSecure(bucketId: string, fileId: string, width = 100, height = 100) {
  const { storage } = createSystemClient();
  try {
    const url = storage.getFilePreview(bucketId, fileId, width, height);
    // Fetch preview content from the server-side context where we have full credentials
    const res = await fetch(url.toString(), {
      headers: {
        'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
        'X-Appwrite-Key': process.env.APPWRITE_API || ''}});
    if (!res.ok) {
      console.warn('[getFilePreviewSecure] Failed to fetch url:', url.toString(), 'status:', res.status);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    console.warn('[getFilePreviewSecure] Failed:', error?.message);
    return null;
  }
}

export async function promotethreadResourceThreadToStorySecure(
  resourceId: string,
  resourceType: string,
  jwt?: string
) {
  const actor = await getActor(jwt);
  if (!actor || !actor.$id) {
    throw new Error('Unauthorized');
  }

  const tables = createSystemTablesDB();

  // 1. Fetch all comments linked to this resource's discussion note
  const commentsList = await tables.listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    queries: [
      Query.equal('noteId', resourceId)
    ] as any
  }).catch(() => ({ rows: [] }));

  // 2. Fetch the thread note itself to see if it exists
  const noteRow = await tables.getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: resourceId
  }).catch(() => null);

  const title = noteRow?.title || `Discussion: ${resourceType} ${resourceId.slice(-8)}`;

  // 3. Compile comments history into a clean markdown row
  let markdownContent = `# Discussion History\n\n*Resource Type: ${resourceType}*\n*Date: ${new Date().toLocaleDateString()}*\n\n`;
  if (commentsList.rows.length === 0) {
    markdownContent += `*No comments were recorded in this thread.*`;
  } else {
    // Sort comments chronologically
    const sorted = [...commentsList.rows].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const c of sorted) {
      markdownContent += `### ${c.userId === actor.$id ? 'You' : 'Collaborator'} (${new Date(c.createdAt).toLocaleTimeString()})\n${c.content}\n\n`;
    }
  }

  // 4. Provision a new permanent story note
  const now = new Date().toISOString();
  const storyNoteId = ID.unique();
  const storyMeta = JSON.stringify({
    isthread: false,
    isStory: true,
    linkedResourceType: resourceType,
    linkedResourceId: resourceId,
    version: 'v2'
  });

  const storyNote = await tables.createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: storyNoteId,
    data: {
      title: `Story: ${title}`,
      content: markdownContent,
      format: 'markdown',
      isPublic: true,
      userId: actor.$id,
      createdAt: now,
      updatedAt: now,
      metadata: storyMeta
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
    ]
  });

  // 5. Cleanup the original thread note comments
  await Promise.all(
    commentsList.rows.map(c => 
      tables.deleteRow({
        databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
        tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
        rowId: c.$id
      }).catch(() => null)
    )
  );

  // 6. Delete the original thread note
  if (noteRow) {
    await tables.deleteRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: resourceId
    }).catch(() => null);
  }

  return JSON.parse(JSON.stringify(storyNote));
}

export async function deletethreadThreadSecure(threadId: string, jwt?: string) {
    const actor = await getActor(jwt);
    if (!actor || !actor.$id) throw new Error('Unauthorized');

    const tables = createSystemTablesDB();
    const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
    const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

    // 1. Fetch thread to verify ownership or collaboration
    const thread = await getRowCached({ databaseId: dbId, tableId, rowId: threadId });
    if (!thread) throw new Error('Thread not found');

    const isCreator = thread.creatorId === actor.$id || thread.userId === actor.$id;
    
    let isAuthorized = isCreator;

    if (!isAuthorized) {
        // Check if actor is a collaborator on the thread itself OR the parent resource
        const resourceId = thread.resourceId || threadId;
        try {
            const collabsRes = await tables.listRows({
                databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
                tableId: 'Collaborators',
                queries: [
                    Query.equal('resourceId', resourceId),
                    Query.equal('userId', actor.$id)
                ] as any
            });
            if (collabsRes.rows.length > 0) {
                isAuthorized = true;
            }
        } catch {}
    }

    if (!isAuthorized) {
        throw new Error('Forbidden: Insufficient permissions to delete this thread');
    }

    // 2. Cascade delete children (comments, reactions, voice files, linked objects, key mappings)
    try {
        await executeCascadeDeleteSecure(dbId, tableId, threadId);
    } catch (err) {
        console.error('[deletethreadThreadSecure] Cascade cleanup failed:', err);
    }

    // 2b. Wipe project_objects and key_mapping for discussion thread thread
    try {
        const polyCollabs = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: 'Collaborators',
            queries: [Query.equal('resourceId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((polyCollabs.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
            tableId: 'Collaborators',
            rowId: row.$id
        }).catch(() => null)));

        const keyMappings = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: 'key_mapping',
            queries: [Query.equal('resourceId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((keyMappings.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
            tableId: 'key_mapping',
            rowId: row.$id
        }).catch(() => null)));

        const projObjects = await tables.listRows({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'project_objects',
            queries: [Query.equal('entityId', threadId), Query.limit(1000)] as any
        }).catch(() => ({ rows: [] }));
        await Promise.all((projObjects.rows || []).map((row: any) => tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
            tableId: 'project_objects',
            rowId: row.$id
        }).catch(() => null)));
    } catch (cleanErr) {
        console.warn('[deletethreadThreadSecure] Secondary cleanup non-fatal warning:', cleanErr);
    }

    // 3. Delete the thread row itself
    const result = await tables.deleteRow({
        databaseId: dbId,
        tableId: tableId,
        rowId: threadId});

    return { success: true, result: JSON.parse(JSON.stringify(result)) };
}

export async function getGlobalProfileStatusSecure(userId: string) {
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) return { exists: false, error: 'userId is required' };

  try {
    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
      tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
      queries: [
        Query.equal('userId', targetUserId),
        Query.limit(1)
      ]
    });
    if (res.total > 0) {
      return { exists: true, profile: JSON.parse(JSON.stringify(res.rows[0])) };
    }
    return { exists: false, error: 'Not Found' };
  } catch (e: any) {
    return { exists: false, error: e.message };
  }
}

export async function toggleResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  mode: 'publish' | 'copy_only' | 'make_private' | 'guest_off' | 'guest_on';
  projectId?: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor || !actor.$id) throw new Error('Unauthorized');

  const { resourceType, resourceId, mode, projectId } = params;
  const tables = createSystemTablesDB();

  const config = getResourceConfig(resourceType);
  if (!config) throw new Error(`Unsupported resource type: ${resourceType}`);

  const row = await tables.getRow({
    databaseId: config.databaseId,
    tableId: config.tableId,
    rowId: resourceId
  }).catch(() => null);

  if (!row) throw new Error('Resource not found');
  
  const ownerId = row.userId || row.ownerId || row.creatorId;
  if (ownerId !== actor.$id) {
     throw new Error('Only the owner can manage public sharing');
  }

  let isPublic = !!row.isPublic;
  let isGuest = !!row.isGuest;

  if (mode === 'copy_only') {
    return {
      success: true,
      isPublic,
      isGuest,
      publicUrl: buildPublicResourceUrl(resourceType, resourceId, { projectId })
    };
  }

  if (mode === 'publish') {
    isPublic = true;
    isGuest = true;
  } else if (mode === 'make_private') {
    isPublic = false;
    isGuest = false;
  } else if (mode === 'guest_off') {
    isGuest = false;
  } else if (mode === 'guest_on') {
    isGuest = true;
    isPublic = true;
  }


  const updateData: Record<string, unknown> = {
    isPublic,
    isGuest};

  // Only tables with a custom updatedAt column — tasks/events/forms omit it.
  if (resourceType === 'note' || resourceType === 'project' || resourceType === 'credential' || resourceType === 'totp') {
    updateData.updatedAt = new Date().toISOString();
  }

  if (resourceType === 'project') {
    updateData.visibility = isPublic || isGuest ? 'public' : 'private';
    if (!isPublic && !isGuest) {
      updateData.isGuest = false;
    }
  }

  if (resourceType === 'form' && mode === 'publish') {
    updateData.status = 'published';
  }

  // Transactional for encrypted vault objects (credential/totp) where share toggle implies key/collab fan-out; single-row but kept atomic with RLS bypass
  try {
    try {
      await withSystemTransaction(async (txId) => {
        await (createSystemTablesDB() as any).updateRow({ databaseId: config.databaseId, tableId: config.tableId, rowId: resourceId, data: updateData, permissions: row.$permissions || [], transactionId: txId });
      }, { ttl: 30 });
    } catch {
      await tables.updateRow({
        databaseId: config.databaseId,
        tableId: config.tableId,
        rowId: resourceId,
        data: updateData,
        permissions: row.$permissions || []
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not save sharing settings';
    console.error('[toggleResourcePublicGuest]', resourceType, resourceId, error);
    throw new Error(message);
  }

  const publicUrl = buildPublicResourceUrl(resourceType, resourceId, { projectId });

  return {
    success: true,
    isPublic,
    isGuest,
    publicUrl
  };
}

export async function getResourcePublicGuestSecure(params: {
  resourceType: PublicResourceType;
  resourceId: string;
  jwt?: string;
}) {
  const config = getResourceConfig(params.resourceType);
  if (!config) throw new Error(`Unsupported resource type: ${params.resourceType}`);

  const tables = createSystemTablesDB();
  const row = await tables.getRow({
    databaseId: config.databaseId,
    tableId: config.tableId,
    rowId: params.resourceId
  }).catch(() => null);

  if (!row) throw new Error('Resource not found');

  return {
    isPublic: !!row.isPublic,
    isGuest: !!row.isGuest,
    isPinned: !!row.isPinned,
    userId: row.userId || row.ownerId || row.creatorId
  };
}

function getResourceConfig(type: PublicResourceType) {
  switch (type) {
    case 'note': return { databaseId: APPWRITE_CONFIG.DATABASES.NOTE, tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES };
    case 'credential': return { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS };
    case 'totp': return { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS };
    case 'task':
    case 'goal': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS };
    case 'form': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS };
    case 'event': return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS };
    case 'project': return { databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: 'projects' };
    case 'moment': return { databaseId: APPWRITE_CONFIG.DATABASES.CHAT, tableId: APPWRITE_CONFIG.TABLES.CHAT.MOMENTS };
    case 'agent_session':
    case 'agent_conversation':
      return { databaseId: APPWRITE_CONFIG.DATABASES.NOTE, tableId: 'agentic_sessions' };
    default: return null;
  }
}

export async function attachObjectSecure(params: {
  parentId: string;
  parentKind: string;
  childId: string;
  childKind: string;
  metadata?: any;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  // Note parent safety: only note owner or write collaborator can attach.
  if (params.parentKind === 'note') {
    const note = await tables.getRow({
      databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
      tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      rowId: params.parentId}).catch(() => null as any);

    if (!note) throw new Error('Parent note not found');

    const isOwner = note.userId === actor.$id;
    const collaborators = Array.isArray(note.collaborators) ? note.collaborators : [];
    const hasWriteAccess = collaborators.some((entry: any) => {
      try {
        const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
        return parsed?.userId === actor.$id && String(parsed?.permission || '').toLowerCase() === 'write';
      } catch {
        return false;
      }
    });

    if (!isOwner && !hasWriteAccess) {
      throw new Error('Forbidden: You do not have write access to this note.');
    }
  }

  // Count existing attachments for the container
  const containerExisting = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', params.parentId),
      Query.equal('parentKind', params.parentKind)
    ] as any
  });

  const duplicate = containerExisting.rows.find((row: any) => (
    row?.childId === params.childId && row?.childKind === params.childKind
  ));
  if (duplicate) {
    return JSON.parse(JSON.stringify(duplicate));
  }



  const now = new Date().toISOString();
  const obj = await tables.createRow({
    databaseId,
    tableId,
    rowId: ID.unique(),
    data: {
      parentId: params.parentId,
      parentKind: params.parentKind,
      childId: params.childId,
      childKind: params.childKind,
      userId: actor.$id,
      metadata: params.metadata ? (typeof params.metadata === 'string' ? params.metadata : JSON.stringify(params.metadata)) : null,
      createdAt: now,
      updatedAt: now,
      isPublic: false,
      isGuest: false,
      isGeneral: false
    },
    permissions: [
      Permission.read(Role.user(actor.$id)),
    ]
  });

  return JSON.parse(JSON.stringify(obj));
}

export async function detachObjectByRelationSecure(params: {
  parentId: string;
  childId: string;
  childKind?: string;
  isSecondary?: boolean;
  bucketId?: string;
  jwt?: string;
}) {
  const actor = await getActor(params.jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  const res = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', params.parentId),
      Query.equal('childId', params.childId),
      Query.limit(10)
    ] as any
  });

  // Check metadata from rows to see if any record was secondary
  let isSecondary = Boolean(params.isSecondary);
  let bucketId = params.bucketId;
  let childKind = params.childKind;

  for (const row of res.rows as any[]) {
    try {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      if (meta?.isSecondary) isSecondary = true;
      if (meta?.bucketId && !bucketId) bucketId = meta.bucketId;
      if (row.childKind && !childKind) childKind = row.childKind;
    } catch {}
  }

  await Promise.all(res.rows.map((row: any) => 
    tables.deleteRow({
      databaseId,
      tableId,
      rowId: row.$id
    })
  ));

  // If this was a secondary object (created in-situ directly on the parent), wipe its storage or row
  if (isSecondary) {
    try {
      if (childKind === 'voice' || childKind === 'file' || childKind === 'image') {
        const { storage } = createSystemClient();
        const targetBucket = bucketId || (childKind === 'voice' ? APPWRITE_CONFIG.BUCKETS.VOICE : APPWRITE_CONFIG.BUCKETS.GENERAL_STORAGE);
        await storage.deleteFile(targetBucket, params.childId).catch(() => {});
      }
    } catch (storageErr) {
      console.warn('[detachObjectByRelationSecure] Could not delete secondary storage file:', storageErr);
    }
  }

  return { success: true, count: res.rows.length };
}

export async function getProfilePicturePreviewSecure(fileId: string): Promise<string | null> {
  const targetId = String(fileId || '').trim();
  if (!targetId) return null;

  try {
    const { storage } = createSystemClient();
    const fileBuffer = await storage.getFilePreview('profile_pictures', targetId, 160, 160);
    const base64 = Buffer.from(fileBuffer).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err: any) {
    console.error('[secure-ops] getProfilePicturePreviewSecure failed:', err);
    return null;
  }
}

export async function getObjectsByParentSecure(parentId: string, parentKind: string, jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();
  const databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
  const tableId = APPWRITE_CONFIG.TABLES.FLOW.OBJECTS || 'objects';

  const res = await tables.listRows({
    databaseId,
    tableId,
    queries: [
      Query.equal('parentId', parentId),
      Query.equal('parentKind', parentKind),
      Query.limit(100)
    ] as any
  });

  return JSON.parse(JSON.stringify(res.rows));
}

