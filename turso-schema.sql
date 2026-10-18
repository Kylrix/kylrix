CREATE INDEX idx_account_user_id ON account(user_id);

CREATE INDEX idx_agentic_sessions_target_created ON agentic_sessions (target_id, created_at DESC);

CREATE INDEX idx_agents_owner ON agents(owner_id);

CREATE INDEX idx_agents_parent ON agents(parent_id);

CREATE INDEX idx_apikey_category ON apikey(category);

CREATE INDEX idx_apikey_display_sessions ON apikey(display_in_sessions);

CREATE INDEX idx_apikey_key ON apikey(key);

CREATE INDEX idx_apikey_user_id ON apikey(user_id);

CREATE UNIQUE INDEX idx_collaborators_resource_user ON collaborators(resource_id, user_id);

CREATE INDEX idx_collaborators_user ON collaborators(user_id);

CREATE INDEX idx_conversation_members_conv ON conversation_members(conversation_id);

CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);

CREATE INDEX idx_conversations_context ON conversations(context_type, context_id);

CREATE INDEX idx_conversations_creator ON conversations(creator_id);

CREATE INDEX idx_conversations_type ON conversations(type);

CREATE UNIQUE INDEX idx_epochs_resource_epoch ON epochs(resource_id, epoch_number);

CREATE INDEX idx_events_creator_id ON events(creator_id);

CREATE INDEX idx_events_start_time ON events(start_time);

CREATE INDEX idx_events_workspace_id ON events(workspace_id);

CREATE INDEX idx_follows_following ON follows(following_id);

CREATE UNIQUE INDEX idx_follows_pair ON follows(follower_id, following_id);

CREATE INDEX idx_form_responses_created_at ON form_responses(created_at);

CREATE INDEX idx_form_responses_form_id ON form_responses(form_id);

CREATE INDEX idx_form_responses_respondent ON form_responses(respondent_id);

CREATE INDEX idx_forms_public ON forms(is_public);

CREATE INDEX idx_forms_user_id ON forms(user_id);

CREATE INDEX idx_forms_workspace_id ON forms(workspace_id);

CREATE INDEX idx_goals_created_at ON goals(created_at);

CREATE INDEX idx_goals_due_date ON goals(due_date);

CREATE INDEX idx_goals_priority ON goals(priority);

CREATE INDEX idx_goals_status ON goals(status);

CREATE INDEX idx_goals_user_id ON goals(user_id);

CREATE INDEX idx_goals_workspace_id ON goals(workspace_id);

CREATE INDEX idx_ideas_created_at ON ideas(created_at);

CREATE INDEX idx_ideas_pinned ON ideas(is_pinned);

CREATE INDEX idx_ideas_trashed ON ideas(is_trashed);

CREATE INDEX idx_ideas_updated_at ON ideas (updated_at);

CREATE INDEX idx_ideas_user_id ON ideas(user_id);

CREATE INDEX idx_ideas_user_trash ON ideas (user_id, is_trashed);

CREATE INDEX idx_ideas_user_updated ON ideas (user_id, updated_at, created_at);

CREATE INDEX idx_ideas_workspace_id ON ideas(workspace_id);

CREATE INDEX idx_join_requests_requester ON join_requests(requester_id, status);

CREATE INDEX idx_join_requests_resource ON join_requests(resource_type, resource_id, status);

CREATE UNIQUE INDEX idx_join_requests_unique ON join_requests(resource_type, resource_id, requester_id);

CREATE INDEX idx_keychain_account ON keychain(account);

CREATE INDEX idx_keychain_user_id ON keychain(user_id);

CREATE INDEX idx_messages_conv ON messages(conversation_id);

CREATE INDEX idx_messages_created ON messages(created_at);

CREATE INDEX idx_messages_sender ON messages(sender_id);

CREATE INDEX idx_notifications_originator ON notifications(originator_id);

CREATE INDEX idx_objects_child ON objects(child_id, child_kind);

CREATE INDEX idx_objects_parent ON objects(parent_id, parent_kind);

CREATE INDEX idx_objects_user_parent ON objects(user_id, parent_id);

CREATE INDEX idx_pat_rate_state_user ON pat_rate_state(user_id);

CREATE INDEX idx_session_token ON session(token);

