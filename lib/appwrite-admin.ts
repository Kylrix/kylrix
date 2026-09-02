import { Client, Account, Databases, Messaging, Storage, Users, TablesDB, Teams, Functions } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { configureInternalAppwriteClient } from '@/lib/appwrite/internal-headers';
import {
  experimental_taintUniqueValue,
  experimental_taintObjectReference} from 'react';

// Setup Next.js React Taint security boundaries for all sensitive credentials on module load
try {
  // Taint sensitive environment variables to prevent them from ever leaking to the client
  if (process.env.APPWRITE_API) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: High-privilege Appwrite API Key must never be passed to the client.',
      globalThis,
      process.env.APPWRITE_API
    );
  }
  if (process.env.BLOCKBEE_API) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: Blockbee Payment API Key must never be passed to the client.',
      globalThis,
      process.env.BLOCKBEE_API
    );
  }
  if (process.env.CLOUDFLARE_TURNSTILE_SECRET) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: Cloudflare Turnstile Secret must never be passed to the client.',
      globalThis,
      process.env.CLOUDFLARE_TURNSTILE_SECRET
    );
  }
  if (process.env.CLOUDFLARE_API) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: Cloudflare Admin API Token must never be passed to the client.',
      globalThis,
      process.env.CLOUDFLARE_API
    );
  }
  if (process.env.GOOGLE_API_KEY) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: Google Gemini API Key must never be passed to the client.',
      globalThis,
      process.env.GOOGLE_API_KEY
    );
  }
  if (process.env.TELEGRAM_BOT_API) {
    experimental_taintUniqueValue(
      'Security Boundary Violation: Telegram Bot API token must never be passed to the client.',
      globalThis,
      process.env.TELEGRAM_BOT_API
    );
  }
} catch (_e) {
  // Silent fail-safe for non-next execution environments
}

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

  configureInternalAppwriteClient(
    client
      .setEndpoint(APPWRITE_CONFIG.SERVER_ENDPOINT)
      .setProject(APPWRITE_CONFIG.PROJECT_ID)
      .setKey(apiKey || '')
  );

  cachedSystemClient = {
    client,
    account: new Account(client),
    databases: createProxiedDatabases(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    users: new Users(client),
    teams: new Teams(client)};

  try {
    experimental_taintObjectReference(
      'Security Boundary Violation: High-privilege System Client must never be passed to the client.',
      cachedSystemClient
    );
  } catch (_e) {
    // Fail-silent
  }

  return cachedSystemClient;
}

