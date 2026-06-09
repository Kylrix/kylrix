import { ID, Models, Permission, Role, Query } from 'appwrite';
import { tablesDB, realtime } from './appwrite/client';
import { APPWRITE_CONFIG } from './appwrite/config';
import { getEcosystemUrl } from './constants';
import { Calendar, Task, Event, EventGuest, FocusSession } from '../types/kylrixflow';
import type { CollaboratorPermission, TaskCollaborator } from '../types';
import { sendKylrixEmailNotification } from './email-notifications';

const FLOW_DATABASE_ID = APPWRITE_CONFIG.FLOW_DATABASE_ID || APPWRITE_CONFIG.DATABASES.FLOW;
const { TABLES } = APPWRITE_CONFIG;
const TASK_COLLABORATOR_RESOURCE_PREFIX = 'task:';
const TASK_COLLABORATOR_TABLE = TABLES.FLOW.COLLABORATORS;
const TASK_COLLABORATOR_DATABASE = FLOW_DATABASE_ID;

export { realtime };

export function subscribeToTable<T extends Models.Row>(
    tableId: string,
    callback: (event: { type: 'create' | 'update' | 'delete', payload: T }) => void
) {
    const channel = `databases.${FLOW_DATABASE_ID}.collections.${TABLES.FLOW.TASKS}.documents`;

    return realtime.subscribe(channel, (response) => {
        const payload = response.payload as T;
        let type: 'create' | 'update' | 'delete' | null = null;

        if (response.events.some(e => e.includes('.create'))) type = 'create';
        else if (response.events.some(e => e.includes('.update'))) type = 'update';
        else if (response.events.some(e => e.includes('.delete'))) type = 'delete';

        if (type) {
            callback({ type, payload });
        }
    });
}

type TableCreateData<T extends Models.Row> =
    T extends Models.DefaultRow
    ? Partial<Models.Row> & Record<string, unknown>
    : Partial<Models.Row> & Omit<T, keyof Models.Row>;
type TableUpdateData<T extends Models.Row> =
    T extends Models.DefaultRow
    ? Partial<Models.Row> & Record<string, unknown>
    : Partial<Models.Row> & Partial<Omit<T, keyof Models.Row>>;

import { fetchOptimized, invalidateCache } from "@/lib/ecosystem/nexus-fetcher";

const FLOW_TTL = 1000 * 60 * 15; // 15 mins
const CACHE_TTL = FLOW_TTL;
const queryCache = new Map<string, { data: unknown; expires: number }>();

async function listRows<T extends Models.Row>(tableId: string, queries: string[] = []): Promise<Models.RowList<T>> {
    const key = `list:${tableId}:${JSON.stringify(queries)}`;
    return await fetchOptimized(key, async () => {
        return await tablesDB.listRows<T>({ databaseId: FLOW_DATABASE_ID, tableId, queries });
    }, FLOW_TTL);
}

const taskPermissionForLevel = (level: CollaboratorPermission, userId: string) => {
    if (level === 'admin') {
        return [
            Permission.read(Role.user(userId))];
    }

    if (level === 'write') {
        return [
            Permission.read(Role.user(userId))];
    }

    return [Permission.read(Role.user(userId))];
};

const mergePermissions = (...permissionGroups: string[][]) => {
    const merged = new Set<string>();
    permissionGroups.flat().forEach((permission) => merged.add(permission));
    return Array.from(merged);
};

const normalizeCollaborator = (row: any): TaskCollaborator => ({
    id: row.$id,
    taskId: row.resourceId || String(row.noteId || '').replace(TASK_COLLABORATOR_RESOURCE_PREFIX, ''),
    userId: row.userId,
    permission: row.permission,
    invitedAt: row.invitedAt ? new Date(row.invitedAt) : null,
    accepted: row.accepted ?? null,
});

const mapPermissionsByUser = (creatorId: string | null, assigneeIds: string[] = [], collaborators: TaskCollaborator[] = []) => {
    const permissionsByUser = new Map<string, CollaboratorPermission>();

    if (creatorId && creatorId !== 'guest') {
        permissionsByUser.set(creatorId, 'admin');
    }

    assigneeIds.filter(Boolean).forEach((userId) => {
        const current = permissionsByUser.get(userId);
        if (!current || permissionRank.read > permissionRank[current]) {
            permissionsByUser.set(userId, 'read');
        }
    });

    collaborators.forEach((collaborator) => {
        const current = permissionsByUser.get(collaborator.userId);
        if (!current || permissionRank[collaborator.permission] > permissionRank[current]) {
            permissionsByUser.set(collaborator.userId, collaborator.permission);
        }
    });

    return permissionsByUser;
};

