export { resolveDataBackendProvider, type DataBackendProvider } from './backend';
export { getDatabase, Registry } from './db';
export { q, type QueryExpression } from './queries';
export { systemTables, overrideSystemTables, createRegistrySystemTables } from './system-tables';
export type { SystemTablesPort } from './system-tables.port';
export {
  tagsCacheKey,
  readLocalTagRows,
  writeLocalTagRows,
  upsertLocalTag,
  findLocalTagByName,
  mergeTagIntoRows,
  normalizeTagCachePayload,
  type TagCachePayload,
} from './local/tags';

export type Notes = {
  $id: string;
  id?: string;
  title?: string | null;
  content?: string | null;
  userId?: string;
  isPublic?: boolean;
  dek?: string | null;
  createdAt?: string;
  updatedAt?: string;
  $createdAt?: string;
  $updatedAt?: string;
  [key: string]: any;
};

export type Forms = {
  $id: string;
  id?: string;
  title?: string;
  description?: string | null;
  schema?: string | null;
  settings?: string | null;
  status?: string;
  userId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

export type Calendars = any;
export type Tasks = any;
export type Events = any;
export type EventGuests = any;

export type Credentials = any;
export type CredentialsCreate = any;
export type TotpSecrets = any;
export type Folders = any;
export type Users = any;
export type Projects = any;
export type ProjectObjects = any;
export type Tags = any;
export type ActivityLog = any;

export const APPWRITE_TABLE_ID_ACTIVITYLOG = 'activity_logs';
export const APPWRITE_DATABASE_ID = 'passwordManagerDb';
export const KYLRIX_AUTH_URI = process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space';

export const APPWRITE_CONFIG = {
  PROJECT_ID: 'kylrix',
  ENDPOINT: process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space',
  SYSTEM: { DOMAIN: 'kylrix.space' },
  DATABASE_ID: 'passwordManagerDb',
  DATABASES: {
    NOTE: 'passwordManagerDb',
    CHAT: 'passwordManagerDb',
    VAULT: 'passwordManagerDb',
    FLOW: 'passwordManagerDb',
    PASSWORD_MANAGER: 'passwordManagerDb',
    CONNECT: 'passwordManagerDb',
    KYLRIXFLOW: 'passwordManagerDb',
  },
  TABLES: {
    NOTES: 'notes',
    TASKS: 'tasks',
    EVENTS: 'events',
    TAGS: 'tags',
    CALENDARS: 'calendars',
    CONTEXTS: 'contexts',
    KNOWLEDGE_GRAPH: 'knowledge_graph',
    PATTERNS: 'patterns',
    NOTE: { NOTES: 'notes', COMMENTS: 'comments', REACTIONS: 'reactions', COLLABORATORS: 'collaborators', NOTE_TAGS: 'note_tags', TAGS: 'tags', SUBSCRIPTIONS: 'subscriptions', COUPONS: 'coupons', THREADS: 'threads' },
    CHAT: { CONVERSATIONS: 'conversations', MESSAGES: 'messages', CALL_LINKS: 'call_links', ACCOUNT_EVENTS: 'account_events', PROFILES: 'profiles', EPOCHS: 'epochs', APP_ACTIVITY: 'app_activity_logs', MESSAGE_REACTIONS: 'message_reactions' },
    VAULT: { CREDENTIALS: 'credentials', USER: 'users', KEYCHAIN: 'keychain', TOTP_SECRETS: 'totp_secrets' },
    FLOW: { TASKS: 'tasks', FORMS: 'forms', EVENTS: 'events', GUESTS: 'guests', OBJECTS: 'objects', COLLABORATORS: 'collaborators',     AGENTS: 'agents', OAUTH_CONSENT_REQUESTS: 'oauth_consent_requests' },
    PASSWORD_MANAGER: { WALLETS: 'wallets', IDENTITIES: 'identities', KEY_MAPPING: 'key_mapping' },
    CONNECT: { TELEGRAM_CONNECTIONS: 'telegram_connections', CONVERSATIONS: 'conversations', MESSAGES: 'messages' },
  },
  BUCKETS: {
    GENERAL_STORAGE: 'chat_uploads',
    VOICE: 'voice',
    NOTES_ATTACHMENTS: 'notes_attachments',
    CHAT_UPLOADS: 'chat_uploads',
    FORM_ATTACHMENTS: 'form_attachments',
    EVENT_COVERS: 'event_covers',
    SEND_EPHEMERAL: 'send_ephemeral',
    APP_LOGOS: 'app_logos',
  },
  FUNCTIONS: {
    DATA_PORTER: 'data-porter',
  },
};

export const ID = {
  unique: () => `id_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
  custom: (id: string) => id,
};

export const Query = {
  equal: (attribute: string, value: any): any => ({ type: 'equal', attribute, value }),
  equalOrNull: (attribute: string, value: any): any => ({ type: 'equal', attribute, value }),
  notEqual: (attribute: string, value: any): any => ({ type: 'notEqual', attribute, value }),
  greaterThan: (attribute: string, value: any): any => ({ type: 'greaterThan', attribute, value }),
  greaterThanEqual: (attribute: string, value: any): any => ({ type: 'greaterThanEqual', attribute, value }),
  lessThan: (attribute: string, value: any): any => ({ type: 'lessThan', attribute, value }),
  lessThanEqual: (attribute: string, value: any): any => ({ type: 'lessThanEqual', attribute, value }),
  search: (attribute: string, value: any): any => ({ type: 'search', attribute, value }),
  orderDesc: (attribute: string): any => ({ type: 'orderDesc', attribute }),
  orderAsc: (attribute: string): any => ({ type: 'orderAsc', attribute }),
  limit: (value: number): any => ({ type: 'limit', value }),
  offset: (value: number): any => ({ type: 'offset', value }),
  select: (value: string[]): any => ({ type: 'select', value }),
  isNull: (attribute: string): any => ({ type: 'isNull', attribute }),
  isNotNull: (attribute: string): any => ({ type: 'isNotNull', attribute }),
  or: (queries: any[]): any => ({ type: 'or', queries }),
  startsWith: (attribute: string, value: any): any => ({ type: 'startsWith', attribute, value }),
  contains: (attribute: string, value: any): any => ({ type: 'contains', attribute, value }),
  cursorAfter: (value: string): any => ({ type: 'cursorAfter', value }),
};

export const Permission = {
  read: (role: any) => `read(${role})`,
  write: (role: any) => `write(${role})`,
  update: (role: any) => `update(${role})`,
  delete: (role: any) => `delete(${role})`,
};

export const Role = {
  any: () => 'any',
  user: (id?: string) => (id ? `user:${id}` : 'user'),
  users: () => 'users',
  guests: () => 'guests',
  team: (id: string, role?: string) => (role ? `team:${id}/${role}` : `team:${id}`),
};

export const Models = {
  Document: class {},
  Row: class {},
};

export namespace Models {
  export type Document = any;
  export type Row = any;
  export type DefaultRow = any;
  export type RowList<T = any> = { total: number; rows: T[] };
  export type Log = any;
  export type Session = any;
}

export type FormSubmissions = any;

export const OAuthProvider = {
  Google: 'google',
  Github: 'github',
  Discord: 'discord',
};

export const ExecutionMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

export class Functions {
  constructor(_client?: any) {}
  async createExecution(..._args: any[]): Promise<any> {
    return { status: 'completed', responseBody: JSON.stringify({ success: true }) };
  }
}

export class Databases {
  constructor(_client?: any) {}
  async listRows(..._args: any[]): Promise<any> { return { rows: [], total: 0 }; }
  async getRow(..._args: any[]): Promise<any> { return null; }
  async createRow(..._args: any[]): Promise<any> { return {}; }
  async updateRow(..._args: any[]): Promise<any> { return {}; }
  async deleteRow(..._args: any[]): Promise<any> { return {}; }
}

export class Client {
  setEndpoint(_endpoint: string): this { return this; }
  setProject(_project: string): this { return this; }
}

export class TablesDB extends Databases {}

export class Storage {
  constructor(_client?: any) {}
  getFilePreview(..._args: any[]): string { return ''; }
  getFileView(..._args: any[]): string { return ''; }
  getFileDownload(..._args: any[]): string { return ''; }
  async getFile(..._args: any[]): Promise<any> { return {}; }
  async updateFile(..._args: any[]): Promise<any> { return {}; }
  async createFile(..._args: any[]): Promise<any> { return {}; }
  async deleteFile(..._args: any[]): Promise<any> { return {}; }
}

export const client = {};

export const tablesDB = {
  async getRow<T = any>(..._args: any[]): Promise<T | null> { return null; },
  async listRows<T = any>(..._args: any[]): Promise<{ rows: T[]; total: number }> { return { rows: [], total: 0 }; },
  async createRow<T = any>(..._args: any[]): Promise<T> { return {} as T; },
  async updateRow<T = any>(..._args: any[]): Promise<T> { return {} as T; },
  async deleteRow(..._args: any[]): Promise<any> { return {}; },
};

export const databases = tablesDB;

export const account = {
  async get(): Promise<any> { return null; },
  async createSession(..._args: any[]): Promise<any> { return {}; },
  async createEmailPasswordSession(..._args: any[]): Promise<any> { return {}; },
  async deleteSession(..._args: any[]): Promise<any> { return {}; },
  async getPrefs(): Promise<any> { return {}; },
  async updatePrefs(..._args: any[]): Promise<any> { return {}; },
  async updateName(_name: string): Promise<any> { return { success: true }; },
  async hasMasterpass(): Promise<boolean> { return false; },
  async searchGlobalProfiles(..._args: any[]): Promise<any[]> { return []; },
  async getGlobalProfileStatus(..._args: any[]): Promise<any> { return { status: 'offline' }; },
  async listLogs(): Promise<any> { return { logs: [] }; },
  async createOAuth2Session(provider: string, success?: string, _failure?: string) {
    if (typeof window !== 'undefined') {
      const callbackURL = success || `${window.location.origin}/app?auth=success`;
      window.location.assign(
        `/api/auth/oauth/${encodeURIComponent(provider)}?callbackURL=${encodeURIComponent(callbackURL)}`,
      );
    }
    return { success: true };
  },
  async createJWT(): Promise<any> { return { jwt: '' }; },
  async listSessions(): Promise<any[]> { return []; },
  async deleteSessions(): Promise<any> { return { success: true }; },
};

export const storage = {
  getFilePreview(..._args: any[]): string { return ''; },
  getFileView(..._args: any[]): string { return ''; },
  getFileDownload(..._args: any[]): string { return ''; },
  async getFile(..._args: any[]): Promise<any> { return {}; },
  async updateFile(..._args: any[]): Promise<any> { return {}; },
  async createFile(..._args: any[]): Promise<any> { return {}; },
  async deleteFile(..._args: any[]): Promise<any> { return {}; },
};

export const users = {
  async get(_id: string): Promise<any> { return null; },
  async getPrefs(_id?: string): Promise<any> { return {}; },
  async list(_queries?: any[]): Promise<{ total: number; users: any[] }> { return { total: 0, users: [] }; },
  async create(_id: string, _email: string, _phone?: string, _password?: string, _name?: string): Promise<any> { return { $id: _id }; },
  async updatePrefs(_id: string, _prefs: any): Promise<any> { return {}; },
};

export const teams = {
  async get(_id: string): Promise<any> { return null; },
  async list(_queries?: any[]): Promise<{ total: number; teams: any[] }> { return { total: 0, teams: [] }; },
  async create(_id: string, _name: string, _roles?: any[]): Promise<any> { return { $id: _id }; },
  async delete(_id: string): Promise<any> { return { success: true }; },
  async createMembership(..._args: any[]): Promise<any> { return {}; },
  async deleteMembership(..._args: any[]): Promise<any> { return {}; },
  async listMemberships(..._args: any[]): Promise<any> { return { total: 0, memberships: [] }; },
};

export const functions = {
  async createExecution(..._args: any[]): Promise<any> {
    return { status: 'completed', responseBody: JSON.stringify({ success: true }) };
  },
};

export const messaging = {
  async createSms(..._args: any[]): Promise<any> { return {}; },
  async createEmail(..._args: any[]): Promise<any> { return {}; },
};

export const AppwriteService = {
  account,
  databases,
  client,
  storage,
  teams,
  messaging,
  functions,
  async searchGlobalProfiles(...args: any[]): Promise<any[]> { return account.searchGlobalProfiles(...args); },
  async getGlobalProfileStatus(...args: any[]): Promise<any> { return account.getGlobalProfileStatus(...args); },
  async getUserDoc(_userId: string): Promise<any> { return null; },
  async setMasterpassFlag(_userId: string, _email?: string): Promise<any> { return { success: true }; },
  async listKeychainEntries(userId: string): Promise<any[]> { return KeychainService.listKeychainEntries(userId); },
  async deleteKeychainEntry(id: string): Promise<any> { return KeychainService.deleteKeychainEntry(id); },
  async createKeychainEntry(data: any): Promise<any> {
    const { upsertKeychainTurso } = await import('@/lib/actions/turso-ops');
    const now = new Date().toISOString();
    const result = await upsertKeychainTurso({
      id: data.id || data.$id || `keychain_${Date.now()}`,
      userId: data.userId,
      account: data.account || 'masterpass',
      type: data.type || 'password',
      encryptedPayload: data.encryptedPayload || data.wrappedKey || '',
      nonce: data.nonce || data.salt || null,
      metadata: JSON.stringify({
        credentialId: data.credentialId || null,
        params: data.params || null,
        isArgon: data.isArgon ?? null,
        isPending: data.isPending ?? false,
      }),
      createdAt: data.createdAt || now,
      updatedAt: now,
    });
    return result.success ? { ...data, $id: data.id || data.$id } : null;
  },
  async createSecurityLog(_data: any): Promise<any> { return { success: true }; },
  async hasMasterpass(userId?: string): Promise<boolean> { return KeychainService.hasMasterpass(userId); },
};

export const realtime = {
  subscribe(_channels: any, _callback: any) {
    return () => {};
  },
};

export function createSystemClient() {
  return { tablesDB, account, storage, client, users, teams, messaging, functions, databases: tablesDB };
}

export function createServerClient(_jwt?: string) {
  return { tablesDB, account, storage, client, users, teams, messaging, functions, databases: tablesDB };
}

export function createAdminClient() {
  return { tablesDB, account, storage, client, users, teams, messaging, functions, databases: tablesDB };
}

export async function tryOwnerDirectUpdateNote(id: string, data: any): Promise<any> {
  return updateNote(id, data);
}

export async function tryOwnerDirectUpdateGoal(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: id,
    data,
  });
}

export async function tryOwnerDirectUpdateProject(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.OBJECTS,
    rowId: id,
    data,
  });
}

export async function tryOwnerDirectUpdateForm(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
    rowId: id,
    data,
  });
}

export async function tryOwnerDirectUpdateEvent(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
    rowId: id,
    data,
  });
}

export async function getSettings(_id?: string): Promise<any> {
  return null;
}

export async function updateSettings(_id: string, _data: any): Promise<any> {
  return { success: true };
}

export async function createSettings(_data: any): Promise<any> {
  return { success: true };
}

export async function updateRow(..._args: any[]): Promise<any> {
  return { success: true };
}

export async function listActivityLogs(): Promise<any[]> {
  return [];
}

export async function createTag(arg1: any, arg2?: any): Promise<any> {
  const name = typeof arg1 === 'string' ? arg1 : arg1?.name || 'Tag';
  const color = typeof arg1 === 'string' ? arg2 : arg1?.color;
  const userId = typeof arg1 === 'object' ? arg1?.userId || 'system' : 'system';
  const { upsertLocalTag } = await import('./local/tags');
  return upsertLocalTag(userId, { id: `tag_${Date.now()}`, name, color: color || '#6366f1' });
}

export async function updateTag(tagId: string, data: any): Promise<any> {
  const { upsertLocalTag } = await import('./local/tags');
  return upsertLocalTag('system', { id: tagId, ...data });
}

export async function deleteTag(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return (db.deleteRow as any)({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.TAGS,
    rowId: id,
  });
}

export async function getAllTags(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  const res = await (db.listRows as any)({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.TAGS,
  });
  return res.rows;
}

export async function listTagsByUser(): Promise<any[]> {
  return getAllTags();
}

export async function listTags(): Promise<any[]> {
  return getAllTags();
}

export async function createTotpSecret(data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const id = `totp_${Date.now()}`;
  return systemTables().createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: 'totp_secrets',
    rowId: id,
    data: { id, ...data },
  });
}

export async function updateTotpSecret(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: 'totp_secrets',
    rowId: id,
    data,
  });
}

export async function deleteTotpSecret(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().deleteRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: 'totp_secrets',
    rowId: id,
  });
}

export async function listTotpSecrets(_userId?: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const res = await systemTables().listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: 'totp_secrets',
  });
  return res.rows;
}

export async function createCredential(data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const id = `cred_${Date.now()}`;
  return systemTables().createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
    rowId: id,
    data: { id, ...data },
  });
}

export async function updateCredential(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
    rowId: id,
    data,
  });
}

export async function deleteCredential(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().deleteRow({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
    rowId: id,
  });
}

export async function setCredentialPinned(id: string, isPinned: boolean): Promise<any> {
  return updateCredential(id, { isPinned });
}

export async function setTotpPinned(id: string, isPinned: boolean): Promise<any> {
  return updateTotpSecret(id, { isPinned });
}

export async function validatePublicNoteAccess(noteId: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId,
  }).catch(() => null);
}

export async function createComment(noteId: string, content: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const id = `comment_${Date.now()}`;
  return systemTables().createRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.COMMENTS,
    rowId: id,
    data: {
      id,
      noteId,
      content,
      createdAt: new Date().toISOString(),
    },
  });
}

export async function getNote(noteId: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().getRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: noteId,
  });
}

export async function listNotes(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const res = await systemTables().listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
  });
  return res.rows;
}

export async function listNotesByUser(_userId?: string): Promise<any> {
  return listNotes();
}

export async function listNotesPaginated(_options?: any): Promise<{ rows: any[]; total: number; hasMore?: boolean; nextCursor?: string | null }> {
  try {
    const { authClient } = await import('@/lib/auth/better-auth-client');
    const session = await authClient.getSession();
    const userId = session?.data?.user?.id;
    if (!userId) return { rows: [], total: 0, hasMore: false, nextCursor: null };
    const { listNotesTurso } = await import('@/lib/actions/turso-ops');
    const res = await listNotesTurso(userId);
    return { rows: res.rows, total: res.rows.length, hasMore: false, nextCursor: null };
  } catch (err) {
    console.warn('[data] Turso note list failed:', err);
    return { rows: [], total: 0, hasMore: false, nextCursor: null };
  }
}

export async function updateNote(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.NOTE,
    tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
    rowId: id,
    data,
  });
}

export function pickNoteAutosavePayload(data: any): any {
  return data;
}

export function isExcludedNote(_note: any): boolean {
  return false;
}

export function createDirectUpdateEvent(_data: any) {}
export function invalidateNoteRowClientCache(_id?: string) {}
export function ideaListExclusionQueries(): any[] { return []; }

export async function getNotesByTag(tagId: string): Promise<any[]> {
  const rows = await listNotes();
  return rows.filter((n: any) => Array.isArray(n.tags) && n.tags.includes(tagId));
}

export function getNotePublicState(note: any): boolean {
  return Boolean(note?.isPublic || note?.published);
}

export function isNoteEditableByAnyone(_note: any): boolean {
  return false;
}

export async function toggleNoteVisibility(id: string, isPublic = true): Promise<any> {
  return updateNote(id, { isPublic });
}

export async function lockNote(id: string): Promise<any> {
  return updateNote(id, { isLocked: true });
}

export async function unlockNote(id: string): Promise<any> {
  return updateNote(id, { isLocked: false });
}

export async function decryptPublicEncryptedNote(note: any): Promise<any> {
  return note;
}

export async function decryptGoalForView(goal: any): Promise<any> {
  return goal;
}

export async function getNoteShareUrlWithDek(noteId: string, dek?: string | null): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space';
  return dek ? `${baseUrl}/idea/${noteId}#dek=${dek}` : `${baseUrl}/idea/${noteId}`;
}

export async function rotatePublicNoteLink(id: string): Promise<any> {
  return { id };
}

export function getShareableUrl(id: string, _dek?: string | null): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space';
  return `${baseUrl}/idea/${id}`;
}