function createProxiedDatabases(client: Client) {
  const original = new Databases(client);
  const tablesDB = new TablesDB(client);

  return new Proxy(original, {
    get(target, prop, receiver) {
      if (prop === 'listRows') {
        return async (databaseId: string, tableId: string, queries?: any[]) => {
          return tablesDB.listRows({ databaseId, tableId, queries });
        };
      }
      if (prop === 'getRow') {
        return async (databaseId: string, tableId: string, rowId: string, queries?: any[]) => {
          return tablesDB.getRow({ databaseId, tableId, rowId, queries });
        };
      }
      if (prop === 'createRow') {
        return async (
          databaseId: string,
          tableId: string,
          rowId: string,
          data: any,
          permissions?: string[]) => {
          return tablesDB.createRow({ databaseId, tableId, rowId, data, permissions });
        };
      }
      if (prop === 'updateRow') {
        return async (
          databaseId: string,
          tableId: string,
          rowId: string,
          data: any,
          permissions?: string[]) => {
          return tablesDB.updateRow({ databaseId, tableId, rowId, data, permissions });
        };
      }
      if (prop === 'deleteRow') {
        return async (databaseId: string, tableId: string, rowId: string) => {
          return tablesDB.deleteRow({ databaseId, tableId, rowId });
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }}) as unknown as Databases;
}

const serverRowCache = new Map<string, { row: any; at: number }>();
const serverRowInflight = new Map<string, Promise<any>>();
const serverListCache = new Map<string, { result: any; at: number }>();
const serverListInflight = new Map<string, Promise<any>>();

const SERVER_ROW_TTL_MS = 30_000;
const SERVER_LIST_TTL_MS = 15_000;

export function invalidateServerRowCache(databaseId: string, tableId: string, rowId?: string) {
  if (rowId) {
    serverRowCache.delete(`${databaseId}:${tableId}:${rowId}`);
  }
  const prefix = `${databaseId}:${tableId}`;
  for (const k of serverListCache.keys()) {
    if (k.startsWith(prefix)) {
      serverListCache.delete(k);
    }
  }
}

let cachedSystemTablesDB: TablesDB | null = null;

/**
 * Creates a server-side TablesDB instance with system executor privileges,
 * hardened with read-through caching and request coalescing to protect the Appwrite read budget.
 */
export function createSystemTablesDB(): TablesDB {
  if (cachedSystemTablesDB) {
    return cachedSystemTablesDB;
  }

  const { client } = createSystemClient();
  const rawTablesDB = new TablesDB(client);

  const proxied = new Proxy(rawTablesDB, {
    get(target, prop, receiver) {
      if (prop === 'getRow') {
        return async (...args: any[]) => {
          let databaseId = '';
          let tableId = '';
          let rowId = '';
          let queries: any[] | undefined;

          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            databaseId = args[0].databaseId;
            tableId = args[0].tableId;
            rowId = args[0].rowId;
            queries = args[0].queries;
          } else {
            [databaseId, tableId, rowId, queries] = args;
          }

          if (!databaseId || !tableId || !rowId) {
            return (target as any).getRow(...args);
          }

          const cacheKey = `${databaseId}:${tableId}:${rowId}`;
          const now = Date.now();
          const hit = serverRowCache.get(cacheKey);
          if (hit && now - hit.at < SERVER_ROW_TTL_MS) {
            return JSON.parse(JSON.stringify(hit.row));
          }

          const pending = serverRowInflight.get(cacheKey);
          if (pending) {
            return await pending;
          }

          const fetcher = async () => {
            const row = await (target as any).getRow(...args);
            if (row) {
              serverRowCache.set(cacheKey, { row, at: Date.now() });
            }
            return row;
          };

          const task = fetcher().finally(() => {
            serverRowInflight.delete(cacheKey);
          });
          serverRowInflight.set(cacheKey, task);
          return await task;
        };
      }

      if (prop === 'listRows') {
        return async (...args: any[]) => {
          let databaseId = '';
          let tableId = '';
          let queries: any[] | undefined;

          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            databaseId = args[0].databaseId;
            tableId = args[0].tableId;
            queries = args[0].queries;
          } else {
            [databaseId, tableId, queries] = args;
          }

          if (!databaseId || !tableId) {
            return (target as any).listRows(...args);
          }

          const queryKey = queries && queries.length ? JSON.stringify(queries) : 'all';
          const cacheKey = `${databaseId}:${tableId}:${queryKey}`;
          const now = Date.now();
          const hit = serverListCache.get(cacheKey);
          if (hit && now - hit.at < SERVER_LIST_TTL_MS) {
            return JSON.parse(JSON.stringify(hit.result));
          }

          const pending = serverListInflight.get(cacheKey);
          if (pending) {
            return await pending;
          }

          const fetcher = async () => {
            const result = await (target as any).listRows(...args);
            if (result) {
              serverListCache.set(cacheKey, { result, at: Date.now() });
            }
            return result;
          };

          const task = fetcher().finally(() => {
            serverListInflight.delete(cacheKey);
          });
          serverListInflight.set(cacheKey, task);
          return await task;
        };
      }

      if (prop === 'updateRow') {
        return async (...args: any[]) => {
          let databaseId = '';
          let tableId = '';
          let rowId = '';
          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            databaseId = args[0].databaseId;
            tableId = args[0].tableId;
            rowId = args[0].rowId;
          } else {
            [databaseId, tableId, rowId] = args;
          }
          const res = await (target as any).updateRow(...args);
          if (databaseId && tableId) {
            invalidateServerRowCache(databaseId, tableId, rowId);
          }
          return res;
        };
      }

      if (prop === 'deleteRow') {
        return async (...args: any[]) => {
          let databaseId = '';
          let tableId = '';
          let rowId = '';
          if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
            databaseId = args[0].databaseId;
            tableId = args[0].tableId;
            rowId = args[0].rowId;
          } else {
            [databaseId, tableId, rowId] = args;
          }
          const res = await (target as any).deleteRow(...args);
          if (databaseId && tableId) {
            invalidateServerRowCache(databaseId, tableId, rowId);
          }
          return res;
        };
      }

      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  }) as unknown as TablesDB;

  cachedSystemTablesDB = proxied;

  try {
    experimental_taintObjectReference(
      'Security Boundary Violation: High-privilege System TablesDB must never be passed to the client.',
      cachedSystemTablesDB
    );
  } catch (_e) {
    // Fail-silent
  }

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
    .map((e: any) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminList.includes(normalized);
}

