import { Client, TablesDB, ID, Query, type Models, Permission, Role } from 'appwrite';
import type { DatabaseHandle, DatabaseId, DatabaseTableMap, DatabaseTables, QueryBuilder, PermissionBuilder, RoleBuilder, RoleString } from './types';
import { PROJECT_ID, ENDPOINT } from './constants';

const createQueryBuilder = <T>(): QueryBuilder<T> => ({
  equal: (field, value) => Query.equal(String(field), value as any),
  notEqual: (field, value) => Query.notEqual(String(field), value as any),
  lessThan: (field, value) => Query.lessThan(String(field), value as any),
  lessThanEqual: (field, value) => Query.lessThanEqual(String(field), value as any),
  greaterThan: (field, value) => Query.greaterThan(String(field), value as any),
  greaterThanEqual: (field, value) => Query.greaterThanEqual(String(field), value as any),
  contains: (field, value) => Query.contains(String(field), value as any),
  search: (field, value) => Query.search(String(field), value),
  isNull: (field) => Query.isNull(String(field)),
  isNotNull: (field) => Query.isNotNull(String(field)),
  startsWith: (field, value) => Query.startsWith(String(field), value),
  endsWith: (field, value) => Query.endsWith(String(field), value),
  between: (field, start, end) => Query.between(String(field), start as any, end as any),
  select: (fields) => Query.select(fields.map(String)),
  orderAsc: (field) => Query.orderAsc(String(field)),
  orderDesc: (field) => Query.orderDesc(String(field)),
  limit: (value) => Query.limit(value),
  offset: (value) => Query.offset(value),
  cursorAfter: (documentId) => Query.cursorAfter(documentId),
  cursorBefore: (documentId) => Query.cursorBefore(documentId),
  or: (...queries) => Query.or(queries),
  and: (...queries) => Query.and(queries),
});

const tableIdMap: Record<string, Record<string, string>> = Object.create(null);
tableIdMap["67ff05a9000296822396"] = Object.create(null);
tableIdMap["67ff05a9000296822396"]["users"] = "67ff05c900247b5673d3";
tableIdMap["67ff05a9000296822396"]["notes"] = "67ff05f3002502ef239e";
tableIdMap["67ff05a9000296822396"]["tags"] = "67ff06280034908cf08a";
tableIdMap["67ff05a9000296822396"]["apiKeys"] = "67ff064400263631ffe4";
tableIdMap["67ff05a9000296822396"]["Comments"] = "comments";
tableIdMap["67ff05a9000296822396"]["Extensions"] = "extensions";
tableIdMap["67ff05a9000296822396"]["Reactions"] = "reactions";
tableIdMap["67ff05a9000296822396"]["Collaborators"] = "collaborators";
tableIdMap["67ff05a9000296822396"]["ActivityLog"] = "activityLog";
tableIdMap["67ff05a9000296822396"]["Settings"] = "settings";
tableIdMap["67ff05a9000296822396"]["walletMap"] = "walletMap";
tableIdMap["67ff05a9000296822396"]["note_tags"] = "note_tags";
tableIdMap["67ff05a9000296822396"]["note_revisions"] = "note_revisions";
tableIdMap["67ff05a9000296822396"]["ai_generations"] = "ai_generations";
tableIdMap["67ff05a9000296822396"]["subscriptions"] = "subscriptions";
tableIdMap["passwordManagerDb"] = Object.create(null);
tableIdMap["passwordManagerDb"]["Security Logs"] = "securityLogs";
tableIdMap["passwordManagerDb"]["Credentials"] = "credentials";
tableIdMap["passwordManagerDb"]["Identities"] = "identities";
tableIdMap["passwordManagerDb"]["user"] = "user";
tableIdMap["passwordManagerDb"]["Folders"] = "folders";
tableIdMap["passwordManagerDb"]["TOTP Secrets"] = "totpSecrets";
tableIdMap["passwordManagerDb"]["Keychain"] = "keychain";
tableIdMap["chat"] = Object.create(null);
tableIdMap["chat"]["Messages"] = "messages";
tableIdMap["chat"]["Conversations"] = "conversations";
tableIdMap["chat"]["Contacts"] = "contacts";
tableIdMap["chat"]["users"] = "users";
tableIdMap["chat"]["Follows"] = "follows";
tableIdMap["chat"]["AppActivity"] = "app_activity";
tableIdMap["chat"]["CallLinks"] = "call_links";
tableIdMap["chat"]["Interactions"] = "interactions";
tableIdMap["chat"]["CallLogs"] = "call_logs";
tableIdMap["chat"]["Moments"] = "moments";
tableIdMap["whisperrflow"] = Object.create(null);
tableIdMap["whisperrflow"]["focusSessions"] = "focusSessions";
tableIdMap["whisperrflow"]["eventGuests"] = "eventGuests";
tableIdMap["whisperrflow"]["events"] = "events";
tableIdMap["whisperrflow"]["calendars"] = "calendars";
tableIdMap["whisperrflow"]["tasks"] = "tasks";

