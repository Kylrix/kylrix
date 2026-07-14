import { Client, TablesDB, ID, Query, type Models, Permission, Role } from 'appwrite';
import type { DatabaseHandle, DatabaseId, DatabaseTableMap, DatabaseTables, QueryBuilder, QueryValue, PermissionBuilder, RoleBuilder, RoleString } from './types';
import { PROJECT_ID, ENDPOINT } from './constants';

const createQueryBuilder = <T>(): QueryBuilder<T> => ({
  equal: (field, value) => Query.equal(String(field), value as QueryValue),
  notEqual: (field, value) => Query.notEqual(String(field), value as QueryValue),
  lessThan: (field, value) => Query.lessThan(String(field), value as QueryValue),
  lessThanEqual: (field, value) => Query.lessThanEqual(String(field), value as QueryValue),
  greaterThan: (field, value) => Query.greaterThan(String(field), value as QueryValue),
  greaterThanEqual: (field, value) => Query.greaterThanEqual(String(field), value as QueryValue),
  contains: (field, value) => Query.contains(String(field), value as string | QueryValue[]),
  search: (field, value) => Query.search(String(field), value),
  isNull: (field) => Query.isNull(String(field)),
  isNotNull: (field) => Query.isNotNull(String(field)),
  startsWith: (field, value) => Query.startsWith(String(field), value),
  endsWith: (field, value) => Query.endsWith(String(field), value),
  between: (field, start, end) => Query.between(String(field), start as string | number, end as string | number),
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
tableIdMap["passwordManagerDb"] = Object.create(null);
tableIdMap["passwordManagerDb"]["Security Logs"] = "securityLogs";
tableIdMap["passwordManagerDb"]["Credentials"] = "credentials";
tableIdMap["passwordManagerDb"]["Identities"] = "identities";
tableIdMap["passwordManagerDb"]["user"] = "user";
tableIdMap["passwordManagerDb"]["Folders"] = "folders";
tableIdMap["passwordManagerDb"]["TOTP Secrets"] = "totpSecrets";
tableIdMap["passwordManagerDb"]["Keychain"] = "keychain";
tableIdMap["passwordManagerDb"]["key_mapping"] = "key_mapping";
tableIdMap["passwordManagerDb"]["wallets"] = "wallets";
tableIdMap["passwordManagerDb"]["notes"] = "67ff05f3002502ef239e";
tableIdMap["passwordManagerDb"]["Comments"] = "comments";
tableIdMap["passwordManagerDb"]["Extensions"] = "extensions";
tableIdMap["passwordManagerDb"]["Reactions"] = "reactions";
tableIdMap["passwordManagerDb"]["ActivityLog"] = "activityLog";
tableIdMap["passwordManagerDb"]["Settings"] = "settings";
tableIdMap["passwordManagerDb"]["subscriptions"] = "subscriptions";
tableIdMap["passwordManagerDb"]["billing_transactions"] = "billing_transactions";
tableIdMap["passwordManagerDb"]["billing_webhook_logs"] = "billing_webhook_logs";
tableIdMap["passwordManagerDb"]["tags"] = "67ff06280034908cf08a";
tableIdMap["passwordManagerDb"]["resource_tags"] = "resource_tags";
tableIdMap["passwordManagerDb"]["coupons"] = "coupons";
tableIdMap["passwordManagerDb"]["User Resource Pins"] = "user_resource_pins";
tableIdMap["passwordManagerDb"]["Messages"] = "messages";
tableIdMap["passwordManagerDb"]["Conversations"] = "conversations";
tableIdMap["passwordManagerDb"]["Contacts"] = "contacts";
tableIdMap["passwordManagerDb"]["Follows"] = "follows";
tableIdMap["passwordManagerDb"]["AppActivity"] = "app_activity";
tableIdMap["passwordManagerDb"]["Interactions"] = "interactions";
tableIdMap["passwordManagerDb"]["Moments"] = "moments";
tableIdMap["passwordManagerDb"]["Calls"] = "calls";
tableIdMap["passwordManagerDb"]["epochs"] = "epochs";
tableIdMap["passwordManagerDb"]["Conversation Members"] = "conversationMembers";
tableIdMap["passwordManagerDb"]["profiles"] = "profiles";
tableIdMap["passwordManagerDb"]["Message Reactions"] = "messageReactions";
tableIdMap["passwordManagerDb"]["Join Requests"] = "joinRequests";
tableIdMap["passwordManagerDb"]["Unorganic Emails"] = "unorganic_emails";
tableIdMap["passwordManagerDb"]["kylrix_token_ledger"] = "kylrix_token_ledger";
tableIdMap["passwordManagerDb"]["engagement_views"] = "engagement_views";
tableIdMap["passwordManagerDb"]["engagement_view_rollups"] = "engagement_view_rollups";
tableIdMap["passwordManagerDb"]["account_ledger"] = "account_ledger";
tableIdMap["passwordManagerDb"]["system_pulse"] = "system_pulse";
tableIdMap["passwordManagerDb"]["projects"] = "projects";
tableIdMap["passwordManagerDb"]["project_objects"] = "project_objects";
tableIdMap["passwordManagerDb"]["Telegram Connections"] = "telegram_connections";
tableIdMap["passwordManagerDb"]["source_control"] = "source_control";
tableIdMap["passwordManagerDb"]["Call Signals"] = "call_signals";
tableIdMap["passwordManagerDb"]["Account Events"] = "accountEvents";
tableIdMap["passwordManagerDb"]["focusSessions"] = "focusSessions";
tableIdMap["passwordManagerDb"]["eventGuests"] = "eventGuests";
tableIdMap["passwordManagerDb"]["events"] = "events";
tableIdMap["passwordManagerDb"]["calendars"] = "calendars";
tableIdMap["passwordManagerDb"]["tasks"] = "tasks";
tableIdMap["passwordManagerDb"]["forms"] = "forms";
tableIdMap["passwordManagerDb"]["formSubmissions"] = "formSubmissions";
tableIdMap["passwordManagerDb"]["agents"] = "agents";
tableIdMap["passwordManagerDb"]["Collaborators"] = "Collaborators";
tableIdMap["passwordManagerDb"]["user_keys"] = "user_keys";
tableIdMap["passwordManagerDb"]["compute_balances"] = "compute_balances";
tableIdMap["passwordManagerDb"]["compute_ledger"] = "compute_ledger";
tableIdMap["passwordManagerDb"]["action_threads"] = "action_threads";
tableIdMap["passwordManagerDb"]["app_activity_logs"] = "app_activity_logs";
tableIdMap["passwordManagerDb"]["anonymized_telemetry"] = "anonymized_telemetry";
tableIdMap["passwordManagerDb"]["notifications"] = "notifications";
tableIdMap["passwordManagerDb"]["workflows"] = "workflows";
tableIdMap["passwordManagerDb"]["objects"] = "objects";
tableIdMap["passwordManagerDb"]["Token Registry"] = "token_registry";
tableIdMap["passwordManagerDb"]["Web3 Transactions"] = "web3_transactions";
tableIdMap["passwordManagerDb"]["nostr_identities"] = "nostr_identities";
tableIdMap["passwordManagerDb"]["Agent Payment Intents"] = "agent_payment_intents";
tableIdMap["passwordManagerDb"]["Agentic Telemetry"] = "agentic_telemetry";
tableIdMap["passwordManagerDb"]["Agentic Sessions"] = "agentic_sessions";
tableIdMap["passwordManagerDb"]["swept"] = "swept";

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
    create: (data: Omit<T, keyof Models.Row>, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) =>
      tablesDB.createRow<T>({
        databaseId,
        tableId,
        rowId: options?.rowId ?? ID.unique(),
        data: data as T extends Models.DefaultRow ? Partial<Models.Row> & Record<string, unknown> : Partial<Models.Row> & Omit<T, keyof Models.Row>,
        permissions: resolvePermissions(options?.permissions),
        transactionId: options?.transactionId,
      }),
    get: (id: string) =>
      tablesDB.getRow<T>({
        databaseId,
        tableId,
        rowId: id,
      }),
    update: (id: string, data: Partial<Omit<T, keyof Models.Row>>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) =>
      tablesDB.updateRow<T>({
        databaseId,
        tableId,
        rowId: id,
        data: data as T extends Models.DefaultRow ? Partial<Models.Row> & Record<string, unknown> : Partial<Models.Row> & Partial<Omit<T, keyof Models.Row>>,
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
    list: (options?: { queries?: (q: QueryBuilder<T>) => string[] }) =>
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