export async function getCurrentPublicNoteShareUrl(id: string): Promise<string> {
  return getShareableUrl(id);
}

export async function listFlowTasks(_queries?: any[]): Promise<{ rows: any[]; total: number }> {
  const { systemTables } = await import('./system-tables');
  const res = await systemTables().listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
  });
  return { rows: res.rows, total: res.total };
}

export async function listFlowEvents(_queries?: any[]): Promise<{ rows: any[]; total: number }> {
  const { systemTables } = await import('./system-tables');
  const res = await systemTables().listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
  });
  return { rows: res.rows, total: res.total };
}

export async function listKeepCredentials(_queries?: any[]): Promise<{ rows: any[]; total: number }> {
  const { systemTables } = await import('./system-tables');
  const res = await systemTables().listRows({
    databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
    tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
  });
  return { rows: res.rows, total: res.total };
}

export async function getGoalShareUrlWithDek(id: string, dek?: string | null): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space';
  return dek ? `${baseUrl}/goal/${id}#dek=${dek}` : `${baseUrl}/goal/${id}`;
}

export function isGoalLocked(goal: any): boolean {
  return Boolean(goal?.isLocked);
}

export async function lockGoal(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: id,
    data: { isLocked: true },
  });
}

export async function unlockGoal(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().updateRow({
    databaseId: APPWRITE_CONFIG.DATABASES.FLOW,
    tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
    rowId: id,
    data: { isLocked: false },
  });
}

