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
  SYSTEM: { DOMAIN: 'kylrix.space' },
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
    NOTE: { NOTES: 'notes', COMMENTS: 'comments', REACTIONS: 'reactions', COLLABORATORS: 'collaborators', NOTE_TAGS: 'note_tags', TAGS: 'tags', SUBSCRIPTIONS: 'subscriptions', COUPONS: 'coupons' },
    CHAT: { CONVERSATIONS: 'conversations', MESSAGES: 'messages', CALL_LINKS: 'call_links', ACCOUNT_EVENTS: 'account_events', PROFILES: 'profiles' },
    VAULT: { CREDENTIALS: 'credentials', USER: 'users', KEYCHAIN: 'keychain' },
    FLOW: { TASKS: 'tasks', FORMS: 'forms', EVENTS: 'events', GUESTS: 'guests', OBJECTS: 'objects', COLLABORATORS: 'collaborators' },
    PASSWORD_MANAGER: { WALLETS: 'wallets', IDENTITIES: 'identities' },
    CONNECT: { TELEGRAM_CONNECTIONS: 'telegram_connections' },
  },
  BUCKETS: {
    VOICE: 'voice',
    NOTES_ATTACHMENTS: 'notes_attachments',
    CHAT_UPLOADS: 'chat_uploads',
    FORM_ATTACHMENTS: 'form_attachments',
    EVENT_COVERS: 'event_covers',
    SEND_EPHEMERAL: 'send_ephemeral',
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
  equal: (field: string, val: any) => [field, '=', val],
  equalOrNull: (field: string, val: any) => [field, '=', val],
  notEqual: (field: string, val: any) => [field, '!=', val],
  greaterThan: (field: string, val: any) => [field, '>', val],
  greaterThanEqual: (field: string, val: any) => [field, '>=', val],
  lessThan: (field: string, val: any) => [field, '<', val],
  lessThanEqual: (field: string, val: any) => [field, '<=', val],
  search: (field: string, val: any) => [field, 'search', val],
  orderDesc: (field: string) => ['orderDesc', field],
  orderAsc: (field: string) => ['orderAsc', field],
  limit: (limit: number) => ['limit', limit],
  offset: (offset: number) => ['offset', offset],
  select: (fields: string[]) => ['select', fields],
  isNull: (field: string) => [field, 'isNull'],
  isNotNull: (field: string) => [field, 'isNotNull'],
  or: (queries: any[]) => ['or', queries],
  startsWith: (field: string, val: any) => [field, 'startsWith', val],
  contains: (field: string, val: any) => [field, 'contains', val],
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

export class Storage {
  constructor(_client?: any) {}
  getFilePreview(..._args: any[]): string { return ''; }
  getFileDownload(..._args: any[]): string { return ''; }
  async createFile(..._args: any[]): Promise<any> { return {}; }
  async deleteFile(..._args: any[]): Promise<any> { return {}; }
}

export const client = {};

export const tablesDB = {
  async getRow(..._args: any[]): Promise<any> { return null; },
  async listRows(..._args: any[]): Promise<any> { return { rows: [], total: 0 }; },
  async createRow(..._args: any[]): Promise<any> { return {}; },
  async updateRow(..._args: any[]): Promise<any> { return {}; },
  async deleteRow(..._args: any[]): Promise<any> { return {}; },
};

export const databases = tablesDB;

export const account = {
  async get(): Promise<any> { return null; },
  async createSession(..._args: any[]): Promise<any> { return {}; },
  async deleteSession(..._args: any[]): Promise<any> { return {}; },
  async getPrefs(): Promise<any> { return {}; },
  async updatePrefs(..._args: any[]): Promise<any> { return {}; },
  async createOAuth2Session(provider: string, _success?: string, _failure?: string) {
    if (typeof window !== 'undefined') {
      window.location.href = `/api/auth/oauth/${provider}`;
    }
    return { success: true };
  },
};

export const storage = {
  getFilePreview(..._args: any[]): string { return ''; },
  getFileDownload(..._args: any[]): string { return ''; },
  async createFile(..._args: any[]): Promise<any> { return {}; },
  async deleteFile(..._args: any[]): Promise<any> { return {}; },
};

export const AppwriteService = {
  account,
  databases,
  client,
  storage,
};

export const realtime = {
  subscribe(_channels: any, _callback: any) {
    return () => {};
  },
};

export function createSystemClient() {
  return { tablesDB, account, storage, client };
}

export function createServerClient() {
  return { tablesDB, account, storage, client };
}

export function createAdminClient() {
  return { tablesDB, account, storage, client };
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

export async function createTag(name: string, color?: string): Promise<any> {
  const { upsertLocalTag } = await import('./local/tags');
  return upsertLocalTag({ id: `tag_${Date.now()}`, name, color: color || '#6366f1' });
}

export async function updateTag(tagId: string, data: any): Promise<any> {
  const { upsertLocalTag } = await import('./local/tags');
  return upsertLocalTag({ id: tagId, ...data });
}

export async function deleteTag(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  return systemTables().tags.delete(id);
}

export async function getAllTags(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  return systemTables().tags.list();
}

export async function listTagsByUser(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.tags.list();
}

export async function createTotpSecret(data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.totpSecrets.create({ id: `totp_${Date.now()}`, ...data });
}

export async function updateTotpSecret(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.totpSecrets.update(id, data);
}

export async function deleteTotpSecret(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.totpSecrets.delete(id);
}

export async function listTotpSecrets(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.totpSecrets.list();
}

export async function createCredential(data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.credentials.create({ id: `cred_${Date.now()}`, ...data });
}

export async function updateCredential(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.credentials.update(id, data);
}

export async function deleteCredential(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.credentials.delete(id);
}

export async function setCredentialPinned(id: string, isPinned: boolean): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.credentials.update(id, { isPinned });
}

export async function setTotpPinned(id: string, isPinned: boolean): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.totpSecrets.update(id, { isPinned });
}