CREATE INDEX idx_session_token_type ON session(token_type);

CREATE INDEX idx_session_user_id ON session(user_id);

CREATE INDEX idx_source_control_project ON source_control(project_id);

CREATE INDEX idx_totp_user_id ON totp_secrets(user_id);

CREATE INDEX idx_unorganic_emails_recipient ON unorganic_emails(recipient_id, status, sent_at);

CREATE INDEX idx_unorganic_emails_status ON unorganic_emails(status, priority);

CREATE INDEX idx_vault_items_trashed ON vault_items(is_trashed);

CREATE INDEX idx_vault_items_user_id ON vault_items(user_id);

CREATE INDEX idx_vault_items_workspace_id ON vault_items(workspace_id);

CREATE INDEX idx_wo_entity ON workspace_objects(entity_kind, entity_id);

CREATE INDEX idx_wo_user_id ON workspace_objects(user_id);

CREATE INDEX idx_wo_workspace_id ON workspace_objects(workspace_id);

CREATE UNIQUE INDEX idx_workspace_members_pair ON workspace_members(workspace_id, user_id);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

CREATE INDEX idx_workspaces_agentic ON workspaces(is_agentic);

CREATE INDEX idx_workspaces_creator ON workspaces(creator_id);

CREATE INDEX idx_workspaces_invite_code ON workspaces(invite_code);

CREATE INDEX oauthAccessToken_authorizationCodeId_idx ON oauth_access_token(authorization_code_id);

CREATE INDEX oauthAccessToken_clientId_idx ON oauth_access_token(client_id);

CREATE INDEX oauthAccessToken_refreshId_idx ON oauth_access_token(refresh_id);

CREATE INDEX oauthAccessToken_sessionId_idx ON oauth_access_token(session_id);

CREATE INDEX oauthAccessToken_userId_idx ON oauth_access_token(user_id);

CREATE INDEX oauthClientResource_clientId_idx ON oauth_client_resource(client_id);

CREATE UNIQUE INDEX oauthClientResource_clientId_resourceId_uidx ON oauth_client_resource(client_id, resource_id);

CREATE INDEX oauthClientResource_resourceId_idx ON oauth_client_resource(resource_id);

CREATE INDEX oauthClient_userId_idx ON oauth_client(user_id);

CREATE INDEX oauthConsent_clientId_idx ON oauth_consent(client_id);

CREATE INDEX oauthConsent_userId_idx ON oauth_consent(user_id);

CREATE INDEX oauthRefreshToken_authorizationCodeId_idx ON oauth_refresh_token(authorization_code_id);

CREATE INDEX oauthRefreshToken_clientId_idx ON oauth_refresh_token(client_id);

CREATE INDEX oauthRefreshToken_sessionId_idx ON oauth_refresh_token(session_id);

CREATE INDEX oauthRefreshToken_userId_idx ON oauth_refresh_token(user_id);

CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE account_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  attention_balance TEXT DEFAULT '0',
  success_tax_rate TEXT DEFAULT '0',
  reputation_score TEXT DEFAULT '0',
  last_peak_velocity TEXT DEFAULT '0',
  thermal_cache_score TEXT DEFAULT '0',
  updated_at TEXT
);

CREATE TABLE agent_payment_intents (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      agent_id TEXT,
      amount REAL,
      currency TEXT,
      status TEXT,
      metadata TEXT,
      created_at TEXT,
      updated_at TEXT
    , tx_hash TEXT, payload TEXT, chain_id INTEGER, session_id TEXT);

CREATE TABLE agentic_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  context TEXT,
  seen INTEGER DEFAULT 0,
  chat_history TEXT,
  is_memory INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  harness TEXT,
  target_type TEXT,
  target_id TEXT,
  is_workspace INTEGER DEFAULT 0,
  project_id TEXT,
  created_at TEXT,
  updated_at TEXT
, agent_id TEXT, agentic_meta TEXT, session_title TEXT, status TEXT, workspace_id TEXT, metadata TEXT);

CREATE TABLE agentic_telemetry (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  zone TEXT,
  pointers TEXT,
  metadata TEXT,
  timestamp TEXT NOT NULL
, session_id TEXT, niche TEXT, app TEXT, intent TEXT, thread_id TEXT, tokens_used INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0, created_at TEXT);

CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    parent_id TEXT,
    public_key TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT DEFAULT 'idle',
    is_public INTEGER DEFAULT 0,
    is_guest INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  );

CREATE TABLE api_user_rate_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    minute_key TEXT NOT NULL,
    minute_count INTEGER DEFAULT 0,
    hour_key TEXT NOT NULL,
    hour_count INTEGER DEFAULT 0,
    updated_at TEXT
  );

CREATE TABLE apikey (
    id TEXT PRIMARY KEY,
    name TEXT,
    start TEXT,
    prefix TEXT,
    key TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    refill_interval INTEGER,
    refill_amount INTEGER,
    last_refill_at INTEGER,
    enabled INTEGER DEFAULT 1,
    rate_limit_enabled INTEGER DEFAULT 0,
    rate_limit_time_window INTEGER,
    rate_limit_max INTEGER,
    request_count INTEGER DEFAULT 0,
    remaining INTEGER,
    last_request INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT,
    metadata TEXT,
    category TEXT NOT NULL DEFAULT 'user_pat',
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    is_workspace INTEGER DEFAULT 0,
    display_in_sessions INTEGER DEFAULT 0,
    client_name TEXT,
    last_used_at INTEGER
  );

CREATE TABLE billing_transactions (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_usd TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  provider TEXT DEFAULT 'crypto',
  coupon_id TEXT,
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT
, amount REAL, currency TEXT);

CREATE TABLE billing_webhook_logs (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  provider TEXT DEFAULT 'blockbee',
  payload TEXT NOT NULL,
  headers TEXT,
  status TEXT DEFAULT 'processed',
  error_message TEXT,
  metadata TEXT,
  created_at TEXT
);

CREATE TABLE collaborators (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'read',
    inviter_id TEXT,
    status TEXT DEFAULT 'pending',
    invited_at TEXT,
    accepted INTEGER DEFAULT 0,
    expires_at TEXT,
    role TEXT,
    metadata TEXT
  );

CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      target_id TEXT,
      target_type TEXT,
      user_id TEXT,
      content TEXT,
      metadata TEXT,
      is_public INTEGER DEFAULT 0,
      is_guest INTEGER DEFAULT 0,
      is_trash INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    , parent_comment_id TEXT, is_voice INTEGER DEFAULT 0, is_encrypted INTEGER DEFAULT 0, note_id TEXT, resource_id TEXT, resource_type TEXT);

CREATE TABLE compute_balances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    tier TEXT NOT NULL DEFAULT 'free',
    last_reset_at TEXT,
    balance INTEGER DEFAULT 0,
    updated_at TEXT
  );

CREATE TABLE compute_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tokens_consumed INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
, tokens INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);

CREATE TABLE conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member'
, joined_at INTEGER);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'direct',
  name TEXT,
  last_message_id TEXT,
  last_message_at TEXT,
  last_message_text TEXT,
  last_message_sender_id TEXT,
  unread_count TEXT DEFAULT '0',
  participants TEXT,
  admins TEXT,
  description TEXT,
  avatar_url TEXT,
  avatar_file_id TEXT,
  avatar TEXT,
  participant_count INTEGER DEFAULT 1,
  max_participants INTEGER DEFAULT 100,
  is_encrypted INTEGER DEFAULT 0,
  encryption_version TEXT,
  encryption_key TEXT,
  is_pinned TEXT DEFAULT '',
  is_muted TEXT DEFAULT '',
  is_archived TEXT DEFAULT '',
  settings TEXT,
  is_public INTEGER DEFAULT 0,
  invite_link TEXT,
  invite_link_expiry TEXT,
  category TEXT,
  tags TEXT DEFAULT '',
  context_type TEXT,
  context_id TEXT,
  invite_meta TEXT,
  is_workspace INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
, title TEXT, is_deleted INTEGER DEFAULT 0, project_id TEXT, workspace_id TEXT, metadata TEXT);

