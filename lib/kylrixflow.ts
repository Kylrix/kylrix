import { ID, Models, Permission, Role, Query } from "appwrite";
import { tablesDB, realtime } from "./appwrite/client";
import { APPWRITE_CONFIG } from "./appwrite/config";
import { getEcosystemUrl } from "./constants";
import { Calendar, Task, Event, EventGuest, FocusSession } from "../types/kylrixflow";
import type { CollaboratorPermission, TaskCollaborator } from "../types";
import { sendKylrixEmailNotification } from "./email-notifications";

const { DATABASE_ID, TABLES } = APPWRITE_CONFIG;
const TASK_COLLABORATOR_RESOURCE_PREFIX = 'task:';
const TASK_COLLABORATOR_TABLE = TABLES.FLOW.COLLABORATORS;
const TASK_COLLABORATOR_DATABASE = APPWRITE_CONFIG.NOTE_DATABASE_ID;

export { realtime };

export function subscribeToTable<T extends Models.Row>(
    tableId: string,
    callback: (event: { type: 'create' | 'update' | 'delete', payload: T }) => void
) {
    const channel = `databases.${DATABASE_ID}.collections.${tableId}.documents`;

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

const queryCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30000;

const permissionRank: Record<CollaboratorPermission, number> = {
    read: 1,
    write: 2,
    admin: 3,
};

const taskResourceKey = (taskId: string) => `${TASK_COLLABORATOR_RESOURCE_PREFIX}${taskId}`;

const taskPermissionForLevel = (level: CollaboratorPermission, userId: string) => {
    if (level === 'admin') {
        return [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
        ];
    }

    if (level === 'write') {
        return [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
        ];
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
    taskId: String(row.noteId || '').replace(TASK_COLLABORATOR_RESOURCE_PREFIX, ''),
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

async function listRows<T extends Models.Row>(tableId: string, queries?: string[]): Promise<Models.RowList<T>> {
    const key = `list:${tableId}:${JSON.stringify(queries)}`;
    const cached = queryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;

    const res = await tablesDB.listRows<T>({ databaseId: DATABASE_ID, tableId, queries });
    queryCache.set(key, { data: res, expires: Date.now() + CACHE_TTL });
    return res;
}

async function listTaskCollaborators(taskId: string): Promise<TaskCollaborator[]> {
    const res = await tablesDB.listRows<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        queries: [
            Query.equal('noteId', taskResourceKey(taskId)),
        ],
    });

    return res.rows.map(normalizeCollaborator);
}

async function createTaskCollaborator(taskId: string, userId: string, permission: CollaboratorPermission, creatorId: string | null, permissions?: string[]) {
    const existing = await tablesDB.listRows<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        queries: [
            Query.equal('noteId', taskResourceKey(taskId)),
            Query.equal('userId', userId),
            Query.limit(1),
        ],
    });

    const nextPermissions = permissions ?? mergePermissions(
        creatorId && creatorId !== 'guest' ? taskPermissionForLevel('admin', creatorId) : [],
        taskPermissionForLevel(permission, userId)
    );
    if (existing.rows.length > 0) {
        const current = normalizeCollaborator(existing.rows[0]);
        const updated = await tablesDB.updateRow<any>({
            databaseId: TASK_COLLABORATOR_DATABASE,
            tableId: TASK_COLLABORATOR_TABLE,
            rowId: current.id,
            data: {
                noteId: taskResourceKey(taskId),
                userId,
                permission,
                invitedAt: current.invitedAt ? current.invitedAt.toISOString() : new Date().toISOString(),
                accepted: true,
            },
            permissions: nextPermissions,
        });
        return normalizeCollaborator(updated);
    }

    const created = await tablesDB.createRow<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        rowId: ID.unique(),
        data: {
            noteId: taskResourceKey(taskId),
            userId,
            permission,
            invitedAt: new Date().toISOString(),
            accepted: true,
        },
        permissions: nextPermissions,
    });
    return normalizeCollaborator(created);
}

async function updateTaskCollaborator(rowId: string, data: Partial<{ permission: CollaboratorPermission }>, creatorId: string | null, taskId: string, permissions?: string[]) {
    const current = await tablesDB.getRow<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        rowId,
    });
    const nextPermission = data.permission ?? current.permission;
    const updated = await tablesDB.updateRow<any>({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        rowId,
        data: {
            ...data,
            noteId: taskResourceKey(taskId),
            userId: current.userId,
            permission: nextPermission,
        },
        permissions: permissions ?? mergePermissions(
            creatorId && creatorId !== 'guest' ? taskPermissionForLevel('admin', creatorId) : [],
            taskPermissionForLevel(nextPermission, current.userId)
        ),
    });
    return normalizeCollaborator(updated);
}

async function deleteTaskCollaborator(rowId: string) {
    await tablesDB.deleteRow({
        databaseId: TASK_COLLABORATOR_DATABASE,
        tableId: TASK_COLLABORATOR_TABLE,
        rowId,
    });
}

async function createRow<T extends Models.Row>(
    tableId: string,
    data: TableCreateData<T>,
    permissions?: string[],
    rowId: string = ID.unique()
): Promise<T> {
    const res = await tablesDB.createRow<T>({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data,
        permissions
    });
    clearCache(tableId);
    return res;
}

async function getRow<T extends Models.Row>(tableId: string, rowId: string): Promise<T> {
    const key = `get:${tableId}:${rowId}`;
    const cached = queryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.data;

    const res = await tablesDB.getRow<T>({
        databaseId: DATABASE_ID,
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

async function updateRow<T extends Models.Row>(tableId: string, rowId: string, data: TableUpdateData<T>): Promise<T> {
    const res = await tablesDB.updateRow<T>({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data
    });
    clearCache(tableId);
    return res;
}

async function deleteRow(tableId: string, rowId: string): Promise<void> {
    await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId
    });
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
        tablesDB.updateRow<Task>({
            databaseId: DATABASE_ID,
            tableId: TABLES.TASKS,
            rowId: id,
            data,
            permissions
        }).then((res) => {
            clearCache(TABLES.TASKS);
            return res;
        }),
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
    create: (data: TableCreateData<Event>, permissions?: string[]) =>
        createRow<Event>(TABLES.EVENTS, data, permissions),
    get: (id: string) => getRow<Event>(TABLES.EVENTS, id),
    update: (id: string, data: TableUpdateData<Event>) => updateRow<Event>(TABLES.EVENTS, id, data),
    delete: (id: string) => deleteRow(TABLES.EVENTS, id)
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
