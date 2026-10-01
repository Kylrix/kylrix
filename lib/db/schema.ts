import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { generateId } from '@/lib/utils/id';

// ========================================================
// BETTER AUTH SCHEMA (SQLITE / TURSO)
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
});

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
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

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
});

// ========================================================
// KYLRIX RELATIONAL DOMAIN SCHEMA
// ========================================================

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  isPublished: integer('is_published', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  projectId: text('project_id'),
  category: text('category'),
  tags: text('tags'), // JSON string array
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id').notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  inviteCode: text('invite_code'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isAgentic: integer('is_agentic', { mode: 'boolean' }).default(false),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  privacyMode: integer('privacy_mode', { mode: 'boolean' }).default(false),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const projectObjects = sqliteTable('project_objects', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  projectId: text('project_id').notNull(),
  entityKind: text('entity_kind').notNull(),
  entityId: text('entity_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const keychain = sqliteTable('keychain', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  account: text('account').notNull(),
  type: text('type').notNull(), // 'password' | 'passkey' | 'secret'
  encryptedPayload: text('encrypted_payload').notNull(),
  nonce: text('nonce'),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const totpSecrets = sqliteTable('totp_secrets', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  account: text('account').notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status').notNull().default('pending'),
  priority: text('priority').default('medium'),
  dueDate: text('due_date'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  projectId: text('project_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const vaultItems = sqliteTable('vault_items', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv'),
  metadata: text('metadata'),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const forms = sqliteTable('forms', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  schemaJson: text('schema_json').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  isClosed: integer('is_closed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  projectId: text('project_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const formResponses = sqliteTable('form_responses', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  formId: text('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  respondentId: text('respondent_id'),
  dataJson: text('data_json').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey().$defaultFn(() => generateId()),
  creatorId: text('creator_id').notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  location: text('location'),
  isAllDay: integer('is_all_day', { mode: 'boolean' }).default(false),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  projectId: text('project_id'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