CREATE TABLE coupons (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  title TEXT,
  note TEXT,
  target_user_id TEXT,
  status TEXT DEFAULT 'active',
  discount_percent INTEGER DEFAULT 0,
  discount_percentage INTEGER DEFAULT 0,
  redemption_limit INTEGER DEFAULT 1,
  redemption_count INTEGER DEFAULT 0,
  seats INTEGER DEFAULT 1,
  expires_at TEXT,
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT
, code TEXT, max_uses INTEGER DEFAULT 100, used_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1);

CREATE TABLE epochs (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    epoch_number INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT
  );

CREATE TABLE event_guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending',
  role TEXT DEFAULT 'attendee',
  is_public INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0
, created_at INTEGER);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  , status TEXT, meeting_url TEXT, visibility TEXT, cover_image_id TEXT, recurrence_rule TEXT, calendar_id TEXT, is_deleted INTEGER DEFAULT 0, is_trash INTEGER DEFAULT 0, attendee_count INTEGER DEFAULT 0, is_pinned TEXT, source TEXT, dek TEXT);

CREATE TABLE external_contexts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client TEXT NOT NULL,
  directory TEXT,
  workspace_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT,
  payload TEXT,
  status TEXT DEFAULT 'connected',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE flow_installs (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  installer_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  grants TEXT,
  status TEXT DEFAULT 'installed',
  pinned_version INTEGER DEFAULT 1,
  auto_update INTEGER DEFAULT 1,
  installed_hash TEXT,
  created_at TEXT,
  updated_at TEXT
, user_id TEXT, installed_at TEXT, config TEXT);

CREATE TABLE flow_reviews (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  session_id TEXT,
  verdict TEXT DEFAULT 'pass',
  tool_tier_max TEXT,
  findings TEXT,
  pii_summary TEXT,
  created_at TEXT,
  updated_at TEXT
, user_id TEXT, rating REAL, review TEXT);

CREATE TABLE follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    status TEXT DEFAULT 'accepted',
    is_close_friend INTEGER DEFAULT 0,
    notifications_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );

CREATE TABLE form_responses (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    respondent_id TEXT REFERENCES user(id) ON DELETE SET NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

CREATE TABLE form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  submitter_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'submitted',
  metadata TEXT,
  is_public INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0,
  source TEXT,
  is_trash INTEGER DEFAULT 0,
  created_at TEXT
, respondent_id TEXT, was_draft INTEGER DEFAULT 0, responses TEXT);

CREATE TABLE forms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    schema_json TEXT NOT NULL,
    is_public INTEGER DEFAULT 1,
    is_closed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  , creator_id TEXT, visibility TEXT, is_pinned INTEGER DEFAULT 0, is_trash INTEGER DEFAULT 0, source TEXT, dek TEXT, is_multiple INTEGER DEFAULT 0, fields TEXT, is_published INTEGER DEFAULT 1, metadata TEXT, status TEXT, settings TEXT);

CREATE TABLE goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date TEXT,
    completed_at TEXT,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  , project_id TEXT);

CREATE TABLE ideas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    summary TEXT,
    is_locked INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_trashed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    category TEXT,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  , project_id TEXT, metadata TEXT, format TEXT, is_public INTEGER DEFAULT 0, is_encrypted INTEGER DEFAULT 0, is_agentic INTEGER DEFAULT 0, dek TEXT, article TEXT, crdt TEXT, attachments TEXT, parent_note_id TEXT, status TEXT);

CREATE TABLE join_requests (
    id TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT,
    resolved_at TEXT,
    resolved_by TEXT
  );

CREATE TABLE jwks (
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    alg TEXT,
    crv TEXT
  );

CREATE TABLE key_mapping (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      key_id TEXT,
      public_key TEXT,
      metadata TEXT,
      created_at TEXT
    , resource_id TEXT, resource_type TEXT, grantee TEXT, wrapped_key TEXT, is_public INTEGER DEFAULT 0, is_guest INTEGER DEFAULT 0, is_shared INTEGER DEFAULT 0, encrypted_key TEXT, key_hash TEXT);