export function hasAuthSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('kylrix_auth_hint') || document.cookie.includes('better-auth'));
}

export function getCurrentUserSnapshot(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('kylrix_user_snapshot');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function invalidateCurrentUserCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kylrix_user_snapshot');
  }
}

export function onCurrentUserChanged(_callback: any): () => void {
  return () => {};
}

export async function getCurrentUser(): Promise<any> {
  return getCurrentUserSnapshot();
}

export async function createTaskFromNote(note: any): Promise<any> {
  return { success: true, note };
}

export function cleanRowData(data: any): any {
  return data;
}

export function filterNoteData(data: any): any {
  return data;
}

export function getProfilePicturePreview(_id?: string, _width?: number, _height?: number): string {
  return '';
}

export function setKylrixPulse(_pulse: any, _avatarBase64?: any): void {}

export function getKylrixPulse(): any {
  return null;
}

export const ProjectsService = {
  async listUserProjects(): Promise<{ rows: any[]; total: number }> {
    return { rows: [], total: 0 };
  },
  async getProject(_id?: string): Promise<any> {
    return null;
  },
  async listProjects(..._args: any[]): Promise<any> {
    return { rows: [], total: 0 };
  },
  async createProject(..._args: any[]): Promise<any> {
    return {};
  },
  async updateProject(..._args: any[]): Promise<any> {
    return {};
  },
  async deleteProject(..._args: any[]): Promise<any> {
    return { success: true };
  },
  async removeCollaborator(..._args: any[]): Promise<any> {
    return { success: true };
  },
  async addCollaborator(..._args: any[]): Promise<any> {
    return { success: true };
  },
  async rotateInviteCode(..._args: any[]): Promise<any> {
    return { inviteCode: 'code' };
  },
  async listProjectCollaborators(..._args: any[]): Promise<any> {
    return { rows: [], total: 0 };
  },
  async approveJoinRequest(..._args: any[]): Promise<any> {
    return { success: true };
  },
  async listProjectObjectsByKind(..._args: any[]): Promise<any[]> {
    return [];
  },
  async listTaggedResources(_wsId: string): Promise<any> {
    return { totps: [], notes: [], tasks: [], events: [] };
  },
  async addObjectToProject(..._args: any[]): Promise<any> {
    return { success: true };
  },
  async fetchRemoteProjects(..._args: any[]): Promise<any[]> {
    try {
      const { authClient } = await import('@/lib/auth/better-auth-client');
      const session = await authClient.getSession();
      const userId = session?.data?.user?.id;
      if (!userId) return [];
      const { listWorkspacesTurso } = await import('@/lib/actions/turso-ops');
      const res = await listWorkspacesTurso(userId);
      return res.rows || [];
    } catch (err) {
      console.warn('[ProjectsService] Turso workspace list failed:', err);
      return [];
    }
  },
};

