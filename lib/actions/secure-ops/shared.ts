export { cookies } from 'next/headers';
import { createHmac, randomBytes } from 'node:crypto';
import { systemTables } from '@/lib/data/system-tables';
import { q } from '@/lib/data/queries';
import { Registry } from '@/lib/core/di/registry';

export const rowCache = new Map<string, { row: any; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

export async function invalidateRowCache(tableId?: string, rowId?: string) {
  if (!tableId && !rowId) {
    rowCache.clear();
    return;
  }
  for (const key of Array.from(rowCache.keys())) {
    if (rowId) {
      if (key.includes(`:${rowId}`)) {
        rowCache.delete(key);
      }
    } else if (tableId && key.includes(`:${tableId}:`)) {
      rowCache.delete(key);
    }
  }
}

export type TokenAction =
  | 'state'
  | 'initialize'
  | 'mint_activity'
  | 'transfer'
  | 'zap'
  | 'ledger'
  | 'balance'
  | 'fine_to_root'
  | 'lock_claim'
  | 'settle_claim';

export const VIEWER_COOKIE = 'kylrix_viewer_id';
const viewerSecret = () => String(process.env.VIEWER_TOKEN_SECRET || process.env.BETTER_AUTH_SECRET || 'kylrix-viewer-secret');
const signViewerToken = (payload: string) => createHmac('sha256', viewerSecret()).update(payload).digest('base64url');

export const issueViewerToken = () => {
  const payload = `${Date.now()}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${signViewerToken(payload)}`;
};

export const isViewerTokenValid = (token: string) => {
  const trimmed = String(token || '').trim();
  if (!trimmed) return false;
  const parts = trimmed.split('.');
  if (parts.length < 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return signViewerToken(payload) === parts[2];
};

export type PermissionLevel = 'viewer' | 'editor' | 'admin';

function resolveCollaboratorTypeFilter(tableId?: string) {
  if (!tableId) return null;
  if (tableId === 'ideas' || tableId === 'notes') {
    return q.equal('resourceType', 'note');
  }
  if (tableId === 'projects' || tableId === 'workspaces') {
    return q.equal('resourceType', 'project');
  }
  if (tableId === 'events') {
    return q.equal('resourceType', 'event');
  }
  if (tableId === 'forms') {
    return q.equal('resourceType', 'form');
  }
  if (tableId === 'credentials' || tableId === 'vault_items') {
    return q.equal('resourceType', 'secret');
  }
  if (tableId === 'totpSecrets' || tableId === 'totp_secrets') {
    return q.equal('resourceType', 'totp');
  }
  if (tableId === 'tasks' || tableId === 'goals') {
    return q.equal('resourceType', 'task');
  }
  return null;
}

export interface PermissionChangeInput {
  userId: string;
  resourceId: string;
  resourceType: 'note' | 'task' | 'project' | 'secret' | 'totp';
  resourceTitle: string;
  targetUserId: string;
  targetEmail?: string;
  permission: PermissionLevel;
  actorName: string;
  jwt?: string;
  skipEmail?: boolean;
}

const getRowInflight = new Map<string, Promise<any>>();

export async function getRowCached(params: { databaseId: string; tableId: string; rowId: string }) {
  const cacheKey = `${params.databaseId}:${params.tableId}:${params.rowId}`;
  const now = Date.now();
  const cached = rowCache.get(cacheKey);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.row ? { ...cached.row } : null;
  }
  const pending = getRowInflight.get(cacheKey);
  if (pending) {
    return await pending;
  }

  const fetcher = async () => {
    const db = Registry.getDatabase();
    const row = await db.getRow<any>(params.databaseId, params.tableId, params.rowId, { forceSystem: true });
    if (row) {
      if (rowCache.size > 200) {
        const cur = Date.now();
        for (const [key, val] of rowCache.entries()) {
          if (cur - val.timestamp > CACHE_TTL_MS) {
            rowCache.delete(key);
          }
        }
      }
      rowCache.set(cacheKey, { row, timestamp: Date.now() });
    }
    return row;
  };

  const task = fetcher().finally(() => {
    getRowInflight.delete(cacheKey);
  });
  getRowInflight.set(cacheKey, task);
  return await task;
}

export async function getActor(jwt?: string) {
  try {
    const { headers } = await import('next/headers');
    const { auth } = await import('@/lib/auth/better-auth');

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

    if (session?.user) {
      return {
        $id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || '',
        emailVerification: Boolean((session.user as any).emailVerified),
        isAdmin: false,
        labels: [],
        prefs: {},
      };
    }

    if (!jwt) return null;
    return await Registry.getAuth().getActor(jwt);
  } catch (err) {
    console.error('[secure-ops] getActor exception:', err);
    return null;
  }
}

export function isEnvSERVERSDKUser(user: any) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return false;
  const serverSDKSet = new Set(
    String(process.env.ADMINS || '')
      .split(',')
      .map((e: any) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  return serverSDKSet.has(email);
}

export function isEnvAdminUser(user: any) {
  return isEnvSERVERSDKUser(user);
}

export async function verifyResourcePermissionSecure(params: {
  databaseId?: string;
  tableId?: string;
  rowId?: string;
  actorId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  ownerFields?: string[];
  metadataField?: string;
  data?: any;
}) {
  const { databaseId = 'turso', tableId, rowId, actorId, action, ownerFields = ['userId', 'ownerId', 'creatorId'], metadataField = 'metadata', data } = params;
  
  let row = null;
  
  if (databaseId && tableId && rowId) {
    row = await getRowCached({
      databaseId,
      tableId,
      rowId
    }).catch(() => null);

    if (!row) {
      try {
        const tables = systemTables();
        row = await tables.getRow({
          databaseId,
          tableId,
          rowId
        });
      } catch (err) {
        console.warn('[verifyResourcePermissionSecure] Admin fallback fetch failed:', err);
      }
    }
  }

  if (!row && action !== 'create') {
    return false;
  }

  if (!row && data) {
    row = data;
  }

  if (!row) {
    return false;
  }
  
  let ownerId = '';
  for (const field of ownerFields) {
    const val = String(row[field] || '').trim();
    if (val) {
      ownerId = val;
      break;
    }
  }

  const isOwner = ownerId && ownerId === actorId;

  if (isOwner) {
    return true;
  }

  if (actorId && row.resourceType === 'project' && row.resourceId) {
    try {
      const project = await getRowCached({
        databaseId: 'turso',
        tableId: 'projects',
        rowId: row.resourceId
      });
      if (project && (project.ownerId === actorId || project.creatorId === actorId)) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance check failed:', err);
    }
  }

  if (actorId && row.projectId) {
    try {
      const project = await getRowCached({
        databaseId: 'turso',
        tableId: 'projects',
        rowId: row.projectId
      });
      if (project && (project.ownerId === actorId || project.creatorId === actorId)) {
        return true;
      }
    } catch (err) {
      console.warn('[verifyResourcePermissionSecure] Project inheritance check failed:', err);
    }
  }

  if (action === 'create') {
    return false;
  }

  const isGuest = row.isGuest === true;
  const isPublic = row.isPublic === true;

  if (action === 'read') {
    if (isGuest) return true;
    if (isPublic && actorId) return true;
  }

  let matchedCollabRole: 'viewer' | 'editor' | 'admin' | null = null;

  if (actorId && rowId) {
    try {
      const tables = systemTables();
      const resourceTypeFilter = resolveCollaboratorTypeFilter(tableId);
      const collabQueries = [
        q.equal('resourceId', rowId),
        q.equal('userId', actorId),
      ] as any[];
      if (resourceTypeFilter) {
        collabQueries.push(resourceTypeFilter);
      }
      
      const collabsRes = await tables.listRows({
        databaseId: 'turso',
        tableId: 'collaborators',
        queries: collabQueries
      });
      
      if (collabsRes.rows.length > 0) {
        const p = (collabsRes.rows[0] as any).permission;
        if (p === 'admin') matchedCollabRole = 'admin';
        else if (['write', 'editor'].includes(p)) matchedCollabRole = 'editor';
        else if (['read', 'viewer'].includes(p)) matchedCollabRole = 'viewer';
      }
    } catch (err) {
      console.error('[verifyResourcePermissionSecure] Collaborator table check failed:', err);
    }
  }

  if (!matchedCollabRole) {
    let meta: any = {};
    try {
      const rawMeta = row[metadataField];
      meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta || {};
    } catch {}
    const collaborators = meta.collaborators || {};
    const userRole = collaborators[actorId];
    if (userRole) {
      matchedCollabRole = userRole;
    }
  }

  if (action === 'read') {
    if (matchedCollabRole) {
      return ['viewer', 'editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'update') {
    if (matchedCollabRole) {
      return ['editor', 'admin'].includes(matchedCollabRole);
    }
    return false;
  }

  if (action === 'delete') {
    if (matchedCollabRole) {
      return matchedCollabRole === 'admin';
    }
    return false;
  }

  return false;
}

export async function verifyNotePermission(noteId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete'
  };
  return verifyResourcePermissionSecure({
    databaseId: 'turso',
    tableId: 'ideas',
    rowId: noteId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId', 'creatorId', 'ownerId'],
    metadataField: 'metadata'
  });
}

export async function verifyProjectPermission(projectId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete'
  };
  return verifyResourcePermissionSecure({
    databaseId: 'turso',
    tableId: 'projects',
    rowId: projectId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['ownerId', 'creatorId', 'userId'],
    metadataField: 'metadata'
  });
}

export async function verifyFormPermission(formId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const minToLevelMap: Record<'viewer' | 'editor' | 'admin', 'read' | 'update' | 'delete'> = {
    viewer: 'read',
    editor: 'update',
    admin: 'delete'
  };
  return verifyResourcePermissionSecure({
    databaseId: 'turso',
    tableId: 'forms',
    rowId: formId,
    actorId,
    action: minToLevelMap[minLevel],
    ownerFields: ['userId', 'creatorId', 'ownerId'],
    metadataField: 'settings'
  });
}

export async function verifyEventPermission(eventId: string, actorId: string, minLevel: 'viewer' | 'editor' | 'admin') {
  const tables = systemTables();
  const event = await tables.getRow({
    databaseId: 'turso',
    tableId: 'events',
    rowId: eventId
  });
  
  const ownerId = String((event as any).userId || '').trim();
  if (ownerId && ownerId === actorId) {
    return true;
  }

  try {
    const collabsRes = await tables.listRows({
      databaseId: 'turso',
      tableId: 'collaborators',
      queries: [
        q.equal('resourceId', eventId),
        q.equal('resourceType', 'event'),
        q.equal('userId', actorId),
        q.limit(1),
      ] as any
    });
    if (collabsRes.rows.length > 0) {
      const collab: any = collabsRes.rows[0];
      const p = collab.permission;
      if (minLevel === 'viewer') {
        if (['read', 'write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'editor') {
        if (['write', 'admin'].includes(p)) return true;
      } else if (minLevel === 'admin') {
        if (p === 'admin') return true;
      }
    }
  } catch (err) {
    console.error('[verifyEventPermission] Collaborators query failed:', err);
  }

  return false;
}

export function sanitizeEventData(data: any) {
  if (!data || typeof data !== 'object') return {};
  const allowedKeys = [
    'title',
    'description',
    'startTime',
    'endTime',
    'location',
    'meetingUrl',
    'visibility',
    'status',
    'coverImageId',
    'recurrenceRule',
    'calendarId',
    'userId',
    'isPublic',
    'isPinned',
    'isGuest',
    'keepPermission',
    'source',
    'isWorkspace',
    'projectId',
    'attendeeCount',
    'isAgentic',
    'dek',
  ];
  const sanitized: any = {};
  for (const key of allowedKeys) {
    if (key in data) {
      let val = data[key];
      if ((key === 'startTime' || key === 'endTime') && val) {
        if (val instanceof Date) {
          val = val.toISOString();
        } else if (typeof val === 'string' && val.trim()) {
          const t = Date.parse(val);
          if (Number.isFinite(t)) val = new Date(t).toISOString();
        }
      }
      sanitized[key] = val;
    }
  }
  return sanitized;
}