CREATE TABLE keychain (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    account TEXT NOT NULL,
    type TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    nonce TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

CREATE TABLE kylrix_token_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      amount REAL,
      type TEXT,
      reason TEXT,
      metadata TEXT,
      created_at TEXT
    , row_type TEXT, tx_id TEXT, idempotency_key TEXT, event_type TEXT, counterparty_user_id TEXT, amount_micro TEXT, delta_micro TEXT, balance_after_micro TEXT, status TEXT, source_type TEXT, source_id TEXT, genesis_at TEXT, contract_version TEXT, max_supply_micro TEXT, total_minted_micro TEXT, total_burned_micro TEXT, circulating_micro TEXT, root_balance_micro TEXT, risk_level TEXT, last_activity_at TEXT, last_spike_at TEXT, updated_at TEXT, balance REAL DEFAULT 0, delta REAL DEFAULT 0);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT DEFAULT '',
  attachments TEXT,
  reply_to TEXT,
  read_by TEXT,
  is_pinned INTEGER DEFAULT 0,
  is_voice INTEGER DEFAULT 0,
  metadata TEXT,
  is_bookmark INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    originator_id TEXT NOT NULL,
    targets TEXT NOT NULL,
    target_pointer TEXT,
    type TEXT DEFAULT 'direct',
    metadata TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT
  );

CREATE TABLE oauth_access_token (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE,
    client_id TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    session_id TEXT REFERENCES session(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
    reference_id TEXT,
    authorization_code_id TEXT,
    resources TEXT,
    requested_user_info_claims TEXT,
    refresh_id TEXT REFERENCES oauth_refresh_token(id) ON DELETE CASCADE,
    expires_at INTEGER,
    created_at INTEGER,
    revoked INTEGER,
    confirmation TEXT,
    scopes TEXT NOT NULL
  );

CREATE TABLE oauth_client (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT,
    client_discovery_id TEXT,
    disabled INTEGER DEFAULT 0,
    skip_consent INTEGER,
    enable_end_session INTEGER,
    subject_type TEXT,
    scopes TEXT,
    client_credentials_scopes TEXT DEFAULT '[]',
    user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
    created_at INTEGER,
    updated_at INTEGER,
    name TEXT,
    uri TEXT,
    icon TEXT,
    contacts TEXT,
    tos TEXT,
    policy TEXT,
    software_id TEXT,
    software_version TEXT,
    software_statement TEXT,
    redirect_uris TEXT NOT NULL,
    post_logout_redirect_uris TEXT,
    backchannel_logout_uri TEXT,
    backchannel_logout_session_required INTEGER,
    token_endpoint_auth_method TEXT,
    application_type TEXT,
    jwks TEXT,
    jwks_uri TEXT,
    grant_types TEXT,
    response_types TEXT,
    require_pkce INTEGER,
    dpop_bound_access_tokens INTEGER DEFAULT 0,
    reference_id TEXT,
    metadata TEXT
  );

CREATE TABLE oauth_client_assertion (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );

CREATE TABLE oauth_client_resource (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL REFERENCES oauth_resource(identifier) ON DELETE CASCADE,
    metadata TEXT,
    created_at INTEGER
  );

CREATE TABLE oauth_consent (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
    reference_id TEXT,
    resources TEXT,
    requested_user_info_claims TEXT,
    scopes TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  , consent_given INTEGER DEFAULT 1, redirect_uri TEXT, requested_scopes TEXT, state TEXT, nonce TEXT, response_type TEXT, status TEXT, request_meta TEXT, expires_at TEXT);

CREATE TABLE oauth_refresh_token (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    session_id TEXT REFERENCES session(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    reference_id TEXT,
    authorization_code_id TEXT,
    resources TEXT,
    requested_user_info_claims TEXT,
    expires_at INTEGER,
    created_at INTEGER,
    revoked INTEGER,
    rotated_at INTEGER,
    rotation_replay_response TEXT,
    rotation_replay_expires_at INTEGER,
    auth_time INTEGER,
    confirmation TEXT,
    scopes TEXT NOT NULL
  );

CREATE TABLE oauth_resource (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    access_token_ttl INTEGER,
    refresh_token_ttl INTEGER,
    signing_algorithm TEXT,
    signing_key_id TEXT,
    allowed_scopes TEXT,
    custom_claims TEXT,
    dpop_bound_access_tokens_required INTEGER DEFAULT 0,
    disabled INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    policy_version INTEGER DEFAULT 1,
    metadata TEXT
  );

CREATE TABLE objects (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    parent_kind TEXT NOT NULL,
    child_id TEXT NOT NULL,
    child_kind TEXT NOT NULL,
    metadata TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    is_public INTEGER DEFAULT 0,
    is_guest INTEGER DEFAULT 0,
    is_general INTEGER DEFAULT 0
  );

CREATE TABLE pat_rate_state (
    id TEXT PRIMARY KEY,
    pat_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    minute_key TEXT NOT NULL,
    minute_count INTEGER DEFAULT 0,
    hour_key TEXT NOT NULL,
    hour_count INTEGER DEFAULT 0,
    updated_at TEXT
  );

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar TEXT,
  wallet_address TEXT,
  public_key TEXT,
  status TEXT DEFAULT 'active',
  preferences TEXT,
  is_public INTEGER DEFAULT 1,
  is_guest INTEGER DEFAULT 0,
  is_avatar INTEGER DEFAULT 0,
  is_contact INTEGER DEFAULT 0,
  is_online_visible INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
, avatar_url TEXT, banner_url TEXT, website TEXT, social_links TEXT, metadata TEXT);

CREATE TABLE reactions (
      id TEXT PRIMARY KEY,
      target_id TEXT,
      target_type TEXT,
      user_id TEXT,
      reaction TEXT,
      metadata TEXT,
      created_at TEXT
    , emoji TEXT, resource_id TEXT, resource_type TEXT);

CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  referrer_id TEXT NOT NULL,
  ref_code TEXT,
  src TEXT,
  origin TEXT,
  status TEXT DEFAULT 'completed',
  tokens_rewarded INTEGER DEFAULT 0,
  created_at TEXT
, referred_id TEXT, invited_user_id TEXT, referral_token TEXT, code TEXT, reward_claimed INTEGER DEFAULT 0);