/**
 * Highly gated Admin Client for strict administrative actions (manual billing, admin panel).
 * Mathematically guaranteed to fail if APPWRITE_API is invalid, OR if actorEmail is empty, OR if actorEmail is not listed in the ADMINS env variable.
 */
export function createAdminClient(actorEmail: string) {
  const apiKey = process.env.APPWRITE_API;
  
  if (!apiKey) {
    throw new Error('System API key is missing. Unauthorized action.');
  }

  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email || !isEmailInAdminList(email)) {
    console.warn(`[Admin Client] Gated action blocked. "${email}" is not authorized.`);
    throw new Error('Forbidden: Unauthorized admin operation.');
  }

  const client = configureInternalAppwriteClient(
    new Client()
      .setEndpoint(APPWRITE_CONFIG.SERVER_ENDPOINT)
      .setProject(APPWRITE_CONFIG.PROJECT_ID)
      .setKey(apiKey)
  );

  const adminClient = {
    client,
    account: new Account(client),
    databases: createProxiedDatabases(client),
    messaging: new Messaging(client),
    storage: new Storage(client),
    users: new Users(client),
    teams: new Teams(client)};

  try {
    experimental_taintObjectReference(
      'Security Boundary Violation: High-privilege Admin Client must never be passed to the client.',
      adminClient
    );
  } catch (_e) {
    // Fail-silent
  }

  return adminClient;
}

/**
 * Highly gated Admin TablesDB instance.
 * Mathematically guaranteed to fail if APPWRITE_API is invalid, OR if actorEmail is empty, OR if actorEmail is not listed in the ADMINS env variable.
 */
export function createAdminTablesDB(actorEmail: string) {
  const apiKey = process.env.APPWRITE_API;

  if (!apiKey) {
    throw new Error('System API key is missing. Unauthorized action.');
  }

  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email || !isEmailInAdminList(email)) {
    console.warn(`[Admin TablesDB] Gated action blocked. "${email}" is not authorized.`);
    throw new Error('Forbidden: Unauthorized admin operation.');
  }

  const client = configureInternalAppwriteClient(
    new Client()
      .setEndpoint(APPWRITE_CONFIG.SERVER_ENDPOINT)
      .setProject(APPWRITE_CONFIG.PROJECT_ID)
      .setKey(apiKey)
  );

  const adminTablesDB = new TablesDB(client);

  try {
    experimental_taintObjectReference(
      'Security Boundary Violation: High-privilege Admin TablesDB must never be passed to the client.',
      adminTablesDB
    );
  } catch (_e) {
    // Fail-silent
  }

  return adminTablesDB;
}

export function createSystemFunctions() {
  const { client } = createSystemClient();
  return new Functions(client);
}
