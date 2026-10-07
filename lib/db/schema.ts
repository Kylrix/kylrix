import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ========================================================
// BETTER AUTH SCHEMA (SQLITE / TURSO)
// ========================================================

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  tier1Synced: integer('tier1_synced', { mode: 'boolean' }).default(false),
  tier2Synced: integer('tier2_synced', { mode: 'boolean' }).default(false),
  hasAppwriteAccount: integer('has_appwrite_account', { mode: 'boolean' }),
  appwriteAccountId: text('appwrite_account_id'),
  appwriteFullySynced: integer('appwrite_fully_synced', { mode: 'boolean' }).default(false),
  appwriteSyncedAt: text('appwrite_synced_at'),
  appwritePasswordSynced: integer('appwrite_password_synced', { mode: 'boolean' }).default(false),
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
  category: text('category').default('user_pat'),
  workspaceId: text('workspace_id'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  displayInSessions: integer('display_in_sessions', { mode: 'boolean' }).default(false),
  clientName: text('client_name'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

export const jwks = sqliteTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  alg: text('alg'),
  crv: text('crv'),
});

export const oauthClient = sqliteTable('oauth_client', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  clientDiscoveryId: text('client_discovery_id'),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  skipConsent: integer('skip_consent', { mode: 'boolean' }),
  enableEndSession: integer('enable_end_session', { mode: 'boolean' }),
  subjectType: text('subject_type'),
  scopes: text('scopes', { mode: 'json' }),
  clientCredentialsScopes: text('client_credentials_scopes', { mode: 'json' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  name: text('name'),
  uri: text('uri'),
  icon: text('icon'),
  contacts: text('contacts', { mode: 'json' }),
  tos: text('tos'),
  policy: text('policy'),
  softwareId: text('software_id'),
  softwareVersion: text('software_version'),
  softwareStatement: text('software_statement'),
  redirectUris: text('redirect_uris', { mode: 'json' }).notNull(),
  postLogoutRedirectUris: text('post_logout_redirect_uris', { mode: 'json' }),
  backchannelLogoutUri: text('backchannel_logout_uri'),
  backchannelLogoutSessionRequired: integer('backchannel_logout_session_required', { mode: 'boolean' }),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
  applicationType: text('application_type'),
  jwks: text('jwks'),
  jwksUri: text('jwks_uri'),
  grantTypes: text('grant_types', { mode: 'json' }),
  responseTypes: text('response_types', { mode: 'json' }),
  requirePKCE: integer('require_pkce', { mode: 'boolean' }),
  dpopBoundAccessTokens: integer('dpop_bound_access_tokens', { mode: 'boolean' }).default(false),
  referenceId: text('reference_id'),
  metadata: text('metadata', { mode: 'json' }),
}, (table) => [
  index('oauthClient_userId_idx').on(table.userId),
]);

export const oauthResource = sqliteTable('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes', { mode: 'json' }),
  customClaims: text('custom_claims', { mode: 'json' }),
  dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', { mode: 'boolean' }).default(false),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  policyVersion: integer('policy_version').default(1),
  metadata: text('metadata', { mode: 'json' }),
});

export const oauthClientResource = sqliteTable('oauth_client_resource', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull().references(() => oauthResource.identifier, { onDelete: 'cascade' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('oauthClientResource_clientId_resourceId_uidx').on(table.clientId, table.resourceId),
  index('oauthClientResource_clientId_idx').on(table.clientId),
  index('oauthClientResource_resourceId_idx').on(table.resourceId),
]);

export const oauthRefreshToken = sqliteTable('oauth_refresh_token', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources', { mode: 'json' }),
  requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  revoked: integer('revoked', { mode: 'timestamp_ms' }),
  rotatedAt: integer('rotated_at', { mode: 'timestamp_ms' }),
  rotationReplayResponse: text('rotation_replay_response'),
  rotationReplayExpiresAt: integer('rotation_replay_expires_at', { mode: 'timestamp_ms' }),
  authTime: integer('auth_time', { mode: 'timestamp_ms' }),
  confirmation: text('confirmation', { mode: 'json' }),
  scopes: text('scopes', { mode: 'json' }).notNull(),
}, (table) => [
  index('oauthRefreshToken_clientId_idx').on(table.clientId),
  index('oauthRefreshToken_sessionId_idx').on(table.sessionId),
  index('oauthRefreshToken_userId_idx').on(table.userId),
  index('oauthRefreshToken_authorizationCodeId_idx').on(table.authorizationCodeId),
]);