CREATE TABLE resource_tags (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  user_id TEXT,
  metadata TEXT,
  is_public INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE session (
    id TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    token_type TEXT NOT NULL DEFAULT 'web',
    client_name TEXT DEFAULT 'Web Browser',
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    scopes TEXT,
    last_active_at INTEGER
  );

CREATE TABLE session_objects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  object_type TEXT NOT NULL
, entity_kind TEXT, title TEXT, tool_key TEXT, created_at TEXT, entity_id TEXT);

CREATE TABLE source_control (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    repo_name TEXT,
    owner_name TEXT,
    access_token TEXT,
    enabled INTEGER DEFAULT 1,
    metadata TEXT,
    created_at TEXT,
    updated_at TEXT
  );

CREATE TABLE sponsorships (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  sponsor_name TEXT,
  sponsor_url TEXT,
  sponsor_email TEXT,
  sponsor_message TEXT,
  amount TEXT NOT NULL DEFAULT '0',
  currency TEXT DEFAULT 'USD',
  provider TEXT DEFAULT 'crypto',
  tier TEXT NOT NULL DEFAULT 'supporter',
  status TEXT DEFAULT 'completed',
  tx_hash TEXT,
  is_public INTEGER DEFAULT 1,
  is_anonymous INTEGER DEFAULT 0,
  badge_award INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT
);

CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      tier TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      referral_code TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    , current_period_end INTEGER, plan TEXT, seats INTEGER DEFAULT 1, current_period_start TEXT);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  user_id TEXT,
  metadata TEXT,
  is_public INTEGER DEFAULT 0,
  is_guest INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  is_trash INTEGER DEFAULT 0,
  created_at TEXT
, tag TEXT, color TEXT);

CREATE TABLE telegram_connections (
  id TEXT PRIMARY KEY,
  pair_code TEXT,
  tg_chat_id TEXT,
  tg_username TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
, user_id TEXT, telegram_user_id TEXT, username TEXT);

CREATE TABLE token_registry (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      mint_address TEXT,
      balance TEXT DEFAULT '0',
      ledger TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  tool_key TEXT NOT NULL,
  specifier TEXT,
  args TEXT,
  status TEXT DEFAULT 'success',
  result_summary TEXT,
  created_at TEXT
, tool_name TEXT, arguments TEXT, result TEXT);

CREATE TABLE totp_secrets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    account TEXT NOT NULL,
    encrypted_secret TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );

