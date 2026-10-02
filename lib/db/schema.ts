import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/lib/utils/id';

// ========================================================
// BETTER AUTH CORE SCHEMA (SQLITE / TURSO)
// ========================================================

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_session_user_id').on(table.userId),
  index('idx_session_token').on(table.token),
]);

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_account_user_id').on(table.userId),
  uniqueIndex('idx_account_provider').on(table.providerId, table.accountId),
]);

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => [
  index('idx_verification_identifier').on(table.identifier),
]);

export const apikey = sqliteTable('apikey', {
  id: text('id').primaryKey(),
  name: text('name'),
  start: text('start'),
  prefix: text('prefix'),
  key: text('key').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: integer('last_refill_at', { mode: 'timestamp' }),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' }).default(false),
  rateLimitTimeWindow: integer('rate_limit_time_window'),
  rateLimitMax: integer('rate_limit_max'),
  requestCount: integer('request_count').default(0),
  remaining: integer('remaining'),
  lastRequest: integer('last_request', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
}, (table) => [
  index('idx_apikey_user_id').on(table.userId),
  index('idx_apikey_key').on(table.key),
]);

// ========================================================
// WORKSPACES & MEMBERS (ORGANIZATIONAL TOPOLOGY)
// ========================================================

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').default(''),
  slug: text('slug'),
  inviteCode: text('invite_code'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isAgentic: integer('is_agentic', { mode: 'boolean' }).default(false),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  privacyMode: integer('privacy_mode', { mode: 'boolean' }).default(false),
  metadata: text('metadata'), // JSON string configuration
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_workspaces_creator').on(table.creatorId),
  index('idx_workspaces_agentic').on(table.isAgentic),
  index('idx_workspaces_invite_code').on(table.inviteCode),
]);

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'owner' | 'admin' | 'member' | 'viewer'
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex('idx_workspace_members_pair').on(table.workspaceId, table.userId),
  index('idx_workspace_members_user').on(table.userId),
]);

export const workspaceObjects = sqliteTable('workspace_objects', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  entityKind: text('entity_kind').notNull(), // 'idea' | 'goal' | 'form' | 'event' | 'keychain' | 'vault' | 'thread'
  entityId: text('entity_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_wo_workspace_id').on(table.workspaceId),
  index('idx_wo_entity').on(table.entityKind, table.entityId),
  index('idx_wo_user_id').on(table.userId),
]);

// ========================================================
// IDEAS (KNOWLEDGE ENGINE & UNIFIED NOTEBOOK)
// ========================================================

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  summary: text('summary'),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  isPublished: integer('is_published', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  category: text('category'),
  tags: text('tags'), // JSON string array
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_ideas_user_id').on(table.userId),
  index('idx_ideas_workspace_id').on(table.workspaceId),
  index('idx_ideas_trashed').on(table.isTrashed),
  index('idx_ideas_pinned').on(table.isPinned),
  index('idx_ideas_created_at').on(table.createdAt),
]);

// ========================================================
// GOALS (HIGH-VELOCITY EXECUTION & MILESTONES)
// ========================================================

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status').notNull().default('todo'), // 'todo' | 'in_progress' | 'completed' | 'blocked'
  priority: text('priority').default('medium'), // 'low' | 'medium' | 'high' | 'urgent'
  dueDate: text('due_date'),
  completedAt: text('completed_at'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  tags: text('tags'), // JSON string array
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_goals_user_id').on(table.userId),
  index('idx_goals_workspace_id').on(table.workspaceId),
  index('idx_goals_status').on(table.status),
  index('idx_goals_priority').on(table.priority),
  index('idx_goals_due_date').on(table.dueDate),
  index('idx_goals_created_at').on(table.createdAt),
]);

// ========================================================
// INTAKE FORMS & RESPONSES
// ========================================================

export const forms = sqliteTable('forms', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  schemaJson: text('schema_json').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  isClosed: integer('is_closed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_forms_user_id').on(table.userId),
  index('idx_forms_workspace_id').on(table.workspaceId),
  index('idx_forms_public').on(table.isPublic),
]);

export const formResponses = sqliteTable('form_responses', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  formId: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  respondentId: text('respondent_id')
    .references(() => user.id, { onDelete: 'set null' }),
  dataJson: text('data_json').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_form_responses_form_id').on(table.formId),
  index('idx_form_responses_respondent').on(table.respondentId),
  index('idx_form_responses_created_at').on(table.createdAt),
]);

// ========================================================
// SCHEDULE & CALENDAR EVENTS
// ========================================================

export const events = sqliteTable('events', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').default(''),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  location: text('location'),
  isAllDay: integer('is_all_day', { mode: 'boolean' }).default(false),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_events_creator_id').on(table.creatorId),
  index('idx_events_workspace_id').on(table.workspaceId),
  index('idx_events_start_time').on(table.startTime),
]);

// ========================================================
// ZERO-KNOWLEDGE SECURITY & VAULT
// ========================================================

export const keychain = sqliteTable('keychain', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  account: text('account').notNull(),
  type: text('type').notNull(), // 'password' | 'passkey' | 'secret'
  encryptedPayload: text('encrypted_payload').notNull(),
  nonce: text('nonce'),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_keychain_user_id').on(table.userId),
  index('idx_keychain_account').on(table.account),
]);

export const totpSecrets = sqliteTable('totp_secrets', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  account: text('account').notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_totp_user_id').on(table.userId),
]);

export const vaultItems = sqliteTable('vault_items', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type').notNull(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv'),
  metadata: text('metadata'),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_vault_items_user_id').on(table.userId),
  index('idx_vault_items_workspace_id').on(table.workspaceId),
  index('idx_vault_items_trashed').on(table.isTrashed),
]);

// ========================================================
// UNIFIED THREADS & DISCUSSIONS
// ========================================================

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  targetKind: text('target_kind').notNull(), // 'idea' | 'goal' | 'workspace' | 'form' | 'event'
  targetId: text('target_id').notNull(),
  title: text('title').default(''),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_threads_creator_id').on(table.creatorId),
  index('idx_threads_target').on(table.targetKind, table.targetId),
]);

export const threadMessages = sqliteTable('thread_messages', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  senderId: text('sender_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index('idx_tm_thread_id').on(table.threadId),
  index('idx_tm_sender_id').on(table.senderId),
  index('idx_tm_created_at').on(table.createdAt),
]);

// ========================================================
// BACKWARD-COMPATIBILITY ALIASES
// ========================================================

export const notes = ideas;
export const tasks = goals;
export const projects = workspaces;
export const projectObjects = workspaceObjects;