export async function validatePublicNoteAccess(noteId: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  const note = await db.notes.get(noteId).catch(() => null);
  if (!note) return null;
  return note;
}

export async function createComment(noteId: string, content: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  const id = `comment_${Date.now()}`;
  return db.comments.create({
    id,
    noteId,
    content,
    createdAt: new Date().toISOString(),
  });
}

export async function getNote(noteId: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.notes.get(noteId);
}

export async function listNotes(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.notes.list();
}

export async function listNotesByUser(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.notes.list();
}

export async function listNotesPaginated(): Promise<{ rows: any[]; total: number }> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  const rows = await db.notes.list();
  return { rows, total: rows.length };
}

export async function updateNote(id: string, data: any): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.notes.update(id, data);
}

export function pickNoteAutosavePayload(data: any): any {
  return data;
}

export function isExcludedNote(_note: any): boolean {
  return false;
}

export async function getNotesByTag(tagId: string): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  const rows = await db.notes.list();
  return rows.filter((n: any) => Array.isArray(n.tags) && n.tags.includes(tagId));
}

export function getNotePublicState(note: any): boolean {
  return Boolean(note?.isPublic || note?.published);
}

export function isNoteEditableByAnyone(_note: any): boolean {
  return false;
}

export async function toggleNoteVisibility(id: string, isPublic: boolean): Promise<any> {
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

export async function getShareableUrl(id: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kylrix.space';
  return `${baseUrl}/idea/${id}`;
}

export async function getCurrentPublicNoteShareUrl(id: string): Promise<string> {
  return getShareableUrl(id);
}

export async function listFlowTasks(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.tasks.list();
}

export async function listFlowEvents(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.events.list();
}

export async function listKeepCredentials(): Promise<any[]> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.credentials.list();
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
  const db = systemTables();
  return db.tasks.update(id, { isLocked: true });
}

export async function unlockGoal(id: string): Promise<any> {
  const { systemTables } = await import('./system-tables');
  const db = systemTables();
  return db.tasks.update(id, { isLocked: false });
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

export async function createTaskFromNote(noteId: string): Promise<any> {
  return { success: true, noteId };
}

export function cleanRowData(data: any): any {
  return data;
}

export function filterNoteData(data: any): any {
  return data;
}

export function getProfilePicturePreview(_id?: string): string {
  return '';
}

export function setKylrixPulse(_pulse: any): void {}

export function getKylrixPulse(): any {
  return null;
}

export const ProjectsService = {
  async listUserProjects(): Promise<{ rows: any[]; total: number }> {
    return { rows: [], total: 0 };
  },
  async getProject(): Promise<any> {
    return null;
  },
  async listTaggedResources(_wsId: string): Promise<any> {
    return { totps: [], notes: [], tasks: [], events: [] };
  },
};

export const KeychainService = {
  async getKeychainCount(): Promise<number> { return 0; },
  async getMasterpassState(): Promise<any> { return null; },
  async unwrapDekWithPassword(): Promise<any> { return null; },
};

export const VaultService = {
  async getVaultState(): Promise<any> { return null; },
  async updateTOTPSecret(id: string, data: any): Promise<any> {
    return updateTotpSecret(id, data);
  },
};