CREATE TABLE two_factor (
      id TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      backup_codes TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      verified INTEGER DEFAULT 1,
      failed_verification_count INTEGER DEFAULT 0,
      locked_until INTEGER
    );

CREATE TABLE unorganic_emails (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source_app TEXT NOT NULL,
    actor_id TEXT,
    recipient_id TEXT,
    recipient_email TEXT,
    resource_type TEXT,
    resource_id TEXT,
    template_key TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    dedupe_key TEXT NOT NULL UNIQUE,
    attempts INTEGER DEFAULT 0,
    sent_at TEXT,
    expires_at TEXT,
    processed_at TEXT,
    blocked_reason TEXT,
    metadata TEXT
  );

CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
, tier1_synced INTEGER DEFAULT 0, tier2_synced INTEGER DEFAULT 0, appwrite_synced_at TEXT, has_appwrite_account INTEGER DEFAULT NULL, appwrite_account_id TEXT DEFAULT NULL, appwrite_fully_synced INTEGER DEFAULT 0, appwrite_password_synced INTEGER DEFAULT 0, username TEXT, display_username TEXT, two_factor_enabled INTEGER DEFAULT 0, is_contributor INTEGER DEFAULT 0, contributor_last_checked_at TEXT, contributor_pr_count INTEGER DEFAULT 0, masterpass INTEGER DEFAULT 0, twofa TEXT, twofa_secret TEXT, backup_codes TEXT, is_passkey INTEGER DEFAULT 0, session_fingerprint TEXT, last_login_at TEXT, last_password_change_at TEXT, passkey_reminder_at TEXT, display_name TEXT, labels TEXT, prefs TEXT);

CREATE TABLE user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  badge_type TEXT,
  tier TEXT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_public INTEGER DEFAULT 1,
  awarded_at TEXT,
  sponsorship_id TEXT,
  metadata TEXT
, badge_name TEXT);

CREATE TABLE user_resource_pins (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      resource_id TEXT,
      resource_type TEXT,
      created_at TEXT
    , pinned_at TEXT);

CREATE TABLE user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
      preferences TEXT,
      security_flags TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    , theme TEXT, currency TEXT, language TEXT, auto_lock INTEGER DEFAULT 0, clipboard_timeout INTEGER DEFAULT 30, metadata TEXT, locale TEXT, notifications TEXT, security_preferences TEXT);

CREATE TABLE vault_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    iv TEXT,
    metadata TEXT,
    is_trashed INTEGER DEFAULT 0,
    is_workspace INTEGER DEFAULT 0,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);

CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'evm',
  encrypted_secret TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'embedded',
  metadata TEXT,
  created_at TEXT,
  updated_at TEXT
, is_primary INTEGER DEFAULT 0, user_id TEXT);

CREATE TABLE web3_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chain TEXT NOT NULL,
  hash TEXT NOT NULL,
  from_addr TEXT,
  to_addr TEXT,
  value TEXT NOT NULL DEFAULT '0',
  symbol TEXT NOT NULL DEFAULT 'ETH',
  timestamp INTEGER NOT NULL
);

CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  niche TEXT NOT NULL DEFAULT 'general',
  is_public INTEGER DEFAULT 0,
  is_anonymized INTEGER DEFAULT 0,
  steps TEXT NOT NULL DEFAULT '[]',
  metadata TEXT,
  is_guest INTEGER DEFAULT 0,
  owner_id TEXT,
  install_count INTEGER DEFAULT 0,
  flow_kind TEXT DEFAULT 'automation',
  tool_tier_max TEXT,
  review_status TEXT DEFAULT 'approved',
  publisher_handle TEXT,
  verified_kind TEXT,
  version INTEGER DEFAULT 1,
  content_hash TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL
  );

CREATE TABLE workspace_objects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_kind TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  , role TEXT, is_public INTEGER DEFAULT 0, is_guest INTEGER DEFAULT 0, is_general INTEGER DEFAULT 0, updated_at TEXT);

CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    slug TEXT,
    invite_code TEXT,
    is_public INTEGER DEFAULT 0,
    is_agentic INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    privacy_mode INTEGER DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  , title TEXT, owner_id TEXT, summary TEXT, status TEXT, visibility TEXT, parent_project_id TEXT, kind TEXT, dek TEXT);
