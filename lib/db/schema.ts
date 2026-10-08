import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ========================================================
// BETTER AUTH SCHEMA (SQLITE / TURSO)
// ========================================================

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  username: text('username').unique(),
  displayUsername: text('display_username'),
  image: text('image'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false),
  tier1Synced: integer('tier1_synced', { mode: 'boolean' }).default(false),
  tier2Synced: integer('tier2_synced', { mode: 'boolean' }).default(false),
  hasAppwriteAccount: integer('has_appwrite_account', { mode: 'boolean' }),
  appwriteAccountId: text('appwrite_account_id'),
  appwriteFullySynced: integer('appwrite_fully_synced', { mode: 'boolean' }).default(false),
  appwriteSyncedAt: text('appwrite_synced_at'),
  appwritePasswordSynced: integer('appwrite_password_synced', { mode: 'boolean' }).default(false),
  isContributor: integer('is_contributor', { mode: 'boolean' }).default(false),
  contributorLastCheckedAt: text('contributor_last_checked_at'),
  contributorPrCount: integer('contributor_pr_count').default(0),
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

export const twoFactor = sqliteTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const passkey = sqliteTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credential_id').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
  transports: text('transports'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  aaguid: text('aaguid'),
}, (table) => [
  index('passkey_userId_idx').on(table.userId),
  index('passkey_credentialId_idx').on(table.credentialID),
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
  isExternal: integer('is_external', { mode: 'boolean' }).default(false),
  externalClient: text('external_client'),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  privacyMode: integer('privacy_mode', { mode: 'boolean' }).default(false),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const projects = workspaces;

export const externalContexts = sqliteTable('external_contexts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  client: text('client').notNull(), // 'claude', 'cursor', 'antigravity', 'codex', 'kiro', 'windsurf', etc.
  directory: text('directory'), // standalone project directory
  workspaceId: text('workspace_id'), // linked workspace if associated
  title: text('title').notNull().default(''),
  summary: text('summary'),
  payload: text('payload'), // JSON serialized context / conversation / sessions / memories
  status: text('status').default('connected'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

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

// ========================================================
// 1:1 REPLICATED ECOSYSTEM TABLES (TURSO / SQLITE)
// ========================================================

// 1. Forms & Form Submissions
export const forms = sqliteTable('forms', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default(''),
  description: text('description').default(''),
  schema: text('schema').notNull().default('[]'),
  settings: text('settings').default('{}'),
  status: text('status').default('active'),
  visibility: text('visibility').default('private'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  source: text('source'),
  keepPermission: integer('keep_permission', { mode: 'boolean' }).default(false),
  isTrash: integer('is_trash', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  isAgentic: integer('is_agentic', { mode: 'boolean' }).default(false),
  dek: text('dek'),
  isMultiple: integer('is_multiple', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const formSubmissions = sqliteTable('form_submissions', {
  id: text('id').primaryKey(),
  formId: text('form_id').notNull(),
  submitterId: text('submitter_id'),
  payload: text('payload').notNull().default('{}'),
  status: text('status').default('submitted'),
  metadata: text('metadata'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  source: text('source'),
  isTrash: integer('is_trash', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
});

// 2. Events & Calendars
export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  calendarId: text('calendar_id').notNull().default('default'),
  title: text('title').notNull().default(''),
  description: text('description').default(''),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  location: text('location'),
  meetingUrl: text('meeting_url'),
  visibility: text('visibility').default('private'),
  status: text('status').default('confirmed'),
  coverImageId: text('cover_image_id'),
  recurrenceRule: text('recurrence_rule'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  source: text('source'),
  keepPermission: integer('keep_permission', { mode: 'boolean' }).default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  isTrash: integer('is_trash', { mode: 'boolean' }).default(false),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  attendeeCount: integer('attendee_count').default(0),
  isAgentic: integer('is_agentic', { mode: 'boolean' }).default(false),
  dek: text('dek'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const calendars = sqliteTable('calendars', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull().default('Personal'),
  color: text('color').default('#6366F1'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(true),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
});

export const eventGuests = sqliteTable('event_guests', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  userId: text('user_id'),
  email: text('email'),
  status: text('status').default('pending'),
  role: text('role').default('attendee'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
});

// 3. Agentic Sessions, Tool Calls & Telemetry
export const agenticSessions = sqliteTable('agentic_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  context: text('context'),
  seen: integer('seen', { mode: 'boolean' }).default(false),
  chatHistory: text('chat_history'),
  isMemory: integer('is_memory', { mode: 'boolean' }).default(false),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  harness: text('harness'),
  targetType: text('target_type'),
  targetId: text('target_id'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  projectId: text('project_id'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  toolKey: text('tool_key').notNull(),
  specifier: text('specifier'),
  args: text('args'),
  status: text('status').default('success'),
  resultSummary: text('result_summary'),
  createdAt: text('created_at'),
});

export const agenticTelemetry = sqliteTable('agentic_telemetry', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  action: text('action').notNull(),
  zone: text('zone'),
  pointers: text('pointers'),
  metadata: text('metadata'),
  timestamp: text('timestamp').notNull(),
});

export const sessionObjects = sqliteTable('session_objects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id').notNull(),
  objectId: text('object_id').notNull(),
  objectType: text('object_type').notNull(),
  title: text('title'),
  toolKey: text('tool_key'),
  createdAt: text('created_at'),
});

// 4. Conversations, Messages, Hangouts & P2P Call Signals
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id').notNull(),
  type: text('type').notNull().default('direct'),
  name: text('name'),
  lastMessageId: text('last_message_id'),
  lastMessageAt: text('last_message_at'),
  lastMessageText: text('last_message_text'),
  lastMessageSenderId: text('last_message_sender_id'),
  unreadCount: text('unread_count').default('0'),
  participants: text('participants'),
  admins: text('admins'),
  description: text('description'),
  avatarUrl: text('avatar_url'),
  avatarFileId: text('avatar_file_id'),
  avatar: text('avatar'),
  participantCount: integer('participant_count').default(1),
  maxParticipants: integer('max_participants').default(100),
  isEncrypted: integer('is_encrypted', { mode: 'boolean' }).default(false),
  encryptionVersion: text('encryption_version'),
  encryptionKey: text('encryption_key'),
  isPinned: text('is_pinned').default(''),
  isMuted: text('is_muted').default(''),
  isArchived: text('is_archived').default(''),
  settings: text('settings'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  inviteLink: text('invite_link'),
  inviteLinkExpiry: text('invite_link_expiry'),
  category: text('category'),
  tags: text('tags').default(''),
  contextType: text('context_type'),
  contextId: text('context_id'),
  inviteMeta: text('invite_meta'),
  isWorkspace: integer('is_workspace', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const conversationMembers = sqliteTable('conversation_members', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').default('member'),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  senderId: text('sender_id').notNull(),
  type: text('type').notNull().default('text'),
  content: text('content').default(''),
  attachments: text('attachments'),
  replyTo: text('reply_to'),
  readBy: text('read_by'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isVoice: integer('is_voice', { mode: 'boolean' }).default(false),
  metadata: text('metadata'),
  isBookmark: integer('is_bookmark', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const callSignals = sqliteTable('call_signals', {
  id: text('id').primaryKey(),
  callId: text('call_id').notNull(),
  senderId: text('sender_id').notNull(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at'),
});

// 5. Workflows (Flows), Installs & Reviews
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  name: text('name').notNull(),
  description: text('description').default(''),
  niche: text('niche').notNull().default('general'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isAnonymized: integer('is_anonymized', { mode: 'boolean' }).default(false),
  steps: text('steps').notNull().default('[]'),
  metadata: text('metadata'),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  ownerId: text('owner_id'),
  installCount: integer('install_count').default(0),
  flowKind: text('flow_kind').default('automation'),
  toolTierMax: text('tool_tier_max'),
  reviewStatus: text('review_status').default('approved'),
  publisherHandle: text('publisher_handle'),
  verifiedKind: text('verified_kind'),
  version: integer('version').default(1),
  contentHash: text('content_hash'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const flowInstalls = sqliteTable('flow_installs', {
  id: text('id').primaryKey(),
  flowId: text('flow_id').notNull(),
  installerId: text('installer_id').notNull(),
  scopeKey: text('scope_key').notNull(),
  scopeType: text('scope_type').notNull(),
  grants: text('grants'),
  status: text('status').default('installed'),
  pinnedVersion: integer('pinned_version').default(1),
  autoUpdate: integer('auto_update', { mode: 'boolean' }).default(true),
  installedHash: text('installed_hash'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const flowReviews = sqliteTable('flow_reviews', {
  id: text('id').primaryKey(),
  flowId: text('flow_id').notNull(),
  actorId: text('actor_id').notNull(),
  sessionId: text('session_id'),
  verdict: text('verdict').default('pass'),
  toolTierMax: text('tool_tier_max'),
  findings: text('findings'),
  piiSummary: text('pii_summary'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

// 6. Profiles, User Badges, Referrals & Sponsorships
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  username: text('username').notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatar: text('avatar'),
  walletAddress: text('wallet_address'),
  publicKey: text('public_key'),
  status: text('status').default('active'),
  preferences: text('preferences'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isAvatar: integer('is_avatar', { mode: 'boolean' }).default(false),
  isContact: integer('is_contact', { mode: 'boolean' }).default(false),
  isOnlineVisible: integer('is_online_visible', { mode: 'boolean' }).default(true),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const userBadges = sqliteTable('user_badges', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  badgeId: text('badge_id').notNull(),
  badgeType: text('badge_type'),
  tier: text('tier'),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  awardedAt: text('awarded_at'),
  sponsorshipId: text('sponsorship_id'),
  metadata: text('metadata'),
});

export const referrals = sqliteTable('referrals', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  referrerId: text('referrer_id').notNull(),
  refCode: text('ref_code'),
  src: text('src'),
  origin: text('origin'),
  status: text('status').default('completed'),
  tokensRewarded: integer('tokens_rewarded', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
});

export const sponsorships = sqliteTable('sponsorships', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  sponsorName: text('sponsor_name'),
  sponsorUrl: text('sponsor_url'),
  sponsorEmail: text('sponsor_email'),
  sponsorMessage: text('sponsor_message'),
  amount: text('amount').notNull().default('0'),
  currency: text('currency').default('USD'),
  provider: text('provider').default('crypto'),
  tier: text('tier').notNull().default('supporter'),
  status: text('status').default('completed'),
  txHash: text('tx_hash'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
  badgeAwarded: integer('badge_award', { mode: 'boolean' }).default(false),
  metadata: text('metadata'),
  createdAt: text('created_at'),
});

// 7. Wallets, Web3 Transactions & Compute Ledger
export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  address: text('address').notNull(),
  chain: text('chain').notNull().default('evm'),
  encryptedSecret: text('encrypted_secret').notNull(),
  type: text('type').notNull().default('embedded'),
  metadata: text('metadata'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const web3Transactions = sqliteTable('web3_transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  chain: text('chain').notNull(),
  hash: text('hash').notNull(),
  from: text('from').notNull(),
  to: text('to').notNull(),
  value: text('value').notNull().default('0'),
  symbol: text('symbol').notNull().default('ETH'),
  timestamp: integer('timestamp').notNull(),
});

export const computeLedger = sqliteTable('compute_ledger', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokensConsumed: integer('tokens_consumed').notNull().default(0),
  timestamp: text('timestamp').notNull(),
});

export const kylrixTokenLedger = sqliteTable('kylrix_token_ledger', {
  id: text('id').primaryKey(),
  rowType: text('row_type').notNull().default('event'), // 'state' | 'event'
  txId: text('tx_id'),
  idempotencyKey: text('idempotency_key'),
  eventType: text('event_type'),
  userId: text('user_id'),
  counterpartyUserId: text('counterparty_user_id'),
  amountMicro: text('amount_micro'),
  deltaMicro: text('delta_micro'),
  balanceAfterMicro: text('balance_after_micro'),
  status: text('status').default('settled'),
  sourceType: text('source_type'),
  sourceId: text('source_id'),
  metadata: text('metadata'),
  genesisAt: text('genesis_at'),
  contractVersion: text('contract_version'),
  maxSupplyMicro: text('max_supply_micro'),
  totalMintedMicro: text('total_minted_micro'),
  totalBurnedMicro: text('total_burned_micro'),
  circulatingMicro: text('circulating_micro'),
  rootBalanceMicro: text('root_balance_micro'),
  riskLevel: text('risk_level'),
  lastActivityAt: text('last_activity_at'),
  lastSpikeAt: text('last_spike_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 8. Coupons, Billing Transactions & Account Attention Ledger
export const coupons = sqliteTable('coupons', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').notNull(),
  title: text('title'),
  note: text('note'),
  targetUserId: text('target_user_id'),
  status: text('status').default('active'),
  discountPercent: integer('discount_percent').default(0),
  discountPercentage: integer('discount_percentage').default(0),
  redemptionLimit: integer('redemption_limit').default(1),
  redemptionCount: integer('redemption_count').default(0),
  seats: integer('seats').default(1),
  expiresAt: text('expires_at'),
  metadata: text('metadata'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const billingTransactions = sqliteTable('billing_transactions', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull(),
  userId: text('user_id').notNull(),
  plan: text('plan').notNull(),
  amountUsd: text('amount_usd').notNull(),
  status: text('status').default('completed'),
  provider: text('provider').default('crypto'),
  couponId: text('coupon_id'),
  metadata: text('metadata'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const billingWebhookLogs = sqliteTable('billing_webhook_logs', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id'),
  provider: text('provider').default('blockbee'),
  payload: text('payload').notNull(),
  headers: text('headers'),
  status: text('status').default('processed'),
  errorMessage: text('error_message'),
  metadata: text('metadata'),
  createdAt: text('created_at'),
});

export const accountLedger = sqliteTable('account_ledger', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  attentionBalance: text('attention_balance').default('0'),
  successTaxRate: text('success_tax_rate').default('0'),
  reputationScore: text('reputation_score').default('0'),
  lastPeakVelocity: text('last_peak_velocity').default('0'),
  thermalCacheScore: text('thermal_cache_score').default('0'),
  updatedAt: text('updated_at'),
});

// 9. Telegram Connections
export const telegramConnections = sqliteTable('telegram_connections', {
  id: text('id').primaryKey(),
  pairCode: text('pair_code'),
  tgChatId: text('tg_chat_id'),
  tgUsername: text('tg_username'),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at'),
});

// 10. Tags & Resource Tags
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameLower: text('name_lower').notNull(),
  userId: text('user_id'),
  metadata: text('metadata'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  usageCount: integer('usage_count').default(0),
  isTrash: integer('is_trash', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
});

export const resourceTags = sqliteTable('resource_tags', {
  id: text('id').primaryKey(),
  tagId: text('tag_id').notNull(),
  tag: text('tag').notNull(),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  userId: text('user_id'),
  metadata: text('metadata'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  isGuest: integer('is_guest', { mode: 'boolean' }).default(false),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
});

// 11. AI Context, Knowledge Graph & Agent Patterns
export const contexts = sqliteTable('contexts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  workspaceId: text('workspace_id'),
  projectId: text('project_id'),
  title: text('title').notNull().default(''),
  content: text('content').notNull().default(''),
  type: text('type').default('memory'),
  metadata: text('metadata'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const knowledgeGraph = sqliteTable('knowledge_graph', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  workspaceId: text('workspace_id'),
  subject: text('subject').notNull(),
  predicate: text('predicate').notNull(),
  object: text('object').notNull(),
  confidence: text('confidence').default('1.0'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const patterns = sqliteTable('patterns', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  workspaceId: text('workspace_id'),
  name: text('name').notNull(),
  pattern: text('pattern').notNull(),
  category: text('category').default('general'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const agentByokKeys = sqliteTable('agent_byok_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(),
  keyHash: text('key_hash'),
  keyHint: text('key_hint'),
  encryptedKey: text('encrypted_key').notNull(),
  iv: text('iv'),
  status: text('status').default('active'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const agentPaymentIntents = sqliteTable('agent_payment_intents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  agentId: text('agent_id').notNull(),
  amount: text('amount').notNull(),
  currency: text('currency').default('USD'),
  status: text('status').default('pending'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userConvenienceSessions = sqliteTable('user_convenience_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  deviceId: text('device_id'),
  publicKey: text('public_key'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  lastUsedAt: text('last_used_at'),
});

// 12. Security Logs, Key Mapping & Resource Pins
export const securityLogs = sqliteTable('security_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  status: text('status').default('success'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
});

export const keyMapping = sqliteTable('key_mapping', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  keyType: text('key_type').notNull(),
  mappingData: text('mapping_data').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userResourcePins = sqliteTable('user_resource_pins', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  pinnedAt: text('pinned_at').notNull(),
});

// 13. Comments, Reactions & Activity Logs
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  replyToId: text('reply_to_id'),
  metadata: text('metadata'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey(),
  resourceId: text('resource_id').notNull(),
  resourceType: text('resource_type').notNull(),
  userId: text('user_id').notNull(),
  emoji: text('emoji').notNull(),
  createdAt: text('created_at').notNull(),
});

export const extensions = sqliteTable('extensions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  version: text('version').default('1.0.0'),
  manifest: text('manifest'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  resourceId: text('resource_id'),
  resourceType: text('resource_type'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull(),
});