const tablesWithRelationships = new Set<string>();

const roleBuilder: RoleBuilder = {
  any: () => Role.any() as RoleString,
  user: (userId, status?) => Role.user(userId, status) as RoleString,
  users: (status?) => Role.users(status) as RoleString,
  guests: () => Role.guests() as RoleString,
  team: (teamId, role?) => Role.team(teamId, role) as RoleString,
  member: (memberId) => Role.member(memberId) as RoleString,
  label: (label) => Role.label(label) as RoleString,
};

const permissionBuilder: PermissionBuilder = {
  read: (role) => Permission.read(role),
  write: (role) => Permission.write(role),
  create: (role) => Permission.create(role),
  update: (role) => Permission.update(role),
  delete: (role) => Permission.delete(role),
};

const resolvePermissions = (callback?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]): string[] | undefined =>
  callback?.(permissionBuilder, roleBuilder);

function createTableApi<T extends Models.Row>(
  tablesDB: TablesDB,
  databaseId: string,
  tableId: string,
) {
  return {
    create: (data: any, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) =>
      tablesDB.createRow<T>({
        databaseId,
        tableId,
        rowId: options?.rowId ?? ID.unique(),
        data,
        permissions: resolvePermissions(options?.permissions),
        transactionId: options?.transactionId,
      }),
    get: (id: string) =>
      tablesDB.getRow<T>({
        databaseId,
        tableId,
        rowId: id,
      }),
    update: (id: string, data: any, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) =>
      tablesDB.updateRow<T>({
        databaseId,
        tableId,
        rowId: id,
        data,
        ...(options?.permissions ? { permissions: resolvePermissions(options.permissions) } : {}),
        transactionId: options?.transactionId,
      }),
    delete: async (id: string, options?: { transactionId?: string }) => {
      await tablesDB.deleteRow({
        databaseId,
        tableId,
        rowId: id,
        transactionId: options?.transactionId,
      });
    },
    list: (options?: { queries?: (q: any) => string[] }) =>
      tablesDB.listRows<T>({
        databaseId,
        tableId,
        queries: options?.queries?.(createQueryBuilder<T>()),
      }),
  };
}


const hasOwn = (obj: unknown, key: string): boolean =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key);

function createDatabaseHandle<D extends DatabaseId>(
  tablesDB: TablesDB,
  databaseId: D,
): DatabaseHandle<D> {
  const tableApiCache = new Map<string, unknown>();
  const dbMap = tableIdMap[databaseId];

  return {
    use: <T extends keyof DatabaseTableMap[D] & string>(tableId: T): DatabaseTableMap[D][T] => {
      if (!hasOwn(dbMap, tableId)) {
        throw new Error(`Unknown table "${tableId}" in database "${databaseId}"`);
      }

      if (!tableApiCache.has(tableId)) {
        const resolvedTableId = dbMap[tableId];
        const api = createTableApi(tablesDB, databaseId, resolvedTableId);
        
        tableApiCache.set(tableId, api);
      }
      return tableApiCache.get(tableId) as DatabaseTableMap[D][T];
    },
  };
}

function createDatabasesApi(tablesDB: TablesDB): DatabaseTables {
  const dbCache = new Map<DatabaseId, ReturnType<typeof createDatabaseHandle>>();

  return {
    use: (databaseId: DatabaseId) => {
      if (!hasOwn(tableIdMap, databaseId)) {
        throw new Error(`Unknown database "${databaseId}"`);
      }

      if (!dbCache.has(databaseId)) {
        dbCache.set(databaseId, createDatabaseHandle(tablesDB, databaseId));
      }
      return dbCache.get(databaseId);
    },
  } as DatabaseTables;
}

// Initialize client
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID);

const tablesDB = new TablesDB(client);

export const databases: DatabaseTables = createDatabasesApi(tablesDB);
