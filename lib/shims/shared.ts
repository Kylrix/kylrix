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
  subscribe(channels: string | string[], callback: (response: any) => void) {
    if (typeof window === 'undefined') {
      return () => {};
    }
    try {
      const { partyRealtime } = require('@/lib/realtime/partykit');
      return partyRealtime.subscribe(channels, callback);
    } catch {
      return () => {};
    }
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
  async getPrefs(): Promise<Record<string, any>> {
    return {};
  }
  async updatePrefs(prefs: Record<string, any>): Promise<Record<string, any>> {
    return prefs;
  }
  async listSessions(): Promise<{ rows: any[]; sessions: any[] }> {
    return { rows: [], sessions: [] };
  }
  async deleteSessions(): Promise<void> { return; }
  async updateName(_name: string): Promise<any> { return null; }
  async createEmailPasswordSession(_email: string, _password: string): Promise<any> { return null; }
  async createSession(_params: { userId: string; secret: string } | string, _secret?: string): Promise<any> { return null; }
  async createEmailToken(_userId: string, _email: string): Promise<any> { return { userId: _userId, secret: '' }; }
  async createOAuth2Session(_provider: string, _success: string, _failure: string): Promise<void> { return; }
  async listLogs(): Promise<{ logs: any[] }> { return { logs: [] }; }
  async listMfaFactors(): Promise<{ totp: boolean; email: boolean; phone: boolean }> { return { totp: false, email: false, phone: false }; }
  async createMfaChallenge(_params: string | { factor: any }): Promise<any> { return { $id: '' }; }
  async updateMfaChallenge(_params: { challengeId: string; otp: string } | string, _otp?: string): Promise<any> { return {}; }
  async createMfaRecoveryCodes(): Promise<{ recoveryCodes: string[] }> { return { recoveryCodes: [] }; }
  async updateMFA(_params: boolean | { mfa: boolean }): Promise<any> { return null; }
  async createMfaAuthenticator(_params: string | { type: any }): Promise<any> { return { secret: '', uri: '' }; }
  async updateMfaAuthenticator(_params: string | { type: any }, _otp?: string): Promise<any> { return {}; }
  async deleteMfaAuthenticator(_params: string | { type: any }, ..._args: any[]): Promise<void> { return; }
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

/** Storage has been removed. File uploads, attachments, and buckets are not supported. */
export class Storage {
  constructor(_client?: any) {}
  async createFile(..._args: any[]): Promise<never> {
    throw new Error('File storage is not supported.');
  }
  async deleteFile(_bucketId: string, _fileId: string, ..._args: any[]): Promise<void> { return; }
  async updateFile(_bucketId: string, _fileId: string, ..._args: any[]): Promise<any> { return null; }
  async listFiles(_bucketId: string, _queries?: any[]): Promise<{ total: number; files: any[] }> { return { total: 0, files: [] }; }
  getFileView(_bucketId?: string, _fileId?: string, ..._args: any[]): string { return ''; }
  getFilePreview(_bucketId?: string, _fileId?: string, _width?: number, _height?: number, ..._args: any[]): string { return ''; }
  getFileDownload(_bucketId?: string, _fileId?: string, ..._args: any[]): string { return ''; }
  async getFile(_bucketId?: string, _fileId?: string): Promise<any> { return null; }
}

export class Users {
  constructor(_client?: Client) {}
  async get(userId: string): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.get(userId);
  }
  async list(queries?: any[]): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.list(queries as any);
  }
  async create(...args: any[]): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return (createSystemClient().users as any).create(...args);
  }
  async updatePrefs(userId: string, prefs: any): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.updatePrefs(userId, prefs);
  }
  async getPrefs(userId: string): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.getPrefs(userId);
  }
  async delete(userId: string): Promise<any> {
    const { createSystemClient } = await import('@/lib/appwrite-admin');
    return createSystemClient().users.delete(userId);
  }
  async listLogs(_userId: string): Promise<{ logs: any[] }> { return { logs: [] }; }
  async createToken(_userId: string): Promise<{ userId: string; secret: string }> { return { userId: _userId, secret: '' }; }
  async updatePassword(_userId: string, _password: string): Promise<any> { return null; }
  async updateStatus(_userId: string, _status: boolean): Promise<any> { return null; }
  async updateLabels(_userId: string, _labels: string[]): Promise<any> { return null; }
}

export class Teams {
  constructor(_client?: Client) {}
  async list(_queries?: any[]) {
    return { total: 0, teams: [] };
  }
  async get(_teamId: string) {
    return null;
  }
  async create(_teamId: string, _name: string, _roles?: string[]): Promise<any> { return { $id: _teamId, name: _name }; }
  async delete(_teamId: string): Promise<void> { return; }
  async createMembership(_teamId: string, _roles: string[], _email?: string, ..._args: any[]): Promise<any> { return {}; }
  async deleteMembership(_teamId: string, _membershipId: string): Promise<void> { return; }
  async listMemberships(_teamId: string): Promise<{ total: number; memberships: any[] }> { return { total: 0, memberships: [] }; }
}

export class Functions {
  constructor(_client?: Client) {}
  async createExecution(..._args: any[]): Promise<any> {
    return { status: 'completed', responseBody: '' };
  }
}

export class Messaging {
  constructor(_client?: Client) {}
  async createEmail(..._args: any[]): Promise<any> {
    return { $id: 'msg_stub' };
  }
}

export class Realtime {
  constructor(_client?: Client) {}
  subscribe(channels: string | string[], callback: (response: any) => void) {
    if (typeof window === 'undefined') {
      return () => {};
    }
    try {
      const { partyRealtime } = require('@/lib/realtime/partykit');
      return partyRealtime.subscribe(channels, callback);
    } catch {
      return () => {};
    }
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

export enum OAuthProvider {
  Google = 'google',
  Github = 'github',
  Apple = 'apple',
  Discord = 'discord',
  Spotify = 'spotify',
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
    $createdAt: string;
    $updatedAt: string;
    userId: string;
    expire: string;
    provider: string;
    providerUid: string;
    providerAccessToken: string;
    current: boolean;
    factors: string[];
    secret: string;
    ip: string;
    osCode: string;
    osName: string;
    osVersion: string;
    clientType: string;
    clientCode: string;
    clientName: string;
    clientVersion: string;
    clientEngine: string;
    clientEngineVersion: string;
    deviceName: string;
    deviceBrand: string;
    deviceModel: string;
    countryCode: string;
    countryName: string;
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
  export interface Log {
    event: string;
    userId: string;
    userEmail: string;
    userName: string;
    mode: string;
    ip: string;
    time: string;
    osCode: string;
    osName: string;
    osVersion: string;
    clientType: string;
    clientCode: string;
    clientName: string;
    clientVersion: string;
    clientEngine: string;
    clientEngineVersion: string;
    deviceName: string;
    deviceBrand: string;
    deviceModel: string;
    countryCode: string;
    countryName: string;
  }
  export interface FileList {
    total: number;
    files: File[];
  }
  export interface RowList<T = Document> {
    total: number;
    rows: T[];
  }
  export interface DefaultRow extends Document {}
}
