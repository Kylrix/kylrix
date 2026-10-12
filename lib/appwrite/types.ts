import type {
  Credentials,
  TotpSecrets,
  Folders,
  SecurityLogs,
  User,
  Keychain,
  KeyMapping} from '@/types/appwrite';

export type {
  Credentials,
  TotpSecrets,
  Folders,
  SecurityLogs,
  User,
  Keychain,
  KeyMapping};

export const ID = {
  unique: (padding?: number) => {
    const id = crypto.randomUUID().replace(/-/g, '');
    return padding ? id.slice(0, padding) : id;
  },
  custom: (val: string) => val,
};

export const Query = {
  equal: (attribute: string, value: any) => `equal("${attribute}", ${JSON.stringify(value)})`,
  notEqual: (attribute: string, value: any) => `notEqual("${attribute}", ${JSON.stringify(value)})`,
  lessThan: (attribute: string, value: any) => `lessThan("${attribute}", ${JSON.stringify(value)})`,
  lessThanEqual: (attribute: string, value: any) => `lessThanEqual("${attribute}", ${JSON.stringify(value)})`,
  greaterThan: (attribute: string, value: any) => `greaterThan("${attribute}", ${JSON.stringify(value)})`,
  greaterThanEqual: (attribute: string, value: any) => `greaterThanEqual("${attribute}", ${JSON.stringify(value)})`,
  search: (attribute: string, value: string) => `search("${attribute}", ${JSON.stringify(value)})`,
  orderDesc: (attribute: string) => `orderDesc("${attribute}")`,
  orderAsc: (attribute: string) => `orderAsc("${attribute}")`,
  limit: (limit: number) => `limit(${limit})`,
  offset: (offset: number) => `offset(${offset})`,
  isNull: (attribute: string) => `isNull("${attribute}")`,
  isNotNull: (attribute: string) => `isNotNull("${attribute}")`,
  contains: (attribute: string, value: any) => `contains("${attribute}", ${JSON.stringify(value)})`,
  startsWith: (attribute: string, value: string) => `startsWith("${attribute}", ${JSON.stringify(value)})`,
  endsWith: (attribute: string, value: string) => `endsWith("${attribute}", ${JSON.stringify(value)})`,
  select: (attributes: string[]) => `select(${JSON.stringify(attributes)})`,
  between: (attribute: string, start: any, end: any) => `between("${attribute}", ${JSON.stringify(start)}, ${JSON.stringify(end)})`,
  cursorAfter: (documentId: string) => `cursorAfter("${documentId}")`,
  cursorBefore: (documentId: string) => `cursorBefore("${documentId}")`,
  or: (queries: string[]) => `or(${JSON.stringify(queries)})`,
  and: (queries: string[]) => `and(${JSON.stringify(queries)})`,
  notContains: (attribute: string, value: any) => `notContains("${attribute}", ${JSON.stringify(value)})`,
};

export const Role = {
  any: () => 'role:all',
  user: (userId: string, status?: string) => `user:${userId}${status ? `/${status}` : ''}`,
  users: (status?: string) => `users${status ? `/${status}` : ''}`,
  guest: () => 'role:guest',
  team: (teamId: string, role?: string) => `team:${teamId}${role ? `/${role}` : ''}`,
  label: (name: string) => `label:${name}`,
};

export const Permission = {
  read: (role: string) => `read("${role}")`,
  write: (role: string) => `write("${role}")`,
  create: (role: string) => `create("${role}")`,
  update: (role: string) => `update("${role}")`,
  delete: (role: string) => `delete("${role}")`,
};

export class Client {
  endpoint = '';
  project = '';
  key = '';
  headers: Record<string, string> = {};
  setEndpoint(endpoint: string) { this.endpoint = endpoint; return this; }
  setProject(project: string) { this.project = project; return this; }
  setKey(key: string) { this.key = key; return this; }
  setSession(_session: string) { return this; }
  setJWT(_jwt: string) { return this; }
  addHeader(key: string, value: string) { this.headers[key] = value; return this; }
  subscribe(_channels: any, _callback: any) { return () => {}; }
}

export class Account {
  constructor(_client?: any) {}
  async get(): Promise<any> { return null; }
  async createJWT(): Promise<{ jwt: string }> { return { jwt: '' }; }
  async getSession(_sessionId: string): Promise<any> { return null; }
  async deleteSession(_sessionId: string): Promise<any> { return {}; }
  async deleteSessions(): Promise<void> { return; }
  async getPrefs(): Promise<Record<string, any>> { return {}; }
  async updatePrefs(prefs: Record<string, any>): Promise<Record<string, any>> { return prefs; }
  async listSessions(): Promise<{ rows: any[]; sessions: any[] }> { return { rows: [], sessions: [] }; }
}

