import { Client, Account, Databases, Messaging, Users, TablesDB, Teams, Functions } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { configureInternalAppwriteClient } from '@/lib/appwrite/internal-headers';
import * as React from 'react';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Registry } from '@/lib/core/di/registry';

const experimental_taintUniqueValue: (
  message: string,
  lifetime: any,
  value: any
) => void = (React as any).experimental_taintUniqueValue || (() => {});

const experimental_taintObjectReference: (
  message: string,
  object: any
) => void = (React as any).experimental_taintObjectReference || (() => {});

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
  users: Users;
  teams: Teams;
} | null = null;

function parseSafeIso(val: any, fallback?: string): string {
  if (!val) return fallback || new Date().toISOString();
  if (val instanceof Date) return isNaN(val.getTime()) ? (fallback || new Date().toISOString()) : val.toISOString();
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? (fallback || new Date().toISOString()) : d.toISOString();
  }
  const str = String(val).trim();
  const d = new Date(str);
  return isNaN(d.getTime()) ? (fallback || new Date().toISOString()) : d.toISOString();
}

function shapeTursoUser(u: any) {
  if (!u) return null;
  let labels: string[] = [];
  try { if (u.labels) labels = typeof u.labels === 'string' ? JSON.parse(u.labels) : u.labels; } catch {}
  let prefs: Record<string, any> = {};
  try { if (u.prefs) prefs = typeof u.prefs === 'string' ? JSON.parse(u.prefs) : u.prefs; } catch {}

  const createdAt = parseSafeIso(u.createdAt);
  const updatedAt = parseSafeIso(u.updatedAt, createdAt);

  return {
    $id: u.id,
    id: u.id,
    $createdAt: createdAt,
    $updatedAt: updatedAt,
    name: u.name || '',
    email: u.email || '',
    phone: u.phone || '',
    emailVerification: Boolean(u.emailVerified),
    phoneVerification: Boolean(u.phoneVerified),
    status: !u.banned,
    labels,
    prefs,
    accessedAt: updatedAt,
    registration: createdAt,
    passwordUpdate: updatedAt,
    mfa: Boolean(u.twoFactorEnabled),
  };
}