export const buildTaskPermissions = (creatorId: string | null, assigneeIds: string[] = [], collaborators: TaskCollaborator[] = []) => {
    const permissionsByUser = mapPermissionsByUser(creatorId, assigneeIds, collaborators);
    return Array.from(permissionsByUser.entries()).flatMap(([userId, permission]) =>
        taskPermissionForLevel(permission, userId)
    );
};


async function listTaskCollaborators(taskId: string): Promise<TaskCollaborator[]> {
    const res = await tablesDB.listRows<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        queries: [
            Query.equal('resourceId', taskId),
            Query.equal('resourceType', 'task'),
        ],
    });

    return res.rows.map(normalizeCollaborator);
}

async function createTaskCollaborator(taskId: string, userId: string, permission: CollaboratorPermission, creatorId: string | null, permissions?: string[]) {
    const existing = await tablesDB.listRows<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        queries: [
            Query.equal('resourceId', taskId),
            Query.equal('resourceType', 'task'),
            Query.equal('userId', userId),
            Query.limit(1)
        ],
    });

    const nextPermissions = permissions ?? mergePermissions(
        creatorId && creatorId !== 'guest' ? taskPermissionForLevel('admin', creatorId) : [],
        taskPermissionForLevel(permission, userId)
    );
    if (existing.rows.length > 0) {
        const current = normalizeCollaborator(existing.rows[0]);
        const updated = await updateRow<any>(
            TASK_COLLABORATOR_TABLE,
            current.id,
            {
                resourceId: taskId,
                resourceType: 'task',
                userId,
                permission,
                invitedAt: current.invitedAt ? current.invitedAt.toISOString() : new Date().toISOString(),
                accepted: true,
                status: 'accepted',
            },
            nextPermissions,
            TASK_COLLABORATOR_DATABASE
        );
        return normalizeCollaborator(updated);
    }

    const created = await createRow<any>(
        TASK_COLLABORATOR_TABLE,
        {
            resourceId: taskId,
            resourceType: 'task',
            userId,
            permission,
            invitedAt: new Date().toISOString(),
            accepted: true,
            status: 'accepted',
        },
        nextPermissions,
        ID.unique(),
        TASK_COLLABORATOR_DATABASE
    );
    return normalizeCollaborator(created);
}

async function updateTaskCollaborator(rowId: string, data: Partial<{ permission: CollaboratorPermission }>, creatorId: string | null, taskId: string, permissions?: string[]) {
    const current = await tablesDB.getRow<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        rowId,
    });
    const nextPermission = data.permission ?? current.permission;
    const updated = await updateRow<any>(
        TASK_COLLABORATOR_TABLE,
        rowId,
        {
            ...data,
            resourceId: taskId,
            resourceType: 'task',
            userId: current.userId,
            permission: nextPermission,
        },
        permissions ?? mergePermissions(
            creatorId && creatorId !== 'guest' ? taskPermissionForLevel('admin', creatorId) : [],
            taskPermissionForLevel(nextPermission, current.userId)
        ),
        TASK_COLLABORATOR_DATABASE
    );
    return normalizeCollaborator(updated);
}

async function deleteTaskCollaborator(rowId: string) {
    await deleteRow(TASK_COLLABORATOR_TABLE, rowId, TASK_COLLABORATOR_DATABASE);
}

async function createRow<T extends Models.Row>(
    tableId: string,
    data: TableCreateData<T>,
    permissions?: string[],
    rowId: string = ID.unique(),
    dbId: string = FLOW_DATABASE_ID
): Promise<T> {
    let res: T;
    if (typeof window !== 'undefined') {
        const { createRow } = await import('@/lib/actions/client-ops');
        res = await createRow(dbId, tableId, data, permissions) as any;
    } else {
        const { createRowSecure } = await import('@/lib/actions/secure-ops');
        res = await createRowSecure(dbId, tableId, data, permissions) as any;
    }
    clearCache(tableId);
    return res;
}