export const KeychainService = {
  async getKeychainCount(userId?: string): Promise<number> {
    if (!userId) return 0;
    const { listKeychainTurso } = await import('@/lib/actions/turso-ops');
    const result = await listKeychainTurso(userId);
    return result.rows?.length || 0;
  },
  async getMasterpassState(userId?: string): Promise<any> {
    const rows = await this.listKeychainEntries(userId);
    return {
      hasMasterpass: rows.some((entry: any) => entry.type === 'password'),
      hasPasskey: rows.some((entry: any) => entry.type === 'passkey'),
      entries: rows,
    };
  },
  async unwrapDekWithPassword(): Promise<any> { return null; },
  async listKeychainEntries(userId?: string): Promise<any[]> {
    if (!userId) return [];
    const { listKeychainTurso } = await import('@/lib/actions/turso-ops');
    const result = await listKeychainTurso(userId);
    return (result.rows || []).map((row: any) => {
      const metadata = typeof row.metadata === 'string'
        ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
        : (row.metadata || {});
      let params = metadata.params;
      if (typeof params === 'string') {
        try { params = JSON.parse(params); } catch {}
      }
      return {
        ...row,
        $id: row.id,
        wrappedKey: row.encryptedPayload,
        salt: metadata.salt || row.nonce,
        params,
        isArgon: metadata.isArgon,
        credentialId: metadata.credentialId || (row.type === 'passkey' ? row.account : null),
      };
    });
  },
  async hasMasterpass(userId?: string): Promise<boolean> {
    const rows = await this.listKeychainEntries(userId);
    return rows.some((entry: any) => entry.type === 'password');
  },
  async deleteKeychainEntry(id: string): Promise<any> {
    const { deleteKeychainTurso } = await import('@/lib/actions/turso-ops');
    return deleteKeychainTurso(id);
  },
};

export const VaultService = {
  async getVaultState(): Promise<any> { return null; },
  async updateTOTPSecret(id: string, data: any): Promise<any> {
    return updateTotpSecret(id, data);
  },
  async listAllCredentials(userId?: string): Promise<any[]> {
    if (!userId) return [];
    const { listVaultItemsTurso } = await import('@/lib/actions/turso-ops');
    const result = await listVaultItemsTurso(userId);
    return (result.rows || []).map((row: any) => ({ ...row, $id: row.id }));
  },
  async listTOTPSecrets(userId?: string): Promise<any[]> {
    if (!userId) return [];
    const { listTotpSecretsTurso } = await import('@/lib/actions/turso-ops');
    const result = await listTotpSecretsTurso(userId);
    return (result.rows || []).map((row: any) => ({ ...row, $id: row.id }));
  },
  async getCredential(_id: string): Promise<any> { return null; },
  async getTOTPSecret(_id: string): Promise<any> { return null; },
};