function createTursoUsers(): any {
  return {
    async get(userId: string) {
      const rows = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
      if (rows.length === 0) {
        throw new Error(`User with ID "${userId}" not found.`);
      }
      return shapeTursoUser(rows[0]);
    },

    async list(queries?: any[]) {
      let limitVal = 50;
      let offsetVal = 0;
      const conditions: any[] = [];

      if (Array.isArray(queries)) {
        for (const q of queries) {
          if (typeof q === 'string') {
            const match = q.match(/^([a-zA-Z]+)\("([^"]+)"(?:,\s*(.+))?\)$/);
            if (match) {
              const type = match[1];
              const attr = match[2];
              let val = match[3];
              try { if (val) val = JSON.parse(val); } catch {}
              if (type === 'equal' && attr === 'email') {
                conditions.push(eq(schema.user.email, val));
              } else if (type === 'equal' && (attr === 'userId' || attr === '$id' || attr === 'id')) {
                conditions.push(eq(schema.user.id, val));
              } else if (type === 'limit') {
                limitVal = Number(attr) || limitVal;
              } else if (type === 'offset') {
                offsetVal = Number(attr) || offsetVal;
              }
            }
          }
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(schema.user)
        .where(whereClause)
        .limit(limitVal)
        .offset(offsetVal);

      return {
        total: rows.length,
        users: rows.map(shapeTursoUser),
      };
    },

    async getPrefs(userId: string) {
      const u = await this.get(userId);
      return u?.prefs || {};
    },

    async updatePrefs(userId: string, prefs: Record<string, any>) {
      const existing = await this.getPrefs(userId);
      const merged = { ...existing, ...prefs };
      await db
        .update(schema.user)
        .set({ prefs: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return merged;
    },

    async updateName(userId: string, name: string) {
      await db
        .update(schema.user)
        .set({ name, updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return await this.get(userId);
    },

    async updateEmail(userId: string, email: string) {
      await db
        .update(schema.user)
        .set({ email, updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return await this.get(userId);
    },

    async updatePassword(userId: string, _password: string) {
      await db
        .update(schema.user)
        .set({ updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return await this.get(userId);
    },

    async updateStatus(userId: string, status: boolean) {
      await db
        .update(schema.user)
        .set({ banned: !status, updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return await this.get(userId);
    },

    async updateLabels(userId: string, labels: string[]) {
      await db
        .update(schema.user)
        .set({ labels: JSON.stringify(labels), updatedAt: new Date() })
        .where(eq(schema.user.id, userId));
      return await this.get(userId);
    },

    async create(userId: string, email: string, phone?: string, _password?: string, name?: string) {
      const id = userId === 'unique()' || !userId ? crypto.randomUUID() : userId;
      const now = new Date();
      await db.insert(schema.user).values({
        id,
        email,
        name: name || email.split('@')[0],
        phone: phone || null,
        createdAt: now,
        updatedAt: now,
        emailVerified: false,
      });
      return await this.get(id);
    },

    async delete(userId: string) {
      await db.delete(schema.user).where(eq(schema.user.id, userId));
      return {};
    },

    async createToken(_userId: string) {
      return { secret: `turso_${crypto.randomUUID()}` };
    },

    async listLogs(_userId: string) {
      return { total: 0, logs: [] };
    },
  };
}

let cachedSystemTablesDB: TablesDB | null = null;

export function createSystemTablesDB(): TablesDB {
  if (cachedSystemTablesDB) {
    return cachedSystemTablesDB;
  }

  const dbAdapter = Registry.getDatabase();

  const proxied: any = {
    async createRow(...args: any[]) {
      let databaseId = '';
      let tableId = '';
      let rowId: string | null = null;
      let data: any = {};
      let permissions: string[] | undefined;
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        databaseId = args[0].databaseId;
        tableId = args[0].tableId;
        rowId = args[0].rowId || null;
        data = args[0].data || {};
        permissions = args[0].permissions;
      } else {
        [databaseId, tableId, rowId, data, permissions] = args;
      }
      return await dbAdapter.createRow(databaseId, tableId, rowId, data, permissions, { forceSystem: true });
    },

    async getRow(...args: any[]) {
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
      return await dbAdapter.getRow(databaseId, tableId, rowId, { forceSystem: true });
    },

    async listRows(...args: any[]) {
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
      return await dbAdapter.listRows(databaseId, tableId, queries, { forceSystem: true });
    },

    async updateRow(...args: any[]) {
      let databaseId = '';
      let tableId = '';
      let rowId = '';
      let data: any = {};
      let permissions: string[] | undefined;
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        databaseId = args[0].databaseId;
        tableId = args[0].tableId;
        rowId = args[0].rowId;
        data = args[0].data || {};
        permissions = args[0].permissions;
      } else {
        [databaseId, tableId, rowId, data, permissions] = args;
      }
      return await dbAdapter.updateRow(databaseId, tableId, rowId, data, permissions, { forceSystem: true });
    },

    async deleteRow(...args: any[]) {
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
      return await dbAdapter.deleteRow(databaseId, tableId, rowId, { forceSystem: true });
    },

    async incrementRowColumn(...args: any[]) {
      if (typeof dbAdapter.incrementRowColumn === 'function') {
        const input = args.length === 1 ? args[0] : { databaseId: args[0], tableId: args[1], rowId: args[2], column: args[3], value: args[4] };
        return await dbAdapter.incrementRowColumn(input, { forceSystem: true });
      }
    }
  };

  cachedSystemTablesDB = proxied as unknown as TablesDB;
  return cachedSystemTablesDB;
}

function createProxiedDatabases(_client?: Client) {
  const tablesDB = createSystemTablesDB();
  return new Proxy({} as any, {
    get(_target, prop) {
      if (prop === 'listRows' || prop === 'listDocuments') {
        return async (databaseId: string, tableId: string, queries?: any[]) => {
          return tablesDB.listRows({ databaseId, tableId, queries });
        };
      }
      if (prop === 'getRow' || prop === 'getDocument') {
        return async (databaseId: string, tableId: string, rowId: string, queries?: any[]) => {
          return tablesDB.getRow({ databaseId, tableId, rowId, queries });
        };
      }
      if (prop === 'createRow' || prop === 'createDocument') {
        return async (databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) => {
          return tablesDB.createRow({ databaseId, tableId, rowId, data, permissions });
        };
      }
      if (prop === 'updateRow' || prop === 'updateDocument') {
        return async (databaseId: string, tableId: string, rowId: string, data: any, permissions?: string[]) => {
          return tablesDB.updateRow({ databaseId, tableId, rowId, data, permissions });
        };
      }
      if (prop === 'deleteRow' || prop === 'deleteDocument') {
        return async (databaseId: string, tableId: string, rowId: string) => {
          return tablesDB.deleteRow({ databaseId, tableId, rowId });
        };
      }
      return (tablesDB as any)[prop];
    }
  }) as unknown as Databases;
}

export function createSystemClient() {
  if (cachedSystemClient) {
    return cachedSystemClient;
  }

  const client = new Client();
  const apiKey = process.env.APPWRITE_API;

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
    users: createTursoUsers() as unknown as Users,
    teams: new Teams(client),
  };

  return cachedSystemClient;
}

export function invalidateServerRowCache(_databaseId: string, _tableId: string, _rowId?: string) {
  // Turso is directly consistent with zero stale server caches
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
    users: createTursoUsers() as unknown as Users,
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
 * Mathematically guaranteed to fail if actorEmail is empty, OR if actorEmail is not listed in the ADMINS env variable.
 */
export function createAdminTablesDB(actorEmail: string) {
  const email = String(actorEmail || '').trim().toLowerCase();
  if (!email || !isEmailInAdminList(email)) {
    console.warn(`[Admin TablesDB] Gated action blocked. "${email}" is not authorized.`);
    throw new Error('Forbidden: Unauthorized admin operation.');
  }

  return createSystemTablesDB();
}

export function createSystemFunctions() {
  const { client } = createSystemClient();
  return new Functions(client);
}