async function getRow<T extends Models.Row>(tableId: string, rowId: string): Promise<T> {
    const key = `get:${tableId}:${rowId}`;
    const cached = queryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data as T;

    const res = await tablesDB.getRow<T>({
        databaseId: FLOW_DATABASE_ID,
        tableId,
        rowId
    });
    queryCache.set(key, { data: res, expires: Date.now() + CACHE_TTL });
    return res;
}

function clearCache(tableId: string) {
    for (const key of queryCache.keys()) {
        if (key.includes(`:${tableId}:`)) {
            queryCache.delete(key);
        }
    }
}

async function updateRow<T extends Models.Row>(
    tableId: string,
    rowId: string,
    data: TableUpdateData<T>,
    permissions?: string[],
    dbId: string = FLOW_DATABASE_ID
): Promise<T> {
    let res: T;
    if (typeof window !== 'undefined') {
        const { updateRow } = await import('@/lib/actions/client-ops');
        res = await updateRow(dbId, tableId, rowId, data, permissions) as any;
    } else {
        const { updateRowSecure } = await import('@/lib/actions/secure-ops');
        res = await updateRowSecure(dbId, tableId, rowId, data, permissions) as any;
    }
    clearCache(tableId);
    return res;
}

async function deleteRow(
    tableId: string,
    rowId: string,
    dbId: string = FLOW_DATABASE_ID
): Promise<void> {
    if (typeof window !== 'undefined') {
        const { deleteRow } = await import('@/lib/actions/client-ops');
        await deleteRow(dbId, tableId, rowId);
    } else {
        const { deleteRowSecure } = await import('@/lib/actions/secure-ops');
        await deleteRowSecure(dbId, tableId, rowId);
    }
    clearCache(tableId);
}


// --- Calendars ---

export const calendars = {
    list: (queries?: string[]) => listRows<Calendar>(TABLES.CALENDARS, queries),
    create: (data: TableCreateData<Calendar>) => createRow<Calendar>(TABLES.CALENDARS, data),
    get: (id: string) => getRow<Calendar>(TABLES.CALENDARS, id),
    update: (id: string, data: TableUpdateData<Calendar>) => updateRow<Calendar>(TABLES.CALENDARS, id, data),
    delete: (id: string) => deleteRow(TABLES.CALENDARS, id)
};

// --- Tasks ---

export const tasks = {
    list: (queries?: string[]) => listRows<Task>(TABLES.TASKS, queries),
    create: (data: TableCreateData<Task>, permissions?: string[]) => createRow<Task>(TABLES.TASKS, data, permissions),
    get: (id: string) => getRow<Task>(TABLES.TASKS, id),
    update: (id: string, data: TableUpdateData<Task>, permissions?: string[]) =>
        updateRow<Task>(TABLES.TASKS, id, data, permissions, FLOW_DATABASE_ID),
    delete: (id: string) => deleteRow(TABLES.TASKS, id)
};

export const taskCollaborators = {
    list: (taskId: string) => listTaskCollaborators(taskId),
    create: (taskId: string, userId: string, permission: CollaboratorPermission, creatorId: string | null, permissions?: string[]) =>
        createTaskCollaborator(taskId, userId, permission, creatorId, permissions),
    update: (rowId: string, data: Partial<{ permission: CollaboratorPermission }>, creatorId: string | null, taskId: string, permissions?: string[]) =>
        updateTaskCollaborator(rowId, data, creatorId, taskId, permissions),
    delete: (rowId: string) => deleteTaskCollaborator(rowId),
};

// --- Events ---

export const events = {
    list: (queries?: string[]) => listRows<Event>(TABLES.EVENTS, queries),
    create: async (data: TableCreateData<Event>, _permissions?: string[]) => {
        if (typeof window !== 'undefined') {
            const { createEvent } = await import('@/lib/actions/client-ops');
            return await createEvent(data);
        }
        const { createEventSecure } = await import('@/lib/actions/secure-ops');
        return await createEventSecure(data);
    },
    get: (id: string) => getRow<Event>(TABLES.EVENTS, id),
    update: async (id: string, data: TableUpdateData<Event>) => {
        if (typeof window !== 'undefined') {
            const { updateEvent } = await import('@/lib/actions/client-ops');
            return await updateEvent(id, data);
        }
        const { updateEventSecure } = await import('@/lib/actions/secure-ops');
        return await updateEventSecure(id, data);
    },
    delete: async (id: string) => {
        if (typeof window !== 'undefined') {
            const { deleteEvent } = await import('@/lib/actions/client-ops');
            return await deleteEvent(id);
        }
        const { deleteEventSecure } = await import('@/lib/actions/secure-ops');
        return await deleteEventSecure(id);
    },
    addManager: async (eventId: string, userId: string, role: string = 'viewer') => {
        if (typeof window !== 'undefined') {
            const { addEventManager } = await import('@/lib/actions/client-ops');
            return await addEventManager(eventId, userId, role);
        }
        const { addEventManagerSecure } = await import('@/lib/actions/secure-ops');
        return await addEventManagerSecure(eventId, userId, role);
    },
    removeManager: async (eventId: string, userId: string) => {
        if (typeof window !== 'undefined') {
            const { removeEventManager } = await import('@/lib/actions/client-ops');
            return await removeEventManager(eventId, userId);
        }
        const { removeEventManagerSecure } = await import('@/lib/actions/secure-ops');
        return await removeEventManagerSecure(eventId, userId);
    }
};

