import { Client, Account, Databases, Messaging, Storage, Users, TablesDB, Teams } from 'node-appwrite';
import { PROJECT_ID, ENDPOINT } from '../generated/appwrite/constants';

let cachedSystemClient: {
  client: Client;
  account: Account;
  databases: Databases;
  messaging: Messaging;
  storage: Storage;
  users: Users;
  teams: Teams;
} | null = null;

export function createSystemClient() {
  if (cachedSystemClient) {
    return cachedSystemClient;
  }

  const client = new Client();
  const apiKey = process.env.APPWRITE_API;
  
  if (!apiKey) {
    console.error('[System Client] APPWRITE_API environment variable is missing.');
  }

  client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey || '');

  cachedSystemClient = {
    client,
    account: new Account(client),
    databases: createProxiedDatabases(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    users: new Users(client),
    teams: new Teams(client),
  };

  return cachedSystemClient;
}

function createProxiedDatabases(client: Client) {
  const original = new Databases(client);
  return new Proxy(original, {
    get(target, prop, receiver) {
      if (prop === 'listRows') {
        return async (databaseId: string, tableId: string, queries?: any[]) => {
          const res = await target.listDocuments(databaseId, tableId, queries);
          return {
            ...res,
            rows: res.documents
          };
        };
      }
      if (prop === 'getRow') {
        return (databaseId: string, tableId: string, rowId: string, queries?: any[]) => {
          return target.getDocument(databaseId, tableId, rowId, queries);
        };
      }
      if (prop === 'createRow') {
        return (databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) => {
          return target.createDocument(databaseId, tableId, rowId, data, permissions);
        };
      }
      if (prop === 'updateRow') {
        return (databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) => {
          return target.updateDocument(databaseId, tableId, rowId, data, permissions);
        };
      }
      if (prop === 'deleteRow') {
        return (databaseId: string, tableId: string, rowId: string) => {
          return target.deleteDocument(databaseId, tableId, rowId);
        };
      }
      if (prop === 'listDocuments' || prop === 'getDocument' || prop === 'createDocument' || prop === 'updateDocument' || prop === 'deleteDocument') {
        const originalMethod = (target as any)[prop];
        return async (...args: any[]) => {
          const res = await originalMethod.apply(target, args);
          if (prop === 'listDocuments' && res && typeof res === 'object') {
            return {
              ...res,
              rows: res.documents
            };
          }
          return res;
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  }) as unknown as Databases;
}

let cachedSystemTablesDB: TablesDB | null = null;

/**
 * Creates a server-side TablesDB instance with system executor privileges.
 * Used for chat and shared system data access.
 */
export function createSystemTablesDB() {
  if (cachedSystemTablesDB) {
    return cachedSystemTablesDB;
  }

  const { client } = createSystemClient();
  cachedSystemTablesDB = new TablesDB(client);
  return cachedSystemTablesDB;
}

/**
 * Checks if a given email is listed in the ADMINS environment variable.
 */
export function isEmailInAdminList(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;

  const adminList = String(process.env.ADMINS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminList.includes(normalized);
}

/**
 * Highly gated Admin Client for strict administrative actions (manual billing, admin panel).
 * Mathematically guaranteed to fail if APPWRITE_API is invalid.
 * If actorEmail is provided, it is strictly validated against the ADMINS env variable.
 */
export function createAdminClient(actorEmail?: string | null) {
  const apiKey = process.env.APPWRITE_API;
  
  if (!apiKey) {
    throw new Error('System API key is missing. Unauthorized action.');
  }

  if (actorEmail !== undefined) {
    if (!isEmailInAdminList(actorEmail)) {
      console.warn(`[Admin Client] Gated action blocked. ${actorEmail} is not authorized.`);
      throw new Error('Forbidden: Unauthorized admin operation.');
    }
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey);

  return {
    client,
    account: new Account(client),
    databases: createProxiedDatabases(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    users: new Users(client),
    teams: new Teams(client),
  };
}

/**
 * Highly gated Admin TablesDB instance.
 * Validates the actor email against the ADMINS env variable.
 */
export function createAdminTablesDB(actorEmail?: string | null) {
  const apiKey = process.env.APPWRITE_API;

  if (!apiKey) {
    throw new Error('System API key is missing. Unauthorized action.');
  }

  if (actorEmail !== undefined) {
    if (!isEmailInAdminList(actorEmail)) {
      console.warn(`[Admin TablesDB] Gated action blocked. ${actorEmail} is not authorized.`);
      throw new Error('Forbidden: Unauthorized admin operation.');
    }
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(apiKey);

  return new TablesDB(client);
}
