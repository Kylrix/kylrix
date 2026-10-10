import { ulid } from '@/lib/utils/ulid';

export const ID = {
  unique: (padding?: number) => {
    const id = ulid().toLowerCase();
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

export class AppwriteException extends Error {
  code: number;
  type: string;
  response: string;
  constructor(message: string, code: number = 500, type: string = 'general_error', response: string = '') {
    super(message);
    this.name = 'AppwriteException';
    this.code = code;
    this.type = type;
    this.response = response;
  }
}

export class Client {
  endpoint: string = '';
  project: string = '';
  key: string = '';
  headers: Record<string, string> = {};

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
    return this;
  }
  setProject(project: string) {
    this.project = project;
    return this;
  }
  setKey(key: string) {
    this.key = key;
    return this;
  }
  setSession(_session: string) {
    return this;
  }
  setJWT(_jwt: string) {
    return this;
  }
  addHeader(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }
}

export class Account {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }
  async get(): Promise<any> {
    return null;
  }
  async createJWT(): Promise<{ jwt: string }> {
    return { jwt: `turso_${Date.now()}` };
  }
  async getSession(_sessionId: string): Promise<any> {
    return null;
  }
  async deleteSession(_sessionId: string): Promise<any> {
    return {};
  }
}

export class TablesDB {
  client?: Client;
  constructor(client?: Client) {
    this.client = client;
  }

  async getRow<T = any>(...args: any[]): Promise<T> {
    const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
    return (createSystemTablesDB() as any).getRow(...args);
  }

  async listRows<T = any>(...args: any[]): Promise<{ total: number; rows: T[] }> {
    const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
    return (createSystemTablesDB() as any).listRows(...args);
  }

  async createRow<T = any>(...args: any[]): Promise<T> {
    const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
    return (createSystemTablesDB() as any).createRow(...args);
  }

  async updateRow<T = any>(...args: any[]): Promise<T> {
    const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
    return (createSystemTablesDB() as any).updateRow(...args);
  }

  async deleteRow(...args: any[]): Promise<void> {
    const { createSystemTablesDB } = await import('@/lib/appwrite-admin');
    return (createSystemTablesDB() as any).deleteRow(...args);
  }
}

export class Databases extends TablesDB {
  async getDocument<T = any>(...args: any[]): Promise<T> {
    return this.getRow(...args);
  }
  async listDocuments<T = any>(...args: any[]): Promise<{ total: number; documents: T[]; rows: T[] }> {
    const res = await this.listRows(...args);
    return { ...res, documents: res.rows };
  }
  async createDocument<T = any>(...args: any[]): Promise<T> {
    return this.createRow(...args);
  }
  async updateDocument<T = any>(...args: any[]): Promise<T> {
    return this.updateRow(...args);
  }
  async deleteDocument(...args: any[]): Promise<void> {
    return this.deleteRow(...args);
  }
}

export class Storage {
  constructor(_client?: Client) {}
  async createFile(): Promise<any> {
    throw new Error('Storage is deprecated and disabled.');
  }
  async deleteFile(): Promise<any> {
    return {};
  }
  getFileView(): string {
    return '';
  }
  getFilePreview(): string {
    return '';
  }
  getFileDownload(): string {
    return '';
  }
}

export class Users {
  constructor(_client?: Client) {}
  async get(userId: string) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.get(userId);
  }
  async list(queries?: any[]) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.list(queries as any);
  }
  async create(...args: any[]) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return (createSystemClient().users as any).create(...args);
  }
  async updatePrefs(userId: string, prefs: any) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.updatePrefs(userId, prefs);
  }
  async getPrefs(userId: string) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.getPrefs(userId);
  }
  async delete(userId: string) {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.delete(userId);
  }
}

export class Teams {
  constructor(_client?: Client) {}
  async list() {
    return { total: 0, teams: [] };
  }
  async get() {
    return null;
  }
}

export class Functions {
  constructor(_client?: Client) {}
  async createExecution() {
    return { status: 'completed', responseBody: '' };
  }
}

export class Messaging {
  constructor(_client?: Client) {}
  async createEmail() {
    return {};
  }
}

export class Realtime {
  constructor(_client?: Client) {}
  subscribe() {
    return () => {};
  }
}

export class Avatars {
  constructor(_client?: Client) {}
  getInitials() {
    return '';
  }
}

export class Locale {
  constructor(_client?: Client) {}
  async get() {
    return { country: '', countryCode: '' };
  }
}

export enum AuthenticationFactor {
  Email = 'email',
  Phone = 'phone',
  Totp = 'totp',
  Recoverycode = 'recoverycode',
}

export enum AuthenticatorType {
  Totp = 'totp',
}

export enum ExecutionMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export class InputFile {
  static fromBuffer(buffer: Buffer, filename: string): any {
    return { buffer, filename };
  }
  static fromPath(path: string, filename: string): any {
    return { path, filename };
  }
}

export namespace Models {
  export interface Document {
    $id: string;
    $collectionId: string;
    $databaseId: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    [key: string]: any;
  }
  export interface Row extends Document {}
  export interface User<T = any> {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    name: string;
    email: string;
    phone: string;
    status: boolean;
    labels: string[];
    prefs: T;
    accessedAt: string;
    registration: string;
    passwordUpdate: string;
    emailVerification: boolean;
    phoneVerification: boolean;
    mfa: boolean;
  }
  export interface Session {
    $id: string;
    userId: string;
    expire: string;
    provider: string;
    providerUid: string;
    providerAccessToken: string;
    current: boolean;
    factors: string[];
    secret: string;
  }
  export interface File {
    $id: string;
    bucketId: string;
    $createdAt: string;
    $updatedAt: string;
    name: string;
    signature: string;
    mimeType: string;
    sizeOriginal: number;
    chunksTotal: number;
    chunksUploaded: number;
  }
  export interface Team {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    name: string;
    total: number;
    prefs: Record<string, any>;
  }
  export interface Preferences {
    [key: string]: any;
  }
}