// --- Event Guests ---

export const eventGuests = {
    list: (queries?: string[]) => listRows<EventGuest>(TABLES.EVENT_GUESTS, queries),
    create: async (data: TableCreateData<EventGuest>) => {
        const row = await createRow<EventGuest>(TABLES.EVENT_GUESTS, data);
        try {
            const event = await events.get(String((data as any).eventId || '')).catch(() => null);
            const ownerId = String(event?.userId || '').trim();
            if (ownerId) {
                await sendKylrixEmailNotification({
                    eventType: 'event_registered',
                    sourceApp: 'flow',
                    actorName: String((data as any).email || (data as any).userId || 'Someone'),
                    recipientIds: [ownerId],
                    resourceId: String((data as any).eventId || ''),
                    resourceTitle: event?.title || 'Event',
                    resourceType: 'event',
                    templateKey: 'flow:event-registered',
                    ctaUrl: `${getEcosystemUrl('flow')}/events/${String((data as any).eventId || '')}`,
                    ctaText: 'Open event',
                    metadata: {
                        guestId: row.$id,
                    },
                });
            }
        } catch (error) {
            console.error('[Flow] Failed to queue event registration email', error);
        }
        return row;
    },
    get: (id: string) => getRow<EventGuest>(TABLES.EVENT_GUESTS, id),
    update: (id: string, data: TableUpdateData<EventGuest>) => updateRow<EventGuest>(TABLES.EVENT_GUESTS, id, data),
    delete: (id: string) => deleteRow(TABLES.EVENT_GUESTS, id)
};

// --- Focus Sessions ---

export const focusSessions = {
    list: (queries?: string[]) => listRows<FocusSession>(TABLES.FOCUS_SESSIONS, queries),
    create: (data: TableCreateData<FocusSession>) => createRow<FocusSession>(TABLES.FOCUS_SESSIONS, data),
    get: (id: string) => getRow<FocusSession>(TABLES.FOCUS_SESSIONS, id),
    update: (id: string, data: TableUpdateData<FocusSession>) => updateRow<FocusSession>(TABLES.FOCUS_SESSIONS, id, data),
    delete: (id: string) => deleteRow(TABLES.FOCUS_SESSIONS, id)
};

// --- Notes ---

export const notes = {
    list: (queries?: string[]) => tablesDB.listRows({
        databaseId: APPWRITE_CONFIG.NOTE_DATABASE_ID,
        tableId: TABLES.NOTES,
        queries
    }),
    get: (id: string) => tablesDB.getRow({
        databaseId: APPWRITE_CONFIG.NOTE_DATABASE_ID,
        tableId: TABLES.NOTES,
        rowId: id
    }),
    update: (id: string, data: any) => tablesDB.updateRow({
        databaseId: APPWRITE_CONFIG.NOTE_DATABASE_ID,
        tableId: TABLES.NOTES,
        rowId: id,
        data
    })
};

// --- Secrets (Keep) ---

export const secrets = {
    list: (queries?: string[]) => tablesDB.listRows({
        databaseId: 'passwordManagerDb',
        tableId: 'credentials',
        queries
    }),
    get: (id: string) => tablesDB.getRow({
        databaseId: 'passwordManagerDb',
        tableId: 'credentials',
        rowId: id
    }),
    update: (id: string, data: any) => tablesDB.updateRow({
        databaseId: 'passwordManagerDb',
        tableId: 'credentials',
        rowId: id,
        data
    })
};