export class TablesDB {
  constructor(_client?: any) {}
  async getRow<T = any>(...args: any[]): Promise<T> {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    let [databaseId, tableId, rowId] = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? [args[0].databaseId, args[0].tableId, args[0].rowId] : args;
    return db.getRow(databaseId, tableId, rowId, { forceSystem: true });
  }
  async listRows<T = any>(...args: any[]): Promise<{ total: number; rows: T[] }> {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    let [databaseId, tableId, queries] = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? [args[0].databaseId, args[0].tableId, args[0].queries] : args;
    return db.listRows(databaseId, tableId, queries, { forceSystem: true });
  }
  async createRow<T = any>(...args: any[]): Promise<T> {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    let [databaseId, tableId, rowId, data, permissions] = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? [args[0].databaseId, args[0].tableId, args[0].rowId, args[0].data, args[0].permissions] : args;
    return db.createRow(databaseId, tableId, rowId, data, permissions, { forceSystem: true });
  }
  async updateRow<T = any>(...args: any[]): Promise<T> {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    let [databaseId, tableId, rowId, data, permissions] = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? [args[0].databaseId, args[0].tableId, args[0].rowId, args[0].data, args[0].permissions] : args;
    return db.updateRow(databaseId, tableId, rowId, data, permissions, { forceSystem: true });
  }
  async deleteRow(...args: any[]): Promise<void> {
    const { Registry } = await import('@/lib/core/di/registry');
    const db = Registry.getDatabase();
    let [databaseId, tableId, rowId] = args.length === 1 && typeof args[0] === 'object' && args[0] !== null ? [args[0].databaseId, args[0].tableId, args[0].rowId] : args;
    return db.deleteRow(databaseId, tableId, rowId, { forceSystem: true });
  }
}

export class Databases extends TablesDB {
  async getDocument<T = any>(...args: any[]): Promise<T> { return this.getRow(...args); }
  async listDocuments<T = any>(...args: any[]): Promise<any> { return this.listRows(...args); }
  async createDocument<T = any>(...args: any[]): Promise<T> { return this.createRow(...args); }
  async updateDocument<T = any>(...args: any[]): Promise<T> { return this.updateRow(...args); }
  async deleteDocument(...args: any[]): Promise<void> { return this.deleteRow(...args); }
}

export class Users {
  constructor(_client?: any) {}
  async get(userId: string): Promise<any> {
    const { db } = await import('@/lib/db');
    const schema = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      $id: u.id,
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      status: true,
      emailVerification: Boolean(u.emailVerified),
      prefs: {},
    };
  }
  async list(_queries?: any[]): Promise<any> { return { total: 0, users: [] }; }
  async create(..._args: any[]): Promise<any> { return null; }
  async updatePrefs(_userId: string, prefs: any): Promise<any> { return prefs; }
  async getPrefs(_userId: string): Promise<any> { return {}; }
  async delete(_userId: string): Promise<any> { return {}; }
}

export class Teams { constructor(_client?: any) {} }
export class Functions { constructor(_client?: any) {} }
export class Messaging { constructor(_client?: any) {} }
export class Storage { constructor(_client?: any) {} }
export class Realtime { constructor(_client?: any) {} }

export function isEmailInAdminList(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  const adminList = String(process.env.ADMINS || '')
    .split(',')
    .map((e: any) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminList.includes(normalized);
}

export function createSystemTablesDB(): TablesDB {
  return new TablesDB();
}

export function createSystemClient() {
  const client = new Client();
  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    messaging: new Messaging(client),
    users: new Users(client),
    teams: new Teams(client),
    storage: new Storage(client),
  };
}

export function createAdminClient(_actorEmail: string) {
  return createSystemClient();
}

export type SecurityLogsCreate = {
  userId: string;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  details?: string | null;
  success: boolean;
  severity?: string;
  timestamp: string;
};

export type CredentialsCreate = {
  userId: string;
  itemType: string;
  name: string;
  url?: string | null;
  notes?: string | null;
  totpId?: string | null;
  password?: string | null;
  cardNumber?: string | null;
  cardholderName?: string | null;
  cardExpiry?: string | null;
  cardCVV?: string | null;
  cardPIN?: string | null;
  cardType?: string | null;
  folderId?: string | null;
  tags?: string[] | null;
  customFields?: string | null;
  faviconUrl?: string | null;
  isFavorite?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  lastAccessedAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  username?: string | null;
  sharedFrom?: string | null;
  attachments?: string | null;
  dek?: string | null;
  keepPermission?: boolean | null;
  source?: string | null;
  isEnv?: boolean | null;
};

export type FoldersCreate = {
  userId: string;
  name: string;
  parentFolderId?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type TotpSecretsCreate = {
  userId: string;
  issuer: string;
  accountName: string;
  secretKey: string;
  algorithm: string;
  digits: number;
  period: number;
  url?: string | null;
  folderId?: string | null;
  tags?: string[] | null;
  isFavorite?: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  sharedFrom?: string | null;
  dek?: string | null;
  keepPermission?: boolean | null;
  source?: string | null;
};

export type KeychainCreate = {
  userId: string;
  type: string;
  credentialId?: string | null;
  wrappedKey: string;
  salt: string;
  params?: string | null;
  isBackup?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KeyMappingCreate = {
  resourceId: string;
  resourceType: string;
  grantee: string;
  wrappedKey: string;
  metadata?: string | null;
  isShared?: boolean | null;
};