export const oauthAccessToken = sqliteTable('oauth_access_token', {
  id: text('id').primaryKey(),
  token: text('token').unique(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => session.id, { onDelete: 'set null' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources', { mode: 'json' }),
  requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }),
  refreshId: text('refresh_id').references(() => oauthRefreshToken.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  revoked: integer('revoked', { mode: 'timestamp_ms' }),
  confirmation: text('confirmation', { mode: 'json' }),
  scopes: text('scopes', { mode: 'json' }).notNull(),
}, (table) => [
  index('oauthAccessToken_clientId_idx').on(table.clientId),
  index('oauthAccessToken_sessionId_idx').on(table.sessionId),
  index('oauthAccessToken_userId_idx').on(table.userId),
  index('oauthAccessToken_authorizationCodeId_idx').on(table.authorizationCodeId),
  index('oauthAccessToken_refreshId_idx').on(table.refreshId),
]);

export const oauthConsent = sqliteTable('oauth_consent', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  resources: text('resources', { mode: 'json' }),
  requestedUserInfoClaims: text('requested_user_info_claims', { mode: 'json' }),
  scopes: text('scopes', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('oauthConsent_clientId_idx').on(table.clientId),
  index('oauthConsent_userId_idx').on(table.userId),
]);

export const oauthClientAssertion = sqliteTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});

// ========================================================
// KYLRIX RELATIONAL DOMAIN SCHEMA
// ========================================================

export const ideas = sqliteTable('ideas', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  summary: text('summary'),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  isPublished: integer('is_published', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id'),
  projectId: text('project_id'),
  category: text('category'),
  tags: text('tags'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const notes = ideas;

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  slug: text('slug'),
  inviteCode: text('invite_code'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isAgentic: integer('is_agentic', { mode: 'boolean' }).default(false),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  privacyMode: integer('privacy_mode', { mode: 'boolean' }).default(false),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const projects = workspaces;

export const workspaceObjects = sqliteTable('workspace_objects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  entityKind: text('entity_kind').notNull(),
  entityId: text('entity_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull(),
});
export const projectObjects = workspaceObjects;

export const keychain = sqliteTable('keychain', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  account: text('account').notNull(),
  type: text('type').notNull(),
  encryptedPayload: text('encrypted_payload').notNull(),
  nonce: text('nonce'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const totpSecrets = sqliteTable('totp_secrets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  account: text('account').notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status').notNull().default('todo'),
  priority: text('priority').default('medium'),
  dueDate: text('due_date'),
  completedAt: text('completed_at'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id'),
  projectId: text('project_id'),
  tags: text('tags'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const tasks = goals;

export const vaultItems = sqliteTable('vault_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  encryptedData: text('encrypted_data').notNull(),
  iv: text('iv'),
  metadata: text('metadata'),
  isTrashed: integer('is_trashed', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  workspaceId: text('workspace_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  preferences: text('preferences'),
  securityFlags: text('security_flags'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tier: text('tier').notNull().default('free'),
  status: text('status').notNull().default('active'),
  referralCode: text('referral_code'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tokenRegistry = sqliteTable('token_registry', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  mintAddress: text('mint_address'),
  balance: text('balance').default('0'),
  ledger: text('ledger'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  title: text('title'),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const threadMessages = sqliteTable('thread_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  senderId: text('sender_id').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

